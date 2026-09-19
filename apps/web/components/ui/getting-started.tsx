"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Rocket, X } from "lucide-react";

/**
 * First-run checklist for fresh workspaces. Shows only when the workspace
 * has no meetings yet and the user hasn't dismissed it. Dismissal persists
 * locally — veterans never see it.
 */
export function GettingStarted({ meetings }: { meetings: number }) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem("dec:getting-started") === "done");
    } catch {
      setDismissed(false);
    }
  }, []);

  if (dismissed || meetings > 0) return null;

  const dismiss = () => {
    try {
      localStorage.setItem("dec:getting-started", "done");
    } catch {}
    setDismissed(true);
  };

  return (
    <section aria-label="Getting started" className="reveal relative mt-8 overflow-hidden rounded-[18px] border border-white/[0.06] bg-white/[0.02] p-5">
      <div className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-[#D4A574]/50 to-transparent" aria-hidden="true" />
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-gradient-to-br from-[#D4A574] to-[#38BDF8] text-[#08090B]">
            <Rocket className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-[14px] font-[650] tracking-[-0.01em] text-[#F5F7FA]">Get your first decision in minutes</p>
            <p className="fragment mt-0.5 text-[10px] uppercase tracking-[0.16em] text-[#656B75]">Step 1 of 3 · workspace ready</p>
          </div>
        </div>
        <button onClick={dismiss} className="rounded-[8px] p-1.5 text-[#656B75] transition hover:bg-white/[0.06] hover:text-white" aria-label="Dismiss getting started">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <ol className="mt-4 space-y-2">
        <li className="flex items-center gap-2.5 text-[13px]">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#10B981]/15"><Check className="h-3 w-3 text-[#34D399]" aria-hidden="true" /></span>
          <span className="text-[#656B75]">Workspace created — you&apos;re here</span>
        </li>
        <li>
          <Link href="/meetings?new=1" className="group flex items-center gap-2.5 rounded-[12px] border border-white/[0.07] bg-white/[0.03] px-3 py-2.5 text-[13px] transition hover:border-white/[0.14] hover:bg-white/[0.05]">
            <span className="flex h-5 w-5 items-center justify-center rounded-full border border-[#D4A574]/50 text-[10px] font-[700] text-[#D4A574]">2</span>
            <span className="font-[550] text-[#E9EDF2] group-hover:text-white">Start your first meeting</span>
            <span className="ml-auto text-[11px] text-[#656B75] group-hover:text-[#38BDF8]">Begin →</span>
          </Link>
        </li>
        <li className="flex items-center gap-2.5 px-3 text-[13px] opacity-60">
          <span className="flex h-5 w-5 items-center justify-center rounded-full border border-white/[0.12] text-[10px] font-[700] text-[#656B75]">3</span>
          <span className="text-[#9AA1AC]">Process it, then review your first decision</span>
        </li>
      </ol>
    </section>
  );
}
