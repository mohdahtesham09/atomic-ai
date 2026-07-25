import redis from "../../../shared/redis/redis.js";
import { checkRateLimit, getUserOrIpKey } from "../../../shared/redis/rateLimiter.js";

const PROVIDER_LIMITS = {
  chat: parseInt(process.env.RATE_LIMIT_PROVIDER_CHAT_MAX || "20", 10),
  search: parseInt(process.env.RATE_LIMIT_PROVIDER_SEARCH_MAX || "10", 10),
  coding: parseInt(process.env.RATE_LIMIT_PROVIDER_CODING_MAX || "6", 10),
  pdf: parseInt(process.env.RATE_LIMIT_PROVIDER_PDF_MAX || "5", 10),
  ppt: parseInt(process.env.RATE_LIMIT_PROVIDER_PPT_MAX || "5", 10),
  vision: parseInt(process.env.RATE_LIMIT_PROVIDER_VISION_MAX || "2", 10),
};

const normalizeAgentName = (agent) => {
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

export const providerRateLimiter = async (req, res, next) => {
  const rawAgent = req.body?.selectedAgent || req.body?.agent || req.body?.agentType || "chat";
  const agent = normalizeAgentName(rawAgent);

  const limit = PROVIDER_LIMITS[agent] ?? PROVIDER_LIMITS.chat;
  const windowSeconds = parseInt(process.env.RATE_LIMIT_AGENT_WINDOW_SECONDS || "60", 10);

  const keyId = getUserOrIpKey(req);
  const scope = `provider:${agent}`;

  const rlResult = await checkRateLimit({
    redis,
    scope,
    keyId,
    max: limit,
    windowSeconds,
  });

  res.setHeader("X-RateLimit-Limit", rlResult.limit);
  res.setHeader("X-RateLimit-Remaining", rlResult.remaining);
  res.setHeader("X-RateLimit-Reset", rlResult.resetSeconds);

  if (!rlResult.allowed) {
    res.setHeader("Retry-After", rlResult.resetSeconds);
    return res.status(429).json({
      success: false,
      code: "RATE_LIMITED",
      message: `Provider API rate limit reached for ${agent}. Please try again shortly.`,
      retryAfter: rlResult.resetSeconds,
      limit: rlResult.limit,
      remaining: 0,
    });
  }

  next();
};
