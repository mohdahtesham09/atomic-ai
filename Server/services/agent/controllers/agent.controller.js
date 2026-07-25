import axios from 'axios';
import graph from '../graph/graph.js';
import { addMessage, getMemory, processUserMemory, getUserMemory } from '../Config/memory.js';
import {
  checkUsageBeforeRequest,
  recordUsageAfterResponse,
  getUsagePayload,
} from '../utils/usage.js';
import { sanitizeLog } from '../utils/sanitizer.js';



const inFlightRequests = new Map();

const resolveUserCountry = (req) =>
  req.user?.country ||
  req.user?.location ||
  req.headers["x-user-country"] ||
  "India";

const resolveCurrencyPreference = (req) => {
  const userCountry = resolveUserCountry(req);
  const email = String(req.user?.email || "").toLowerCase();
  const locale = String(req.user?.locale || req.headers["x-user-locale"] || "").toLowerCase();

  if (
    String(userCountry).toLowerCase().includes("india") ||
    locale.includes("in") ||
    email.endsWith(".in")
  ) {
    return "INR";
  }

  return "USD";
};

const resolveUserId = (req, bodyUserId) =>
  req.user?._id ||
  req.user?.id ||
  req.user?.firebaseUid ||
  req.headers["x-user-id"] ||
  bodyUserId ||
  null;

const resolveAgent = (selectedAgent, agentType) => {
  const value = String(selectedAgent || agentType || "auto").toLowerCase();
  const aliases = {
    general: "chat",
    default: "chat",
    web: "search",
    document: "pdf",
    presentation: "ppt",
    image: "vision",
  };
  return aliases[value] || value;
};

const handleControllerError = (res, error) => {

 
  if (res.headersSent) {
    console.warn("[AgentController] Headers already sent, suppressing extra error response.");
    return;
  }

  console.error("[AgentController] Error:", sanitizeLog(error?.message || error));

  const status = error?.status || error?.response?.status || (error?.isConfigError ? 400 : 500);
  const is429 = status === 429 || String(error?.message || "").includes("429") || String(error?.message || "").includes("Quota");

  if (is429) {
    const retryAfter = error?.retryAfter || error?.response?.headers?.["retry-after"] || error?.response?.headers?.["Retry-After"];
    const resetReq = error?.response?.headers?.["x-ratelimit-reset-requests"];
    const resetTokens = error?.response?.headers?.["x-ratelimit-reset-tokens"];

    if (retryAfter) res.set("retry-after", String(retryAfter));
    if (resetReq) res.set("x-ratelimit-reset-requests", String(resetReq));
    if (resetTokens) res.set("x-ratelimit-reset-tokens", String(resetTokens));

    return res.status(429).json({
      success: false,
      message: error?.message || "Too Many Requests",
      error: error?.message || "Too Many Requests",
      retryAfter: retryAfter || null,
      details: sanitizeLog(error?.response?.data || error?.details || error?.message),
    });
  }

  if (error?.isConfigError || status === 400) {
    return res.status(400).json({
      success: false,
      message: error?.message || "Configuration Error",
      error: error?.message || "Configuration Error",
      missingVar: error?.missingVar,
    });
  }

  return res.status(status).json({
    success: false,
    message: error?.message || "Agent error",
    error: error?.message || "Agent error",
  });
};

export const agent = async (req, res) => {
    try {

        const { prompt, conversationId, userId, selectedAgent, agentType, selectedModel, files = [], images = [] } = req.body
        const file = req.file
        const resolvedAgent = resolveAgent(selectedAgent, agentType);
        const resolvedUserId = resolveUserId(req, userId);
        const currencyPreference = resolveCurrencyPreference(req);

        if (resolvedUserId) await processUserMemory(resolvedUserId, prompt);

        await axios.post(`${process.env.CHAT_SERVICE}/save-message`, {
            conversationId, role:"user", content:prompt
        }).catch(() => {});

        const conversationMemory = await getMemory(conversationId);
        const userMemory = await getUserMemory(resolvedUserId);

        const usageCheck = await checkUsageBeforeRequest({
          userId: resolvedUserId,
          prompt,
          conversationMemory,
          userMemory,
        });

        if (!usageCheck.allowed) {
          return res.status(usageCheck.status).json(usageCheck.body);
        }

        const modelToPass = resolvedAgent === "vision" ? (selectedModel || "flash") : (selectedModel || "groq");

        const result = await graph.invoke({
            prompt,
            conversationId,
            file,
            agent,
            userId: resolvedUserId,
            conversationMemory,
            userMemory,
            selectedAgent: resolvedAgent,
            selectedModel: modelToPass,
            currencyPreference,
            uploadedFiles: files,
            uploadedImages: images,
        });

        const updatedUsage = await recordUsageAfterResponse(
          usageCheck.usage,
          result,
          usageCheck.estimatedInputTokens || 0
        );

        const response = result.aiResponse;
        const responseText = typeof response === "string"
          ? response
          : response?.aiResponse || response?.content || response?.message || "";

        await addMessage(conversationId, "user", prompt);
        await addMessage(conversationId, "assistant", responseText);
        await axios.post(`${process.env.CHAT_SERVICE}/save-message`, {
            conversationId, role:"assistant", content:responseText, images:result.images, artifacts:result.artifacts
        }).catch(() => {});

        return res.status(200).json({
          success: true,
          response: responseText,
          aiResponse: responseText,
          answer: responseText,
          agent: result?.agent || resolvedAgent,
          sources: result?.sources || [],
          images: result?.images || [],
          artifacts: Array.isArray(result?.artifacts) ? result.artifacts : [],
          usage: updatedUsage ? getUsagePayload(updatedUsage) : undefined,
        });
    } catch (error) {
        return handleControllerError(res, error);
    }
};

