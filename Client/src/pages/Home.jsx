import React, { useState, useEffect, useRef, useCallback } from "react";
import { signInWithPopup } from "firebase/auth";
import { FcGoogle } from "react-icons/fc";
import { FiMenu } from "react-icons/fi";
import { PanelLeft } from "lucide-react";
import { auth, googleProvider } from "../utils/firebase";
import api from "../utils/axios";
import { useSelector, useDispatch } from "react-redux";
import { setUserData } from "../redux/userSlice";
import SideBar from "../components/SideBar";
import ChatArea from "../components/ChatArea";
import ChatInput from "../components/chat/ChatInput";
import Artifact from "../components/Artifact";
import AtomicLogo from "../components/brand/AtomicLogo";
import { ToastContainer } from "../components/ui/Toast";
import useToast from "../hooks/useToast";
import { getConversations } from "../features/getConversations";
import { getConversationMessages } from "../features/getConversationMessages";
import { getConversationById } from "../features/getConversationById";
import { renameConversation } from "../features/renameConversation";
import { deleteConversation } from "../features/deleteConversation";
import { sendChatMessage, API_ERROR_CODES } from "../features/chatApi";
import {
  setConversations,
  setSelectedConversation,
  updateConversationTitle,
  deleteConversationAction,
  clearSelectedConversation,
} from "../redux/conversationSlice";

const isDev = import.meta.env.DEV;

// ─── Artifact helpers ─────────────────────────────────────────────────────────
const restoreArtifactFromMessages = (msgs, { setCurrentArtifact, setArtifactMode, setIsArtifactOpen }) => {
  // Only restore coding-type artifacts — PPT/slides/pdf/search stay in chat
  const last = [...msgs].reverse().find((m) =>
    Array.isArray(m.artifacts) &&
    m.artifacts.length > 0 &&
    (m.agent === "coding" || m.artifacts[0]?.type === "code")
  );
  if (last) {
    const art = last.artifacts[0];
    setCurrentArtifact({ title: art.title || "Artifact", language: art.language || "javascript", content: art.content || "", type: art.type || "code", pptxBase64: art.pptxBase64 || null, fileName: art.fileName || null, sourceFile: art.sourceFile || null });
    setArtifactMode("code");
    setIsArtifactOpen(true);
  } else {
    setCurrentArtifact(null);
    setIsArtifactOpen(false);
  }
};

const clearArtifactState = ({ setCurrentArtifact, setArtifactMode, setIsArtifactOpen }) => {
  setCurrentArtifact(null);
  setIsArtifactOpen(false);
  setArtifactMode("code");
};

// ─── Agent routing helpers ────────────────────────────────────────────────────────
const isCodingAgent = (agent) => {
  const value = String(
    agent?.type ||
    agent?.name ||
    agent?.id ||
    agent ||
    ""
  ).toLowerCase();

  return (
    value === "coding" ||
    value === "code" ||
    value === "coding-agent" ||
    value.includes("coding agent")
  );
};

const normalizeChatContent = (content) => {
  if (typeof content === "string") return content;

  if (content && typeof content === "object") {
    return (
      content.message ||
      content.content ||
      content.text ||
      content.answer ||
      content.result ||
      JSON.stringify(content, null, 2)
    );
  }

  return "";
};

