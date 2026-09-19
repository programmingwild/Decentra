"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Last-resort crash UI (Next.js requires html/body here).
 * Matches the brand so a fatal error still feels like Decentra.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[decentra] fatal error", error);
    try {
      const Sentry = require("@sentry/nextjs");
      if (typeof Sentry?.captureException === "function") Sentry.captureException(error);
    } catch { /* sentry optional */ }
  }, [error]);
  return (
    <html lang="en" className="dark" style={{ colorScheme: "dark" }}>
      <body className="bg-[#08090B] text-[#F5F7FA] antialiased">
        <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-gradient-to-br from-[#D4A574] to-[#38BDF8] text-[18px] font-[800] text-[#08090B]">
            D
          </span>
          <p className="fragment mt-6 text-[10.5px] uppercase tracking-[0.22em] text-[#656B75]">
            Something broke on our side
          </p>
          <h1 className="display-hero mt-3 text-[40px] sm:text-[56px]">
            Let&apos;s get you <span className="thin text-[#9AA1AC]">back.</span>
          </h1>
          <p className="mt-4 max-w-[420px] text-[14px] leading-relaxed text-[#9AA1AC]">
            The error was reported{error?.digest ? ` (ref ${error.digest})` : ""}. Try again, or head
            back to safety.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => reset()}
              className="inline-flex h-[44px] items-center rounded-full bg-white px-7 text-[14px] font-[650] text-[#08090B] transition hover:bg-[#F5F7FA]"
            >
              Try again
            </button>
            <Link
              href="/"
              className="glass inline-flex h-[44px] items-center rounded-full px-7 text-[14px] font-[550] text-[#E9EDF2] transition hover:bg-white/[0.08]"
            >
              Home
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
