"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Route-level crash UI. A throwing page remounts into this instead of
 * taking down the whole app (see global-error.tsx for the last resort).
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Actually report: Sentry when configured, console otherwise.
    console.error("[decentra] route error", error);
    try {
      const Sentry = require("@sentry/nextjs");
      if (typeof Sentry?.captureException === "function") Sentry.captureException(error);
    } catch { /* sentry optional */ }
  }, [error]);

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
      <p className="fragment text-[10.5px] uppercase tracking-[0.22em] text-[#656B75]">
        This section crashed
      </p>
      <h1 className="display-hero mt-3 text-[36px] sm:text-[48px]">
        Let&apos;s get you <span className="thin text-[#9AA1AC]">back.</span>
      </h1>
      <p className="mt-4 max-w-[420px] text-[14px] leading-relaxed text-[#9AA1AC]">
        The error was reported{error?.digest ? ` (ref ${error.digest})` : ""}. Try again, or
        head somewhere safe.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={() => reset()}
          className="inline-flex h-[44px] items-center rounded-full bg-white px-7 text-[14px] font-[650] text-[#08090B] transition hover:bg-[#F5F7FA]"
        >
          Try again
        </button>
        <Link
          href="/overview"
          className="glass inline-flex h-[44px] items-center rounded-full px-7 text-[14px] font-[550] text-[#E9EDF2] transition hover:bg-white/[0.08]"
        >
          Workspace
        </Link>
      </div>
    </main>
  );
}
