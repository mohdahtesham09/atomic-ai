import fs from "fs";
import { getModel } from "../Config/llmModel.js";
import { createRequire } from "module";
import { deductCredits } from "../utils/deductCredits.js";
const isDev = process.env.NODE_ENV !== "production";

// pdf-parse is a CommonJS module — use createRequire to import it in ESM
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

// ─── Safe JSON parser ─────────────────────────────────────────────────────────
function cleanJsonResponse(raw) {
  if (!raw) return null;
  let text = String(raw).trim()
    .replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  try { return JSON.parse(text); } catch (_) {}
  const fb = text.indexOf("{"), lb = text.lastIndexOf("}");
  if (fb !== -1 && lb > fb) { try { return JSON.parse(text.slice(fb, lb + 1)); } catch (_) {} }
  return null;
}

async function parsePdfBuffer(buffer) {
  if (typeof pdfParse === "function") {
    const res = await pdfParse(buffer);
    return { text: res?.text || "", pages: res?.numpages || 1, info: res?.info || {} };
  }
  if (pdfParse?.PDFParse) {
    const parser = new pdfParse.PDFParse({ data: buffer });
    const res = await parser.getText();
    return { text: res?.text || "", pages: res?.pages?.length || 1, info: {} };
  }
  return { text: "", pages: 0, info: {} };
}

// ─── Extract text from base64-encoded PDF ────────────────────────────────────
async function extractTextFromBase64Pdf(fileObj) {
  try {
    let buffer = null;
    if (typeof fileObj === "string") {
      const raw = fileObj.replace(/^data:[^;]+;base64,/, "");
      buffer = Buffer.from(raw, "base64");
    } else if (fileObj?.buffer) {
      if (Buffer.isBuffer(fileObj.buffer)) {
        buffer = fileObj.buffer;
      } else if (typeof fileObj.buffer === "string") {
        const raw = fileObj.buffer.replace(/^data:[^;]+;base64,/, "");
        buffer = Buffer.from(raw, "base64");
      } else {
        buffer = Buffer.from(fileObj.buffer);
      }
    } else if (fileObj?.base64 || fileObj?.previewUrl || fileObj?.content) {
      const src = fileObj.base64 || fileObj.previewUrl || fileObj.content;
      const raw = src.replace(/^data:[^;]+;base64,/, "");
      buffer = Buffer.from(raw, "base64");
    } else if (fileObj?.path && fs.existsSync(fileObj.path)) {
      buffer = fs.readFileSync(fileObj.path);
    }

    if (!buffer) return null;
    const result = await parsePdfBuffer(buffer);
    return {
      text:      result.text || "",
      pages:     result.pages || 0,
      info:      result.info || {},
    };
  } catch (err) {
    if (isDev) console.error("[pdfAgent] PDF parse error:", err.message);
    return null;
  }
}

// ─── Extract text from plain text / markdown uploaded file ───────────────────
function extractFromTextFile(file) {
  if (file.content && typeof file.content === "string" && file.content.trim().length > 5) {
    return { text: file.content, pages: 1, info: { fileName: file.name } };
  }
  return null;
}

// ─── PDF Agent ────────────────────────────────────────────────────────────────
export const pdfAgent = async (state) => {
  // ── Resolve any uploaded document ────────────────────────────────────────
  const uploadedFile =
    state.artifactFile ||
    (Array.isArray(state.uploadedFiles) && state.uploadedFiles.length > 0
      ? state.uploadedFiles[0]
      : null) ||
    state.file;

  if (!uploadedFile) {
    return {
      ...state,
      agent:      "pdf",
      aiResponse: "Please upload a PDF or text document first, then ask your question.",
      artifacts:  [],
      sources:    [],
      images:     [],
    };
  }

  // ── Extract document text ─────────────────────────────────────────────────
  let extracted = null;
  const isPdf = uploadedFile.type === "application/pdf" ||
                (uploadedFile.name || "").toLowerCase().endsWith(".pdf");

  if (isPdf) {
    extracted = await extractTextFromBase64Pdf(uploadedFile);
  }

  // Fall back to plain-text content (txt, md, js, etc.)
  if (!extracted) {
    extracted = extractFromTextFile(uploadedFile);
  }

  if (!extracted || !extracted.text || extracted.text.trim().length < 10) {
    return {
      ...state,
      agent:      "pdf",
      aiResponse: `I received **${uploadedFile.name || "your file"}** but could not extract readable text from it. For PDF files, please ensure the PDF contains selectable text (not just scanned images).`,
      artifacts:  [],
      sources:    [],
      images:     [],
    };
  }

  // ── Truncate to avoid token overflow (~12 000 chars ≈ 3 000 tokens) ────────
  const MAX_CHARS = 12000;
  const docText = extracted.text.length > MAX_CHARS
    ? extracted.text.slice(0, MAX_CHARS) + "\n\n[... document truncated for analysis ...]"
    : extracted.text;

  const model = await getModel("pdf", state.selectedModel);
  if (!model) {
    return {
      ...state,
      agent:      "pdf",
      aiResponse: "Document analysis model is not available. Please try another model.",
      artifacts:  [],
      sources:    [],
      images:     [],
    };
  }

  const llmPrompt = `You are an expert document analyst.

Document name: ${uploadedFile.name || "document"}
Pages: ${extracted.pages}
User question / task: ${state.prompt}

Document content:
---
${docText}
---

Return ONLY a raw JSON object — no markdown fences, no extra text.

Required JSON format:
{
  "summary": "One or two sentence summary of what you analyzed and what the user asked",
  "title": "Descriptive title for this analysis",
  "analysisMarkdown": "Full structured analysis in markdown"
}

Rules for analysisMarkdown:
- Use markdown headings (##, ###), bullet lists, bold, tables.
- Auto-select the right analysis type from the user task:
  - "summarize" → Executive Summary with key sections
  - "key points" / "extract" → ## Key Points with bullets
  - "questions" / "quiz" → ## Questions section
  - "notes" → ## Structured Notes
  - "important sections" → ## Important Sections with quotes
  - "ppt outline" / "slides" → ## Presentation Outline slide by slide
  - General question → Answer directly with document citations
- ONLY use information from the document. If not found, say so explicitly.
- When referencing specific information, add (Page X) if page data is available.
- Do NOT hallucinate information outside the document.

DO NOT wrap in markdown fences. DO NOT add text before or after the JSON.`;

  try {
    const res = await model.invoke(llmPrompt);
    const raw = res?.content || String(res || "");
    const parsed = cleanJsonResponse(raw);

    const fileName   = uploadedFile.name || "Document";
    const fullAnswer = parsed?.analysisMarkdown || parsed?.analysis || raw;

    if (isDev) console.log("[pdfAgent] Analyzed:", fileName, "pages:", extracted.pages);

    return {
      ...state,
      agent:      "pdf",
      aiResponse: fullAnswer,
      artifacts:  [],
      sources:    [],
      images:     [],
    };
  } catch (error) {
    if (isDev) console.error("[pdfAgent] error:", error.message);
    await deductCredits(state.userId, "pdf");
    return {
      ...state,
      agent:      "pdf",
      aiResponse: "I encountered an error analyzing the document. Please try again.",
      artifacts:  [],
      sources:    [],
      images:     [],
    };
  } finally {
    if (uploadedFile?.path && fs.existsSync(uploadedFile.path)) {
      try { fs.unlinkSync(uploadedFile.path); } catch (_) {}
    }
  }
};
