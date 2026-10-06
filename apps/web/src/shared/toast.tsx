import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useLocale } from "./locale";
import { toProblem } from "./errors";
import type { Message } from "./i18n";

type Toast = { tone: "error" | "success"; code?: string } & (
  { message: string; error?: never; localized?: never } | { error: unknown; message?: never; localized?: never } |
  { localized: Message; message?: never; error?: never }
);
const ToastContext = createContext<((toast: Toast) => void) | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const { language, t } = useLocale();
  // ponytail: one visible toast; add a queue only if concurrent notices become a real UX problem.
  const [toast, setToast] = useState<Toast | null>(null);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const rendered = !toast ? null : toast.localized ? { code: toast.code, message: t(toast.localized.key, toast.localized.params) }
    : "error" in toast ? toProblem(toast.error, language) : { code: toast.code, message: toast.message ?? "" };
  return <ToastContext.Provider value={setToast}>{children}
    {toast && <div className={`toast toast-${toast.tone}`} role={toast.tone === "error" ? "alert" : "status"}>
      <span className="toast-icon" aria-hidden="true">{toast.tone === "error" ? "!" : "✓"}</span>
      <div>{rendered?.code && <code>{rendered.code}</code>}<span>{rendered?.message}</span></div>
      <button type="button" onClick={() => setToast(null)} aria-label={t("common.dismiss")}>×</button>
    </div>}
  </ToastContext.Provider>;
}

export function useToast() {
  const showToast = useContext(ToastContext);
  if (!showToast) throw new Error("ToastProvider is missing");
  return showToast;
}
