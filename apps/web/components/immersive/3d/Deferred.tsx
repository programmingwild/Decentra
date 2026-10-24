"use client";
import { useEffect, useState, type ReactNode } from "react";

/**
 * Defers mounting heavy children until the browser is idle.
 *
 * The hero scene is the only thing that must be ready for first paint; the
 * ambient background layers (aurora, particles) can mount a beat later without
 * anyone noticing, and it keeps them off the critical path.
 */
export function Deferred({
  children,
  timeout = 1200,
}: {
  children: ReactNode;
  timeout?: number;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let done = false;
    const fire = () => {
      if (done) return;
      done = true;
      setReady(true);
    };
    const idle = (window as any).requestIdleCallback;
    let handle: number | undefined;
    if (typeof idle === "function") {
      handle = idle(fire, { timeout });
    } else {
      handle = window.setTimeout(fire, 220);
    }
    // Hard cap so the scene always appears, even on a busy main thread.
    const cap = window.setTimeout(fire, timeout);
    return () => {
      if (typeof idle === "function" && handle != null) (window as any).cancelIdleCallback(handle);
      else window.clearTimeout(handle);
      window.clearTimeout(cap);
    };
  }, [timeout]);

  return <>{ready ? children : null}</>;
}