// ─── Home component ───────────────────────────────────────────────────────────
const Home = () => {
  const dispatch  = useDispatch();
  const userData  = useSelector((s) => s.user);
  const convState = useSelector((s) => s.conversation || {});

  const conversations = Array.isArray(convState.conversations)
    ? convState.conversations
    : Array.isArray(convState.conversations?.data)
      ? convState.conversations.data
      : Array.isArray(convState.data) ? convState.data : [];

  const selectedConversation = convState.selectedConversation || null;

  // ── Core UI state ───────────────────────────────────────────────────────
  const [loading,        setLoading]        = useState(false);
  const [message,        setMessage]        = useState("");
  const [isChatActive,   setIsChatActive]   = useState(false);
  const [selectedAgent,  setSelectedAgent]  = useState("chat");
  const [selectedModel,  setSelectedModel]  = useState("groq");
  const [uploadedFiles,  setUploadedFiles]  = useState([]);
  const [uploadedImages, setUploadedImages] = useState([]);
  const [currentChatId,  setCurrentChatId]  = useState(null);
  const [regeneratingId, setRegeneratingId] = useState(null);

  // ── Artifact state ──────────────────────────────────────────────────────
  const [currentArtifact,     setCurrentArtifact]     = useState(null);
  const [artifactMode,         setArtifactMode]         = useState("code");
  const [uploadedArtifactFile, setUploadedArtifactFile] = useState(null);
  const [isArtifactOpen,       setIsArtifactOpen]       = useState(false);
  const [isArtifactExpanded,   setIsArtifactExpanded]   = useState(false);

  // ── Panels ──────────────────────────────────────────────────────────────
  const [sidebarOpen,   setSidebarOpen]   = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // ── Toast ───────────────────────────────────────────────────────────────
  const { toasts, toast, dismissToast } = useToast();

  // ── Retry ref — stores last failed payload ──────────────────────────────
  const retryPayloadRef = useRef(null);

  // ── selectedModel ref — always current in async closures ───────────────
  // State reads inside async functions capture stale values; ref is live.
  const selectedModelRef  = useRef(selectedModel);
  const selectedAgentRef  = useRef(selectedAgent);
  useEffect(() => { selectedModelRef.current  = selectedModel;  }, [selectedModel]);
  const AVAILABLE_AGENTS = ["auto", "chat", "search", "coding", "ppt"];
  useEffect(() => {
    selectedAgentRef.current = selectedAgent;
    if (!isCodingAgent(selectedAgent)) {
      setIsArtifactOpen(false);
    }
    if (!AVAILABLE_AGENTS.includes(selectedAgent)) {
      setSelectedAgent("chat");
    }
  }, [selectedAgent]);

  const hasMessages = Boolean(selectedConversation?.messages?.length > 0);

  // ── Artifact helpers ────────────────────────────────────────────────────
  const toggleArtifact        = () => setIsArtifactOpen((p) => !p);
  const closeArtifact         = () => { setIsArtifactOpen(false); setIsArtifactExpanded(false); };
  const toggleArtifactExpanded = () => { setIsArtifactOpen(true); setIsArtifactExpanded((p) => !p); };

  const handleGoHome = () => {
    setIsChatActive(false);
    setMessage("");
    dispatch(clearSelectedConversation());
    setCurrentChatId(null);
    localStorage.removeItem("atomic_selected_conversation_id");
    clearArtifactState({ setCurrentArtifact, setArtifactMode, setIsArtifactOpen });
  };

  // ── Auth ────────────────────────────────────────────────────────────────
  const handleLogin = async (firebaseToken) => {
    try {
      if (!firebaseToken) return;
      const { data } = await api.post("/auth/login", { token: firebaseToken });
      dispatch(setUserData(data?.data || data?.user || data));
    } catch (error) {
      console.error("Login failed", {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });
    }
  };

  const googleLogin = async () => {
    try {
      setLoading(true);
      const result = await signInWithPopup(auth, googleProvider);
      await handleLogin(await result.user.getIdToken());
    } catch (err) {
      if (isDev) console.error("[Home] Google login error:", err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Load conversations on mount ─────────────────────────────────────────
  useEffect(() => {
    const userId = userData?._id || userData?.id;
    if (!userId) return;
    const loadConversations = async () => {
      const data = await getConversations();
      dispatch(setConversations(Array.isArray(data) ? data : data?.data || []));
    };
    const restoreConversation = async () => {
      const savedId = localStorage.getItem("atomic_selected_conversation_id");
      if (!savedId) return;
      try {
        const res  = await getConversationById(savedId);
        const conv = res?.data?.conversation || res?.conversation || res?.data || res;
        const msgs = res?.data?.messages || res?.messages || conv?.messages || [];
        dispatch(setSelectedConversation({ ...conv, messages: msgs }));
        setCurrentChatId(savedId);
        setIsChatActive(true);
        restoreArtifactFromMessages(msgs, { setCurrentArtifact, setArtifactMode, setIsArtifactOpen });
      } catch (err) {
        if (isDev) console.error("[Home] Restore failed:", err.message);
        localStorage.removeItem("atomic_selected_conversation_id");
      }
    };
    loadConversations();
    restoreConversation();
  }, [userData?._id || userData?.id, dispatch]);

  // ── handleNewChat / handleSelectChat ────────────────────────────────────
  const handleNewChat = () => {
    dispatch(clearSelectedConversation());
    setCurrentChatId(null);
    setIsChatActive(false);
    setMessage("");
    localStorage.removeItem("atomic_selected_conversation_id");
    clearArtifactState({ setCurrentArtifact, setArtifactMode, setIsArtifactOpen });
  };

  const handleSelectChat = async (chatId) => {
    const msgsData = await getConversationMessages(chatId);
    const msgs = Array.isArray(msgsData) ? msgsData : msgsData?.data || [];
    const conv = conversations.find((c) => (c._id || c.id) === chatId) || {};
    dispatch(setSelectedConversation({ ...conv, messages: msgs }));
    setCurrentChatId(chatId);
    setIsChatActive(true);
    setSidebarOpen(false);
    localStorage.setItem("atomic_selected_conversation_id", chatId);
    restoreArtifactFromMessages(msgs, { setCurrentArtifact, setArtifactMode, setIsArtifactOpen });
  };

  // ═══════════════════════════════════════════════════════════════════════
  // executeRequest — controlled single-attempt API call.
  // Returns the response data on success, throws ApiError on failure.
  // Does NOT touch React state directly — caller handles UI updates.
  // ═══════════════════════════════════════════════════════════════════════
  const executeRequest = useCallback(async ({ text, files, images, conversationId }) => {
    return sendChatMessage({
      conversationId,
      message: text,
      selectedAgent: selectedAgentRef.current || "chat",
      selectedModel: "groq",
      artifactFile: uploadedArtifactFile || undefined,
      files,
      images,
    });
  }, [uploadedArtifactFile]);

  // ═══════════════════════════════════════════════════════════════════════
  // _submitMessage — orchestrates the full request + auto-fallback logic.
  //
  // Flow:
  //  1. Optimistically insert user message.
  //  2. Try executeRequest with current model.
  //  3. If QUOTA_EXCEEDED → mark model as failed, find next model, retry once.
  //  4. Repeat until success or all models exhausted.
  //  5. On final failure → toast "all models unavailable", restore input.
  //  6. Always reset loading in finally.
  // ═══════════════════════════════════════════════════════════════════════
  const _submitMessage = useCallback(async (formDataOrPayload) => {
    let text = "";
    let isFormData = false;

    if (typeof FormData !== "undefined" && formDataOrPayload instanceof FormData) {
      isFormData = true;
      text = formDataOrPayload.get("message") || formDataOrPayload.get("prompt") || "";
    } else if (typeof formDataOrPayload === "string") {
      text = formDataOrPayload;
    } else if (formDataOrPayload && typeof formDataOrPayload === "object") {
      text = formDataOrPayload.message || formDataOrPayload.text || formDataOrPayload.prompt || "";
    }

    const currentMessages = selectedConversation?.messages || [];
    const activeChatId =
      currentChatId ||
      selectedConversation?._id ||
      selectedConversation?.id ||
      localStorage.getItem("atomic_selected_conversation_id") ||
      null;
    const agentId = selectedAgentRef.current || "chat";

    const tempUserMsg = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      pending: true,
    };

    dispatch(setSelectedConversation({
      ...selectedConversation,
      messages: [...currentMessages, tempUserMsg],
    }));

    setLoading(true);
    setIsChatActive(true);

    let lastError = null;
    let data = null;

    try {
      if (isFormData) {
        data = await sendChatMessage(formDataOrPayload);
      } else {
        const files  = formDataOrPayload?.files || uploadedFiles.map(({ name, type, size, content }) => ({ name, type, size, content }));
        const images = formDataOrPayload?.images || uploadedImages.map(({ name, type, size, previewUrl, base64 }) => ({ name, type, size, previewUrl, base64 }));
        data = await executeRequest({ text, files, images, conversationId: activeChatId });
      }
    } catch (err) {
      lastError = err;
      if (isDev) console.debug("[Home] Chat request failed:", err.message);
    }

    try {
      if (data) {
        retryPayloadRef.current = null;

        const assistantContent =
          data?.assistantMessage?.content ||
          data?.message?.content ||
          data?.response ||
          data?.content ||
          data?.answer ||
          data?.data?.assistantMessage?.content ||
          data?.data?.message?.content ||
          data?.data?.response ||
          data?.data?.aiResponse ||
          data?.data?.answer ||
          "";

        // Safely normalize assistant text for chat display
        const normalizedChatText = normalizeChatContent(assistantContent);

        const assistantArtifacts =
          data?.artifacts ||
          data?.assistantMessage?.artifacts ||
          data?.message?.artifacts ||
          data?.data?.artifacts ||
          data?.data?.assistantMessage?.artifacts ||
          data?.data?.message?.artifacts ||
          [];

        // ── Agent-based routing: only Coding Agent opens Artifact ──
        if (isCodingAgent(agentId) && assistantArtifacts.length > 0) {
          const art = assistantArtifacts[0];
          setCurrentArtifact({
            title: art.title || "Artifact",
            language: art.language || "javascript",
            content: art.content || "",
            type: art.type || "code",
            pptxBase64: art.pptxBase64 || null,
            fileName: art.fileName || null,
            sourceFile: art.sourceFile || null,
          });
          setArtifactMode("code");
          setIsArtifactOpen(true);
        }
        // Non-coding agents: do NOT set artifact state, do NOT open panel

        const finalConvId =
          data?.conversationId ||
          data?.conversation?._id ||
          data?.data?.conversationId ||
          data?.data?.conversation?._id ||
          activeChatId;

        if (finalConvId) {
          setCurrentChatId(finalConvId);
          localStorage.setItem("atomic_selected_conversation_id", finalConvId);
        }

        dispatch(setSelectedConversation({
          ...(data?.conversation || selectedConversation),
          _id: finalConvId,
          messages: [
            ...currentMessages,
            { ...tempUserMsg, pending: false },
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content: normalizedChatText,
              agent: data?.agent || agentId,
              sources: data?.sources || [],
              images: (Array.isArray(data?.images) && data.images.length > 0)
                ? data.images
                : (data?.imageUrl ? [{ url: data.imageUrl, imageUrl: data.imageUrl }] : []),
              imageUrl: data?.imageUrl || data?.data?.imageUrl || null,
              responseType: data?.responseType || (data?.imageUrl || data?.images?.length > 0 ? "image" : "text"),
              artifacts: assistantArtifacts,
            },
          ],
        }));

        const loadedData = await getConversations();
        const nextConversations = Array.isArray(loadedData)
          ? loadedData
          : loadedData?.data || loadedData?.conversations || [];
        dispatch(setConversations(nextConversations));
      } else {
        retryPayloadRef.current = formDataOrPayload;

        if (lastError?.code === "FILE_TOO_LARGE" || lastError?.status === 413) {
          toast.error(lastError?.message || "PDF is too large. Maximum allowed size is 20 MB.");
        } else if (lastError?.code === "INVALID_FILE_TYPE") {
          toast.error(lastError?.message || "Only PDF files are allowed.");
        } else if (lastError?.code === "RATE_LIMITED" || lastError?.status === 429 || lastError?.response?.status === 429) {
          const retryAfter = lastError?.retryAfter || lastError?.response?.data?.retryAfter || 60;
          toast.error(lastError?.message || `Too many requests. Please try again after ${retryAfter} seconds.`);
        } else if (lastError?.code === "AGENT_REQUEST_IN_PROGRESS" || lastError?.status === 409 || lastError?.response?.status === 409) {
          toast.error(lastError?.message || "This agent is already processing your previous request.");
        } else if (lastError?.code === API_ERROR_CODES.NETWORK_ERROR) {
          toast.network("Network error. Check your connection and try again.", { duration: 5000 });
        } else {
          toast.error(lastError?.message || "Something went wrong. Please try again.");
        }

        dispatch(setSelectedConversation({ ...selectedConversation, messages: currentMessages }));
        setMessage(text);
      }
    } finally {
      setLoading(false);
      setUploadedFiles([]);
      setUploadedImages([]);
      if (isDev) console.debug("[Home] Finally — loading reset");
    }
  }, [selectedConversation, currentChatId, executeRequest, dispatch, toast, uploadedFiles, uploadedImages]);

  const isSubmittingRef = useRef(false);

  // ── handleSendMessage — called by ChatInput ─────────────────────────────
  const handleSendMessage = async (formDataOrPayload) => {
    let payload = formDataOrPayload;
    let promptText = "";

    if (typeof FormData !== "undefined" && payload instanceof FormData) {
      promptText = payload.get("message") || payload.get("prompt") || "";
    } else if (typeof payload === "string") {
      promptText = payload.trim();
    } else if (payload && typeof payload === "object") {
      promptText = payload.message || payload.text || payload.prompt || "";
    } else {
      promptText = message.trim();
    }

    if (!promptText || loading || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    if (isDev) console.debug("[Home] handleSendMessage");
    setMessage("");
    try {
      await _submitMessage(payload);
    } finally {
      isSubmittingRef.current = false;
    }
  };

  // ── handleRetry — re-submit failed message ──────────────────────────────
  const handleRetry = async (msgContent) => {
    if (loading) return;
    const payload = retryPayloadRef.current || { text: msgContent, files: [], images: [] };
    retryPayloadRef.current = null;
    if (isDev) console.debug("[Home] Retry triggered");
    await _submitMessage(payload);
  };

  // ── handleRegenerate ────────────────────────────────────────────────────
  const handleRegenerate = async (assistantIndex) => {
    const msgs = selectedConversation?.messages || [];
    let prevUser = null;
    for (let i = assistantIndex - 1; i >= 0; i--) {
      if (msgs[i].role === "user") { prevUser = msgs[i]; break; }
    }
    if (!prevUser) return;

    const msgId = msgs[assistantIndex]?.id || msgs[assistantIndex]?._id;
    setRegeneratingId(msgId || assistantIndex);

    try {
      const activeChatId =
        currentChatId ||
        selectedConversation?._id ||
        selectedConversation?.id ||
        localStorage.getItem("atomic_selected_conversation_id") ||
        null;

      const data = await sendChatMessage({
        conversationId: activeChatId,
        message: prevUser.content,
        selectedModel: "groq",
        selectedAgent: selectedAgentRef.current || "chat",
      });
      const rawContent = data?.assistantMessage?.content || data?.message?.content || data?.response || data?.content || data?.answer;
      const content = normalizeChatContent(rawContent);
      if (content) {
        dispatch(setSelectedConversation({
          ...selectedConversation,
          messages: msgs.map((m, i) => i === assistantIndex ? { ...m, content } : m),
        }));
      }
    } catch (err) {
      toast.error("Could not regenerate. Please try again.");
      if (isDev) console.debug("[Home] Regenerate error:", err.message);
    } finally {
      setRegeneratingId(null);
    }
  };

  // ── Rename / Delete chat ─────────────────────────────────────────────────
  const handleRenameChat = async (chatId, newTitle) => {
    const clean   = newTitle.trim() || "Untitled Chat";
    const updated = await renameConversation(chatId, clean);
    dispatch(updateConversationTitle({ conversationId: chatId, title: updated?.title || clean }));
  };

  const handleDeleteChat = async (chatId) => {
    await deleteConversation(chatId);
    dispatch(deleteConversationAction(chatId));
    const selId = selectedConversation?._id || selectedConversation?.id;
    if (selId === chatId) {
      dispatch(clearSelectedConversation());
      setIsChatActive(false);
      setCurrentChatId(null);
    }
  };

  // ── Artifact rename / delete ─────────────────────────────────────────────
  const handleRenameArtifact = (t) => setCurrentArtifact((p) => p ? { ...p, title: t?.trim() || "Untitled Artifact" } : p);
  const handleDeleteArtifact = () => { setCurrentArtifact(null); setIsArtifactOpen(false); };

  // Strict Artifact visibility guard: ONLY for Coding Agent when artifact content exists
  const shouldShowArtifact =
    isArtifactOpen &&
    isCodingAgent(selectedAgent) &&
    Boolean(currentArtifact?.content);

  // ────────────────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────────────────
  return (
    <main className="relative h-screen w-full overflow-hidden bg-slate-950 font-sans antialiased text-slate-100">

      {/* UNAUTHENTICATED STATE */}
      {!userData && (
        <div className="relative z-10 flex h-screen w-full items-center justify-center p-6">
          <section className="flex w-full max-w-md flex-col items-center gap-6 rounded-3xl bg-white/5 p-8 text-center backdrop-blur-xl border border-white/10 shadow-2xl">
            <AtomicLogo state="visible" />
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-white">Welcome to Atomic AI</h1>
              <p className="text-sm text-slate-400">Sign in to access your chats, tools, and workspaces.</p>
            </div>
            <button
              onClick={googleLogin}
              disabled={loading}
              className="group relative flex w-full items-center justify-center gap-3 rounded-2xl bg-white px-5 py-3 text-slate-900 font-semibold shadow-lg hover:bg-slate-100 transition-all duration-200 disabled:opacity-50"
            >
              <FcGoogle className="text-xl" />
              <span className="text-lg font-medium whitespace-nowrap">{loading ? "Signing in..." : "continue with google"}</span>
            </button>
          </section>
        </div>
      )}

      {/* AUTHENTICATED */}
      {userData && (
        <div className="relative z-10 flex h-screen w-full overflow-hidden">
          <SideBar
            isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)}
            userData={userData} isSidebarOpen={isSidebarOpen}
            onToggle={() => setIsSidebarOpen((p) => !p)}
            conversations={conversations} selectedConversation={selectedConversation}
            onNewChat={handleNewChat} onSelectChat={handleSelectChat}
            onRenameChat={handleRenameChat} onDeleteChat={handleDeleteChat}
            onGoHome={handleGoHome}
          />

          <button id="sidebar-float-toggle-btn" onClick={() => setIsSidebarOpen(true)}
            className={`fixed top-5 left-5 z-50 h-10 w-10 flex items-center justify-center rounded-2xl bg-white/80 backdrop-blur-xl border border-slate-200/80 text-slate-600 shadow-[0_15px_45px_rgba(148,163,184,0.25)] hover:bg-white hover:text-slate-900 transition-all duration-300 hover:scale-105 hidden md:flex ${isSidebarOpen ? "opacity-0 scale-95 pointer-events-none" : "opacity-100 scale-100 pointer-events-auto"}`}
            aria-label="Show sidebar">
            <PanelLeft size={16} />
          </button>

          <div className={`relative flex-1 flex flex-col min-w-0 h-full overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${shouldShowArtifact ? "mr-[460px]" : "mr-0"}`}>
            <div className="relative z-40 flex items-center gap-3 px-4 py-3 border-b border-slate-100/80 bg-white/50 backdrop-blur-sm md:hidden flex-shrink-0">
              <button onClick={() => setSidebarOpen(true)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100/80 transition-all" aria-label="Open sidebar">
                <FiMenu size={18} />
              </button>
              <span className="text-[14px] font-bold text-slate-700 flex-1">Atomic AI</span>
            </div>

            <div className="relative z-20 flex-1 flex flex-col overflow-hidden w-full h-full bg-white">
              <ChatArea
                messages={selectedConversation?.messages || []}
                isChatActive={isChatActive || hasMessages}
                onSelectPrompt={(text) => setMessage(text)}
                onRegenerate={handleRegenerate}
                onRetry={handleRetry}
                regeneratingId={regeneratingId}
                isLoading={loading}
                conversationId={selectedConversation?._id || selectedConversation?.id}
              />
              <div className="absolute bottom-10 left-0 right-0 z-30 pointer-events-none">
                <div className="pointer-events-auto">
                  <ChatInput
                    value={message} onChange={setMessage}
                    onSend={handleSendMessage} loading={loading}
                    onFocus={() => setIsChatActive(true)}
                    selectedAgent={selectedAgent} setSelectedAgent={setSelectedAgent}
                    selectedModel={selectedModel} setSelectedModel={setSelectedModel}
                    uploadedFiles={uploadedFiles}   setUploadedFiles={setUploadedFiles}
                    uploadedImages={uploadedImages} setUploadedImages={setUploadedImages}
                    conversationId={selectedConversation?._id || selectedConversation?.id || currentChatId || null}
                  />
                </div>
              </div>
            </div>
          </div>

          <Artifact
            isOpen={isArtifactOpen} isExpanded={isArtifactExpanded}
            onToggle={toggleArtifact} onClose={closeArtifact}
            onToggleExpanded={toggleArtifactExpanded}
            artifact={currentArtifact} artifactMode={artifactMode}
            setArtifactMode={setArtifactMode}
            uploadedArtifactFile={uploadedArtifactFile}
            setUploadedArtifactFile={setUploadedArtifactFile}
            onRenameArtifact={handleRenameArtifact}
            onDeleteArtifact={handleDeleteArtifact}
          />
        </div>
      )}

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </main>
  );
};

export default Home;
