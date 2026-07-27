import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/apiError.js";
import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import axios from "axios";
import fs from "fs";
import path from "path";
import os from "os";
import { generateBasicChatResponse } from "../service/basicChat.service.js";

const normalizeAgent = (agent) => {
  const value = String(agent || "chat").toLowerCase();
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

const isBasicChatAgent = (agent) =>
  ["chat", "general", "default"].includes(agent);

export const createConversation = asyncHandler(async (req, res) => {
  const userId =
    req.user?._id ||
    req.user?.id ||
    req.headers["x-user-id"];

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "User not authenticated. userId missing.",
    });
  }

  const { title } = req.body || {};

  const conversation = await Conversation.create({
    userId: String(userId),
    title: title || "New Chat",
  });

  return res.status(201).json({
    success: true,
    message: "Conversation created successfully",
    conversation,
    data: conversation,
  });
});

export const getConversations = async (req, res) => {
  try {
    const userId =
      req.user?._id ||
      req.user?.id ||
      req.headers["x-user-id"];

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated. userId missing.",
      });
    }

    const conversations = await Conversation.find({ userId: String(userId) })
      .sort({ updatedAt: -1 })
      .lean();

    if (process.env.NODE_ENV !== "production") {
      console.log(`[ChatService] getConversations: found ${conversations.length} conversations for user ${userId}`);
    }

    return res.status(200).json({
      success: true,
      message: "Conversations fetched successfully",
      conversations,
      data: conversations,
    });
  } catch (error) {
    console.error("Error in getConversations:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch conversations",
      error: error.message,
    });
  }
};

export const updateConversation = asyncHandler(async (req, res) => {
  const userId =
    req.user?._id ||
    req.user?.id ||
    req.user?.firebaseUid ||
    req.headers["x-user-id"];

  const { conversationId } = req.params;
  const { title } = req.body;

  if (!userId) {
    return res.status(401).json({ success: false, message: "User not authenticated. userId missing." });
  }

  if (!conversationId) {
    throw new ApiError(400, "Conversation id is required");
  }

  if (!title) {
    throw new ApiError(400, "Conversation title is required");
  }

  const conversation = await Conversation.findOneAndUpdate(
    { _id: conversationId, userId: String(userId) },
    { title },
    { new: true, runValidators: true }
  );

  if (!conversation) {
    throw new ApiError(404, "Conversation not found or unauthorized");
  }

  return res.status(200).json({
    success: true,
    message: "Conversation updated successfully",
    data: conversation,
  });
});

export const deleteConversation = asyncHandler(async (req, res) => {
  const userId =
    req.user?._id ||
    req.user?.id ||
    req.user?.firebaseUid ||
    req.headers["x-user-id"];

  const { conversationId } = req.params;

  if (!userId) {
    return res.status(401).json({ success: false, message: "User not authenticated. userId missing." });
  }

  if (!conversationId) {
    throw new ApiError(400, "Conversation id is required");
  }

  const conversation = await Conversation.findOneAndDelete({ _id: conversationId, userId: String(userId) });

  if (!conversation) {
    throw new ApiError(404, "Conversation not found or unauthorized");
  }

  return res.status(200).json({
    success: true,
    message: "Conversation deleted successfully",
    data: conversation,
  });
});

export const saveMessage = asyncHandler(async (req, res) => {
    const {conversationId, role, content, images, artifacts} = req.body

    if (!conversationId) {
      throw new ApiError(400, "Conversation id is required");
    }

    if (!role) {
      throw new ApiError(400, "Role is required");
    }

    if (!content) {
      throw new ApiError(400, "Message content is required");
    }

    // userId is optional in saveMessage (called internally by agent service)
    const userId = req.headers["x-user-id"] || req.body.userId || "system";

    const message = await Message.create({
      conversationId,
      content,
      role,
      userId,
      images,
      artifacts
    });

    return res.status(200).json({
      success: true,
      message: "Message saved successfully",
      data: message,
    });
})


export const getMessages = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;

  if (!conversationId) {
    throw new ApiError(400, "Conversation id is required");
  }

  const messages = await Message.find({
    conversationId,
  }).sort({ createdAt: 1 });

  return res.status(200).json({
    success: true,
    message: "Messages fetched successfully",
    data: messages,
  });
});

export const generateAgentResponse = async (message, history = []) => {
  try {
    if (!process.env.GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY is missing in chat service .env");
    }

    if (!message || !message.trim()) {
      throw new Error("User message is empty");
    }

    // Lazy initialization to prevent ES Module import hoisting crashes
    const groqModel = new ChatGroq({
      apiKey: process.env.GROQ_API_KEY,
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
    });

    const response = await groqModel.invoke([
      {
        role: "system",
        content:
          "You are Atomic AI, a helpful AI assistant. Use previous conversation context when useful. Give clear and practical answers.",
      },
      ...history,
      {
        role: "user",
        content: message,
      },
    ]);

    const content =
      response?.content ||
      response?.text ||
      response?.message?.content ||
      "";

    if (!content) {
      console.log("Raw Groq response:", response);
      throw new Error("Groq response content missing");
    }

    return content;
  } catch (error) {
    console.error("generateAgentResponse failed:", error);
    throw error;
  }
};

