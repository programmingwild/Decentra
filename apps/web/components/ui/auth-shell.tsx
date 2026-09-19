"use client";
import Link from "next/link";
import { ShaderAurora } from "@/components/immersive/3d/ShaderAurora";

/**
 * Shared auth chrome: ambient aurora, Triakis brand voice, glass card,
 * optional step rail (onboarding), trust footer. One voice across
 * login / register / onboarding.
 */
export function AuthShell({
  title,
  sub,
  children,
  footer,
  steps,
}: {
  title: string;
  sub: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  steps?: { label: string; done?: boolean; active?: boolean }[];
}) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#08090B] p-6">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <ShaderAurora className="opacity-[0.4]" speed={0.6} intensity={0.5} mouseInfluence={0.4} />
        <div className="orb orb-violet h-[460px] w-[520px] left-1/2 top-[-160px] -translate-x-1/2 opacity-[0.16]" />
        <div className="orb orb-amber h-[300px] w-[340px] left-[8%] bottom-[-100px] opacity-[0.10]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(8,9,11,0.7)_100%)]" />
      </div>
      <div className="relative w-full max-w-[460px]">
        <Link href="/" className="mb-8 flex flex-col items-center gap-3" aria-label="Decentra home">
          <span className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-gradient-to-br from-[#D4A574] to-[#38BDF8] text-[16px] font-[800] text-[#08090B] shadow-[0_8px_32px_rgba(212,165,116,0.25)]">D</span>
          <span className="text-center">
            <span className="font-triakis block text-[19px] tracking-[0.06em] text-[#F5F7FA]">DECENTRA</span>
            <span className="fragment mt-1.5 block text-[10px] uppercase tracking-[0.24em] text-[#656B75]">Decision Intelligence</span>
          </span>
        </Link>

        {steps && steps.length > 0 && (
          <div className="mb-5 flex items-center gap-2" aria-label="Setup progress">
            {steps.map((s, i) => (
              <div key={s.label} className="flex-1">
                <div className="h-[3px] overflow-hidden rounded-full bg-white/[0.08]">
                  <div
                    className={`h-full rounded-full ${s.done || s.active ? "bg-gradient-to-r from-[#D4A574] to-[#38BDF8]" : "bg-transparent"}`}
                    style={{ width: s.done ? "100%" : s.active ? "55%" : "0%" }}
                  />
                </div>
                <p className={`fragment mt-1.5 text-[9px] uppercase tracking-[0.16em] ${s.active ? "text-[#E9EDF2]" : "text-[#454B54]"}`}>{s.label}</p>
              </div>
            ))}
          </div>
        )}

        <div className="glass-strong relative overflow-hidden rounded-[24px] p-7 shadow-[0_32px_96px_rgba(0,0,0,0.55)] sm:p-8">
          <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-[#D4A574]/60 to-transparent" aria-hidden="true" />
          <h1 className="font-triakis text-[24px] tracking-[0.02em] text-[#F5F7FA]">{title}</h1>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#9AA1AC]">{sub}</p>
          <div className="mt-6">{children}</div>
        </div>

        {footer && <div className="mt-5 text-center text-[13px] text-[#656B75]">{footer}</div>}
        <p className="fragment mt-6 text-center text-[9.5px] uppercase tracking-[0.2em] text-[#454B54]">
          Evidence-first · Human-in-the-loop
        </p>
      </div>
    </main>
  );
}
