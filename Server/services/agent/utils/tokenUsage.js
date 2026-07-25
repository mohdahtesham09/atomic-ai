import UserUsage from "../models/userUsage.model.js";

const COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours
const DEFAULT_LIMIT = 2500;

export const estimateTokens = (text = "") =>
  Math.ceil(String(text || "").length / 4);

export const getOrCreateUsage = async (userId) => {
  if (!userId) return null;

  let usage = await UserUsage.findOne({ userId: String(userId) });
  if (!usage) {
    usage = await UserUsage.create({
      userId: String(userId),
      tokensUsed: 0,
      limit: DEFAULT_LIMIT,
      cooldownUntil: null,
      windowStartedAt: new Date(),
    });
  }
  return usage;
};

export const resetUsageIfCooldownExpired = async (usage) => {
  if (!usage) return usage;

  const now = new Date();
  if (usage.cooldownUntil && usage.cooldownUntil <= now) {
    usage.tokensUsed = 0;
    usage.cooldownUntil = null;
    usage.windowStartedAt = now;
    await usage.save();
  }
  return usage;
};

export const buildUsagePayload = (usage) => {
  const limit = usage?.limit ?? DEFAULT_LIMIT;
  const tokensUsed = usage?.tokensUsed ?? 0;
  return {
    tokensUsed,
    limit,
    remainingTokens: Math.max(0, limit - tokensUsed),
    cooldownUntil: usage?.cooldownUntil || null,
  };
};

export const checkUsageBeforeRequest = async ({
  userId,
  prompt = "",
  conversationMemory = "",
  userMemory = "",
}) => {
  if (!userId) return { allowed: true, usage: null };

  let usage = await getOrCreateUsage(userId);
  usage = await resetUsageIfCooldownExpired(usage);

  const now = new Date();
  if (usage.cooldownUntil && usage.cooldownUntil > now) {
    const remainingMs = usage.cooldownUntil.getTime() - now.getTime();
    return {
      allowed: false,
      code: "TOKEN_LIMIT_REACHED",
      message:
        "Your free token limit is finished. Please try again after cooldown.",
      cooldownUntil: usage.cooldownUntil,
      remainingMs,
      usage: buildUsagePayload(usage),
    };
  }

  const estimatedInputTokens =
    estimateTokens(prompt) +
    estimateTokens(conversationMemory) +
    estimateTokens(userMemory);

  if (usage.tokensUsed + estimatedInputTokens >= usage.limit) {
    usage.cooldownUntil = new Date(now.getTime() + COOLDOWN_MS);
    await usage.save();
    const remainingMs = usage.cooldownUntil.getTime() - now.getTime();
    return {
      allowed: false,
      code: "TOKEN_LIMIT_REACHED",
      message:
        "Your free token limit is finished. Please try again after cooldown.",
      cooldownUntil: usage.cooldownUntil,
      remainingMs,
      usage: buildUsagePayload(usage),
    };
  }

  return { allowed: true, usage, estimatedInputTokens };
};

export const recordUsageAfterResponse = async ({
  usage,
  userId,
  prompt = "",
  conversationMemory = "",
  userMemory = "",
  aiResponse = "",
  artifacts = [],
}) => {
  if (!userId) return buildUsagePayload(null);

  let record = usage || (await getOrCreateUsage(userId));
  record = await resetUsageIfCooldownExpired(record);

  const inputTokens =
    estimateTokens(prompt) +
    estimateTokens(conversationMemory) +
    estimateTokens(userMemory);
  const outputTokens =
    estimateTokens(aiResponse) + estimateTokens(JSON.stringify(artifacts || []));

  record.tokensUsed += inputTokens + outputTokens;

  if (record.tokensUsed >= record.limit) {
    record.cooldownUntil = new Date(Date.now() + COOLDOWN_MS);
  }

  await record.save();

  console.log(
    "USAGE:",
    record.tokensUsed,
    record.limit,
    record.cooldownUntil
  );

  return buildUsagePayload(record);
};
