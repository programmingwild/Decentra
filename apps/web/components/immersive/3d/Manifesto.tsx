"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useInView } from "framer-motion";
import { GeistSans } from "geist/font/sans";
import { useFailsafeVisible } from "@/components/immersive/3d/useFailsafeVisible";

export type ManifestoSeg = { t: string; hot?: boolean; gold?: boolean };

type Word = { w: string; hot?: boolean; gold?: boolean };

/**
 * Immersive typewriter: words hammer in one by one with a blinking gold
 * caret, starting the moment the manifesto enters view. Reduced motion,
 * missing observers, or any stalled pipeline → full text instantly.
 */
export function Manifesto({
  segments,
  className = "",
  onProgress,
}: {
  segments: ManifestoSeg[];
  className?: string;
  onProgress?: (done: number, total: number) => void;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  const inView = useInView(ref, { once: true, margin: "-20% 0px" });
  const safe = useFailsafeVisible(2500);

  const words: Word[] = useMemo(() => {
    const out: Word[] = [];
    segments.forEach((s) => s.t.split(" ").forEach((w) => w && out.push({ w, hot: s.hot, gold: s.gold })));
    return out;
  }, [segments]);

  const [count, setCount] = useState(0);
  const reduced = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );

  useEffect(() => {
    if (safe || reduced) {
      setCount(words.length);
      return;
    }
    if (!inView || count >= words.length) return;
    const id = setTimeout(() => setCount((c) => c + 1), count === 0 ? 600 : 60);
    return () => clearTimeout(id);
  }, [inView, safe, reduced, count, words.length]);

  useEffect(() => {
    onProgress?.(count, words.length);
  }, [count, words.length, onProgress]);

  const done = count >= words.length;

  return (
    <p ref={ref} className={`${GeistSans.className} ${className}`} aria-label={words.map((w) => w.w).join(" ")}>
      {words.slice(0, count).map((wd, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={wd.gold ? "text-[#D4A574]" : wd.hot ? "text-white" : undefined}
        >
          {wd.w}{" "}
        </span>
      ))}
      {!done && <span aria-hidden="true" className="type-caret" />}
    </p>
  );
}
