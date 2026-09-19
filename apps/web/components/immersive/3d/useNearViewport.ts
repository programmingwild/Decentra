"use client";
import { useEffect, useRef, useState } from "react";

/**
 * True once the anchor scrolls within `margin` of the viewport. Never flips
 * back. Used to mount below-fold WebGL canvases only on approach — each live
 * context costs GPU memory, and a lost context renders as a permanent black
 * hole. Absolutely-positioned canvas layers keep layout stable either way.
 */
export function useNearViewport<T extends HTMLElement>(marginPx = 900) {
  const ref = useRef<T>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    if (!ref.current || typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const el = ref.current;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: `${marginPx}px 0px` }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [marginPx]);

  return { ref, near };
}
