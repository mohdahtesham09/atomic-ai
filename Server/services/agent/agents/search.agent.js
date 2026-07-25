import { searchTool } from "../Config/tavily.js";
import { getModel } from "../Config/llmModel.js";
import { deductCredits } from "../utils/deductCredits.js";
const buildSearchQuery = (prompt, currencyPreference = "INR") => {
  const lower = (prompt || "").toLowerCase();
  const priceKeywords = [
    "under",
    "price",
    "product",
    "buy",
    "rupee",
    "rs",
    "₹",
    "cost",
    "budget",
    "afford",
  ];

  const needsIndiaContext =
    currencyPreference === "INR" &&
    priceKeywords.some((kw) => lower.includes(kw));

  if (!needsIndiaContext) return prompt;

  let query = prompt;

  const underMatch = lower.match(/under\s+(\d+)/);
  if (underMatch) {
    query = query.replace(/under\s+\d+/i, `under ₹${underMatch[1]}`);
  }

  if (!/india|inr|rupee|₹/i.test(query)) {
    query = `${query} India rupees INR`;
  }

  return query;
};

export const searchAgent = async (state) => {
  console.log("SEARCH AGENT RUNNING");

  if (!process.env.TAVILY_API_KEY) {
    return {
      ...state,
      agent: "search",
      aiResponse:
        "Web Search Agent is not configured yet. Add TAVILY_API_KEY to enable live search.",
      sources: [],
      images: [],
    };
  }

  try {
    const prompt = state.prompt?.toLowerCase() || "";
    const currency = state.currencyPreference || "INR";

    const isDateQuery =
      prompt.includes("current date") ||
      prompt.includes("today date") ||
      prompt.includes("today's date") ||
      prompt.includes("aaj ki date") ||
      prompt.includes("date in india") ||
      prompt.includes("what is the date") ||
      prompt.includes("what's the date") ||
      prompt.includes("date today");

    const isTimeQuery =
      prompt.includes("current time") ||
      prompt.includes("time in india") ||
      prompt.includes("india current time") ||
      prompt.includes("what time") ||
      prompt.includes("abhi time") ||
      prompt.includes("time now") ||
      prompt.includes("what is the time") ||
      prompt.includes("what's the time");

    if (isDateQuery || isTimeQuery) {
      console.log("DATE/TIME QUERY DETECTED — using backend system clock");

      const now = new Date();

      const indiaDate = new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      }).format(now);

      const indiaTime = new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      }).format(now);

      let finalAnswer;
      if (isDateQuery && isTimeQuery) {
        finalAnswer = `The current date and time in India is **${indiaDate}, ${indiaTime} IST**.\n\nIndia follows **Indian Standard Time (IST)**, which is **UTC+5:30**.`;
      } else if (isDateQuery) {
        finalAnswer = `The current date in India is **${indiaDate}**.\n\nIndia follows **Indian Standard Time (IST)**, which is **UTC+5:30**.`;
      } else {
        finalAnswer = `The current time in India is **${indiaTime} IST**.\n\nIndia follows **Indian Standard Time (IST)**, which is **UTC+5:30**.`;
      }

      return {
        ...state,
        agent: "search",
        aiResponse: finalAnswer,
        sources: [],
        images: [],
      };
    }

    const query = buildSearchQuery(state.prompt, currency);
    console.log("TAVILY QUERY:", query);

    const results = await searchTool.invoke({ query });

    let data = results;
    if (typeof results === "string") {
      try {
        data = JSON.parse(results);
      } catch (e) {
        data = { results: results };
      }
    }

    console.log("TAVILY RESULTS:", data);

    const hasResults = Array.isArray(data.results)
      ? data.results.length > 0
      : !!data.results;
    if (!hasResults && !data.answer && !data.sources) {
      return {
        ...state,
        agent: "search",
        aiResponse:
          "I couldn't find a reliable live result for this query. Please try again or check an official source.",
        sources: [],
        images: [],
      };
    }

    const llm = await getModel("search", state.selectedModel);
    const systemPrompt = `You are Automic AI Search Agent.

User currency preference: ${currency}

You are given Tavily search results.
Your job is to answer the user using only these search results.

Rules:
- If Tavily results contain a direct answer, use it directly.
- If Tavily results contain latest updates, live status, event details, or factual snippets, summarize them clearly.
- Do not say "I don't have real-time access" because search results are available.
- Do not say "search results are not enough" unless the results are empty or completely unrelated.
- If multiple sources differ, use the most relevant result first and mention that live pages can update quickly.
- Keep answer clear, direct, and professional.
- Use headings, bullet points, and bold text when useful.
- Mention source names when possible.
- If user asks for prices, products, budget, cost, or affordability:
  - If currency preference is INR, use Indian Rupees symbol ₹.
  - Do not show dollar prices unless source only has dollar price; if dollar price appears, also mention approximate INR.
  - For Indian user queries like "under 500", assume ₹500, not $500.

User query:
${state.prompt}

Tavily results:
${JSON.stringify(data.results, null, 2)}

Tavily answer:
${data.answer || "No direct Tavily answer"}

Now generate the final answer.`;

    const messages = [{ role: "system", content: systemPrompt }];
    const response = await llm.invoke(messages);
    await deductCredits(state.userId, "search")

    return {
      ...state,
      agent: "search",
      aiResponse: response.content,
      sources: data.results || data.sources || [],
      images: data.images || [],
    };
  } catch (error) {
    console.error("SEARCH AGENT ERROR:", error.message);
    return {
      ...state,
      agent: "search",
      aiResponse: "I encountered an error while searching. Please try again.",
      sources: [],
      images: [],
    };
  }
};
