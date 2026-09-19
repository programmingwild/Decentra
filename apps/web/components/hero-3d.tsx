"use client";
import { useEffect, useState } from "react";

export function Hero3D() {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(m.matches);
    const onMove = (e: MouseEvent) => {
      if (m.matches) return;
      setMouse({ x: (e.clientX / window.innerWidth - 0.5) * 10, y: (e.clientY / window.innerHeight - 0.5) * 10 });
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden rounded-[24px] bg-gradient-to-br from-slate-50 via-white to-indigo-50/20">
      {/* Subtle grid */}
      <div className="absolute inset-0 grid-pattern opacity-[0.04]" />

      {/* Depth layers - CSS 3D */}
      <div className="absolute inset-0 flex items-center justify-center" style={{ perspective: "1000px" }}>
        <div
          className="relative w-[720px] h-[420px] hidden lg:block"
          style={{
            transformStyle: "preserve-3d",
            transform: reducedMotion ? undefined : `rotateX(${mouse.y * 0.04}deg) rotateY(${mouse.x * 0.06}deg)`,
            transition: "transform 0.6s ease-out",
          }}
        >
          {/* Back layer - data grid */}
          <div
            className="absolute inset-0 rounded-[20px] bg-gradient-to-br from-slate-900/[0.04] to-indigo-500/[0.06] border border-slate-200/40"
            style={{ transform: "translateZ(-40px) scale(1.05)" }}
          />
          {/* Mid layer - chart abstract */}
          <div
            className="absolute left-8 right-8 top-8 bottom-8 rounded-[16px] bg-white/60 backdrop-blur-xl border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.06)]"
            style={{ transform: "translateZ(0px)" }}
          >
            <div className="h-full p-5">
              <div className="flex gap-1.5 mb-4">
                <span className="h-2 w-2 rounded-full bg-slate-300" />
                <span className="h-2 w-2 rounded-full bg-slate-300" />
                <span className="h-2 w-2 rounded-full bg-slate-300" />
              </div>
              <div className="space-y-2">
                <div className="h-2 w-3/4 rounded-full bg-slate-200" />
                <div className="h-2 w-1/2 rounded-full bg-slate-100" />
              </div>
              <div className="mt-6 flex items-end gap-1 h-24">
                {[40, 65, 45, 80, 55, 90, 70, 85].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t-[4px] bg-gradient-to-t from-slate-900 to-slate-700"
                    style={{ height: `${h}%`, opacity: 0.9 - i * 0.05 }}
                  />
                ))}
              </div>
            </div>
          </div>
          {/* Front layer - floating KPI */}
          <div
            className="absolute -right-4 -top-2 rounded-[14px] bg-white/90 backdrop-blur-2xl border border-white/60 shadow-[0_12px_32px_rgba(0,0,0,0.12),0_1px_2px_rgba(0,0,0,0.04)] p-3.5"
            style={{ transform: "translateZ(40px)" }}
          >
            <div className="text-[11px] font-semibold tracking-widest uppercase text-slate-500">Revenue</div>
            <div className="text-[18px] font-bold tracking-tight text-slate-900 mt-1">₹12.4M</div>
            <div className="text-[11px] font-medium text-amber-600 mt-1">↓ 8.3% vs prev</div>
          </div>
          <div
            className="absolute -left-4 -bottom-2 rounded-[14px] bg-slate-900 text-white border border-slate-800 shadow-[0_12px_32px_rgba(0,0,0,0.2)] p-3.5"
            style={{ transform: "translateZ(30px)" }}
          >
            <div className="text-[11px] font-semibold tracking-widest uppercase text-slate-400">Anomalies</div>
            <div className="text-[14px] font-bold mt-1">3 flagged</div>
            <div className="text-[11px] text-slate-400 mt-1">z-score • IQR</div>
          </div>
          {/* Floating orb */}
          <div
            className="absolute right-1/3 top-1/3 h-20 w-20 rounded-full bg-gradient-to-br from-indigo-500/20 to-violet-500/20 blur-[1px] border border-white/40"
            style={{ transform: "translateZ(60px)" }}
          />
        </div>
      </div>

      {/* Vignette */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-white via-white/40 to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-slate-900/[0.02]" />
    </div>
  );
}