export const generateResponse = async (req, res) => {
    const {
      prompt,
      conversationId,
      userId,
      selectedAgent,
      agentType,
      selectedModel,
      artifactFile,
      files = [],
      images = [],
    } = req.body;

    const resolvedAgent = resolveAgent(selectedAgent, agentType);

    console.log("[PDF Agent Service]", {
      bodyKeys: Object.keys(req.body || {}),
      hasFile: Boolean(req.file || artifactFile),
      fileName: (req.file || artifactFile)?.originalname || (req.file || artifactFile)?.name,
      fileSize: (req.file || artifactFile)?.size,
    });

    if (!prompt || !prompt.trim()) {
        return res.status(400).json({
            success: false,
            message: "Prompt is required",
        });
    }

    const resolvedUserId = resolveUserId(req, userId);
    const dedupeKey = `${conversationId || resolvedUserId || 'anon'}:${resolvedAgent}:${String(prompt || '').trim()}`;

    if (inFlightRequests.has(dedupeKey)) {
      console.log("[agent.controller] Deduplicated in-flight request:", dedupeKey);
      try {
        const result = await inFlightRequests.get(dedupeKey);
        return res.status(200).json(result);
      } catch (err) {
        return handleControllerError(res, err);
      }
    }

    const requestPromise = (async () => {
      const currencyPreference = resolveCurrencyPreference(req);

      await addMessage(conversationId, "user", prompt);
      if (resolvedUserId) await processUserMemory(resolvedUserId, prompt);

      const conversationMemory = await getMemory(conversationId);
      const userMemory = await getUserMemory(resolvedUserId);

      const usageCheck = await checkUsageBeforeRequest({
        userId: resolvedUserId,
        prompt,
        conversationMemory,
        userMemory,
      });

      if (!usageCheck.allowed) {
        const err = new Error("Usage limit exceeded");
        err.status = usageCheck.status;
        err.body = usageCheck.body;
        throw err;
      }

      const modelToPass = resolvedAgent === "vision" ? (selectedModel || "flash") : (selectedModel || "groq");

      const result = await graph.invoke({
          prompt,
          conversationId,
          userId: resolvedUserId,
          conversationMemory,
          userMemory,
          selectedAgent: resolvedAgent,
          selectedModel: modelToPass,
          currencyPreference,
          artifactFile: artifactFile || null,
          uploadedFiles: files,
          uploadedImages: images,
      });

      const updatedUsage = await recordUsageAfterResponse(
        usageCheck.usage,
        result,
        usageCheck.estimatedInputTokens || 0
      );

      const responseText = result?.aiResponse || "No response received from selected agent.";
      const finalAgent = result?.agent || resolvedAgent;
      const finalSources = result?.sources || [];
      const finalImages = result?.images || [];
      const finalArtifacts = result?.artifacts || [];

      await addMessage(conversationId, "assistant", responseText);

      const finalResponseType = result?.responseType || (finalImages.length > 0 ? "image" : "text");
      const finalImageUrl = result?.imageUrl || finalImages[0]?.url || finalImages[0]?.imageUrl || null;

      return {
          success: true,
          response: responseText,
          aiResponse: responseText,
          answer: responseText,
          responseType: finalResponseType,
          imageUrl: finalImageUrl,
          agent: finalAgent,
          sources: finalSources,
          images: finalImages,
          artifacts: finalArtifacts,
          usage: updatedUsage ? getUsagePayload(updatedUsage) : undefined,
      };
    })();

    // Attach silent error handler to background promise to prevent unhandledRejection
    requestPromise.catch(() => {});
    inFlightRequests.set(dedupeKey, requestPromise);

    try {
      const responseData = await requestPromise;
      return res.status(200).json(responseData);
    } catch (error) {
      if (error.body && error.status) {
        return res.status(error.status).json(error.body);
      }
      return handleControllerError(res, error);
    } finally {
      inFlightRequests.delete(dedupeKey);
    }
};
