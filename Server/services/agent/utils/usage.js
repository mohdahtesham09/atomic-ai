import UserUsage from "../models/userUsage.model.js";

const COOLDOWN_MS = 6 * 60 * 60 * 1000;

export const estimateTokens = (text = "") =>
  Math.ceil(String(text || "").length / 4);

export const getUsagePayload = (usage) => ({
  tokensUsed: usage.tokensUsed,
  limit: usage.limit,
  remainingTokens: Math.max(0, usage.limit - usage.tokensUsed),
  cooldownUntil: usage.cooldownUntil,
});

export const getOrCreateUsage = async (userId) => {
  if (!userId) return null;

  try {
    let usage = await UserUsage.findOne({ userId: String(userId) }).maxTimeMS(3000);
    if (!usage) {
      usage = await UserUsage.create({ userId: String(userId) });
    }
    return usage;
  } catch (err) {
    console.error("[usage] DB operation failed/bypassed:", err.message);
    return null;
  }
};

export const resetUsageIfCooldownExpired = async (usage) => {
  if (!usage) return null;
  const now = new Date();
  if (usage.cooldownUntil && usage.cooldownUntil <= now) {
    usage.tokensUsed = 0;
    usage.cooldownUntil = null;
    usage.windowStartedAt = now;
    try {
      await usage.save();
    } catch (_) {}
  }
  return usage;
};

export const checkUsageBeforeRequest = async ({
  userId,
  prompt,
  conversationMemory,
  userMemory,
}) => {
  const usage = await getOrCreateUsage(userId);
  if (!usage) return { allowed: true, usage: null };

  await resetUsageIfCooldownExpired(usage);

  const now = new Date();
  if (usage.cooldownUntil && usage.cooldownUntil > now) {
    return {
      allowed: false,
      usage,
      status: 429,
      body: {
        success: false,
        code: "TOKEN_LIMIT_REACHED",
        message:
          "Your free token limit is finished. Please try again after cooldown.",
        cooldownUntil: usage.cooldownUntil,
        remainingMs: usage.cooldownUntil.getTime() - now.getTime(),
        usage: getUsagePayload(usage),
      },
    };
  }

  const estimatedInputTokens =
    estimateTokens(prompt) +
    estimateTokens(conversationMemory) +
    estimateTokens(userMemory);

  if (usage.tokensUsed + estimatedInputTokens >= usage.limit) {
    usage.cooldownUntil = new Date(now.getTime() + COOLDOWN_MS);
    try {
      await usage.save();
    } catch (_) {}

    return {
      allowed: false,
      usage,
      status: 429,
      body: {
        success: false,
        code: "TOKEN_LIMIT_REACHED",
        message:
          "Your free token limit is finished. Please try again after cooldown.",
        cooldownUntil: usage.cooldownUntil,
        remainingMs: COOLDOWN_MS,
        usage: getUsagePayload(usage),
      },
    };
  }

  return { allowed: true, usage, estimatedInputTokens };
};

export const recordUsageAfterResponse = async (usage, result, estimatedInputTokens = 0) => {
  if (!usage) return null;

  try {
    const outputTokens =
      estimateTokens(result?.aiResponse) +
      estimateTokens(JSON.stringify(result?.artifacts || []));

    usage.tokensUsed += estimatedInputTokens + outputTokens;

    if (usage.tokensUsed >= usage.limit) {
      usage.cooldownUntil = new Date(Date.now() + COOLDOWN_MS);
    }

    await usage.save();
    return usage;
  } catch (err) {
    console.error("[usage] Failed to record usage:", err.message);
    return usage;
  }
};
