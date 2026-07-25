import axios from "axios";
import { getModel } from "../Config/llmModel.js";
import { sanitizeLog } from "../utils/sanitizer.js";
import { deductCredits } from "../utils/deductCredits.js";

function isNonRetryableError(error) {
  if (error?.isConfigError) return true;
  const status = error?.response?.status || error?.status;
  if (status === 401 || status === 403) return true;

  const dataStr = JSON.stringify(error?.response?.data || "").toLowerCase();
  const msgStr = String(error?.message || "").toLowerCase();
  const full = `${dataStr} ${msgStr}`;

  const nonRetryableKeywords = [
    "insufficient_quota",
    "resource_exhausted",
    "quota exceeded",
    "daily limit",
    "per-minute quota",
    "billing",
    "invalid_api_key",
    "api_key_invalid",
    "rate limit reached",
    "configuration error",
    "unsupported image_generation_provider",
  ];

  return nonRetryableKeywords.some((kw) => full.includes(kw));
}

function extractRetryAfter(error) {
  const h = error?.response?.headers;
  const headerVal = h ? (h["retry-after"] || h["Retry-After"]) : null;

  if (headerVal) {
    const numeric = parseInt(headerVal, 10);
    if (!isNaN(numeric) && numeric > 0) return numeric;

    const dateMs = Date.parse(headerVal);
    if (!isNaN(dateMs)) {
      const diffSec = Math.ceil((dateMs - Date.now()) / 1000);
      if (diffSec > 0) return diffSec;
    }
  }

  const dataStr = JSON.stringify(error?.response?.data || "");
  const match = dataStr.match(/retry in\s+([\d.]+)\s*s/i);
  if (match && match[1]) {
    const sec = Math.ceil(parseFloat(match[1]));
    if (!isNaN(sec) && sec > 0) return sec;
  }

  return null;
}

async function executeWithRetry(fn, options = {}) {
  const maxRetries = 2; // Initial request + maximum 2 retries (total 3 attempts)
  const timeoutMs = options.timeoutMs || 30000;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const result = await fn(controller.signal);
      clearTimeout(timeoutId);
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error;

      const status = error?.response?.status || error?.status || 500;
      const retryAfterSec = extractRetryAfter(error);

      console.error(`[VisionAgent] External API call failed (Attempt ${attempt + 1}/${maxRetries + 1}):`, {
        status,
        data: sanitizeLog(error?.response?.data),
        headers: sanitizeLog(error?.response?.headers),
        retryAfter: retryAfterSec,
        message: sanitizeLog(error?.message),
      });

      const isTemporary = status === 429 || (status >= 500 && status <= 599);

      if (attempt === maxRetries || isNonRetryableError(error) || !isTemporary) {
        break;
      }

      const backoffMs = retryAfterSec
        ? retryAfterSec * 1000
        : Math.pow(2, attempt) * 1000;

      console.log(`[VisionAgent] Retrying request in ${backoffMs}ms...`);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }

  const status = lastError?.response?.status || lastError?.status || (lastError?.isConfigError ? 400 : 500);
  const retryAfter = extractRetryAfter(lastError);

  const formattedErr = new Error(
    status === 429
      ? "Image generation provider rate limit reached."
      : lastError?.message || "Vision agent execution failed."
  );
  formattedErr.status = status;
  formattedErr.code = status === 429 ? "RATE_LIMITED" : (lastError?.code || "PROVIDER_ERROR");
  formattedErr.retryAfter = retryAfter;
  formattedErr.missingVar = lastError?.missingVar;
  formattedErr.isConfigError = Boolean(lastError?.isConfigError);
  formattedErr.response = lastError?.response;
  formattedErr.details = sanitizeLog(lastError?.response?.data || lastError?.details || lastError?.message);

  throw formattedErr;
}

