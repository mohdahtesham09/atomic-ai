import { ChatGroq } from "@langchain/groq";

export const generateBasicChatResponse = async ({ message, history = [] }) => {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is missing in chat service .env");
  }

  if (!message || !message.trim()) {
    throw new Error("Message is required");
  }

  const model = new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: "llama-3.3-70b-versatile",
    temperature: 0.7,
  });

  const response = await model.invoke([
    {
      role: "system",
      content:
        "You are Atomic AI, a helpful AI assistant. Give clear, practical, concise answers.",
    },
    ...history,
    {
      role: "user",
      content: message,
    },
  ]);

  const content = response?.content || "";

  if (!content) {
    console.log("Raw Groq response:", response);
    throw new Error("Groq response content missing");
  }

  return content;
};
