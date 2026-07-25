import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Copy, RefreshCw, ExternalLink, Globe, Image as ImageIcon, Code2 } from "lucide-react";

const MessageUI = ({ message, index, onRegenerate, onRetry, isRegenerating }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [copied, setCopied] = useState(false);

  const isUser   = message?.role === "user";
  const isFailed = Boolean(message?.failed);

  // Safely normalize content — handles strings, objects, null, undefined
  const normalizeContent = (val) => {
    if (typeof val === "string") return val;
    if (val && typeof val === "object") {
      return (
        val.message ||
        val.content ||
        val.text ||
        val.answer ||
        val.result ||
        JSON.stringify(val, null, 2)
      );
    }
    return "";
  };

  const rawContent = message?.content || message?.text || message?.message || "";
  const content  = normalizeContent(rawContent);

  // Search result metadata
  const sources = Array.isArray(message?.sources) ? message.sources : [];
  const rawImages = Array.isArray(message?.images) ? message.images : [];
  const singleUrl = message?.imageUrl || message?.data?.imageUrl;
  const images = rawImages.length > 0
    ? rawImages
    : (singleUrl ? [{ url: singleUrl, imageUrl: singleUrl }] : []);
  const artifacts = Array.isArray(message?.artifacts) ? message.artifacts : [];
  const hasSources = sources.length > 0;
  const hasImages = images.length > 0;
  
  // Filter coding vs slides artifacts
  const codingArtifacts = artifacts.filter(
    (art) => art.type !== "slides" && art.type !== "ppt" && art.type !== "presentation"
  );
  const slidesArtifacts = artifacts.filter(
    (art) => art.type === "slides" || art.type === "ppt" || art.type === "presentation"
  );
  
  const hasCodingArtifacts = codingArtifacts.length > 0;
  const hasSlides = slidesArtifacts.length > 0;
  const isCodingWithArtifacts =
    hasCodingArtifacts && (message?.agent === "coding" || message?.agent === "code");

  // When code lives in the Artifact panel, chat shows summary only — strip fenced code blocks
  const displayContent = isCodingWithArtifacts
    ? content.replace(/```[\s\S]*?```/g, "").trim() || content.split("\n").slice(0, 3).join("\n").trim()
    : content;

  const handleCopy = () => {
    if (!displayContent) return;
    navigator.clipboard.writeText(displayContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Helper: extract hostname from URL for fallback label
  const getDomain = (url) => {
    try {
      return new URL(url).hostname.replace("www.", "");
    } catch {
      return url;
    }
  };

  // Helper: parse slides content safely
  const getSlides = (art) => {
    try {
      if (typeof art.content === "object" && art.content?.slides) {
        return art.content.slides;
      }
      if (typeof art.content === "string") {
        const parsed = JSON.parse(art.content);
        return parsed.slides || parsed || [];
      }
    } catch (e) {
      console.error("Failed to parse slides content:", e);
    }
    return [];
  };

  // Helper: Download Base64 File
  const downloadBase64File = (base64, fileName, mimeType) => {
    if (!base64) return;
    try {
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i += 1) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName || "atomic-ai-presentation.pptx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Failed to download Base64 file:", e);
    }
  };

  if (isUser) {
    return (
      <div className="flex w-full justify-end group py-1">
        <div className="relative max-w-[75%] flex flex-col items-end gap-1.5">
          <div className={`rounded-[24px] rounded-tr-[8px] px-5 py-3 text-[15px] leading-relaxed shadow-sm ${isFailed ? "bg-red-50 ring-1 ring-red-200/60" : "bg-slate-100"} text-slate-800`}>
            <div className="whitespace-pre-wrap break-words">{content}</div>
          </div>
          {isFailed && onRetry && (
            <button
              type="button"
              onClick={() => onRetry(content)}
              className="flex items-center gap-1.5 text-[11.5px] font-semibold text-red-500 hover:text-red-600 transition-colors"
            >
              <RefreshCw size={12} />
              Failed · Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  // Assistant Message UI
  return (
    <div
      className="group relative flex w-full justify-start py-4"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="w-full max-w-[880px] text-[15.5px] leading-8 text-slate-700">
        {/* ── Main Answer Text ─────────────────────────────────────────────── */}
        <ReactMarkdown
          components={{
            h1: ({ children }) => <h1 className="mb-5 mt-8 text-[26px] font-bold text-slate-900 leading-tight tracking-tight first:mt-0">{children}</h1>,
            h2: ({ children }) => <h2 className="mb-4 mt-8 text-[20px] font-bold text-slate-900 leading-snug tracking-tight first:mt-0">{children}</h2>,
            h3: ({ children }) => <h3 className="mb-3 mt-6 text-[17px] font-semibold text-slate-900 first:mt-0">{children}</h3>,
            p: ({ children }) => <p className="mb-5 leading-[1.8] text-slate-700 last:mb-0">{children}</p>,
            ul: ({ children }) => <ul className="mb-6 list-disc space-y-2.5 pl-6 text-slate-700 marker:text-slate-400">{children}</ul>,
            ol: ({ children }) => <ol className="mb-6 list-decimal space-y-2.5 pl-6 text-slate-700 marker:text-slate-400">{children}</ol>,
            li: ({ children }) => <li className="leading-relaxed pl-1">{children}</li>,
            strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
            code: ({ inline, className, children }) => {
              const match = /language-(\w+)/.exec(className || "");
              const language = match ? match[1] : "Text";
              if (!inline) {
                return (
                  <div className="my-6 overflow-hidden rounded-xl bg-[#FAFAFA] border border-slate-200/80 shadow-sm">
                    <div className="flex items-center justify-between bg-slate-100/60 px-4 py-2.5 border-b border-slate-200/80">
                      <span className="text-[12px] font-semibold uppercase tracking-wider text-slate-500">{language}</span>
                    </div>
                    <div className="overflow-x-auto p-4">
                      <code className="text-[14px] leading-[1.6] text-slate-800 font-mono block">{children}</code>
                    </div>
                  </div>
                );
              }
              return (
                <code className="rounded-md bg-slate-100/80 px-1.5 py-0.5 text-[13.5px] text-cyan-700 font-mono font-medium">{children}</code>
              );
            },
            a: ({ href, children }) => (
              <a href={href} target="_blank" rel="noopener noreferrer" className="text-cyan-600 font-medium hover:text-cyan-700 hover:underline underline-offset-2">
                {children}
              </a>
            ),
            blockquote: ({ children }) => (
              <blockquote className="border-l-4 border-slate-200 pl-4 py-1 italic text-slate-500 my-5 bg-slate-50/50 rounded-r-lg">
                {children}
              </blockquote>
            ),
          }}
        >
          {displayContent}
        </ReactMarkdown>

        {/* ── Slides/PPT Card Section ────────────────────────────────────────── */}
        {hasSlides && (
          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-orange-200/80 bg-orange-50/30 p-5 shadow-sm">
            {slidesArtifacts.map((art, idx) => {
              const slides = getSlides(art);
              const pptxBase64 = art.pptxBase64 || art.content?.pptxBase64 || null;
              const fileName = art.fileName || art.content?.fileName || "presentation.pptx";
              
              return (
                <div key={idx} className="flex flex-col gap-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500 text-white shadow-md shadow-orange-500/20">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-slate-800 leading-tight">
                          {art.title || "PowerPoint Presentation"}
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5 font-medium">
                          PowerPoint Deck · {slides.length} {slides.length === 1 ? "slide" : "slides"}
                        </p>
                      </div>
                    </div>
                    {pptxBase64 && (
                      <button
                        onClick={() => downloadBase64File(
                          pptxBase64,
                          fileName,
                          "application/vnd.openxmlformats-officedocument.presentationml.presentation"
                        )}
                        className="flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-orange-700 transition-all active:scale-95 cursor-pointer shrink-0"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download PPT
                      </button>
                    )}
                  </div>

                  {/* Previews grid */}
                  {slides.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-1">
                      {slides.slice(0, 3).map((slide, sIdx) => (
                        <div key={sIdx} className="flex flex-col justify-between p-3.5 rounded-xl border border-orange-100 bg-white aspect-[16/9] shadow-sm select-none transition-transform hover:scale-[1.01]">
                          <div className="text-[11px] font-bold text-slate-800 line-clamp-1 border-b border-slate-50 pb-1 leading-tight">
                            {slide.title || `Slide ${sIdx + 1}`}
                          </div>
                          <div className="flex-1 mt-1.5 text-[9px] text-slate-500 overflow-hidden leading-normal">
                            {Array.isArray(slide.content) ? (
                              slide.content.slice(0, 3).map((bullet, bIdx) => (
                                <div key={bIdx} className="truncate">• {bullet}</div>
                              ))
                            ) : (
                              <div className="line-clamp-3">{slide.content || slide.text || ""}</div>
                            )}
                          </div>
                          <div className="text-right text-[7px] text-slate-400 font-mono font-semibold mt-1">
                            {sIdx + 1}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Artifact Badge (Coding Agent) ────────────────────────────────────── */}
        {isCodingWithArtifacts && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-teal-200/80 bg-teal-50/60 px-3.5 py-2 text-[12.5px] font-medium text-teal-700 select-none">
            <div className="flex h-5 w-5 items-center justify-center rounded-md bg-teal-500/10">
              <Code2 size={11} className="text-teal-600" />
            </div>
            <span>
              {codingArtifacts[0]?.title
                ? <><span className="font-semibold">{codingArtifacts[0].title}</span> opened in Artifact panel</>  
                : "Code opened in Artifact panel"
              }
            </span>
          </div>
        )}

        {/* ── Sources Section ───────────────────────────────────────────────── */}
        {hasSources && (
          <div className="mt-5 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-1.5 mb-3">
              <Globe size={13} className="text-slate-400" />
              <span className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Sources</span>
            </div>
            <div className="flex flex-col gap-2">
              {sources.map((source, i) => {
                const url = typeof source === "string" ? source : source?.url;
                const title = typeof source === "object" ? source?.title : null;
                const label = title || getDomain(url || "") || `Source ${i + 1}`;
                if (!url) return null;
                return (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group/src flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-slate-50/70 px-3.5 py-2.5 text-[13px] text-slate-600 hover:border-slate-300 hover:bg-white hover:text-cyan-600 transition-all duration-200 w-full overflow-hidden"
                  >
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-white border border-slate-200/80 shadow-sm">
                      <img
                        src={`https://www.google.com/s2/favicons?domain=${getDomain(url)}&sz=16`}
                        alt=""
                        className="h-3 w-3"
                        onError={(e) => { e.target.style.display = "none"; }}
                      />
                    </div>
                    <span className="flex-1 truncate font-medium">{label}</span>
                    <ExternalLink size={12} className="shrink-0 text-slate-300 group-hover/src:text-cyan-400 transition-colors" />
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Images Section ─────────────────────────────────────────────────── */}
        {hasImages && (
          <div className="mt-5 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-1.5 mb-3">
              <ImageIcon size={13} className="text-slate-400" />
              <span className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Images</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
              {images.slice(0, 8).map((img, i) => {
                const src = typeof img === "string" ? img : img?.url || img?.imageUrl || img?.src;
                if (!src) return null;
                return (
                  <a
                    key={i}
                    href={src}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group/img relative overflow-hidden rounded-xl border border-slate-200/80 bg-slate-100 aspect-square block"
                  >
                    <img
                      src={src}
                      alt={`Search result ${i + 1}`}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover/img:scale-105"
                      onError={(e) => {
                        e.target.parentElement.style.display = "none";
                      }}
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/10 transition-all duration-200 flex items-center justify-center">
                      <ExternalLink size={14} className="text-white opacity-0 group-hover/img:opacity-100 transition-opacity drop-shadow-md" />
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Action Buttons ────────────────────────────────────────────────── */}
        <div className={`mt-3 flex items-center gap-2 transition-all duration-200 ${isHovered || isRegenerating ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"}`}>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            title="Copy response"
          >
            <Copy size={15} />
            {copied && <span className="text-[11px] font-medium text-slate-500">Copied</span>}
          </button>

          <button
            onClick={() => onRegenerate && onRegenerate(index)}
            disabled={isRegenerating}
            className={`flex items-center gap-1.5 rounded-lg p-1.5 transition-colors ${
              isRegenerating
                ? "text-cyan-500 bg-cyan-50/50 cursor-not-allowed"
                : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            }`}
            title="Regenerate"
          >
            <RefreshCw size={15} className={isRegenerating ? "animate-spin" : ""} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MessageUI;
