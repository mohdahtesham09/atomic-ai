import React, { useState, useEffect, useRef } from "react";
import { FiCode, FiCopy, FiCheck } from "react-icons/fi";
import {
  X,
  MoreHorizontal,
  PencilLine,
  Trash2,
  Code2,
  ChevronRight,
  Maximize2,
  Minimize2,
  Eye,
  Download,
  Upload,
  FileCode,
  AlertCircle,
  Smartphone,
  Tablet,
  Monitor,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// normalizeArtifactContent
// Safely extracts a string from any artifact content shape and strips code fences.
// ─────────────────────────────────────────────────────────────────────────────
const normalizeArtifactContent = (content) => {
  if (content === null || content === undefined) return "";

  if (typeof content !== "string") {
    if (typeof content === "object") {
      content =
        content.html ||
        content.code ||
        content.content ||
        content.text ||
        content.result ||
        "";
    } else {
      content = String(content);
    }
  }

  let str = String(content).trim();

  // Strip wrapping markdown code fences if present (e.g. ```html ... ```)
  if (str.startsWith("```")) {
    str = str
      .replace(/^```[a-zA-Z]*\n?/, "")
      .replace(/\n?```$/, "")
      .trim();
  }

  return str;
};

// ─────────────────────────────────────────────────────────────────────────────
// buildPreviewHtml
// Converts an artifact into a full HTML document string for iframe srcDoc.
// ─────────────────────────────────────────────────────────────────────────────
const buildPreviewHtml = (artifact) => {
  if (!artifact?.content) return null;

  const content = normalizeArtifactContent(artifact.content);
  if (!content) return null;

  const { language } = artifact;
  const trimmedContent = content.trimStart();

  // Full HTML document — ensure viewport meta tag exists
  if (
    trimmedContent.startsWith("<!DOCTYPE") ||
    trimmedContent.startsWith("<html") ||
    trimmedContent.includes("<html")
  ) {
    if (!trimmedContent.includes('name="viewport"')) {
      if (content.includes("<head>")) {
        return content.replace(
          /<head>/i,
          `<head>\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">`
        );
      } else if (content.includes("<html")) {
        return content.replace(
          /(<html[^>]*>)/i,
          `$1\n<head><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>`
        );
      }
    }
    return content;
  }

  if (language === "html" || trimmedContent.startsWith("<")) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Preview</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #ffffff; color: #0f172a; }
    img { max-width: 100%; height: auto; }
  </style>
</head>
<body>${content}</body>
</html>`;
  }

  if (language === "css") {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>CSS Preview</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 16px; font-family: system-ui, sans-serif; }
    ${content}
  </style>
</head>
<body>
  <p style="color:#94a3b8;font-size:13px;">CSS preview — add HTML content to see styled output.</p>
</body>
</html>`;
  }

  if (language === "javascript" || language === "js") {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>JS Preview</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 16px; font-family: system-ui, sans-serif; background:#f8fafc; color:#334155; }
    #output { background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:16px; min-height:60px; }
    pre { margin:0; white-space:pre-wrap; font-size:13px; }
  </style>
</head>
<body>
  <div id="output"></div>
  <script>
    const output = document.getElementById('output');
    const origLog = console.log;
    console.log = (...args) => {
      origLog(...args);
      const pre = document.createElement('pre');
      pre.textContent = args.map(a => typeof a === 'object' ? JSON.stringify(a,null,2) : String(a)).join(' ');
      output.appendChild(pre);
    };
    try {
      ${content}
    } catch(e) {
      output.innerHTML = '<pre style="color:#ef4444">Error: ' + e.message + '</pre>';
    }
  </script>
</body>
</html>`;
  }

  // React / JSX / TypeScript — not directly previewable
  return null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Accepted file types for upload
// ─────────────────────────────────────────────────────────────────────────────
const ACCEPT_TYPES = ".js,.jsx,.ts,.tsx,.html,.css,.json,.txt,.md,.py,.java,.c,.cpp,.go,.rs";

// ─────────────────────────────────────────────────────────────────────────────
// Artifact Component
// ─────────────────────────────────────────────────────────────────────────────
const Artifact = ({
  isOpen = false,
  artifact = null,
  artifactMode = "code",
  setArtifactMode,
  uploadedArtifactFile = null,
  setUploadedArtifactFile,
  onClose,
  onToggle,
  isExpanded,
  onToggleExpanded,
  onRenameArtifact,
  onDeleteArtifact,
}) => {
  const [copied, setCopied]           = useState(false);
  const [menuOpen, setMenuOpen]       = useState(false);
  const [isRenaming, setIsRenaming]   = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [viewportSize, setViewportSize] = useState("full"); // "mobile", "tablet", "desktop", "full"

  const menuRef    = useRef(null);
  const renameRef  = useRef(null);
  const fileInputRef = useRef(null);

  // Sync rename value when artifact changes
  useEffect(() => {
    setRenameValue(artifact?.title ?? "");
  }, [artifact]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target))
        setMenuOpen(false);
    };
    if (menuOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  // Auto-focus rename input
  useEffect(() => {
    if (isRenaming) renameRef.current?.focus();
  }, [isRenaming]);

  // Copy artifact content to clipboard
  const handleCopy = async () => {
    const text = normalizeArtifactContent(artifact?.content);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  // Commit rename
  const commitRename = () => {
    const sanitized = renameValue.trim() || "Untitled Artifact";
    onRenameArtifact?.(sanitized);
    setIsRenaming(false);
  };

  // Delete artifact
  const handleDelete = () => {
    setMenuOpen(false);
    if (!window.confirm("Delete this artifact?")) return;
    onDeleteArtifact?.();
  };

  // File upload handler
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const uploaded = { name: file.name, type: file.type, content: text };
      setUploadedArtifactFile?.(uploaded);
      console.log("ARTIFACT FILE UPLOADED:", file.name, "size:", text.length);
    } catch (err) {
      console.error("File read failed:", err);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Determine if preview is available
  const previewHtml = artifact ? buildPreviewHtml(artifact) : null;
  const canPreview = previewHtml !== null;
  const isDisabled = !artifact && !uploadedArtifactFile;

  return (
    <>
      {/* ── Mobile backdrop overlay ─────────────────────────────────── */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-[9997] xl:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* ── Floating vertical tab ─────────────────────────────────────────── */}
      <button
        id="artifact-tab-btn"
        onClick={onToggle}
        title="Toggle Artifact panel"
        className={`
          fixed right-0 top-1/2 z-[9999]
          flex flex-col items-center justify-center gap-1.5
          h-28 w-9 rounded-l-2xl
          bg-white/95 backdrop-blur-xl
          border border-r-0 border-slate-200/80
          shadow-[0_16px_45px_rgba(148,163,184,0.22)]
          transition-all duration-300 hover:text-sky-500 hover:shadow-[0_20px_60px_rgba(14,165,233,0.20)]
          ${isOpen ? (isExpanded ? "-translate-x-[min(760px,100vw)] -translate-y-1/2" : "-translate-x-[min(460px,100vw)] -translate-y-1/2") : "-translate-x-0 -translate-y-1/2"}
          ${isDisabled
            ? "text-slate-400 opacity-50 cursor-pointer hover:bg-white hover:text-slate-500"
            : "text-slate-500 hover:bg-white hover:text-slate-900"
          }
        `}
        aria-label="Toggle Artifact panel"
      >
        <Code2 size={13} className={isDisabled ? "text-slate-300" : "text-slate-400"} />
        <span className="[writing-mode:vertical-lr] text-[9px] font-bold tracking-[0.15em] rotate-180 select-none uppercase">
          Artifact
        </span>
        <ChevronRight size={11} className={`rotate-180 ${isDisabled ? "text-slate-300" : "text-slate-400"}`} />
      </button>

      {/* ── Main panel ────────────────────────────────────────────────────── */}
      <aside
        className={`
          fixed right-0 top-0 h-full min-h-dvh z-[9998] flex-shrink-0
          flex flex-col overflow-hidden
          bg-gradient-to-br from-white via-sky-50/40 to-cyan-50/30 backdrop-blur-2xl
          border-l border-slate-200/80
          shadow-[-24px_0_80px_rgba(148,163,184,0.20)]
          transition-all duration-300 will-change-transform
          ${isOpen ? "translate-x-0" : "translate-x-full"}
          w-full sm:w-[460px] ${isExpanded ? "xl:w-[760px]" : "w-full sm:w-[460px]"}
        `}
        aria-label="Artifact output panel"
        aria-hidden={!isOpen}
      >
        <div className="relative z-10 flex flex-col h-full overflow-hidden">

          {/* ╔═══════════════════════════════════╗
              ║  HEADER                           ║
              ╚═══════════════════════════════════╝ */}
          <div className="relative z-10 h-16 flex items-center justify-between px-4 bg-white/80 border-b border-slate-200/70 backdrop-blur-xl flex-shrink-0">
            {/* Left: icon + title */}
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center flex-shrink-0 shadow-[0_6px_20px_rgba(52,211,153,0.28)]">
                <FiCode size={14} className="text-white" strokeWidth={2.5} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold text-slate-900 leading-tight tracking-tight truncate">
                  {artifact?.title || "Artifact"}
                </p>
                <p className="text-[10px] text-slate-500 font-medium truncate">
                  {artifact?.language
                    ? `${artifact.language} · Generated by Atomic AI`
                    : "Generated workspace"}
                </p>
              </div>
            </div>

            {/* Right: action buttons */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {/* Copy */}
              {artifact && (
                <button
                  id="artifact-copy-btn"
                  onClick={handleCopy}
                  title="Copy to clipboard"
                  className="h-8 w-8 flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100/80 transition-all duration-200"
                >
                  {copied
                    ? <FiCheck size={13} className="text-emerald-500" />
                    : <FiCopy size={13} />
                  }
                </button>
              )}

              {/* Fullscreen toggle */}
              <button
                id="artifact-expand-btn"
                onClick={onToggleExpanded}
                title={isExpanded ? "Collapse" : "Expand"}
                className="h-8 w-8 flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100/80 transition-all duration-200"
              >
                {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>

              {/* Three-dot menu */}
              {artifact && (
                <div className="relative" ref={menuRef}>
                  <button
                    id="artifact-menu-btn"
                    onClick={() => setMenuOpen((p) => !p)}
                    title="Artifact options"
                    className={`h-8 w-8 flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100/80 transition-all duration-200 ${menuOpen ? "bg-slate-100/80 text-slate-900" : ""}`}
                  >
                    <MoreHorizontal size={16} />
                  </button>

                  {menuOpen && (
                    <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-44 bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-xl shadow-[0_15px_45px_rgba(148,163,184,0.25)] overflow-hidden py-1">
                      <button
                        id="artifact-rename-btn"
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-[12.5px] font-medium text-slate-700 hover:bg-slate-100 transition-colors duration-150"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenameValue(artifact?.title ?? "");
                          setIsRenaming(true);
                          setMenuOpen(false);
                        }}
                      >
                        <PencilLine size={13} className="text-slate-400" />
                        Rename
                      </button>
                      <div className="mx-2 my-1 h-px bg-slate-100" />
                      <button
                        id="artifact-delete-btn"
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-[12.5px] font-medium text-red-500 hover:bg-red-50 transition-colors duration-150"
                        onClick={handleDelete}
                      >
                        <Trash2 size={13} className="text-red-400" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Close */}
              <button
                id="artifact-close-btn"
                onClick={onClose}
                title="Close artifact panel"
                className="h-8 w-8 flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100/80 transition-all duration-200"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* ── Inline rename input ── */}
          {isRenaming && (
            <div className="relative z-10 px-4 py-2.5 border-b border-slate-200/70 bg-white/30 flex-shrink-0">
              <input
                ref={renameRef}
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename();
                  if (e.key === "Escape") setIsRenaming(false);
                }}
                onBlur={commitRename}
                placeholder="Artifact title…"
                className="w-full bg-white/80 border border-sky-300 rounded-xl px-3 py-1.5 text-[12.5px] text-slate-800 font-medium outline-none focus:ring-2 focus:ring-sky-200/60 transition-all duration-150"
              />
            </div>
          )}

          {/* ╔═══════════════════════════════════╗
              ║  TOOLBAR: Code / Preview + Upload  ║
              ╚═══════════════════════════════════╝ */}
          <div className="relative z-10 flex items-center justify-between px-4 py-2.5 border-b border-slate-200/60 bg-white/50 flex-shrink-0 flex-wrap gap-2">
            {/* Left controls: Code/Preview tabs & Viewport switcher */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Code / Preview tab pills */}
              <div className="flex items-center gap-1 bg-slate-100/80 rounded-xl p-0.5">
                <button
                  id="artifact-tab-code"
                  onClick={() => setArtifactMode?.("code")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[12px] font-semibold transition-all duration-200 ${
                    artifactMode === "code"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <Code2 size={12} />
                  Code
                </button>
                <button
                  id="artifact-tab-preview"
                  onClick={() => setArtifactMode?.("preview")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[12px] font-semibold transition-all duration-200 ${
                    artifactMode === "preview"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <Eye size={12} />
                  Preview
                </button>
              </div>

              {/* Viewport size controls (visible when in preview mode and canPreview) */}
              {artifactMode === "preview" && canPreview && (
                <div className="flex items-center gap-0.5 bg-slate-100/80 rounded-xl p-0.5">
                  {[
                    { id: "mobile", label: "Mobile", icon: Smartphone, width: "375px" },
                    { id: "tablet", label: "Tablet", icon: Tablet, width: "768px" },
                    { id: "desktop", label: "Desktop", icon: Monitor, width: "1280px" },
                    { id: "full", label: "Full", icon: Maximize2, width: "100%" },
                  ].map((vp) => (
                    <button
                      key={vp.id}
                      id={`viewport-btn-${vp.id}`}
                      onClick={() => setViewportSize(vp.id)}
                      title={`Preview ${vp.label} (${vp.width})`}
                      className={`flex items-center gap-1 px-2 py-1 rounded-[8px] text-[11px] font-medium transition-all duration-150 ${
                        viewportSize === vp.id
                          ? "bg-white text-sky-600 font-semibold shadow-sm"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      <vp.icon size={11} />
                      <span className="hidden sm:inline">{vp.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* File upload section */}
            <div className="flex items-center gap-2">
              {artifact?.pptxBase64 && (
                <button
                  id="artifact-download-pptx"
                  onClick={() => {
                    try {
                      const byteChars = atob(artifact.pptxBase64);
                      const byteNums  = new Uint8Array(byteChars.length).map((_, i) => byteChars.charCodeAt(i));
                      const blob      = new Blob([byteNums], { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
                      const url       = URL.createObjectURL(blob);
                      const a         = document.createElement("a");
                      a.href          = url;
                      a.download      = artifact.fileName || `${artifact.title || "presentation"}.pptx`;
                      a.click();
                      URL.revokeObjectURL(url);
                    } catch (_) {}
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-violet-200/80 bg-violet-50 text-[11px] font-semibold text-violet-700 hover:bg-violet-100 hover:border-violet-300 transition-all shadow-sm"
                  title="Download PPTX"
                >
                  <Download size={11} />
                  Download PPTX
                </button>
              )}
              {uploadedArtifactFile && (
                <div className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-200/80 rounded-lg px-2.5 py-1 max-w-[130px]">
                  <FileCode size={10} className="text-indigo-500 flex-shrink-0" />
                  <span className="text-[10.5px] font-medium text-indigo-700 truncate">
                    {uploadedArtifactFile.name}
                  </span>
                  <button
                    onClick={() => setUploadedArtifactFile?.(null)}
                    className="text-indigo-400 hover:text-indigo-600 flex-shrink-0 ml-0.5"
                    title="Remove file"
                  >
                    <X size={9} />
                  </button>
                </div>
              )}

              <button
                id="artifact-upload-btn"
                onClick={() => fileInputRef.current?.click()}
                title="Upload code file"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200/80 bg-white/80 text-[11px] font-medium text-slate-600 hover:text-slate-900 hover:bg-white hover:border-slate-300 transition-all duration-200 shadow-sm"
              >
                <Upload size={11} />
                Upload
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT_TYPES}
                onChange={handleFileUpload}
                className="hidden"
                aria-label="Upload code file"
              />
            </div>
          </div>

          {/* ╔═══════════════════════════════════╗
              ║  CONTENT AREA                     ║
              ╚═══════════════════════════════════╝ */}
          <div className="relative z-10 flex-1 min-h-0 overflow-hidden">
            {!artifact ? (
              /* ── Empty state ── */
              <div className="flex flex-col items-center justify-center h-full gap-4 py-16 px-5 overflow-y-auto">
                <div className="w-14 h-14 rounded-2xl bg-white/80 border border-slate-200/70 flex items-center justify-center shadow-sm">
                  <Code2 size={22} className="text-slate-400" />
                </div>
                <div className="text-center">
                  <p className="text-[14px] font-semibold text-slate-900">No artifact yet</p>
                  <p className="text-[12px] text-slate-500 mt-1 leading-relaxed max-w-[220px] mx-auto">
                    Select the <span className="font-semibold text-slate-700">Coding</span> agent and ask to write code. Or upload a file to analyze it.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center mt-1">
                  {["Write a food cart webapp", "Build a SaaS landing page", "Fix my code"].map((hint) => (
                    <span key={hint} className="text-[10.5px] px-3 py-1 rounded-full bg-white/60 border border-slate-200/60 text-slate-500 font-medium">
                      {hint}
                    </span>
                  ))}
                </div>

                {uploadedArtifactFile && (
                  <div className="mt-2 flex items-center gap-2 bg-indigo-50 border border-indigo-200/80 rounded-xl px-4 py-2.5">
                    <FileCode size={14} className="text-indigo-500 flex-shrink-0" />
                    <div>
                      <p className="text-[12px] font-semibold text-indigo-700">{uploadedArtifactFile.name}</p>
                      <p className="text-[11px] text-indigo-500">Ready as context · ask Coding agent to fix or explain it</p>
                    </div>
                  </div>
                )}
              </div>
            ) : artifactMode === "code" ? (
              /* ── CODE TAB ── */
              <div className="h-full overflow-y-auto p-5 custom-scrollbar">
                <div className="flex flex-col gap-4 rounded-3xl bg-white/90 border border-slate-200/80 shadow-[0_20px_70px_rgba(148,163,184,0.18)] p-6">
                  {/* Meta row */}
                  <div className="flex items-center justify-between flex-shrink-0">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-sky-500 px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-100">
                      {artifact.language ?? artifact.type ?? "code"}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {normalizeArtifactContent(artifact.content).split("\n").length ?? 0} lines
                    </span>
                  </div>

                  {/* Code block */}
                  <div className="relative group/block mt-2">
                    <pre className="text-[12.5px] font-mono leading-[1.75] text-slate-700 whitespace-pre-wrap break-words bg-slate-50/50 rounded-2xl p-4 overflow-auto custom-scrollbar border border-slate-100">
                      {normalizeArtifactContent(artifact.content)}
                    </pre>

                    <button
                      onClick={handleCopy}
                      className="absolute top-3 right-3 opacity-0 group-hover/block:opacity-100 w-7 h-7 flex items-center justify-center rounded-lg bg-slate-200/60 border border-slate-200 text-slate-500 hover:text-slate-900 shadow-sm transition-all duration-150"
                      title="Copy"
                    >
                      {copied
                        ? <FiCheck size={11} className="text-emerald-500" />
                        : <FiCopy size={11} />
                      }
                    </button>
                  </div>

                  {/* Status footer */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                    <p className="text-[10.5px] text-slate-400 font-medium">
                      Generated by Atomic AI · {normalizeArtifactContent(artifact.content).length} chars
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              /* ── PREVIEW TAB ── */
              <div className="h-full flex flex-col bg-slate-100/60 overflow-hidden">
                {canPreview ? (
                  <div className={`flex-1 min-h-0 w-full overflow-auto flex justify-center items-stretch ${viewportSize !== "full" ? "p-4" : ""}`}>
                    <div
                      className={`h-full bg-white transition-all duration-300 ${
                        viewportSize !== "full"
                          ? "shadow-2xl rounded-xl border border-slate-300/80 overflow-hidden"
                          : "w-full"
                      }`}
                      style={{
                        width:
                          viewportSize === "mobile"
                            ? "375px"
                            : viewportSize === "tablet"
                            ? "768px"
                            : viewportSize === "desktop"
                            ? "1280px"
                            : "100%",
                        maxWidth: "100%",
                      }}
                    >
                      <iframe
                        key={artifact.content}
                        title="Artifact Preview"
                        srcDoc={previewHtml}
                        sandbox="allow-scripts allow-forms allow-modals allow-same-origin"
                        className="w-full h-full border-0 bg-white"
                      />
                    </div>
                  </div>
                ) : (
                  /* Not previewable */
                  <div className="flex flex-col items-center justify-center h-full gap-4 px-8 text-center bg-white">
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-center">
                      <AlertCircle size={20} className="text-amber-500" />
                    </div>
                    <div>
                      <p className="text-[13.5px] font-semibold text-slate-900">
                        Preview not available
                      </p>
                      <p className="text-[12px] text-slate-500 mt-1.5 leading-relaxed">
                        Preview works for <span className="font-semibold text-slate-700">HTML, CSS, and JavaScript</span> artifacts.
                        React / JSX / TypeScript preview is coming soon.
                      </p>
                    </div>
                    <button
                      onClick={() => setArtifactMode?.("code")}
                      className="mt-1 px-4 py-2 rounded-xl bg-slate-900 text-white text-[12.5px] font-semibold hover:bg-slate-800 transition-colors duration-200"
                    >
                      View Code instead
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </aside>
    </>
  );
};

export default Artifact;
