import redis from "../../../shared/redis/redis.js";
import { checkRateLimit, acquireLock, releaseLock, getUserOrIpKey } from "../../../shared/redis/rateLimiter.js";

const DEFAULT_LIMITS = {
  chat: parseInt(process.env.RATE_LIMIT_CHAT_MAX || "20", 10),
  search: parseInt(process.env.RATE_LIMIT_SEARCH_MAX || "10", 10),
  coding: parseInt(process.env.RATE_LIMIT_CODING_MAX || "6", 10),
  pdf: parseInt(process.env.RATE_LIMIT_PDF_MAX || "5", 10),
  ppt: parseInt(process.env.RATE_LIMIT_PPT_MAX || "3", 10),
  vision: parseInt(process.env.RATE_LIMIT_VISION_MAX || "2", 10),
};

const DEFAULT_LOCK_TTLS = {
  chat: 0,
  search: 20,
  coding: 60,
  pdf: 90,
  ppt: 120,
  vision: 90,
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

export const chatAgentRateLimiter = async (req, res, next) => {
  const rawAgent = req.body?.selectedAgent || req.body?.agent || req.body?.agentType || "chat";
  const agent = normalizeAgentName(rawAgent);

  const limit = DEFAULT_LIMITS[agent] ?? DEFAULT_LIMITS.chat;
  const windowSeconds = parseInt(process.env.RATE_LIMIT_AGENT_WINDOW_SECONDS || "60", 10);
  const lockTtl = DEFAULT_LOCK_TTLS[agent] ?? 0;

  const keyId = getUserOrIpKey(req);
  const scope = `chat-agent:${agent}`;

  // 1. Check Rate Limit
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
      message: `Too many requests for ${agent} agent. Please try again after ${rlResult.resetSeconds} seconds.`,
      retryAfter: rlResult.resetSeconds,
      limit: rlResult.limit,
      remaining: 0,
    });
  }

  // 2. Check Concurrent Lock if agent lock TTL > 0
  if (lockTtl > 0) {
    const lockResult = await acquireLock({
      redis,
      scope: "agent",
      userId: keyId,
      agent,
      ttlSeconds: lockTtl,
    });

    if (!lockResult.acquired) {
      return res.status(429).json({
        success: false,
        code: "AGENT_REQUEST_IN_PROGRESS",
        message: "A request for this agent is already processing.",
        retryAfter: lockTtl,
      });
    }

    // Release lock when request finishes or closes
    const releaseHandler = () => {
      res.removeListener("finish", releaseHandler);
      res.removeListener("close", releaseHandler);
      releaseLock({ redis, lockKey: lockResult.lockKey, token: lockResult.token }).catch(() => {});
    };
    res.on("finish", releaseHandler);
    res.on("close", releaseHandler);
  }

  next();
};
