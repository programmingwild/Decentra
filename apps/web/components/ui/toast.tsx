"use client";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

type Toast = { id: number; message: string; type: "success" | "error" | "info" };
type Ctx = { toast: (message: string, type?: Toast["type"]) => void };
const ToastCtx = createContext<Ctx>({ toast: () => {} });

const ICONS = { success: CheckCircle2, error: AlertTriangle, info: Info };
const COLORS = { success: "text-[var(--emerald)]", error: "text-[var(--red)]", info: "text-[var(--sky)]" };

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const toast = useCallback(
    (message: string, type: Toast["type"] = "info") => {
      const id = ++idRef.current;
      setToasts((t) => [...t.slice(-3), { id, message, type }]);
      setTimeout(() => dismiss(id), 4200);
    },
    [dismiss]
  );

  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed bottom-5 right-5 z-[200] flex w-[320px] flex-col gap-2">
        {toasts.map((t) => {
          const Icon = ICONS[t.type];
          return (
            <div key={t.id} className="animate-rise pointer-events-auto flex items-start gap-2.5 rounded-[12px] border border-[var(--border)] bg-[var(--elevated)] p-3.5 shadow-[0_12px_40px_rgba(0,0,0,0.6)]">
              <Icon className={`mt-px h-4 w-4 shrink-0 ${COLORS[t.type]}`} aria-hidden="true" />
              <p className="flex-1 text-[13px] leading-snug text-[var(--text)]">{t.message}</p>
              <button onClick={() => dismiss(t.id)} className="rounded p-0.5 text-[var(--subtle)] hover:text-[var(--fg)]" aria-label="Dismiss notification">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
