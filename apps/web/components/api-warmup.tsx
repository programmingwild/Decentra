"use client";
import { useEffect } from "react";

/**
 * Render free-tier services sleep after ~5 min idle. Loading a page wakes the
 * web service, but the API service only wakes on the first /api/v1/* call —
 * which used to be the login POST, so the click burned the client's 60s
 * timeout + retry (~2 min) while the API booted. Ping health in the
 * background on mount and every 4 min while the tab is open so the API is
 * already warm when the user signs in. Fully fire-and-forget: no UI, no
 * errors surfaced, no effect on the login flow.
 */
export function ApiWarmup() {
  useEffect(() => {
    let active = true;
    const ctrl = new AbortController();
    const ping = () => {
      if (!active || document.visibilityState !== "visible") return;
      fetch("/api/v1/health", { cache: "no-store", signal: ctrl.signal })
        .then((r) => r.text())
        .catch(() => {});
    };
    ping();
    const id = window.setInterval(ping, 4 * 60 * 1000);
    const onVisible = () => { if (document.visibilityState === "visible") ping(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      ctrl.abort();
    };
  }, []);
  return null;
}
