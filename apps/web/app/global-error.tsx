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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('dec:theme');var d=t||(window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');document.documentElement.classList.toggle('light',d==='light');document.documentElement.classList.toggle('dark',d==='dark');document.documentElement.style.colorScheme=d;}catch(e){}})();` }} />
      </head>
      <body className="bg-[var(--bg)] text-[var(--text)] antialiased">
        <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-gradient-to-br from-[var(--gold)] to-[var(--sky)] text-[18px] font-[800] text-[var(--bg)]">
            D
          </span>
          <p className="fragment mt-6 text-[10.5px] uppercase tracking-[0.22em] text-[var(--subtle)]">
            Something broke on our side
          </p>
          <h1 className="display-hero mt-3 text-[40px] sm:text-[56px]">
            Let&apos;s get you <span className="thin text-[var(--muted)]">back.</span>
          </h1>
          <p className="mt-4 max-w-[420px] text-[14px] leading-relaxed text-[var(--muted)]">
            The error was reported{error?.digest ? ` (ref ${error.digest})` : ""}. Try again, or head
            back to safety.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => reset()}
              className="inline-flex h-[44px] items-center rounded-full bg-[var(--fg)] px-7 text-[14px] font-[650] text-[var(--bg)] transition hover:bg-[var(--text)]"
            >
              Try again
            </button>
            <Link
              href="/"
              className="glass inline-flex h-[44px] items-center rounded-full px-7 text-[14px] font-[550] text-[var(--text)] transition hover:bg-[color-mix(in_srgb,var(--fg)_8%,transparent)]"
            >
              Home
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
