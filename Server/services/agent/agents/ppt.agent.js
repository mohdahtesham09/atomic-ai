import PptxGenJS from "pptxgenjs";
import { getModel } from "../Config/llmModel.js";
import { deductCredits } from "../utils/deductCredits.js";
const isDev = process.env.NODE_ENV !== "production";

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

// ─── Theme config ─────────────────────────────────────────────────────────────
const THEME = {
  bg:        "1E293B",   // slate-800
  accent:    "06B6D4",   // cyan-500
  titleClr:  "FFFFFF",
  bodyClr:   "CBD5E1",   // slate-300
  bulletClr: "94A3B8",   // slate-400
  titleSz:   28,
  subtitleSz:18,
  bodySz:    14,
  bulletSz:  13,
};

// ─── Build PPTX binary from parsed slide data ─────────────────────────────────
async function buildPptxBuffer(title, slides) {
  const pptx = new PptxGenJS();
  pptx.author  = "Automic AI";
  pptx.subject = title;
  pptx.title   = title;

  pptx.defineLayout({ name: "LAYOUT_16x9", width: 10, height: 5.625 });
  pptx.layout = "LAYOUT_16x9";

  for (const slide of slides) {
    const sl = pptx.addSlide();

    // Background
    sl.background = { color: THEME.bg };

    // Accent bar on left
    sl.addShape(pptx.ShapeType.rect, {
      x: 0, y: 0, w: 0.08, h: 5.625,
      fill: { color: THEME.accent },
      line: { color: THEME.accent },
    });

    // Slide number badge
    sl.addText(String(slide.slideNumber || ""), {
      x: 0.18, y: 0.12, w: 0.5, h: 0.35,
      fontSize: 9, color: THEME.accent, bold: true,
    });

    // Title
    const titleText = (slide.title || "").slice(0, 120);
    sl.addText(titleText, {
      x: 0.18, y: 0.5, w: 9.6, h: 0.75,
      fontSize: THEME.titleSz, bold: true, color: THEME.titleClr,
      fontFace: "Calibri",
    });

    // Subtitle (if present)
    if (slide.subtitle) {
      sl.addText(slide.subtitle.slice(0, 160), {
        x: 0.18, y: 1.2, w: 9.6, h: 0.45,
        fontSize: THEME.subtitleSz, color: THEME.accent, italic: true,
        fontFace: "Calibri",
      });
    }

    // Bullet points
    const bullets = Array.isArray(slide.bullets) ? slide.bullets.slice(0, 7) : [];
    if (bullets.length > 0) {
      const bulletObjs = bullets.map((b) => ({
        text: "  •  " + String(b).slice(0, 200),
        options: { fontSize: THEME.bulletSz, color: THEME.bodyClr, breakLine: true },
      }));
      sl.addText(bulletObjs, {
        x: 0.18, y: slide.subtitle ? 1.75 : 1.45, w: 9.6, h: 3.2,
        fontFace: "Calibri", valign: "top",
      });
    }

    // Speaker notes
    if (slide.speakerNotes) {
      sl.addNotes(slide.speakerNotes.slice(0, 500));
    }
  }

  // Return base64 string
  const base64 = await pptx.write({ outputType: "base64" });
  return base64;
}

// ─── PPT Agent ────────────────────────────────────────────────────────────────
export const pptAgent = async (state) => {
  const model = await getModel("ppt", state.selectedModel);

  if (!model) {
    return {
      ...state,
      agent:      "ppt",
      aiResponse: "Presentation model is not available. Please try another model.",
      artifacts:  [],
      sources:    [],
      images:     [],
    };
  }

  const llmPrompt = `You are an expert presentation designer.

User request:
${state.prompt}

Conversation history:
${state.conversationMemory || "None"}

Return ONLY a raw JSON object — no markdown fences, no extra text.

Required JSON format:
{
  "summary": "One or two sentence description of the presentation",
  "title": "Full presentation title",
  "slides": [
    {
      "slideNumber": 1,
      "title": "Slide title",
      "subtitle": "Optional subtitle",
      "bullets": ["Bullet 1", "Bullet 2", "Bullet 3"],
      "speakerNotes": "Speaker notes for this slide",
      "imagePrompt": "Visual idea for this slide"
    }
  ]
}

Rules:
- Default 6–8 slides unless user specifies a number.
- Business/pitch: Cover, Problem, Solution, How It Works, Benefits, Pricing, CTA.
- Educational: Cover, Introduction, Key Concepts, Deep Dive, Examples, Summary, Q&A.
- Bullets: short, punchy, max 8 words each.
- DO NOT wrap in markdown fences.
- DO NOT add text before or after the JSON.`;

  try {
    const res = await model.invoke(llmPrompt);
    const raw = res?.content || String(res || "");
    const parsed = cleanJsonResponse(raw);

    if (!parsed || !Array.isArray(parsed.slides) || parsed.slides.length === 0) {
      return {
        ...state,
        agent:      "ppt",
        aiResponse: "I could not generate a valid presentation. Please try again.",
        artifacts:  [],
        sources:    [],
        images:     [],
      };
    }

    const presentationTitle = parsed.title || "Presentation";
    const summary = parsed.summary || `Created a ${parsed.slides.length}-slide presentation: ${presentationTitle}`;

    // Normalise slides
    const slides = parsed.slides.map((s, i) => ({
      slideNumber:  s.slideNumber  ?? i + 1,
      title:        s.title        || `Slide ${i + 1}`,
      subtitle:     s.subtitle     || "",
      bullets:      Array.isArray(s.bullets) ? s.bullets : [],
      speakerNotes: s.speakerNotes || "",
      imagePrompt:  s.imagePrompt  || "",
    }));

    // Generate real PPTX binary as base64
    let pptxBase64 = null;
    try {
      pptxBase64 = await buildPptxBuffer(presentationTitle, slides);
    } catch (pptxErr) {
      if (isDev) console.error("[pptAgent] pptxgenjs error:", pptxErr.message);
      // Still return slides artifact even if binary generation fails
    }

    const artifact = {
      type:     "slides",
      title:    presentationTitle,
      language: "slides",
      content:  { slides },
      // pptxBase64 is attached so the frontend can offer a download link
      ...(pptxBase64 ? { pptxBase64, fileName: `${presentationTitle.replace(/[^a-z0-9]/gi, "_")}.pptx` } : {}),
    };

    if (isDev) console.log("[pptAgent] Generated:", presentationTitle, "slides:", slides.length, "pptx:", Boolean(pptxBase64));
    await deductCredits(state.userId, "ppt")

    return {
      ...state,
      agent:      "ppt",
      aiResponse: summary,
      artifacts:  [artifact],
      sources:    [],
      images:     [],
    };
  } catch (error) {
    if (isDev) console.error("[pptAgent] error:", error.message);
    return {
      ...state,
      agent:      "ppt",
      aiResponse: "I encountered an error generating the presentation. Please try again.",
      artifacts:  [],
      sources:    [],
      images:     [],
    };
  }
};
