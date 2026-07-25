import api from "../utils/axios";

const isDev = import.meta.env.DEV;

// ─── Normalized API error ─────────────────────────────────────────────────────
export class ApiError extends Error {
  constructor(message, code, status, meta = {}) {
    super(message);
    this.name       = "ApiError";
    this.code       = code   || "UNKNOWN_ERROR";
    this.status     = status || 0;
    // Extra fields from 429: retryAfter (ms), provider
    this.retryAfter = meta.retryAfter || null;
    this.provider   = meta.provider   || null;
  }
}

export const API_ERROR_CODES = {
  RATE_LIMITED: "RATE_LIMITED",
  AGENT_REQUEST_IN_PROGRESS: "AGENT_REQUEST_IN_PROGRESS",
  QUOTA_EXCEEDED: "QUOTA_EXCEEDED",  // 429 — token / rate / provider quota
  NETWORK_ERROR:  "NETWORK_ERROR",   // No response received
  SERVER_ERROR:   "SERVER_ERROR",    // 5xx
  BAD_REQUEST:    "BAD_REQUEST",     // 400
  UNAUTHORIZED:   "UNAUTHORIZED",    // 401
  UNKNOWN_ERROR:  "UNKNOWN_ERROR",
};

const normalizeError = (error) => {
  if (!error.response) {
    return new ApiError(
      "Network error. Check your connection and try again.",
      API_ERROR_CODES.NETWORK_ERROR,
      0
    );
  }

  const { status, data } = error.response;
  const serverMessage = data?.message || data?.error?.message || data?.error || null;
  const serverCode    = data?.code    || data?.error?.code    || null;
  const retryAfter    = data?.retryAfter || data?.error?.retryAfter || null;
  const provider      = data?.error?.provider || null;

  if (status === 413 || serverCode === "FILE_TOO_LARGE") {
    return new ApiError(
      serverMessage || "PDF is too large. Maximum allowed size is 20 MB.",
      "FILE_TOO_LARGE",
      413
    );
  }

  if (status === 400 && serverCode === "INVALID_FILE_TYPE") {
    return new ApiError(
      serverMessage || "Only PDF files are allowed.",
      "INVALID_FILE_TYPE",
      400
    );
  }

  if (status === 429) {
    const code = serverCode || API_ERROR_CODES.RATE_LIMITED;
    const msg = serverMessage || `Too many requests. Please try again after ${retryAfter || 60} seconds.`;
    return new ApiError(msg, code, 429, { retryAfter, provider });
  }

  if (status === 409) {
    const code = serverCode || API_ERROR_CODES.AGENT_REQUEST_IN_PROGRESS;
    const msg = serverMessage || "This agent is already processing your previous request.";
    return new ApiError(msg, code, 409, { retryAfter, provider });
  }

  if (status >= 500) {
    return new ApiError(
      serverMessage || "Server error. Please try again in a moment.",
      API_ERROR_CODES.SERVER_ERROR,
      status
    );
  }

  if (status === 401) {
    return new ApiError("Session expired. Please refresh the page.", API_ERROR_CODES.UNAUTHORIZED, 401);
  }

  if (status === 400) {
    return new ApiError(serverMessage || "Invalid request.", API_ERROR_CODES.BAD_REQUEST, 400);
  }

  return new ApiError(
    serverMessage || "Something went wrong. Please try again.",
    API_ERROR_CODES.UNKNOWN_ERROR,
    status
  );
};

// ─── sendChatMessage ──────────────────────────────────────────────────────────
export const sendChatMessage = async (payload) => {
  let body = payload;
  if (!(typeof FormData !== "undefined" && payload instanceof FormData) && typeof payload === "object" && payload !== null) {
    const { conversationId, message, prompt, selectedAgent, selectedModel, artifactFile, files = [], images = [] } = payload;
    const msgText = message || prompt;
    body = { message: msgText };
    if (conversationId) body.conversationId = conversationId;
    if (selectedAgent)  body.selectedAgent   = selectedAgent;
    if (selectedModel)  body.selectedModel   = selectedModel;
    if (artifactFile)   body.artifactFile    = artifactFile;
    if (files?.length)  body.files           = files;
    if (images?.length) body.images          = images;
  }

  if (isDev) {
    console.debug("[chatApi] Sending chat message request");
  }

  try {
    const { data } = await api.post("/chat/message", body);
    if (isDev) {
      console.debug("[chatApi] OK — agent:", data?.agent, "artifacts:", data?.artifacts?.length ?? 0);
    }
    return data;
  } catch (error) {
    const normalized = normalizeError(error);
    if (isDev) {
      console.debug("[chatApi] Error —", normalized.code, normalized.status);
    }
    throw normalized;
  }
};
