import dotenv from "dotenv";
dotenv.config();

import { ChatGroq } from "@langchain/groq";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";

const hasGroq = Boolean(process.env.GROQ_API_KEY);
const hasGoogle = Boolean(process.env.GOOGLE_API_KEY);
const hasOpenRouter = Boolean(process.env.OPENROUTER_API_KEY);

// Default Groq model
export const llm = hasGroq
  ? new ChatGroq({
      apiKey: process.env.GROQ_API_KEY,
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
    })
  : null;

const groq = llm;

const geminiFlash = hasGoogle
  ? new ChatGoogleGenerativeAI({
      apiKey: process.env.GOOGLE_API_KEY,
      model: "gemini-2.5-flash",
      temperature: 0.7,
    })
  : null;

const geminiPro = hasGoogle
  ? new ChatGoogleGenerativeAI({
      apiKey: process.env.GOOGLE_API_KEY,
      model: "gemini-2.5-pro",
      temperature: 0.7,
    })
  : null;

const openRouter = hasOpenRouter
  ? new ChatOpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      model: "deepseek/deepseek-chat",
      temperature: 0,
      maxTokens: 8192,
      configuration: {
        baseURL: "https://openrouter.ai/api/v1",
      },
    })
  : null;

const fallback = () => groq || geminiFlash || openRouter;

const resolveBySelectedModel = (selectedModel, agent = "chat") => {
  if (agent === "vision") {
    const visionModelName = process.env.VISION_ANALYSIS_MODEL || "gemini-2.5-flash";
    if (selectedModel === "groq") {
      const groqVisionModel = process.env.GROQ_VISION_MODEL;
      if (groqVisionModel && hasGroq) {
        return new ChatGroq({
          apiKey: process.env.GROQ_API_KEY,
          model: groqVisionModel,
          temperature: 0.7,
        });
      }
      // Never send images to text-only llama-3.3-70b-versatile. Fallback to Gemini vision model.
      return geminiFlash || fallback();
    }
    if (selectedModel === "pro" && geminiPro) return geminiPro;
    return geminiFlash || (hasGoogle ? new ChatGoogleGenerativeAI({
      apiKey: process.env.GOOGLE_API_KEY,
      model: visionModelName,
      temperature: 0.7,
    }) : null) || fallback();
  }

  switch (selectedModel) {
    case "groq":
      return groq || fallback();
    case "deepseek":
      return openRouter || groq || fallback();
    case "flash":
      return geminiFlash || groq || fallback();
    case "pro":
      return geminiPro || groq || fallback();
    default:
      return fallback();
  }
};

export const getModel = async (agent = "chat", selectedModel) => {
  if (agent === "vision") {
    return resolveBySelectedModel(selectedModel, "vision");
  }

  if (selectedModel) {
    return resolveBySelectedModel(selectedModel, agent);
  }

  switch (agent) {
    case "chat":
      return groq || fallback();

    case "search":
      return groq || fallback();

    case "coding":
      return groq || openRouter || fallback();
    case "imageAnalyzer":
      return geminiFlash || fallback();

    case "ppt":
      return groq || fallback();

    case "pdf":
    case "pdf-rag":
    case "pdfRag":
      return groq || fallback();

    case "vision":
      return geminiFlash || fallback();

    case "router":
      return groq || fallback();

    default:
      return fallback();
  }
};
