import React from "react";
import { Sparkles } from "lucide-react";

const TypingIndicator = () => {
  return (
    <div className="flex w-full justify-start py-4 animate-in fade-in duration-300">
      <div className="w-full max-w-[880px]">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 text-white shadow-md">
            <Sparkles size={16} className="animate-pulse" />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-slate-500 tracking-wide">Automic AI is thinking</span>
            <div className="flex items-center gap-1.5 px-1 py-1">
              <div className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0ms" }}></div>
              <div className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "150ms" }}></div>
              <div className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "300ms" }}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TypingIndicator;
