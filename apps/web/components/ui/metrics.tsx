"use client";
import { useId, useMemo, useRef, useState, useEffect } from "react";
import { motion, useSpring, useMotionValue, useInView } from "framer-motion";
import { TiltCard } from "@/components/immersive/3d/TiltCard";

export const TONE_COLORS: Record<string, string> = {
  sky: "#38BDF8",
  violet: "#A78BFA",
  amber: "#FBBF24",
  emerald: "#34D399",
  red: "#F87171",
  gold: "#D4A574",
};

export function AreaChart({ data, color }: { data: Array<{ x: number; y: number }>; color: string }) {
  if (!data.length) return null;
  const maxY = Math.max(...data.map((d) => d.y), 1);
  const minY = Math.min(...data.map((d) => d.y));
  const points = data
    .map((d, i) => `${(i / (data.length - 1)) * 100}%,${100 - ((d.y - minY) / (maxY - minY || 1)) * 100}%`)
    .join(" ");
  const areaPoints = `0,100 ${points} 100,100`;
  // Deterministic per instance. NEVER Math.random() here — server and client
  // must render the identical id or React throws a hydration mismatch.
  // (useId colons are stripped: they break url(#...) references.)
  const gid = `area-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <svg viewBox="0 0 100 60" className="w-full h-14" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#${gid})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
    </svg>
  );
}

export function AnimatedNumber({ value, delay = 0, className = "" }: { value: number; delay?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const [display, setDisplay] = useState(0);
  const [forced, setForced] = useState(false);
  const spring = useSpring(0, { stiffness: 120, damping: 22, mass: 0.6 });

  // Failsafe: never trap a "0" on screen if the in-view pipeline stalls.
  useEffect(() => {
    const id = setTimeout(() => setForced(true), 2000);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!inView && !forced) return;
    const timer = setTimeout(() => spring.set(value), delay);
    return () => clearTimeout(timer);
  }, [inView, forced, value, delay, spring]);

  useEffect(() => {
    const unsub = spring.on("change", (v) => setDisplay(Math.round(v)));
    return unsub;
  }, [spring]);

  return (
    <span ref={ref} className={`text-[40px] font-[800] tabular-nums text-[#F5F7FA] ${className}`}>
      {display.toLocaleString()}
    </span>
  );
}

export interface MetricCardProps {
  label: string;
  value: number | string;
  change: string;
  tone: string;
  icon: any;
  sparkline: Array<{ x: number; y: number }>;
  index?: number;
  immersive?: boolean;
}

export function MetricCard({ label, value, change, tone, icon: Icon, sparkline, index = 0, immersive = false }: MetricCardProps) {
  const color = TONE_COLORS[tone] || "#38BDF8";
  const numValue = typeof value === "string" ? parseInt(value.replace(/[^0-9]/g, "")) || 0 : value;

  return (
    <TiltCard max={5} scale={1.02} glare={`${color}14`} className="h-full">
    <motion.div
      initial={{ opacity: 0, y: 28, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
      className={`preserve-3d relative group glass-strong rounded-[24px] p-6 transition-colors duration-300 overflow-hidden border border-white/[0.06] h-full ${immersive ? "min-h-[168px]" : ""}`}
    >
      <div className="pointer-events-none absolute inset-0 rounded-[24px] bg-gradient-to-br from-transparent via-white/[0.03] to-transparent" />
      <div className="pointer-events-none absolute -top-12 -right-12 h-32 w-32 opacity-[0.10] blur-2xl transition-all duration-500 group-hover:opacity-[0.25] [transform:translateZ(10px)]" style={{ background: color }} />
      <div className="relative flex min-w-0 items-start justify-between gap-3 [transform:translateZ(24px)]">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-[600] uppercase tracking-[0.12em] text-[#9AA1AC]">{label}</p>
          <div className="mt-3 flex min-w-0 items-end gap-3">
            <AnimatedNumber value={numValue} delay={index * 0.1} />
            <div className="[transform:translateZ(48px)]">
              <div className="flex h-10 w-10 items-center justify-center rounded-[12px] mb-1 transition-transform group-hover:scale-110" style={{ background: `${color}18`, color, boxShadow: `0 8px 24px ${color}30` }}>
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
            </div>
          </div>
          <p className="mt-2.5 text-[12px] text-[#656B75]">
            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full transition-transform group-hover:scale-150" style={{ background: color }} />
            {change}
          </p>
        </div>
        <div className="relative ml-1 w-[104px] shrink-0 opacity-80 transition-opacity group-hover:opacity-100 min-[420px]:ml-4 min-[420px]:w-[140px]">
          <AreaChart data={sparkline} color={color} />
        </div>
      </div>
      <div className="pointer-events-none absolute inset-0 rounded-[24px] opacity-0 group-hover:opacity-100 transition bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />
    </motion.div>
    </TiltCard>
  );
}
