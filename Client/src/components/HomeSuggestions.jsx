import React from "react";

const SUGGESTIONS = [
  "Explain RAG",
  "Fix code",
  "Search AI tools",
  "Summarize PDF",
  "Create PPT",
  "Analyze image",
];

const HomeSuggestions = ({ onSelectPrompt }) => {
  return (
    <div className="mt-2 flex flex-col items-center w-full max-w-xl mx-auto">
      <div className="flex flex-wrap justify-center gap-2.5">
        {SUGGESTIONS.map((suggestion, idx) => (
          <button
            key={idx}
            onClick={() => onSelectPrompt?.(suggestion)}
            className="flex h-[36px] items-center justify-center rounded-full border border-slate-200/80 bg-white/70 px-4 text-[13px] font-medium text-slate-600 shadow-sm backdrop-blur-sm transition-all hover:border-cyan-300 hover:bg-cyan-50/80 hover:text-cyan-700 hover:-translate-y-[1px]"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
};

export default HomeSuggestions;
