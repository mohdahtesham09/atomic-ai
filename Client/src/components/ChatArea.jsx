import React, { useEffect, useRef } from "react";
import AtomicLogo from "./brand/AtomicLogo";
import HomeSuggestions from "./HomeSuggestions";
import MessageUI from "./MessageUI";
import TypingIndicator from "./TypingIndicator";

const ChatArea = ({
  messages = [],
  isChatActive,
  onSelectPrompt,
  onRegenerate,
  onRetry,
  regeneratingId,
  isLoading,
  conversationId,
}) => {
  const scrollContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const isNearBottomRef = useRef(true);
  const prevMessagesLengthRef = useRef(messages.length);
  const prevConversationIdRef = useRef(conversationId);

  const scrollToBottom = (behavior = "smooth") => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior,
        block: "end",
      });
    } else if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior,
      });
    }
  };

  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    isNearBottomRef.current = distanceToBottom < 120;
  };

  // Derive last message details safely
  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
  const lastMessageContent = lastMessage?.content || "";
  const lastMessageSender = lastMessage?.role || lastMessage?.sender || "";

  // 1. Conversation switch effect -> instant scroll to bottom
  useEffect(() => {
    if (conversationId && conversationId !== prevConversationIdRef.current) {
      prevConversationIdRef.current = conversationId;
      isNearBottomRef.current = true;
      scrollToBottom("auto");
    }
  }, [conversationId]);

  // 2. New message or streaming token update effect
  useEffect(() => {
    const prevLength = prevMessagesLengthRef.current;
    const currentLength = messages.length;
    prevMessagesLengthRef.current = currentLength;

    const isNewUserMessage = currentLength > prevLength && lastMessageSender === "user";
    const isNewMessage = currentLength > prevLength;

    if (isNewUserMessage || isNewMessage) {
      isNearBottomRef.current = true;
      scrollToBottom("smooth");
      return;
    }

    if (isNearBottomRef.current) {
      scrollToBottom("auto");
    }
  }, [messages.length, lastMessageContent, isLoading, lastMessageSender]);

  return (
    <section className="relative h-full min-h-0 w-full overflow-hidden bg-white">
      {/* ================= Soft Background Glow ================= */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,rgba(103,232,249,0.28),rgba(219,234,254,0.22),transparent_62%)]" />

      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="relative z-10 h-full overflow-y-auto px-3 sm:px-4 md:px-8 pt-4 sm:pt-8 pb-36 sm:pb-48 custom-scrollbar scroll-smooth"
      >
        {/* ================= Hero Logo Section (Empty State) ================= */}
        {!isChatActive && messages.length === 0 && (
          <div className="flex min-h-[50vh] sm:min-h-[60vh] flex-col items-center justify-center px-3 sm:px-6 text-center pt-2 sm:pt-4">
            <div className="flex flex-col items-center w-full max-w-3xl space-y-4 sm:space-y-6">
              <AtomicLogo state="visible" />
              
              <div className="space-y-1.5 sm:space-y-2">
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-slate-800">
                  Hello, <span className="text-cyan-500">Mohd</span>
                </h2>

                <h3 className="text-base sm:text-xl md:text-2xl font-semibold text-slate-700">
                  How can Atomic AI help you today?
                </h3>
                
                <p className="text-xs sm:text-sm text-slate-500 max-w-lg mx-auto">
                  Chat, code, search, read documents, create slides, and analyze visuals.
                </p>
              </div>

              <div className="w-full mb-6 sm:mb-10">
                <HomeSuggestions onSelectPrompt={onSelectPrompt} />
              </div>
            </div>
          </div>
        )}

        {/* ================= Messages List ================= */}
        {isChatActive && (
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 sm:gap-6 px-1 sm:px-4 md:px-8 pt-4 sm:pt-10">
            {messages.map((msg, index) => (
              <MessageUI 
                key={msg.id || msg._id || index} 
                message={msg} 
                index={index}
                onRegenerate={onRegenerate}
                onRetry={onRetry}
                isRegenerating={regeneratingId === (msg.id || msg._id || index)}
              />
            ))}
            {isLoading && <TypingIndicator />}
            <div ref={messagesEndRef} className="h-2 w-full flex-shrink-0" />
          </div>
        )}
      </div>
    </section>
  );
};

export default ChatArea;
