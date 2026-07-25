import redisClient from "./redis.js";

// Lua script for atomic sliding window rate limiting
const RATE_LIMIT_LUA = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])

local current = redis.call('INCR', key)
if current == 1 then
    redis.call('EXPIRE', key, window)
end
local ttl = redis.call('TTL', key)
return { current, ttl }
`;

// Lua script for atomic Compare-And-Delete lock release
const RELEASE_LOCK_LUA = `
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
else
    return 0
end
`;

/**
 * Normalizes user ID or IP for rate limiting keys
 */
export const getUserOrIpKey = (req) => {
  const userId =
    req.user?._id ||
    req.user?.id ||
    (process.env.NODE_ENV !== "production" ? req.headers["x-user-id"] : null);

  if (userId) return String(userId);

  const rawIp =
    req.headers["x-forwarded-for"] ||
    req.ip ||
    req.socket?.remoteAddress ||
    "127.0.0.1";

  return String(rawIp).split(",")[0].trim();
};

/**
 * Checks rate limit atomically using Redis INCR + EXPIRE via Lua
 */
export const checkRateLimit = async ({
  redis = redisClient,
  scope = "global",
  keyId,
  max = 100,
  windowSeconds = 60,
}) => {
  const failOpen = process.env.RATE_LIMIT_FAIL_OPEN !== "false";
  const rateLimitKey = `rate-limit:${scope}:${keyId}`;

  try {
    if (redis.status !== "ready" && redis.status !== "connecting") {
      await redis.connect().catch(() => {});
    }

    const res = await redis.eval(RATE_LIMIT_LUA, 1, rateLimitKey, max, windowSeconds);
    const current = Number(res[0] || 0);
    const ttl = Number(res[1] || windowSeconds);
    const resetSeconds = ttl > 0 ? ttl : windowSeconds;
    const remaining = Math.max(0, max - current);
    const allowed = current <= max;

    return {
      allowed,
      current,
      limit: max,
      remaining,
      resetSeconds,
      key: rateLimitKey,
    };
  } catch (err) {
    console.warn(`[RedisRateLimiter Warning] Redis error for key ${rateLimitKey}:`, err.message);
    if (failOpen) {
      return {
        allowed: true,
        current: 1,
        limit: max,
        remaining: max - 1,
        resetSeconds: windowSeconds,
        key: rateLimitKey,
        redisError: true,
      };
    }
    return {
      allowed: false,
      current: max + 1,
      limit: max,
      remaining: 0,
      resetSeconds: windowSeconds,
      key: rateLimitKey,
      redisError: true,
    };
  }
};

/**
 * Acquires a concurrent-request lock using SET key token NX EX lockTtl
 */
export const acquireLock = async ({
  redis = redisClient,
  scope = "agent",
  userId,
  agent,
  ttlSeconds = 60,
}) => {
  const failOpen = process.env.RATE_LIMIT_FAIL_OPEN !== "false";
  const lockKey = `agent-lock:${userId}:${agent}`;
  const token = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  try {
    if (redis.status !== "ready" && redis.status !== "connecting") {
      await redis.connect().catch(() => {});
    }

    const acquired = await redis.set(lockKey, token, "NX", "EX", ttlSeconds);
    return {
      acquired: Boolean(acquired),
      token,
      lockKey,
    };
  } catch (err) {
    console.warn(`[RedisRateLimiter Warning] Lock error for key ${lockKey}:`, err.message);
    return {
      acquired: failOpen,
      token,
      lockKey,
      redisError: true,
    };
  }
};

/**
 * Releases a concurrent-request lock safely using atomic Compare-And-Delete Lua script
 */
export const releaseLock = async ({
  redis = redisClient,
  lockKey,
  token,
}) => {
  if (!lockKey || !token) return false;
  try {
    if (redis.status !== "ready" && redis.status !== "connecting") {
      await redis.connect().catch(() => {});
    }
    await redis.eval(RELEASE_LOCK_LUA, 1, lockKey, token);
    return true;
  } catch (err) {
    console.warn(`[RedisRateLimiter Warning] Release lock error for key ${lockKey}:`, err.message);
    return false;
  }
};
