"use client";
import { useEffect, useRef } from "react";

export function Magnetic({ children, strength = 0.22 }: { children: React.ReactNode; strength?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - (r.left + r.width / 2);
      const y = e.clientY - (r.top + r.height / 2);
      el.style.transform = `translate(${x * strength}px, ${y * strength}px)`;
    };
    const onLeave = () => { el.style.transform = "translate(0,0)"; };
    const parent = el.parentElement;
    parent?.addEventListener("mousemove", onMove);
    parent?.addEventListener("mouseleave", onLeave);
    return () => { parent?.removeEventListener("mousemove", onMove); parent?.removeEventListener("mouseleave", onLeave); };
  }, [strength]);
  return <div ref={ref} className="magnetic inline-flex">{children}</div>;
}

export function Marquee({ items, reverse = false }: { items: string[]; reverse?: boolean }) {
  const doubled = [...items, ...items];
  return (
    <div className="marquee border-y border-white/[0.06] bg-[#0D0F12]/50 py-2 backdrop-blur">
      <div className="marquee-track gap-8" style={reverse ? { animationDirection: "reverse" } : undefined}>
        {doubled.map((t, i) => (
          <span key={i} className="fragment inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-[#9AA1AC]">
            <span className="h-1 w-1 rounded-full bg-[#0EA5E9]" /> {t}
          </span>
        ))}
      </div>
    </div>
  );
}

export function SpotlightCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - r.left}px`);
      el.style.setProperty("--my", `${e.clientY - r.top}px`);
    };
    el.addEventListener("mousemove", onMove);
    return () => el.removeEventListener("mousemove", onMove);
  }, []);
  return <div ref={ref} className={`spotlight ${className}`}>{children}</div>;
}
