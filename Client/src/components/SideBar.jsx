import React, { useState, useEffect, useRef } from "react";
import {
  FiPlus,
  FiSearch,
  FiSettings,
  FiUser,
  FiMessageSquare,
} from "react-icons/fi";
import { PanelLeft, PencilLine, MoreHorizontal, Trash2, LogOut } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import {
  clearConversations,
  clearSelectedConversation,
} from "../redux/conversationSlice";
import { clearUserData } from "../redux/userSlice";
import { logoutUser } from "../features/logout";

/**
 * SideBar — Clean, compact, responsive sidebar for Atomic AI.
 */
const SideBar = ({
  isOpen,
  onClose,
  userData,
  isSidebarOpen,
  onToggle,
  chats = [],
  currentChatId,
  conversations: propConversations,
  selectedConversation: propSelectedConversation,
  onNewChat,
  onSelectChat,
  onRenameChat,
  onDeleteChat,
  onGoHome,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const dispatch = useDispatch();

  const conversationState = useSelector((state) => state.conversation || {});
  const conversationsResponse = conversationState?.conversations;

  const conversations = propConversations || conversationsResponse;

  const safeConversations = Array.isArray(conversations)
    ? conversations
    : Array.isArray(conversations?.data)
    ? conversations.data
    : Array.isArray(conversations?.conversations)
    ? conversations.conversations
    : [];

  const uniqueConversations = Array.from(
    new Map(
      safeConversations
        .filter(Boolean)
        .map((conv) => [conv._id || conv.id, conv])
    ).values()
  );

  const selectedConversation = propSelectedConversation || conversationState?.selectedConversation;

  const filteredConversations = uniqueConversations.filter((conv) => {
    const title = (conv?.title || "New Chat").toLowerCase();
    return title.includes(searchQuery.trim().toLowerCase());
  });

  const handleSearchKeyDown = (e) => {
    if (e.key === "Enter") {
      const firstMatch = filteredConversations?.[0];
      if (!firstMatch) return;
      const conversationId = firstMatch?._id || firstMatch?.id;
      if (conversationId) {
        onSelectChat?.(conversationId);
        onClose?.();
      }
    }
  };

  const handleNewChatClick = (e) => {
    e?.stopPropagation?.();
    if (typeof onNewChat === "function") {
      onNewChat();
    }
  };

  // ── Dropdown & Rename state ──────────────────────────────────────────
  const [openMenuId, setOpenMenuId] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const menuRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenuId(null);
      }
    };
    if (openMenuId) document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [openMenuId]);

  // ── Settings dropdown state ──────────────────────────────────────────
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef(null);

  useEffect(() => {
    const handleOutsideSettings = (e) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target)) {
        setSettingsOpen(false);
      }
    };
    if (settingsOpen) document.addEventListener("mousedown", handleOutsideSettings);
    return () => document.removeEventListener("mousedown", handleOutsideSettings);
  }, [settingsOpen]);

  const handleLogout = async () => {
    const confirmLogout = window.confirm("Are you sure you want to logout?");
    if (!confirmLogout) return;

    setSettingsOpen(false);
    await logoutUser();

    dispatch(clearUserData());
    dispatch(clearSelectedConversation());
    dispatch(clearConversations());
  };

  return (
    <>
      {/* ── Mobile backdrop overlay ─────────────────────────────────── */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-30 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar panel ───────────────────────────────────────────── */}
      <aside
        className={`
          fixed md:relative top-0 left-0 h-screen w-[280px] shrink-0
          bg-white border-r border-slate-200
          flex flex-col overflow-hidden z-40
          transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : isSidebarOpen === false ? "-translate-x-full" : "-translate-x-full md:translate-x-0"}
        `}
        aria-label="Sidebar navigation"
      >
        {/* ── HEADER ROW (64px) ────────────────────────────────────── */}
        <div className="h-16 shrink-0 flex items-center justify-between px-4 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-2">
            <button
              id="sidebar-toggle-inner-btn"
              onClick={onToggle || onClose}
              title="Toggle sidebar"
              className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
              aria-label="Toggle sidebar"
            >
              <PanelLeft size={17} />
            </button>
            <button
              type="button"
              onClick={onGoHome}
              className="flex items-center gap-2 hover:opacity-85 transition-opacity cursor-pointer"
            >
              <span className="text-sm font-bold text-slate-800 tracking-tight">
                Atomic AI
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-sky-50 text-sky-600 border border-sky-200/80 font-medium leading-none">
                free
              </span>
            </button>
          </div>

          <button
            id="new-chat-pencil-btn"
            onClick={handleNewChatClick}
            title="New chat"
            className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
            aria-label="New chat"
          >
            <PencilLine size={16} />
          </button>
        </div>

        {/* ── NEW CHAT BUTTON (44px) ────────────────────────────────── */}
        <div className="px-4 pt-3 pb-2 shrink-0">
          <button
            id="new-chat-btn"
            onClick={handleNewChatClick}
            className="w-full h-11 flex items-center justify-center gap-2 rounded-2xl bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-white text-xs font-semibold shadow-xs hover:shadow-sm transition-all duration-200 cursor-pointer"
          >
            <FiPlus size={16} strokeWidth={2.5} />
            New Chat
          </button>
        </div>

        {/* ── SEARCH INPUT (40px) ───────────────────────────────────── */}
        <div className="px-4 py-2 shrink-0">
          <div className="relative w-full">
            <FiSearch
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              id="sidebar-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search chats..."
              autoComplete="off"
              className="w-full h-10 pl-8 pr-3 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-700 placeholder:text-slate-400 outline-none focus:bg-white focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition-all"
            />
          </div>
        </div>

        {/* ── RECENT CONVERSATIONS LIST (Scrollable) ─────────────────── */}
        <div className="px-4 pt-2 pb-1 shrink-0">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            {safeConversations.length === 0 ? "No Conversations" : "Recent"}
          </p>
        </div>

        <nav
          className="flex-1 overflow-y-auto px-3 space-y-1 min-h-0"
          style={{ scrollbarWidth: "thin", scrollbarColor: "#cbd5e1 transparent" }}
          aria-label="Recent chats"
        >
          {filteredConversations.length === 0 && safeConversations.length > 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">No chats found</p>
          ) : (
            filteredConversations.map((conv) => {
              const conversationId = conv?._id || conv?.id;
              const conversationTitle = conv?.title || "Untitled Chat";
              const selectedConversationId = selectedConversation?._id || selectedConversation?.id;
              const isActive = selectedConversationId === conversationId;
              const menuOpen = openMenuId === conversationId;
              const isRenaming = renamingId === conversationId;

              if (!conversationId) return null;

              return (
                <div key={conversationId} className="relative">
                  <div
                    id={`chat-item-${conversationId}`}
                    onClick={() => {
                      if (isRenaming) return;
                      onSelectChat?.(conversationId);
                      onClose?.();
                    }}
                    className={`
                      group flex items-center gap-2.5 h-11 px-3 rounded-xl cursor-pointer text-xs transition-all duration-150
                      ${
                        isActive
                          ? "bg-sky-50 text-sky-700 border border-sky-200/80 font-medium"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent"
                      }
                    `}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <FiMessageSquare
                      size={14}
                      className={`shrink-0 ${isActive ? "text-sky-600" : "text-slate-400 group-hover:text-slate-600"}`}
                    />

                    {isRenaming ? (
                      <input
                        autoFocus
                        id={`rename-input-${conversationId}`}
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            onRenameChat?.(conversationId, renameValue);
                            setRenamingId(null);
                          }
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                        onBlur={() => {
                          if (renamingId === conversationId) {
                            onRenameChat?.(conversationId, renameValue);
                            setRenamingId(null);
                          }
                        }}
                        className="flex-1 min-w-0 bg-white border border-sky-300 rounded-lg px-2 py-0.5 text-xs text-slate-800 font-medium outline-none focus:ring-2 focus:ring-sky-100"
                      />
                    ) : (
                      <span className="flex-1 min-w-0 truncate leading-normal">
                        {conversationTitle}
                      </span>
                    )}

                    {!isRenaming && (
                      <button
                        id={`chat-menu-btn-${conversationId}`}
                        title="Chat options"
                        aria-label="Chat options"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(menuOpen ? null : conversationId);
                        }}
                        className={`shrink-0 flex items-center justify-center h-6 w-6 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-all ${
                          menuOpen ? "opacity-100 bg-slate-200/60" : "opacity-0 group-hover:opacity-100"
                        }`}
                      >
                        <MoreHorizontal size={14} />
                      </button>
                    )}
                  </div>

                  {menuOpen && (
                    <div
                      ref={menuRef}
                      className="absolute right-2 top-full z-50 w-36 bg-white border border-slate-200 rounded-xl shadow-lg py-1 overflow-hidden"
                    >
                      <button
                        id={`rename-btn-${conversationId}`}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenameValue(conversationTitle);
                          setRenamingId(conversationId);
                          setOpenMenuId(null);
                        }}
                      >
                        <PencilLine size={13} className="text-slate-400" />
                        Rename
                      </button>
                      <div className="my-1 border-t border-slate-100" />
                      <button
                        id={`delete-btn-${conversationId}`}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(null);
                          if (window.confirm("Delete this chat?")) {
                            onDeleteChat?.(conversationId);
                          }
                        }}
                      >
                        <Trash2 size={13} className="text-red-500" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </nav>

        {/* ── FOOTER (Settings + Profile) ──────────────────────────── */}
        <div className="shrink-0 border-t border-slate-100 bg-white p-3 space-y-1">
          <div className="relative" ref={settingsRef}>
            <button
              id="sidebar-settings-btn"
              onClick={() => setSettingsOpen((prev) => !prev)}
              className="w-full h-10 flex items-center gap-2.5 px-3 rounded-xl text-slate-600 text-xs font-medium hover:bg-slate-100 hover:text-slate-900 transition-colors"
            >
              <FiSettings size={15} className="text-slate-400 shrink-0" />
              Settings
            </button>

            {settingsOpen && (
              <div className="absolute bottom-full left-0 w-full mb-2 bg-white border border-slate-200 rounded-xl shadow-lg p-1.5 z-50">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-red-600 text-xs font-medium hover:bg-red-50 transition-colors"
                >
                  <LogOut size={15} />
                  Logout
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2.5 h-[52px] px-3 rounded-xl hover:bg-slate-100 transition-colors group cursor-default">
            {userData?.photoURL ? (
              <img
                src={userData.photoURL}
                alt={userData?.name || "User"}
                className="w-8 h-8 rounded-full object-cover shrink-0 ring-1 ring-slate-200"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-sky-500 text-white flex items-center justify-center shrink-0 font-bold text-xs">
                <FiUser size={14} />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-800 truncate leading-tight">
                {userData?.name?.split(" ")[0] ||
                  userData?.displayName?.split(" ")[0] ||
                  "User"}
              </p>
              <p className="text-[11px] text-slate-400 truncate">
                {userData?.email || "user@example.com"}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default SideBar;
