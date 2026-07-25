import fs from "fs";
import { createRequire } from "module";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";

import { vectorStore } from "../Config/vectorDB.js";
import { getModel } from "../Config/llmModel.js";

const require = createRequire(import.meta.url);
const pdfModule = require("pdf-parse");

async function parsePdfBuffer(buffer) {
  if (typeof pdfModule === "function") {
    const res = await pdfModule(buffer);
    return res?.text || "";
  }
  if (pdfModule.PDFParse) {
    const parser = new pdfModule.PDFParse({ data: buffer });
    const res = await parser.getText();
    return res?.text || "";
  }
  return "";
}

export const pdfRag = async (state) => {
  const uploadedFile =
    state?.artifactFile ||
    state?.file ||
    (Array.isArray(state?.uploadedFiles) && state.uploadedFiles.length > 0
      ? state.uploadedFiles[0]
      : null);

  let tempPathToDelete = null;

  try {
    if (!uploadedFile) {
      return {
        ...state,
        agent: "pdf",
        aiResponse: "Please upload a PDF document first, then ask your question.",
      };
    }

    let buffer = null;

    if (uploadedFile.buffer) {
      if (Buffer.isBuffer(uploadedFile.buffer)) {
        buffer = uploadedFile.buffer;
      } else if (typeof uploadedFile.buffer === "string") {
        const raw = uploadedFile.buffer.replace(/^data:[^;]+;base64,/, "");
        buffer = Buffer.from(raw, "base64");
      } else {
        buffer = Buffer.from(uploadedFile.buffer);
      }
    } else if (uploadedFile.base64 || uploadedFile.content) {
      const raw = (uploadedFile.base64 || uploadedFile.content).replace(/^data:[^;]+;base64,/, "");
      buffer = Buffer.from(raw, "base64");
    } else if (uploadedFile.path && fs.existsSync(uploadedFile.path)) {
      buffer = fs.readFileSync(uploadedFile.path);
      tempPathToDelete = uploadedFile.path;
    }

    if (!buffer || buffer.length === 0) {
      return {
        ...state,
        agent: "pdf",
        aiResponse: "Could not read file data from uploaded PDF.",
      };
    }

    let text = "";
    try {
      text = (await parsePdfBuffer(buffer)).trim();
    } catch (parseErr) {
      console.error("[PDF Agent] parsePdfBuffer failed:", parseErr.message);
    }

    if (!text || text.length < 10) {
      return {
        ...state,
        agent: "pdf",
        aiResponse: `I received **${uploadedFile.name || "your file"}** but could not extract readable text from it. Please ensure the PDF contains selectable text (not scanned images).`,
      };
    }

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const docs = await splitter.createDocuments([text]);
    const collectionName = `pdf-${Date.now()}`;

    let context = "";
    try {
      const store = await vectorStore(docs, collectionName);
      const relevantDocs = await store.similaritySearch(state.prompt || "", 5);
      context = relevantDocs
        .map((doc) => doc.pageContent)
        .join("\n\n");
    } catch (vectorErr) {
      console.warn("[PDF Agent] Vector search fallback to document text:", vectorErr.message);
      context = text.slice(0, 12000);
    }

    const llm = await getModel("pdf-rag", state.selectedModel);

    if (!llm) {
      throw new Error("PDF RAG model is not configured.");
    }

    const messages = [
      new SystemMessage(`
You are Atomic AI PDF Assistant.

Rules:
- Answer only from the uploaded PDF.
- Never make up information.
- If the answer is not present in the PDF, reply:
  "I couldn't find this information in the uploaded PDF."
- Use Markdown formatting when helpful.
      `),

      new HumanMessage(`
Context:
${context}

Question:
${state.prompt || "Summarize this PDF."}
      `),
    ];

    const response = await llm.invoke(messages);
    const contentText =
      typeof response?.content === "string"
        ? response.content
        : JSON.stringify(response?.content || "");

    return {
      ...state,
      agent: "pdf",
      aiResponse: contentText,
    };
  } catch (error) {
    console.error("PDF RAG Agent Error:", error.message);

    return {
      ...state,
      agent: "pdf",
      aiResponse: error.message || "Failed to analyze the PDF.",
    };
  } finally {
    if (tempPathToDelete && fs.existsSync(tempPathToDelete)) {
      try {
        fs.unlinkSync(tempPathToDelete);
      } catch (_) {}
    }
  }
};
