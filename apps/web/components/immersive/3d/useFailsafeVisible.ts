"use client";
import { useEffect, useState } from "react";

/**
 * Failsafe visibility: returns true once entrance animation is unnecessary.
 * Covers reduced-motion, missing IntersectionObserver, and any stalled
 * animation pipeline (background tabs, throttled rAF) — content must never
 * be trapped invisible. Components render a plain visible tree when true.
 */
export function useFailsafeVisible(timeoutMs = 2000) {
  const [safe, setSafe] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setSafe(true);
      return;
    }
    if (typeof IntersectionObserver === "undefined") {
      setSafe(true);
      return;
    }
    const id = setTimeout(() => setSafe(true), timeoutMs);
    return () => clearTimeout(id);
  }, [timeoutMs]);

  return safe;
}
