import fs from "fs";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { getModel } from "../Config/llmModel.js";

export const imageAnalyzer = async (state) => {
  const filePath = state?.file?.path;

  try {
    if (!state?.file) {
      return {
        ...state,
        agent: "vision",
        aiResponse: "Please upload an image file to analyze.",
      };
    }

    if (!filePath || !fs.existsSync(filePath)) {
      return {
        ...state,
        agent: "vision",
        aiResponse: "Uploaded image file is missing or invalid.",
      };
    }

    const mimeType = state?.file?.mimetype || "image/jpeg";

    const llm = await getModel("imageAnalyzer", state?.selectedModel);

    if (!llm) {
      throw new Error("Image analyzer model is not configured.");
    }

    const imageBuffer = fs.readFileSync(filePath);
    const base64Image = imageBuffer.toString("base64");

    const messages = [
      new SystemMessage(`
You are Atomic AI Image Analyzer Agent.

Rules:
- Analyze only the uploaded image.
- Answer the user's question accurately.
- If text exists in the image, extract it.
- If charts or tables exist, explain them.
- If something is unclear, say so.
- Use Markdown when helpful.
- Do not hallucinate.
      `),

      new HumanMessage({
        content: [
          {
            type: "text",
            text: state.prompt || "Analyze this image.",
          },
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${base64Image}`,
            },
          },
        ],
      }),
    ];

    const response = await llm.invoke(messages);

    return {
      ...state,
      agent: "vision",
      aiResponse:
        typeof response?.content === "string"
          ? response.content
          : JSON.stringify(response?.content || ""),
    };
  } catch (error) {
    console.error("Image analyzer error:", error.message);

    return {
      ...state,
      agent: "vision",
      aiResponse: error.message || "Failed to analyze the uploaded image.",
    };
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (_) {}
    }
  }
};
