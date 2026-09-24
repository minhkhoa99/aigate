import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Toast = { tone: "error" | "success"; message: string; code?: string };
const ToastContext = createContext<((toast: Toast) => void) | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  // ponytail: one visible toast; add a queue only if concurrent notices become a real UX problem.
  const [toast, setToast] = useState<Toast | null>(null);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  return <ToastContext.Provider value={setToast}>{children}
    {toast && <div className={`toast toast-${toast.tone}`} role={toast.tone === "error" ? "alert" : "status"}>
      <span className="toast-icon" aria-hidden="true">{toast.tone === "error" ? "!" : "✓"}</span>
      <div>{toast.code && <code>{toast.code}</code>}<span>{toast.message}</span></div>
      <button type="button" onClick={() => setToast(null)} aria-label="Dismiss notification">×</button>
    </div>}
  </ToastContext.Provider>;
}

export function useToast() {
  const showToast = useContext(ToastContext);
  if (!showToast) throw new Error("ToastProvider is missing");
  return showToast;
}
