"use client";

import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { uid } from "@/lib/utils";

type Tone = "success" | "error" | "info";
type Toast = { id: string; message: string; tone: Tone };

const ToastContext = createContext<{
  push: (message: string, tone?: Tone) => void;
} | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (message: string, tone: Tone = "success") => {
      const id = uid("toast_");
      setToasts((current) => [...current.slice(-2), { id, message, tone }]);
      setTimeout(() => dismiss(id), tone === "error" ? 6000 : 3200);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6">
        {toasts.map((toast) => {
          const Icon =
            toast.tone === "success"
              ? CheckCircle2
              : toast.tone === "error"
                ? AlertCircle
                : Info;
          const color =
            toast.tone === "success"
              ? "var(--good)"
              : toast.tone === "error"
                ? "var(--critical)"
                : "var(--accent)";

          return (
            <div
              key={toast.id}
              role="status"
              className="animate-fade-up bg-surface border-line pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl border px-3.5 py-3 shadow-[var(--shadow-lg)]"
            >
              <Icon className="mt-0.5 size-4 shrink-0" style={{ color }} />
              <p className="text-ink flex-1 text-[13px] leading-snug">
                {toast.message}
              </p>
              <button
                onClick={() => dismiss(toast.id)}
                className="text-ink-3 hover:text-ink -m-1 rounded p-1 transition-colors"
                aria-label="Dismiss"
              >
                <X className="size-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside <ToastProvider>");
  return context;
}
