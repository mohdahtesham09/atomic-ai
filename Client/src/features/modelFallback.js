/**
 * modelFallback.js
 *
 * Central config for:
 *  - Model fallback order per agent type
 *  - Model health tracking (quota_exceeded with cooldown)
 *  - Human-readable model labels
 *  - Agent ↔ model compatibility
 *
 * Nothing in here makes network requests or reads env vars.
 * Keep it pure so it can be imported by any component/hook.
 */

// ─── Model metadata ───────────────────────────────────────────────────────────

export const MODEL_META = {
  flash:    { id: "flash",    label: "Gemini Flash" },
  pro:      { id: "pro",      label: "Gemini Pro"   },
  groq:     { id: "groq",     label: "Groq"         },
  deepseek: { id: "deepseek", label: "DeepSeek"     },
};

// ─── Fallback priority order (first = highest priority) ───────────────────────
// Mirrors what the backend actually has configured.
// Vision must always include "flash" first (multimodal support).
export const MODEL_FALLBACK_ORDER = {
  default:  ["groq"],
  chat:     ["groq"],
  search:   ["groq"],
  coding:   ["groq"],
  pdf:      ["groq"],
  ppt:      ["groq"],
  vision:   ["groq"],
  auto:     ["groq"],
};

/**
 * Returns the fallback order for a given agent.
 * Excludes models that are not in the supported list.
 */
export const getFallbackOrder = (agentId = "auto") => {
  return MODEL_FALLBACK_ORDER[agentId] || MODEL_FALLBACK_ORDER.default;
};

/**
 * Given a model that just failed and a set of already-attempted models,
 * return the next model to try — or null if all options are exhausted.
 *
 * @param {string}   failedModel        - e.g. "groq"
 * @param {Set}      attemptedModels    - models already tried this request
 * @param {string}   agentId            - e.g. "ppt"
 * @param {object}   healthMap          - modelId → { status, retryAfter }
 * @returns {string|null}
 */
export const getNextFallbackModel = (failedModel, attemptedModels, agentId, healthMap) => {
  const order = getFallbackOrder(agentId);

  for (const modelId of order) {
    // Skip models already attempted in this request
    if (attemptedModels.has(modelId)) continue;

    // Skip models currently in cooldown
    const health = healthMap[modelId];
    if (health?.status === "quota_exceeded") {
      const now = Date.now();
      if (!health.retryAfter || health.retryAfter > now) continue;
      // Cooldown expired — treat as available again (caller will update healthMap)
    }

    return modelId;
  }

  return null; // all exhausted
};

// ─── Model health store (module-level singleton, resets on page refresh) ──────
// Shape: { [modelId]: { status: "available"|"quota_exceeded", retryAfter: timestamp|null } }

const _health = {};

const COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes default frontend cooldown

export const modelHealth = {
  /** Get health entry for a model */
  get: (modelId) => _health[modelId] || { status: "available", retryAfter: null },

  /** Mark a model as quota-exceeded. retryAfterMs overrides default cooldown. */
  markQuotaExceeded: (modelId, retryAfterMs = COOLDOWN_MS) => {
    _health[modelId] = {
      status:     "quota_exceeded",
      retryAfter: Date.now() + retryAfterMs,
    };
  },

  /** Restore a model to available */
  markAvailable: (modelId) => {
    _health[modelId] = { status: "available", retryAfter: null };
  },

  /** Return a snapshot of all health entries (for logging only) */
  snapshot: () => ({ ..._health }),

  /** Check whether a model is currently usable */
  isAvailable: (modelId) => {
    const h = _health[modelId];
    if (!h || h.status === "available") return true;
    if (h.status === "quota_exceeded") {
      if (h.retryAfter && h.retryAfter <= Date.now()) {
        // Auto-restore expired cooldown
        _health[modelId] = { status: "available", retryAfter: null };
        return true;
      }
      return false;
    }
    return true;
  },
};

/** Human-readable label for a model ID */
export const getModelLabel = (modelId) => MODEL_META[modelId]?.label || modelId;
