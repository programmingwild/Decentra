import { ReactNode } from "react";

export function GlassCard({ children, className = "", intensity = "medium" }: { children: ReactNode; className?: string; intensity?: "subtle" | "medium" | "strong" }) {
  const bg = {
    subtle: "bg-white/60 backdrop-blur-xl",
    medium: "bg-white/75 backdrop-blur-2xl",
    strong: "bg-white/85 backdrop-blur-[20px]",
  }[intensity];
  return (
    <div className={`rounded-[20px] border border-white/50 ${bg} shadow-[0_8px_32px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.6)] ${className}`}>
      {children}
    </div>
  );
}

export function GlassNav({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-white/70 backdrop-blur-2xl border border-slate-200/50 shadow-[0_4px_24px_rgba(0,0,0,0.04)] ${className}`}>{children}</div>
  );
}
