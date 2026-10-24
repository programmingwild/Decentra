"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useMotionValueEvent,
  useMotionTemplate,
  type MotionValue,
} from "framer-motion";
import { GeistSans } from "geist/font/sans";
import type { ManifestoSeg } from "@/components/immersive/3d/Manifesto";

type Word = { w: string; hot?: boolean; gold?: boolean };

/**
 * Scroll-scrubbed manifesto — the 2025/26 editorial pattern (Awwwards
 * "text filling on scroll", OFF+BRAND manifesto, Apple-style narrative).
 *
 * The full paragraph is laid out from first paint — nothing is timed, so
 * fast scrollers always read complete copy and layout never shifts.
 * Each word unblurs + fills from ghost to ink as a pure function of
 * section scroll progress; scrolling back reverses it exactly.
 */
function ScrubWord({
  word,
  index,
  total,
  progress,
}: {
  word: Word;
  index: number;
  total: number;
  progress: MotionValue<number>;
}) {
  const start = index / total;
  const end = Math.min(1, start + 1.5 / total);
  const opacity = useTransform(progress, [start, end], [0.13, 1]);
  const blur = useTransform(progress, [start, end], [6, 0]);
  const y = useTransform(progress, [start, end], [10, 0]);
  const filter = useMotionTemplate`blur(${blur}px)`;

  return (
    <motion.span
      aria-hidden="true"
      style={{ opacity, filter, y }}
      className={
        word.gold
          ? "serif italic text-[var(--gold)]"
          : word.hot
            ? "text-[var(--fg)]"
            : undefined
      }
    >
      {word.w}{" "}
    </motion.span>
  );
}

/** Inline glass evidence chip — fades in with the word it annotates. */
function EvidenceChip({
  index,
  total,
  progress,
}: {
  index: number;
  total: number;
  progress: MotionValue<number>;
}) {
  const opacity = useTransform(
    progress,
    [index / total, Math.min(1, (index + 2) / total)],
    [0, 1]
  );
  return (
    <motion.span
      aria-hidden="true"
      style={{ opacity }}
      className="fragment mx-1 inline-flex -translate-y-1 items-center gap-1.5 whitespace-nowrap rounded-full border border-[color-mix(in_srgb,var(--gold)_30%,transparent)] bg-[color-mix(in_srgb,var(--gold)_10%,transparent)] px-3 py-1 align-middle text-[0.32em] font-[500] uppercase tracking-[0.14em] text-[var(--gold)]"
    >
      ◆ 42:17 evidence
    </motion.span>
  );
}

export function ManifestoScrub({
  segments,
  className = "",
  onProgress,
}: {
  segments: ManifestoSeg[];
  className?: string;
  onProgress?: (done: number, total: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // NOTE: no useFailsafeVisible here — that hook forces content visible
  // after a timeout, which would kill the scroll scrub. Reduced motion
  // alone decides the static path; scrubbing is scroll-driven, never timed.
  const [reduced, setReduced] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pct, setPct] = useState(0);

  const words: Word[] = useMemo(() => {
    const out: Word[] = [];
    segments.forEach((s) =>
      s.t
        .split(" ")
        .forEach((w) => w && out.push({ w, hot: s.hot, gold: s.gold }))
    );
    return out;
  }, [segments]);

  // One scroll source for the whole passage — words derive MotionValues
  // from it, so nothing re-renders per frame except the % readout.
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.82", "end 0.42"],
  });
  const ghostX = useTransform(scrollYProgress, [0, 1], ["3%", "-14%"]);
  const railScale = scrollYProgress;

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const p = Math.min(Math.max(v, 0), 1);
    const next = Math.round(p * 100);
    setPct((prev) => (prev === next ? prev : next));
    onProgress?.(Math.min(words.length, Math.floor(p * words.length) + 1), words.length);
  });

  useEffect(() => {
    setMounted(true);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setReduced(true);
    }
  }, []);

  const fullText = words.map((w) => w.w).join(" ");
  const staticMode = reduced || !mounted;
  const spokenAt = words.findIndex((w) => w.w.startsWith("spoken"));

  return (
    <div ref={ref} className={`relative ${className}`}>
      {/* drifting ghost word behind the copy */}
      <motion.span
        aria-hidden="true"
        style={{ x: ghostX }}
        className="display-hero text-stroke pointer-events-none absolute -top-[0.9em] left-0 select-none whitespace-nowrap text-[clamp(4rem,14vw,12rem)] leading-none opacity-40"
      >
        REMEMBER
      </motion.span>

      {/* meta row */}
      <div className="relative mb-8 flex flex-wrap items-center justify-between gap-3">
        <span className="fragment text-[10px] uppercase tracking-[0.2em] text-[var(--subtle)]">
          {pct >= 100 ? "Read · scroll back to re-read" : `Reading · ${pct}%`}
        </span>
        <span className="fragment inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[color-mix(in_srgb,var(--fg)_3%,transparent)] px-3.5 py-1.5 text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--gold)]" /> scroll to fill
        </span>
      </div>

      <p
        aria-label={fullText}
        className={`${GeistSans.className} relative max-w-[20ch] text-[clamp(1.9rem,4.6vw,3.3rem)] font-[650] leading-[1.32] tracking-[-0.02em] text-[var(--subtle)] sm:max-w-[24ch]`}
      >
        {staticMode
          ? words.map((wd, i) => (
              <span
                key={i}
                className={wd.gold ? "serif italic text-[var(--gold)]" : wd.hot ? "text-[var(--fg)]" : undefined}
              >
                {wd.w}{" "}
              </span>
            ))
          : words.map((wd, i) => (
              <span key={i}>
                <ScrubWord word={wd} index={i} total={words.length} progress={scrollYProgress} />
                {i === spokenAt && (
                  <EvidenceChip index={i} total={words.length} progress={scrollYProgress} />
                )}
              </span>
            ))}
      </p>

      {/* progress hairline */}
      <div className="relative mt-10 h-px w-full bg-[color-mix(in_srgb,var(--fg)_8%,transparent)]">
        <motion.div
          aria-hidden="true"
          style={{ scaleX: staticMode ? 1 : railScale }}
          className="h-full origin-left bg-gradient-to-r from-[var(--gold)] via-[var(--gold)] to-[var(--sky)]"
        />
      </div>
      <div className="relative mt-5 flex flex-wrap items-end justify-between gap-4">
        <p className="fragment text-[10.5px] uppercase leading-loose tracking-[0.2em] text-[var(--faint)]">
          — the reason
          <br />
          decentra exists
        </p>
        <p className="serif max-w-[300px] text-right text-[15px] leading-snug text-[var(--muted)]">
          Every commitment, <span className="italic text-[var(--gold)]">pinned to the second</span> it
          was spoken.
        </p>
      </div>
    </div>
  );
}
