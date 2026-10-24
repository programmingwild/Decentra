import { Sparkles } from "lucide-react";

/**
 * Route-level loading skeleton.
 *
 * Next.js streams this while a route's RSC payload + chunks are in flight, so
 * navigation feels instant instead of showing a blank page. The shimmer uses
 * the same motion language as the rest of the app.
 */
export default function Loading() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)] lg:flex-row">
      <div className="hidden w-[272px] shrink-0 border-r border-[var(--border)] bg-[var(--bg-2)] lg:block">
        <div className="space-y-4 p-4">
          <div className="skeleton h-8 w-32" />
          <div className="skeleton h-10 w-full rounded-[11px]" />
          <div className="skeleton h-10 w-full rounded-[11px]" />
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="skeleton h-7 w-full" style={{ animationDelay: `${i * 0.07}s` }} />
          ))}
        </div>
      </div>
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-[1240px] px-5 pb-20 pt-8 lg:px-8 lg:pt-12">
          <div className="flex items-center gap-2.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-[7px] bg-[var(--elevated)] text-[var(--muted)]">
              <Sparkles className="h-3.5 w-3.5 animate-pulse" aria-hidden="true" />
            </span>
            <span className="fragment text-[10.5px] uppercase tracking-[0.2em] text-[var(--subtle)]">Loading workspace</span>
          </div>
          <div className="skeleton mt-4 h-11 w-2/3 max-w-xl" />
          <div className="skeleton mt-3 h-4 w-1/2 max-w-sm" />
          <div className="mt-8 grid gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton h-[168px] rounded-[24px]" style={{ animationDelay: `${i * 0.08}s` }} />
            ))}
          </div>
          <div className="mt-10 grid gap-8 lg:grid-cols-[1.5fr_1fr]">
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton h-16 rounded-[16px]" style={{ animationDelay: `${i * 0.06}s` }} />
              ))}
            </div>
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="skeleton h-10 rounded-[12px]" style={{ animationDelay: `${i * 0.06}s` }} />
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
