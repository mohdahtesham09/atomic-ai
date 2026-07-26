import React, { useState, useEffect, useRef } from "react";
import {
  Plus,
  X,
  Send,
  Mic,
  MicOff,
  Paperclip,
  Image as ImageIcon,
  FileText,
  ChevronDown,
  Sparkles,
  Check,
} from "lucide-react";
import useToast from "../../hooks/useToast";
import AgentSelectorPopup, { AGENT_OPTIONS } from "./AgentSelectorPopup";

const MODEL_OPTIONS = [
  { id: "flash", label: "Flash" },
  { id: "pro", label: "Pro" },
  { id: "groq", label: "Groq" },
  { id: "deepseek", label: "DeepSeek" },
];

const FILE_ACCEPT = ".txt,.md,.js,.jsx,.ts,.tsx,.html,.css,.json";
const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp";

const iconBtnBase =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40";
const iconBtnNormal = `${iconBtnBase} text-slate-400 hover:bg-slate-100/90 hover:text-slate-700 active:scale-95`;
const iconBtnActive = `${iconBtnBase} bg-slate-900 text-white shadow-md shadow-slate-900/15`;

const isDev = import.meta.env.DEV;

/**
 * ChatInput
 */
const ChatInput = ({
  value,
  onChange,
  onSend, // (formData) => Promise<void>
  loading = false,
  onFocus,
  selectedAgent = "auto",
  setSelectedAgent,
  selectedModel = "flash",
  setSelectedModel,
  uploadedFiles = [],
  setUploadedFiles,
  uploadedImages = [],
  setUploadedImages,
  conversationId = null,
  // usageBlockedUntil intentionally ignored in UI — handled via toast in parent
  usageBlockedUntil = null,
}) => {
  const [toolsOpen, setToolsOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const { toast } = useToast();

  const containerRef = useRef(null);
  const modelRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const recognitionRef = useRef(null);

  const isSubmittingRef = useRef(false);

  const [selectedFile, setSelectedFile] = useState(null);
  const fileRef = useRef(null);

  // ── Single submit handler ─────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e?.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || loading || isSubmittingRef.current) return;

    const agentKey = String(selectedAgent || "auto").toLowerCase();

    isSubmittingRef.current = true;
    try {
      const formData = new FormData();
      formData.append("message", trimmed);
      formData.append("selectedAgent", agentKey);
      formData.append("selectedModel", selectedModel || "flash");

      if (conversationId && conversationId !== "null" && conversationId !== "undefined") {
        formData.append("conversationId", conversationId);
      }

      if (selectedFile instanceof File) {
        formData.append("file", selectedFile);
      }

      await onSend(formData);
      setSelectedFile(null);
      if (setUploadedFiles) setUploadedFiles([]);
      if (setUploadedImages) setUploadedImages([]);
    } finally {
      isSubmittingRef.current = false;
    }
  };

  // ── Enter key: IME-safe, Shift+Enter → newline ────────────────────────────
  const handleKeyDown = (e) => {
    if (
      e.key === "Enter" &&
      !e.shiftKey &&
      !e.nativeEvent.isComposing // guard against IME composition (CJK etc.)
    ) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // ── Close dropdowns on outside click ─────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target))
        setToolsOpen(false);
      if (modelRef.current && !modelRef.current.contains(e.target))
        setModelOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Auto-resize textarea ──────────────────────────────────────────────────
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [value]);

  // ── Re-focus textarea after loading ends ─────────────────────────────────
  useEffect(() => {
    if (!loading && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [loading]);

  // ── File helpers ──────────────────────────────────────────────────────────
  const readFileAsText = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve({
          name: file.name,
          type: file.type,
          size: file.size,
          content: reader.result,
        });
      reader.onerror = reject;
      reader.readAsText(file);
    });

  const readImageAsBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve({
          name: file.name,
          type: file.type,
          size: file.size,
          previewUrl: reader.result,
          base64: reader.result,
        });
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleFileUpload = async (event) => {
    const selected = Array.from(event.target.files || []);
    if (!selected.length || !setUploadedFiles) return;

    const parsed = await Promise.all(
      selected.map((f) =>
        f.type.startsWith("image/") ? readImageAsBase64(f) : readFileAsText(f)
      )
    );

    const nonImages = parsed.filter((f) => !f.base64);
    const imageFiles = parsed.filter((f) => f.base64);

    if (nonImages.length) setUploadedFiles((p) => [...p, ...nonImages]);
    if (imageFiles.length && setUploadedImages)
      setUploadedImages((p) => [...p, ...imageFiles]);
    event.target.value = "";
  };

  const handleImageUpload = async (event) => {
    const selected = Array.from(event.target.files || []);
    if (!selected.length || !setUploadedImages) return;
    const parsed = await Promise.all(selected.map(readImageAsBase64));
    setUploadedImages((p) => [...p, ...parsed]);
    event.target.value = "";
  };

  const removeFile = (i) =>
    setUploadedFiles?.((p) => p.filter((_, idx) => idx !== i));
  const removeImage = (i) =>
    setUploadedImages?.((p) => p.filter((_, idx) => idx !== i));

  // ── Voice ─────────────────────────────────────────────────────────────────
  const toggleVoice = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.onresult = (e) => {
      const t = e.results?.[0]?.[0]?.transcript?.trim();
      if (t) onChange(value ? `${value} ${t}` : t);
    };
    recognitionRef.current = recognition;
    recognition.start();
  };

  // ── Derived state ─────────────────────────────────────────────────────────
  const activeAgentInfo =
    AGENT_OPTIONS.find((a) => a.id === selectedAgent) || AGENT_OPTIONS[0];
  const activeModel =
    MODEL_OPTIONS.find((m) => m.id === selectedModel) || MODEL_OPTIONS[0];
  const ActiveAgentIcon = activeAgentInfo.icon;

  // canSend: there is text AND no request is already in-flight
  const canSend = Boolean(value.trim()) && !loading;
  const isPanelOpen = toolsOpen || modelOpen;
  const showFocusRing = isFocused && !isPanelOpen;

  return (
    <div className='relative w-full max-w-3xl mx-auto px-2 sm:px-4 md:px-6'>
      {/* form wrapper — enables type="submit" button + Enter via form submit */}
      <form onSubmit={handleSubmit} noValidate>
        <div className='relative' ref={containerRef}>
          {/* ── Uploaded pills ── */}
          {(selectedFile || uploadedFiles.length > 0 || uploadedImages.length > 0) && (
            <div className='mb-2.5 flex flex-wrap gap-1.5'>
              {selectedFile && (
                <div className='inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/95 px-2.5 py-1 text-[11px] font-medium text-slate-600 shadow-sm'>
                  <Paperclip size={11} className='text-slate-400' />
                  <span className='max-w-[120px] truncate'>{selectedFile.name}</span>
                  <button
                    type='button'
                    onClick={() => setSelectedFile(null)}
                    className='rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition'
                  >
                    <X size={11} />
                  </button>
                </div>
              )}
              {uploadedFiles.map((file, idx) => (
                <div
                  key={`f-${idx}`}
                  className='inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/95 px-2.5 py-1 text-[11px] font-medium text-slate-600 shadow-sm'
                >
                  <FileText size={11} className='text-slate-400' />
                  <span className='max-w-[120px] truncate'>{file.name}</span>
                  <button
                    type='button'
                    onClick={() => removeFile(idx)}
                    className='rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition'
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
              {uploadedImages.map((img, idx) => (
                <div
                  key={`i-${idx}`}
                  className='inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/95 px-1.5 py-1 text-[11px] font-medium text-slate-600 shadow-sm'
                >
                  <img
                    src={img.previewUrl}
                    alt={img.name}
                    className='h-5 w-5 rounded-full object-cover ring-1 ring-slate-200/80'
                  />
                  <span className='max-w-[90px] truncate'>{img.name}</span>
                  <button
                    type='button'
                    onClick={() => removeImage(idx)}
                    className='rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition'
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* ── Agent popup ── */}
          <AgentSelectorPopup
            isOpen={toolsOpen}
            selectedAgent={selectedAgent}
            onSelect={(id) => {
              setSelectedAgent?.(id);
              setToolsOpen(false);
            }}
          />

          {/* ── Input container ── */}
          <div
            className={`relative flex min-h-[54px] items-end gap-1.5 rounded-[26px] border bg-white/95 px-2 py-1.5 backdrop-blur-xl transition-all duration-300 sm:gap-2 sm:px-2.5 ${
              isPanelOpen
                ? "border-cyan-200/80 shadow-lg shadow-cyan-100/40"
                : showFocusRing
                  ? "border-cyan-200/70 shadow-lg shadow-cyan-100/30 ring-2 ring-cyan-100/60"
                  : "border-slate-200/60 shadow-md shadow-slate-200/30 hover:border-slate-300/70 hover:shadow-lg"
            }`}
          >
            {/* Left controls */}
            <div className='flex shrink-0 items-center gap-0.5 pb-0.5'>
              <button
                type='button'
                onClick={() => {
                  setModelOpen(false);
                  setToolsOpen((p) => !p);
                }}
                className={toolsOpen ? iconBtnActive : iconBtnNormal}
                title='Choose agent'
              >
                {toolsOpen ? (
                  <X size={18} />
                ) : (
                  <Plus size={19} strokeWidth={2.2} />
                )}
              </button>

              <input
                type='file'
                accept='image/*,.txt,.md,.js,.jsx,.ts,.tsx,.html,.css,.json'
                hidden
                ref={fileRef}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setSelectedFile(file);
                  }
                  e.target.value = "";
                }}
              />

              <button
                type='button'
                onClick={() => fileRef.current?.click()}
                disabled={loading}
                className={iconBtnNormal}
                title='Attach file'
              >
                <Paperclip size={17} strokeWidth={2.1} />
              </button>

              <button
                type='button'
                onClick={() => imageInputRef.current?.click()}
                disabled={loading}
                className={iconBtnNormal}
                title='Upload image'
              >
                <ImageIcon size={17} strokeWidth={2.1} />
              </button>

              {/* Agent pill — desktop */}
              <button
                type='button'
                onClick={() => {
                  setModelOpen(false);
                  setToolsOpen(true);
                }}
                className={`hidden sm:inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[12px] font-semibold transition-all duration-200 ${
                  activeAgentInfo.id === "auto"
                    ? "border-slate-200/70 bg-slate-50/70 text-slate-400 hover:bg-slate-100/80 hover:text-slate-600"
                    : "border-slate-200/70 bg-white text-slate-600 shadow-sm hover:border-slate-300/70 hover:bg-slate-50/80"
                }`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-md ${activeAgentInfo.iconBg} ${activeAgentInfo.iconColor}`}
                >
                  <ActiveAgentIcon size={12} strokeWidth={2.2} />
                </span>
                {activeAgentInfo.label}
              </button>
            </div>

            {/* Center — textarea */}
            <div className='min-w-0 flex-1 self-center'>
              <textarea
                ref={textareaRef}
                placeholder='Ask Atomic AI...'
                rows={1}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onFocus={() => {
                  setIsFocused(true);
                  onFocus?.();
                }}
                onBlur={() => setIsFocused(false)}
                onKeyDown={handleKeyDown}
                disabled={loading}
                className='block w-full min-h-[36px] max-h-32 resize-none bg-transparent px-1 py-2 text-[15px] leading-relaxed text-slate-800 outline-none placeholder:text-slate-400/80 disabled:opacity-50 sm:px-2'
              />
            </div>

            {/* Right controls */}
            <div
              className='flex shrink-0 items-center gap-0.5 pb-0.5 sm:gap-1'
              ref={modelRef}
            >
              {/* Model selector */}
              <div className='relative'>
                <button
                  type='button'
                  onClick={() => {
                    setToolsOpen(false);
                    setModelOpen((p) => !p);
                  }}
                  disabled={loading}
                  className='inline-flex h-9 items-center gap-1 rounded-full border border-slate-200/70 bg-white px-2.5 text-[12px] font-semibold text-slate-600 shadow-sm transition-all duration-200 hover:border-slate-300/70 hover:bg-slate-50/90 disabled:cursor-not-allowed disabled:opacity-40 sm:px-3'
                >
                  <Sparkles size={12} className='text-cyan-400' />
                  {activeModel.label}
                  <ChevronDown
                    size={13}
                    className={`text-slate-400 transition-transform duration-200 ${modelOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {modelOpen && (
                  <div className='absolute bottom-[calc(100%+8px)] right-0 z-[60] min-w-[132px] origin-bottom-right animate-in fade-in zoom-in-95 duration-200'>
                    <div className='overflow-hidden rounded-2xl border border-slate-200/70 bg-white/95 p-1 shadow-xl shadow-slate-300/20 backdrop-blur-xl ring-1 ring-white/70'>
                      {MODEL_OPTIONS.map((m) => {
                        const active = selectedModel === m.id;
                        return (
                          <button
                            key={m.id}
                            type='button'
                            onClick={() => {
                              setSelectedModel?.(m.id);
                              setModelOpen(false);
                            }}
                            className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-[13px] transition-colors ${active ? "bg-cyan-50/80 font-semibold text-slate-900" : "text-slate-600 hover:bg-slate-50"}`}
                          >
                            {m.label}
                            {active && (
                              <Check
                                size={13}
                                className='text-cyan-500'
                                strokeWidth={2.5}
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Mic */}
              <button
                type='button'
                onClick={toggleVoice}
                disabled={loading}
                className={`${iconBtnBase} ${isListening ? "bg-rose-50 text-rose-500 ring-2 ring-rose-100 animate-pulse" : "text-slate-400 hover:bg-slate-100/90 hover:text-slate-700"} disabled:cursor-not-allowed disabled:opacity-40`}
                title={isListening ? "Stop listening" : "Voice input"}
              >
                {isListening ? (
                  <MicOff size={17} strokeWidth={2.1} />
                ) : (
                  <Mic size={17} strokeWidth={2.1} />
                )}
              </button>

              {/* Send — type="submit" fires form's onSubmit */}
              <button
                type='submit'
                disabled={!canSend}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-200 sm:h-10 sm:w-10 ${
                  canSend
                    ? "bg-slate-900 text-white shadow-md shadow-slate-900/20 hover:bg-slate-800 hover:scale-[1.04] active:scale-95"
                    : "bg-slate-100/80 text-slate-300 cursor-not-allowed"
                }`}
                title='Send message'
              >
                <Send
                  size={17}
                  strokeWidth={2.2}
                  className='pointer-events-none'
                />
              </button>
            </div>
          </div>

          {/* Hidden file inputs */}
          <input
            ref={fileInputRef}
            type='file'
            accept={FILE_ACCEPT}
            multiple
            className='hidden'
            onChange={handleFileUpload}
          />
          <input
            ref={imageInputRef}
            type='file'
            accept={IMAGE_ACCEPT}
            multiple
            className='hidden'
            onChange={handleImageUpload}
          />

          <p className='mt-3 text-center text-[10.5px] font-medium tracking-wide text-slate-400/70 select-none sm:text-[11px]'>
            Automic AI can make mistakes. Verify important info.
          </p>
        </div>
      </form>
    </div>
  );
};

export default ChatInput;
