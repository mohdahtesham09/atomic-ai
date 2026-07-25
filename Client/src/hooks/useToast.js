import { useState, useCallback } from "react";

let _nextId = 1;

/**
 * useToast — lightweight in-component toast queue.
 *
 * Usage:
 *   const { toasts, toast, dismissToast } = useToast();
 *
 *   toast.error("Something went wrong");
 *   toast.warning("Rate limit hit — try another model");
 *   toast.success("Copied!");
 *   toast("Custom message", { variant: "info", duration: 5000, action: { label: "Retry", onClick: fn } });
 */
const useToast = () => {
  const [toasts, setToasts] = useState([]);

  const show = useCallback((message, options = {}) => {
    const id = _nextId++;
    const entry = {
      id,
      message,
      variant:  options.variant  || "info",
      duration: options.duration || 4000,
      action:   options.action   || null,
    };
    setToasts((prev) => [...prev, entry]);
    return id;
  }, []);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Convenience helpers
  const toast = useCallback(
    (message, options) => show(message, options),
    [show]
  );
  toast.error   = (msg, opts) => show(msg, { variant: "error",   duration: 5000, ...opts });
  toast.warning = (msg, opts) => show(msg, { variant: "warning", duration: 4500, ...opts });
  toast.success = (msg, opts) => show(msg, { variant: "success", duration: 3000, ...opts });
  toast.network = (msg, opts) => show(msg, { variant: "network", duration: 5000, ...opts });
  toast.info    = (msg, opts) => show(msg, { variant: "info",    duration: 4000, ...opts });

  return { toasts, toast, dismissToast: dismiss };
};

export default useToast;
