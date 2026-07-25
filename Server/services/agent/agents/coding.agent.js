import { getModel } from "../Config/llmModel.js";
import { deductCredits } from "../utils/deductCredits.js";

// ─── JSON extraction helpers ────────────────────────────────────────────────

/**
 * cleanModelJson
 * Strips markdown fences then attempts progressively looser parse
 * strategies before giving up and returning null.
 */
function cleanModelJson(raw) {
  if (!raw) return null;

  // 1. Strip markdown code fences (```json ... ``` or ``` ... ```)
  let text = String(raw).trim();
  text = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  // 2. Direct parse
  try {
    return JSON.parse(text);
  } catch (_) { /* fall through */ }

  // 3. Fix common LLM unescaped newlines inside JSON string values
  try {
    const sanitized = text.replace(/("code"\s*:\s*")([\s\S]*?)("\s*,\s*"|\s*\}\s*$)/g, (match, prefix, codeContent, suffix) => {
      const escapedCode = codeContent
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r")
        .replace(/\t/g, "\\t");
      return prefix + escapedCode + suffix;
    });
    return JSON.parse(sanitized);
  } catch (_) { /* fall through */ }

  // 4. Find first { … } block — greedy to the LAST } to capture large HTML values
  const firstBrace = text.indexOf("{");
  const lastBrace  = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(text.slice(firstBrace, lastBrace + 1));
    } catch (_) { /* fall through */ }
  }

  // 5. Non-greedy regex fallback
  const match = text.match(/\{[\s\S]*?\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch (_) { /* give up */ }
  }

  return null;
}

/**
 * extractCodeFromRaw
 * Last-resort: if JSON.parse fails entirely, use regex to pull the "code" value
 * out of the raw string.
 */
function extractCodeFromRaw(raw) {
  if (!raw) return null;

  const codeMatch = raw.match(/"code"\s*:\s*"([\s\S]*?)(?:"\s*[,}]|"$)/);
  if (codeMatch && codeMatch[1]) {
    try {
      return JSON.parse('"' + codeMatch[1] + '"');
    } catch (_) {
      return codeMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    }
  }

  const trimmed = raw.trim();
  if (
    trimmed.startsWith("<!DOCTYPE") ||
    trimmed.startsWith("<html") ||
    trimmed.startsWith("<") ||
    trimmed.startsWith("const ") ||
    trimmed.startsWith("import ") ||
    trimmed.startsWith("function ")
  ) {
    return trimmed;
  }

  return null;
}

/**
 * extractSummaryFromRaw
 * Best-effort summary extraction when JSON parse fails.
 */
function extractSummaryFromRaw(raw) {
  const m = raw.match(/"summary"\s*:\s*"([^"]{5,200})"/);
  return m ? m[1] : null;
}

