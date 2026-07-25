import { getModel } from "../Config/llmModel.js";

export const router = async (state) => {
  const normalizeSelectedAgent = (agent) => {
    const value = String(agent || "auto").toLowerCase();
    const aliases = {
      general: "chat",
      default: "chat",
      web: "search",
      document: "pdf",
      presentation: "ppt",
      image: "vision",
      imageagent: "vision",
      imageanalyzer: "vision",
    };
    return aliases[value] || value;
  };

  const selected = normalizeSelectedAgent(state.selectedAgent);

  if (selected && selected !== "auto") {
    const validAgents = ["chat", "search", "coding", "pdf", "ppt", "vision"];
    if (validAgents.includes(selected)) {
      return {
        ...state,
        agent: selected,
      };
    }
  }

  // Safe file checks for auto-routing mode
  if (state.file?.mimetype === "application/pdf" || state.artifactFile?.type === "application/pdf") {
    return {
      ...state,
      agent: "pdf",
    };
  }

  if (state.file?.mimetype?.startsWith("image/") || state.artifactFile?.type?.startsWith("image/")) {
    return {
      ...state,
      agent: "vision",
    };
  }

  const prompt = String(state.prompt || "").toLowerCase();

  const codingKeywords = [
    "code",
    "write code",
    "make code",
    "generate code",
    "webapp",
    "web app",
    "website",
    "landing page",
    "html",
    "css",
    "tailwind",
    "javascript",
    "react",
    "jsx",
    "component",
    "navbar",
    "dashboard",
    "form",
    "page",
    "ui",
    "frontend",
    "fix this code",
    "debug",
    "bug",
    "optimize code",
    "convert code",
  ];

  if (codingKeywords.some((kw) => prompt.includes(kw))) {
    console.log("AUTO ROUTER KEYWORD MATCHED: coding");
    return { ...state, agent: "coding" };
  }

  const llm = await getModel("router");
  const routerPrompt = `You are Automic AI, a professional multi-agent AI assistant router.


Available Agents:

- chat
- search
- coding
- pdf
- ppt
- vision

Rules:

chat:
General conversation,
explanations,
learning,
concepts,
brainstorming,
career guidance,
study help,
simple questions.

search:
Latest information,
current events,
news,
recent updates,
web research,
internet lookup,
fact checking,
new tools,
new ai tools,
company information,
market trends.

coding:
Generate code,
debug code,
fix errors,
explain code,
build features,
project architecture,
API design,
database design,
frontend issues,
backend issues,
Docker,
Redis,
AWS,
CI/CD,
Git/GitHub.

pdf:
Questions about PDFs,
document context,
PDF summary,
document analysis,
resume analysis,
offer letter review,
contract review,
invoice reading,
research paper explanation,
notes generation,
key points extraction.

ppt:
Generate presentations,
create PPT outlines,
slide-by-slide content,
pitch decks,
speaker notes,
presentation improvement,
convert topic into slides,
business presentations,
course/training slides.

vision:
Image understanding,
screenshot analysis,
UI review,
diagram explanation,
handwritten notes reading,
chart analysis,
visual content extraction,
image generation,
image editing,
visual design suggestions.

Use the provided conversation history to answer the user. If the user previously shared their name, preference, project detail, or instruction in this conversation, remember and use it.

Do not say you do not know something if it exists in the conversation history.


Response style:
- Start with a direct answer.
- Use clear headings and subheadings for long answers.
- Use bullet points and numbered lists.
- Bold important terms.
- Keep paragraphs short.
- Give practical, useful, and professional answers.
- Avoid robotic phrases like "I am a large language model" unless absolutely necessary.
- If the user asks a casual question, respond naturally.
- If the user asks a technical question, explain step-by-step.
- If the user asks about current/latest information and no search results are provided, say that live search is needed.

Conversation history:
${state.conversationMemory || state.memory || "No previous conversation history."}

User message:
${state.prompt}
`;
  const response = await llm.invoke(routerPrompt);

  const raw = String(response.content || "")
    .trim()
    .toLowerCase();
  const validAgents = ["chat", "search", "coding", "pdf", "ppt", "vision"];
  const matched = validAgents.find((agent) => raw.includes(agent)) || "chat";

  console.log("ROUTER RAW:", raw);
  console.log("ROUTER MATCHED:", matched);

  return {
    ...state,
    agent: matched,
  };
};
