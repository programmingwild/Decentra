"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Reports whether the element is in the viewport.
 *
 * Used to pause WebGL rendering entirely when a scene is off-screen.
 * IMPORTANT: R3F's `useFrame` does not auto-invalidate, so `frameloop="demand"`
 * would freeze animations after a single frame. The correct pattern is
 * `frameloop="always"` while visible and `"never"` while hidden.
 */
export function useSceneVisibility<T extends HTMLElement>(rootMargin = "200px") {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (e) setVisible(e.isIntersecting);
      },
      { rootMargin, threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);

  return { ref, visible };
}