// ─── Coding Agent ────────────────────────────────────────────────────────────
export const codingAgent = async (state) => {
  console.log("═══════════════ CODING AGENT RUNNING ═══════════════");
  console.log("CODING AGENT state.prompt:", state.prompt);
  console.log("CODING AGENT FILE:", state.artifactFile?.name ?? "none");

  const model = await getModel("coding", state.selectedModel);
  if (!model) throw new Error("getModel('coding') returned undefined");

  // ── Uploaded file context ─────────────────────────────────────────────────
  const artifactFileBlock = state.artifactFile?.content
    ? `
Artifact File:
File name: ${state.artifactFile.name}
File content:
\`\`\`
${state.artifactFile.content}
\`\`\`
Rules for uploaded file:
- Analyze the file above when user asks to fix, debug, explain, optimize, or update.
- Return the full updated code in the "code" field.
- Set title to: "${state.artifactFile.name}".
`
    : "";

  const uploadedFilesBlock =
    Array.isArray(state.uploadedFiles) && state.uploadedFiles.length > 0
      ? state.uploadedFiles
          .map(
            (f) => `
Uploaded File: ${f.name}
Type: ${f.type || "unknown"}
Content:
\`\`\`
${f.content || ""}
\`\`\`
`
          )
          .join("\n")
      : "";

  const uploadedImagesNote =
    Array.isArray(state.uploadedImages) && state.uploadedImages.length > 0
      ? `User also uploaded images: ${state.uploadedImages.map((i) => i.name).join(", ")}.`
      : "";

  const fileContext =
    artifactFileBlock || uploadedFilesBlock || uploadedImagesNote
      ? `${artifactFileBlock}${uploadedFilesBlock}${uploadedImagesNote}`
      : "No uploaded file.";

  const prompt = `You are a world-class principal frontend engineer and web application developer.

User request:
${state.prompt}

Uploaded file context:
${fileContext}

Conversation memory:
${state.conversationMemory || "No previous conversation."}

IMPORTANT: Return ONLY a raw JSON object. Do not wrap the JSON in markdown fences (\`\`\`json). Do not add any text before or after the JSON.

Required JSON format:
{
  "summary": "One or two sentence description of what you built — NO code here",
  "title": "index.html",
  "language": "html",
  "code": "FULL formatted multi-line source code string"
}

================================================================================
CRITICAL STANDALONE HTML & UI CODE GENERATION RULES
================================================================================

1. STANDALONE & COMPLETE DOCUMENT:
   - Output MUST be a single, complete, fully functional HTML5 document.
   - Include <!DOCTYPE html>, <html lang="en">, <head>, <meta name="viewport" content="width=device-width, initial-scale=1.0">, <title>, embedded <style>, and embedded <script>.

2. FORMATTING & READABILITY:
   - Code MUST be formatted cleanly with proper line breaks (\\n) and 2-space indentation.
   - NEVER return code compressed into a single line.

3. MODERN DESIGN SYSTEM & STYLING:
   - CSS Variables: Define color tokens in :root (:root { --primary: #4f46e5; --primary-hover: #4338ca; --bg: #f8fafc; --card: #ffffff; --text: #0f172a; --muted: #64748b; --border: #e2e8f0; --radius: 12px; --shadow: 0 10px 25px -5px rgba(0,0,0,0.06); }).
   - Global Reset: * { box-sizing: border-box; margin: 0; padding: 0; }
   - Typography: Font family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif. High contrast readability.
   - Polish & Aesthetic: Soft rounded corners (12px to 16px), subtle borders (1px solid var(--border)), elegant box-shadows, and glassmorphism elements where appropriate.
   - Professional Buttons & Inputs: NO browser default styling! All buttons must have custom padding (0.625rem 1.25rem), border-radius (8px-12px), bold typography, background colors or vibrant gradients, transition: all 0.2s ease, hover transforms (transform: translateY(-1px)), focus rings, and cursor: pointer.

4. FULLY RESPONSIVE BREAKPOINTS:
   - Mobile: 360px+
   - Tablet: 768px+
   - Laptop: 1024px+
   - Desktop: 1440px+
   - Layout: Use max-width containers (max-width: 1200px; margin: 0 auto; width: 100%;).
   - Use CSS Grid (grid-template-columns: repeat(auto-fit, minmax(280px, 1fr))) and Flexbox with flex-wrap: wrap.
   - Mobile media queries (@media (max-width: 768px)) for stacking multi-column layouts into responsive single columns with touch-friendly controls. Zero horizontal overflow.

5. RELIABLE IMAGES (ZERO BROKEN IMAGE ICONS):
   - DO NOT use source.unsplash.com or unreliable remote image URLs that return 404s or block CORS.
   - Use colorful inline SVG Data URIs or SVG cards for item artwork!
   - Pre-crafted SVG Data URI patterns:
     * Biryani: data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'><rect width='400' height='300' fill='%23fef3c7'/><circle cx='200' cy='150' r='90' fill='%23f59e0b'/><circle cx='200' cy='150' r='75' fill='%23d97706'/><text x='200' y='155' font-family='sans-serif' font-size='22' font-weight='bold' fill='%23ffffff' text-anchor='middle'>🍲 Royal Biryani</text></svg>
     * Shawarma: data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'><rect width='400' height='300' fill='%23ffedd5'/><rect x='100' y='80' width='200' height='140' rx='70' fill='%23ea580c'/><text x='200' y='155' font-family='sans-serif' font-size='22' font-weight='bold' fill='%23ffffff' text-anchor='middle'>🌯 Shawarma Wrap</text></svg>
     * Burger: data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'><rect width='400' height='300' fill='%23fef2f2'/><path d='M100 160 Q200 80 300 160 Z' fill='%23b45309'/><rect x='100' y='165' width='200' height='20' rx='5' fill='%2315803d'/><rect x='100' y='190' width='200' height='25' rx='5' fill='%2378350f'/><text x='200' y='150' font-family='sans-serif' font-size='22' font-weight='bold' fill='%23ffffff' text-anchor='middle'>🍔 Classic Burger</text></svg>
     * Pizza: data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'><rect width='400' height='300' fill='%23fff7ed'/><polygon points='200,50 320,240 80,240' fill='%23f59e0b'/><circle cx='200' cy='160' r='16' fill='%23dc2626'/><circle cx='160' cy='190' r='14' fill='%23dc2626'/><circle cx='240' cy='190' r='14' fill='%23dc2626'/><text x='200' y='220' font-family='sans-serif' font-size='20' font-weight='bold' fill='%23ffffff' text-anchor='middle'>🍕 Cheese Pizza</text></svg>
     * Drinks: data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'><rect width='400' height='300' fill='%23ecfeff'/><path d='M140 80 L260 80 L240 240 L160 240 Z' fill='%2306b6d4'/><text x='200' y='160' font-family='sans-serif' font-size='22' font-weight='bold' fill='%23ffffff' text-anchor='middle'>🥤 Chilled Drink</text></svg>
   - Include CSS & JS fallback handling for image elements:
     CSS: img { background: #f1f5f9; object-fit: cover; }
     JS:
       document.querySelectorAll('img').forEach(img => {
         img.onerror = function() {
           this.style.display = 'none';
           if (this.parentElement) this.parentElement.classList.add('image-fallback');
         };
       });

6. FOOD CART & INTERACTIVE APP REQUIREMENTS:
   When user asks for "food cart", "restaurant", "store", "shopping cart", or similar web application:
   - Header: Brand logo/name, search bar, category filter pills ("All", "Main Course", "Fast Food", "Drinks"), live cart badge counter.
   - Product Cards Grid: Product SVG image, title, category tag, description, price tag, and "Add to Cart" button.
   - Cart Section / Sidebar:
     * Desktop: 2-column layout (products on left, cart sticky on right).
     * Mobile: Cart stacks neatly below products.
     * Cart items list with item title, price, quantity controls ([-] qty [+]), and remove [🗑️] button.
     * Summary calculation (Subtotal, Tax, Total price).
     * Empty cart state view ("Your cart is empty").
   - Functional JavaScript:
     * JavaScript data array for products.
     * Dynamic DOM rendering for products and cart.
     * State management for adding, updating quantity, removing, and computing total.
     * DOMContentLoaded wrapping to avoid global variable collisions and runtime errors.

Return ONLY the raw JSON object string.`;

  const res  = await model.invoke(prompt);
  const raw  = res.content || String(res);
  await deductCredits(state.userId, "coding");

  console.log("CODING AGENT raw (first 600 chars):", raw.slice(0, 600));

  // ── Step 1: try full JSON parse ───────────────────────────────────────────
  let parsed = cleanModelJson(raw);

  // ── Step 2: if full parse failed, try extracting code field by regex ──────
  if (!parsed || !parsed.code) {
    console.warn("CODING AGENT: JSON parse failed or missing 'code'. Trying regex extraction.");

    const extractedCode    = extractCodeFromRaw(raw);
    const extractedSummary = extractSummaryFromRaw(raw);

    if (extractedCode) {
      console.log("CODING AGENT: Regex extraction succeeded. Code length:", extractedCode.length);
      parsed = {
        summary:  extractedSummary || "I created the requested web application.",
        title:    state.artifactFile?.name || "index.html",
        language: "html",
        code:     extractedCode,
      };
    }
  }

  // ── Step 3: complete fallback — treat entire raw output as code ───────────
  if (!parsed || !parsed.code) {
    console.error("CODING AGENT: All parse strategies failed. Raw output (first 1000):");
    console.error(raw.slice(0, 1000));

    const fallbackArtifact = {
      type:     "code",
      title:    state.artifactFile?.name || "index.html",
      language: "html",
      content:  raw,
    };

    return {
      ...state,
      agent:      "coding",
      aiResponse: "I generated the code. Please check the Artifact panel.",
      artifacts:  [fallbackArtifact],
    };
  }

  // ── Clean & normalize code string ─────────────────────────────────────────
  const summary  = parsed.summary  || "I created the requested code.";
  const title    = parsed.title    || state.artifactFile?.name || "index.html";
  const language = (parsed.language || "html").toLowerCase();
  let code       = String(parsed.code || "");

  // Strip markdown code fences if present
  if (code.startsWith("```")) {
    code = code
      .replace(/^```[a-zA-Z]*\n?/, "")
      .replace(/\n?```$/, "")
      .trim();
  }

  console.log("CODING SUMMARY:", summary);
  console.log("CODING AGENT title:", title, "| language:", language);
  console.log("CODING AGENT code length:", code.length);

  const artifact = {
    type:     "code",
    title,
    language,
    content:  code,
  };

  console.log("CODING ARTIFACT:", { title, language, contentLength: code.length });
  console.log("═══════════════════════════════════════════════════");

  return {
    ...state,
    agent:      "coding",
    aiResponse: summary,
    artifacts:  [artifact],
  };
};