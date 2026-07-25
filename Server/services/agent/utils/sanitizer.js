/**
 * Sanitizes data structures and error strings to remove API keys before logging.
 */
export function sanitizeLog(data) {
  if (!data) return data;
  let str = typeof data === "object" ? JSON.stringify(data) : String(data);

  // Redact common API key patterns
  str = str
    .replace(/gsk_[a-zA-Z0-9_-]+/g, "[REDACTED_GROQ_KEY]")
    .replace(/AIzaSy[a-zA-Z0-9_-]+/g, "[REDACTED_GOOGLE_KEY]")
    .replace(/AQ\.[a-zA-Z0-9_-]+/g, "[REDACTED_GOOGLE_KEY]")
    .replace(/sk-or-v1-[a-zA-Z0-9_-]+/g, "[REDACTED_OPENROUTER_KEY]")
    .replace(/tvly-[a-zA-Z0-9_-]+/g, "[REDACTED_TAVILY_KEY]")
    .replace(/key=[a-zA-Z0-9._-]+/g, "key=[REDACTED_KEY]")
    .replace(/Bearer\s+[a-zA-Z0-9._-]+/gi, "Bearer [REDACTED_TOKEN]");

  try {
    return JSON.parse(str);
  } catch (_) {
    return str;
  }
}
