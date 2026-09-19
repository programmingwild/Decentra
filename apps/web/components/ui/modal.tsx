"use client";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";

export function Modal({ open, onClose, title, children, width = 460 }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; width?: number }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCloseRef.current();
    window.addEventListener("keydown", onKey);
    const el = panelRef.current?.querySelector<HTMLElement>("input,textarea,select");
    const t = setTimeout(() => {
      if (el && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA" && document.activeElement?.tagName !== "SELECT") el.focus();
    }, 30);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(t);
    };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[3px]" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ maxWidth: width }}
        className="animate-pop relative max-h-[85vh] w-full overflow-auto rounded-[16px] border border-white/[0.09] bg-[#101216] shadow-[0_32px_80px_rgba(0,0,0,0.7)]"
      >
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5">
          <h2 className="text-[14px] font-[650] tracking-[-0.01em] text-[#F5F7FA]">{title}</h2>
          <button onClick={onClose} className="rounded-[8px] p-1 text-[#656B75] transition hover:bg-white/[0.06] hover:text-white" aria-label="Close dialog">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
