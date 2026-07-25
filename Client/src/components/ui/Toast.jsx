import React, { useEffect, useRef } from "react";
import { X, AlertTriangle, Info, CheckCircle, WifiOff } from "lucide-react";

/**
 * Toast variants:
 *   "error"   — red, used for API / quota errors
 *   "warning" — amber, used for soft warnings
 *   "success" — green
 *   "info"    — slate / default
 */
const VARIANT = {
  error: {
    bar:   "bg-red-500",
    icon:  <AlertTriangle size={15} className="text-red-500 flex-shrink-0" />,
    ring:  "ring-red-200/60",
    bg:    "bg-white",
  },
  warning: {
    bar:   "bg-amber-400",
    icon:  <AlertTriangle size={15} className="text-amber-500 flex-shrink-0" />,
    ring:  "ring-amber-200/60",
    bg:    "bg-white",
  },
  success: {
    bar:   "bg-emerald-500",
    icon:  <CheckCircle size={15} className="text-emerald-500 flex-shrink-0" />,
    ring:  "ring-emerald-200/60",
    bg:    "bg-white",
  },
  network: {
    bar:   "bg-slate-500",
    icon:  <WifiOff size={15} className="text-slate-500 flex-shrink-0" />,
    ring:  "ring-slate-200/60",
    bg:    "bg-white",
  },
  info: {
    bar:   "bg-cyan-500",
    icon:  <Info size={15} className="text-cyan-500 flex-shrink-0" />,
    ring:  "ring-cyan-200/60",
    bg:    "bg-white",
  },
};

/** Single toast card */
const ToastCard = ({ id, message, variant = "info", action, onDismiss, duration = 4000 }) => {
  const v = VARIANT[variant] || VARIANT.info;
  const progressRef = useRef(null);

  useEffect(() => {
    const el = progressRef.current;
    if (!el) return;
    // Animate progress bar from 100% → 0% over duration
    el.style.transition = "none";
    el.style.width = "100%";
    // Force reflow
    void el.offsetWidth;
    el.style.transition = `width ${duration}ms linear`;
    el.style.width = "0%";

    const timer = setTimeout(() => onDismiss(id), duration);
    return () => clearTimeout(timer);
  }, [id, duration, onDismiss]);

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`
        relative flex w-full max-w-sm items-start gap-3 overflow-hidden
        rounded-2xl border border-slate-200/80 ${v.bg}
        px-4 py-3.5
        shadow-[0_8px_32px_rgba(15,23,42,0.12)]
        ring-1 ${v.ring}
        animate-in slide-in-from-right-4 fade-in duration-300
      `}
    >
      {/* Colored left accent bar */}
      <span className={`absolute left-0 top-0 h-full w-1 rounded-l-2xl ${v.bar}`} />

      {/* Icon */}
      <span className="mt-0.5 pl-1">{v.icon}</span>

      {/* Body */}
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium leading-snug text-slate-800">{message}</p>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="mt-1.5 text-[12px] font-semibold text-cyan-600 hover:text-cyan-700 transition-colors"
          >
            {action.label} →
          </button>
        )}
      </div>

      {/* Dismiss */}
      <button
        type="button"
        onClick={() => onDismiss(id)}
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
        aria-label="Dismiss"
      >
        <X size={13} />
      </button>

      {/* Auto-dismiss progress bar */}
      <span
        ref={progressRef}
        className={`absolute bottom-0 left-0 h-[2px] ${v.bar} opacity-40`}
        style={{ width: "100%" }}
      />
    </div>
  );
};

/** Container — mount once, reads from window.__toastQueue via custom event */
export const ToastContainer = ({ toasts, onDismiss }) => {
  if (!toasts.length) return null;

  return (
    <div
      aria-label="Notifications"
      className="fixed bottom-6 right-5 z-[99999] flex flex-col gap-2.5 pointer-events-none"
    >
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastCard {...t} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
};