export const visionAgent = async (state) => {
  const images = Array.isArray(state.uploadedImages)
    ? state.uploadedImages.filter((img) => img?.base64 || img?.url)
    : [];

  const hasFileImage = Boolean(state.file?.mimetype?.startsWith("image/"));
  const promptText = String(state.prompt || "").trim();

  const isAnalysis = images.length > 0 || hasFileImage;
  const isGeneration = !isAnalysis;

  const operation = isAnalysis ? "image_analysis" : "image_generation";

  const effectiveProvider = isAnalysis
    ? (process.env.VISION_ANALYSIS_PROVIDER || "gemini")
    : (process.env.IMAGE_GENERATION_PROVIDER || "gemini");

  const effectiveModel = isAnalysis
    ? (process.env.VISION_ANALYSIS_MODEL || "gemini-2.5-flash")
    : (process.env.IMAGE_GENERATION_MODEL || "gemini-2.5-flash-image");

  const requestedModel = state.selectedModel || "groq";

  if (process.env.NODE_ENV !== "production") {
    console.log("[VisionAgent Debug]", {
      operation,
      requestedModel,
      effectiveProvider,
      effectiveModel,
    });
  }

  // ── IMAGE ANALYSIS ──
  if (isAnalysis) {
    const analysisProvider = process.env.VISION_ANALYSIS_PROVIDER || "gemini";

    if (analysisProvider === "gemini" && !process.env.GOOGLE_API_KEY) {
      const err = new Error("Configuration error: Missing environment variable GOOGLE_API_KEY for vision analysis.");
      err.isConfigError = true;
      err.missingVar = "GOOGLE_API_KEY";
      err.status = 400;
      err.code = "CONFIG_ERROR";
      throw err;
    }

    try {
      const resultText = await executeWithRetry(async (signal) => {
        const model = await getModel("vision", state.selectedModel);
        if (!model) {
          const err = new Error("Configuration error: Vision model not configured.");
          err.isConfigError = true;
          err.status = 400;
          err.code = "CONFIG_ERROR";
          throw err;
        }

        const imageDescriptions = images.map((img) => `Image: ${img.name || "uploaded image"}`).join(", ");
        const prompt = `You are Automic AI Vision Agent.\n\nUser question:\n${promptText}\n\nUploaded images: ${imageDescriptions}\n\nDescribe what you see in the uploaded image(s) and answer the user's question clearly.`;

        const content = [
          { type: "text", text: prompt },
          ...images.map((img) => ({
            type: "image_url",
            image_url: {
              url: (img.base64 || img.url).startsWith("data:") || (img.base64 || img.url).startsWith("http")
                ? (img.base64 || img.url)
                : `data:${img.type || "image/jpeg"};base64,${img.base64}`,
            },
          })),
        ];

        const response = await model.invoke([{ role: "user", content }], { signal });
        await deductCredits(state.userId, "vision");
        return response?.content || "I analyzed the image but could not generate a detailed response.";
      });

      return {
        ...state,
        agent: "vision",
        responseType: "text",
        aiResponse: resultText,
      };
    } catch (error) {
      throw error;
    }
  }

  // ── IMAGE GENERATION ──
  if (isGeneration) {
    const genProvider = process.env.IMAGE_GENERATION_PROVIDER || "gemini";
    const genModel = process.env.IMAGE_GENERATION_MODEL || "gemini-2.5-flash-image";
    const googleApiKey = process.env.GOOGLE_API_KEY;

    if (genProvider !== "gemini") {
      const err = new Error(`Configuration error: Unsupported IMAGE_GENERATION_PROVIDER "${genProvider}"`);
      err.isConfigError = true;
      err.status = 400;
      err.code = "CONFIG_ERROR";
      throw err;
    }

    const allowPublicFallback =
      process.env.NODE_ENV !== "production" &&
      process.env.ALLOW_PUBLIC_IMAGE_FALLBACK === "true";

    if (!googleApiKey && !allowPublicFallback) {
      const err = new Error("Configuration error: Missing environment variable GOOGLE_API_KEY for image generation.");
      err.isConfigError = true;
      err.missingVar = "GOOGLE_API_KEY";
      err.status = 400;
      err.code = "CONFIG_ERROR";
      throw err;
    }

    try {
      const imageResult = await executeWithRetry(async (signal) => {
        if (googleApiKey) {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${genModel}:generateContent?key=${googleApiKey}`;
          const body = {
            contents: [{ parts: [{ text: `Generate an image based on this prompt: ${promptText}` }] }]
          };
          const res = await axios.post(url, body, { signal, timeout: 30000 });
          const candidates = res.data?.candidates;
          if (!candidates || candidates.length === 0) {
            const err = new Error("Gemini image generation completed but returned no candidates.");
            err.status = 502;
            err.code = "INVALID_PROVIDER_RESPONSE";
            throw err;
          }

          const parts = candidates[0]?.content?.parts || [];
          const imagePart = parts.find((p) => p.inlineData || p.imageData || p.text?.includes("data:image"));

          if (!imagePart?.inlineData?.data) {
            const err = new Error("Gemini image generation completed but no image data was returned.");
            err.status = 502;
            err.code = "INVALID_PROVIDER_RESPONSE";
            throw err;
          }

          const mime = imagePart.inlineData.mimeType || "image/png";
          const base64Data = `data:${mime};base64,${imagePart.inlineData.data}`;
          return { imageUrl: base64Data };
        }

        if (allowPublicFallback) {
          console.log("[VisionAgent] Using development public fallback after provider failure");
          const publicUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(promptText)}?width=1024&height=1024&nologo=true`;
          return { imageUrl: publicUrl, isPublic: true };
        }

        const noKeyErr = new Error("Configuration error: Missing environment variable GOOGLE_API_KEY for image generation.");
        noKeyErr.isConfigError = true;
        noKeyErr.missingVar = "GOOGLE_API_KEY";
        noKeyErr.status = 400;
        noKeyErr.code = "CONFIG_ERROR";
        throw noKeyErr;
      });

      await deductCredits(state.userId, "vision");
      const responseMarkdown = `Here is the generated image for: **"${promptText}"**\n\n![Generated Image](${imageResult.imageUrl})`;

      return {
        ...state,
        agent: "vision",
        responseType: "image",
        imageUrl: imageResult.imageUrl,
        aiResponse: responseMarkdown,
        images: [{ url: imageResult.imageUrl, imageUrl: imageResult.imageUrl, name: "generated_image.png" }],
      };
    } catch (error) {
      if (allowPublicFallback && !error.isConfigError) {
        console.log("[VisionAgent] Using development public fallback after provider failure");
        const publicUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(promptText)}?width=1024&height=1024&nologo=true`;
        return {
          ...state,
          agent: "vision",
          responseType: "image",
          imageUrl: publicUrl,
          aiResponse: `Here is the generated image for: **"${promptText}"**\n\n![Generated Image](${publicUrl})`,
          images: [{ url: publicUrl, imageUrl: publicUrl, name: "generated_image.png" }],
        };
      }

      throw error;
    }
  }
};
