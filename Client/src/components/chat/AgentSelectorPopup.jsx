import React from "react";
import {
  MessageSquare,
  Globe,
  Code2,
  Presentation,
  Zap,
  Check,
} from "lucide-react";

export const AGENT_OPTIONS = [
  {
    id: "auto",
    label: "Auto",
    subtitle: "Automatically choose best agent",
    icon: Zap,
    iconBg: "bg-slate-100",
    iconColor: "text-slate-500",
    accent: "cyan",
  },
  {
    id: "chat",
    label: "Chat",
    subtitle: "General conversation",
    icon: MessageSquare,
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-500",
    accent: "emerald",
  },
  {
    id: "search",
    label: "Search",
    subtitle: "Latest web research",
    icon: Globe,
    iconBg: "bg-sky-50",
    iconColor: "text-sky-500",
    accent: "sky",
  },
  {
    id: "coding",
    label: "Coding",
    subtitle: "Code and debugging",
    icon: Code2,
    iconBg: "bg-indigo-50",
    iconColor: "text-indigo-500",
    accent: "indigo",
  },
  {
    id: "ppt",
    label: "PPT",
    subtitle: "Presentation creation",
    icon: Presentation,
    iconBg: "bg-cyan-50",
    iconColor: "text-cyan-500",
    accent: "cyan",
  },
];

const AgentSelectorPopup = ({
  isOpen,
  selectedAgent,
  onSelect,
  className = "",
}) => {
  if (!isOpen) return null;

  return (
    <div
      className={`absolute bottom-[calc(100%+10px)] left-0 z-[60] w-[min(360px,calc(100vw-2rem))] origin-bottom-left animate-in fade-in zoom-in-95 duration-200 ${className}`}
      role="listbox"
      aria-label="Choose agent"
    >
      <div className="overflow-hidden rounded-3xl border border-slate-200/70 bg-white/95 shadow-2xl shadow-slate-200/50 backdrop-blur-xl ring-1 ring-white/80">
        {/* Header */}
        <div className="border-b border-slate-100/80 px-4 py-2.5">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Select agent
          </p>
        </div>

        {/* Agent list */}
        <div className="p-2 space-y-0.5">
          {AGENT_OPTIONS.map((agent, index) => {
            const isActive = selectedAgent === agent.id;
            const Icon = agent.icon;

            return (
              <React.Fragment key={agent.id}>
                {index === 1 && (
                  <div className="mx-1.5 my-1 border-t border-slate-100/80" />
                )}

                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  onClick={() => onSelect(agent.id)}
                  className={`group flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-all duration-150 ${
                    isActive
                      ? "bg-cyan-50/80 ring-1 ring-cyan-200/40"
                      : "hover:bg-slate-50/90"
                  }`}
                >
                  {/* Icon */}
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-transform duration-150 group-hover:scale-[1.04] ${agent.iconBg} ${agent.iconColor}`}
                  >
                    <Icon size={15} strokeWidth={2.1} />
                  </div>

                  {/* Label + subtitle */}
                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-[13.5px] font-semibold leading-tight ${
                        isActive ? "text-slate-900" : "text-slate-700"
                      }`}
                    >
                      {agent.label}
                    </p>
                    <p className="truncate text-[11.5px] leading-snug text-slate-400">
                      {agent.subtitle}
                    </p>
                  </div>

                  {/* Check indicator */}
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                    {isActive ? (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500 text-white shadow-[0_0_8px_rgba(6,182,212,0.30)]">
                        <Check size={10} strokeWidth={3} />
                      </span>
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-transparent transition-colors group-hover:bg-slate-200" />
                    )}
                  </div>
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AgentSelectorPopup;