export const getConversationById = async (req, res) => {
  try {
    const userId =
      req.user?._id ||
      req.user?.id ||
      req.user?.firebaseUid ||
      req.headers["x-user-id"];

    const { conversationId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated. userId missing.",
      });
    }

    const conversation = await Conversation.findOne({
      _id: conversationId,
      userId: String(userId),
    }).lean();

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    const messages = await Message.find({
      conversationId,
    })
      .sort({ createdAt: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      conversation,
      messages,
    });
  } catch (error) {
    console.error("FULL ERROR in getConversationById:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch conversation",
      error: error.message,
    });
  }
};

export const sendMessageToAi = asyncHandler(async (req, res) => {
  const body = req.body ?? {};

  const userId =
    req.user?._id ||
    req.user?.id ||
    req.headers["x-user-id"];

  if (!userId) {
    return res.status(401).json({ success: false, message: "User not authenticated. userId missing." });
  }

  const userText =
    body.message ||
    body.prompt ||
    body.content ||
    "";

  if (!userText || !userText.trim()) {
    return res.status(400).json({ success: false, message: "Message content is required" });
  }

  let conversationId = body.conversationId;
  if (!conversationId || conversationId === "null" || conversationId === "undefined") {
    conversationId = null;
  }

  const selectedAgent = normalizeAgent(body.selectedAgent || body.agent || body.agentType || "chat");
  const selectedModel = body.selectedModel || body.model || "groq";

  let files = body.files || [];
  let images = body.images || [];
  let artifactFile = body.artifactFile;

  const uploadedFile = req.file || req.files?.file?.[0];
  console.log("[PDF Chat Service]", {
    contentType: req.headers["content-type"],
    contentLength: req.headers["content-length"],
    bodyKeys: Object.keys(req.body || {}),
    hasFile: Boolean(uploadedFile),
    fileName: uploadedFile?.originalname,
    fileSize: uploadedFile?.size,
  });

  if (selectedAgent === "pdf" && !uploadedFile && (!body.files || body.files.length === 0) && !body.artifactFile) {
    return res.status(400).json({
      success: false,
      code: "PDF_REQUIRED",
      message: "Please attach a PDF first.",
    });
  }

  if (uploadedFile) {
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(
      tempDir,
      `pdf-${Date.now()}-${(uploadedFile.originalname || "document.pdf").replace(/[^a-zA-Z0-9._-]/g, "_")}`
    );
    fs.writeFileSync(tempFilePath, uploadedFile.buffer);

    artifactFile = {
      name: uploadedFile.originalname,
      originalname: uploadedFile.originalname,
      type: uploadedFile.mimetype,
      mimetype: uploadedFile.mimetype,
      size: uploadedFile.size,
      path: tempFilePath,
    };
  }

  if (req.files?.images?.length) {
    images = req.files.images.map((img) => ({
      name: img.originalname,
      type: img.mimetype,
      size: img.size,
      buffer: img.buffer,
    }));
  }

  if (process.env.NODE_ENV !== "production") {
    console.log(`[ChatService] Request — userId: ${userId}, agent: ${selectedAgent}, model: ${selectedModel}, convId: ${conversationId}`);
  }

  let conversation;
  if (conversationId) {
    conversation = await Conversation.findOne({ _id: conversationId, userId: String(userId) });
  }

  if (!conversation) {
    const trimmed = userText.trim();
    const title = trimmed.length > 40 ? trimmed.slice(0, 40).trimEnd() + "..." : trimmed;

    conversation = await Conversation.create({ userId: String(userId), title });
  }

  console.log("created/found conversation:", conversation?._id);

  // Load previous messages BEFORE saving the new user message to prevent duplicating the prompt in history
  const previousMessages = await Message.find({ conversationId: conversation._id, userId: String(userId) })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  const chatHistory = previousMessages.reverse().map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));

  // Save the user message to the database
  const userMessage = await Message.create({
    conversationId: conversation._id,
    userId: String(userId),
    role: "user",
    content: userText
  });

  const agentUrl = process.env.AGENT_SERVICE || "http://agent:8003";
  let aiText = "";
  let agentSources = [];
  let agentImages = [];
  let agentArtifacts = [];
  let agentName = selectedAgent || "chat";
  let agentUsage = undefined;

  const activeAgent = selectedAgent;

  if (isBasicChatAgent(activeAgent)) {
    try {
      aiText = await generateBasicChatResponse({
        message: userText,
        history: chatHistory,
      });
      agentName = "chat";
    } catch (err) {
      console.error("Direct Groq basic chat failed:", err);
      aiText =
        err?.message?.includes("GROQ_API_KEY")
          ? "Basic chat is not configured yet. Add GROQ_API_KEY to enable responses."
          : "I encountered an error while processing your request. Please try again.";
    }
  } else {
    // Agent path (e.g. ppt, search, pdf, coding, vision)
    try {
      console.log("Calling agent service at:", `${agentUrl}/generate`);
      const agentPayload = {
        prompt: userText,
        history: chatHistory,
        conversationId: conversation._id,
        userId: String(userId),
        selectedAgent: activeAgent,
        selectedModel: selectedModel || (activeAgent === "vision" ? "flash" : "groq"),
        files,
        images,
      };
      if (artifactFile) {
        agentPayload.artifactFile = artifactFile;
        console.log("FORWARDING ARTIFACT FILE TO AGENT:", artifactFile.name);
      }
      const agentRes = await axios.post(`${agentUrl}/generate`, agentPayload, {
        headers: {
          "x-user-id": String(userId),
          "x-user-country": req.user?.country || req.headers["x-user-country"] || "India",
        },
        timeout: 60000,
      });

      console.log("RAW AGENT RESPONSE DATA keys:", Object.keys(agentRes.data || {}));

      aiText =
        (typeof agentRes.data?.aiResponse === "string" && agentRes.data.aiResponse) ||
        (typeof agentRes.data?.response   === "string" && agentRes.data.response)   ||
        (typeof agentRes.data?.answer     === "string" && agentRes.data.answer)     ||
        "Response generated.";

      agentSources   = agentRes.data?.sources   || [];
      agentImages    = agentRes.data?.images    || (agentRes.data?.imageUrl ? [{ url: agentRes.data.imageUrl, imageUrl: agentRes.data.imageUrl }] : []);
      agentArtifacts = Array.isArray(agentRes.data?.artifacts) ? agentRes.data.artifacts : [];
      agentName      = agentRes.data?.agent     || activeAgent;
      agentUsage     = agentRes.data?.usage;
    } catch (error) {
      console.error("Agent service call failed for agent:", activeAgent, error.message);

      const status = error.response?.status || 500;
      const data = error.response?.data;

      if (status === 429) {
        const retryAfter = error.response?.headers?.["retry-after"] || data?.retryAfter;
        if (retryAfter) res.set("retry-after", String(retryAfter));
        const resetReq = error.response?.headers?.["x-ratelimit-reset-requests"];
        const resetTokens = error.response?.headers?.["x-ratelimit-reset-tokens"];
        if (resetReq) res.set("x-ratelimit-reset-requests", String(resetReq));
        if (resetTokens) res.set("x-ratelimit-reset-tokens", String(resetTokens));

        return res.status(429).json({
          success: false,
          responseType: "image",
          code: "RATE_LIMITED",
          message: data?.message || error.message || "Too Many Requests",
          error: data?.error || error.message,
          retryAfter: retryAfter || null,
          details: data?.details || data,
        });
      }

      if (status === 400 || data?.isConfigError) {
        return res.status(400).json({
          success: false,
          message: data?.message || error.message,
          error: data?.error || error.message,
          missingVar: data?.missingVar,
        });
      }

      aiText =
        data?.message ||
        data?.error ||
        error.message ||
        "This agent is temporarily unavailable. Please try again.";
      agentName = activeAgent;
    }
  }

  if (!aiText?.trim()) {
    return res.status(500).json({
      success: false,
      message: "Assistant response content missing",
    });
  }

  // Save the assistant message to the database
  const assistantMessage = await Message.create({
    conversationId: conversation._id,
    userId: String(userId),
    role: "assistant",
    content: aiText,
    agent: agentName,
    sources: agentSources,
    images: agentImages,
    artifacts: agentArtifacts,
  });

  conversation.updatedAt = new Date();
  await conversation.save();

  console.log("FINAL CHAT CONTROLLER RESPONSE — artifacts:", agentArtifacts?.length, "agent:", agentName);

  const responseType = (agentImages.length > 0 ? "image" : "text");
  const imageUrl = agentImages[0]?.url || agentImages[0]?.imageUrl || null;

  return res.status(200).json({
    success: true,
    conversationId: conversation._id,
    conversation,
    userMessage,
    assistantMessage,
    message: assistantMessage,
    response: aiText,
    responseType,
    imageUrl,
    agent: agentName,
    sources: agentSources,
    images: agentImages,
    artifacts: agentArtifacts,
    usage: agentUsage,
  });
});