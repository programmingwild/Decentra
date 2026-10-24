"use client";
import dynamic from "next/dynamic";
import { Nav } from "@/components/nav";
import { PageHero } from "@/components/ui/page-hero";
const ShaderAurora = dynamic(() => import("@/components/immersive/3d/ShaderAurora").then((m) => m.ShaderAurora), { ssr: false });
import { ShieldCheck, Lock, EyeOff, Database } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)] lg:flex-row">
      <Nav />
      <main className="min-w-0 flex-1">
        <div className="relative mx-auto max-w-[860px] px-5 pb-20 pt-8 lg:px-8 lg:pt-12">
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true"><ShaderAurora className="opacity-[0.22]" speed={0.6} intensity={0.35} mouseInfluence={0.2} /><div className="orb orb-violet h-[280px] w-[320px] -right-[60px] top-[40px] opacity-[0.12]" /></div>
          <PageHero
            kicker="Workspace controls"
            title="Settings"
            sub="Privacy modes, retention, and organization controls."
          />

          <section className="mt-8">
            <h2 className="text-[13px] font-[600] text-[var(--text)]">Privacy Mode</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {[
                {icon: Lock, title:"Maximum Privacy", desc:"No external research. All intelligence stays on-device.", active:false},
                {icon: ShieldCheck, title:"Balanced", desc:"Only sanitized decision context may be researched.", active:true},
                {icon: EyeOff, title:"Research Mode", desc:"Org-approved external research policies.", active:false},
              ].map(({icon:Icon,title,desc,active})=> (
                <div key={title} className={`rounded-[14px] border p-4 ${active?"border-[color-mix(in_srgb,var(--sky-2)_30%,transparent)] bg-[color-mix(in_srgb,var(--sky-2)_6%,transparent)]":"border-[var(--border)] bg-[color-mix(in_srgb,var(--fg)_2%,transparent)]"}`}>
                  <Icon className={`h-5 w-5 ${active?"text-[var(--sky)]":"text-[var(--subtle)]"}`} />
                  <p className="mt-2 text-[13px] font-[600] text-[var(--text)]">{title} {active&&<span className="ml-1 rounded-full bg-[color-mix(in_srgb,var(--sky-2)_20%,transparent)] px-1.5 py-0.5 text-[10px] text-[var(--sky)]">Active</span>}</p>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--muted)]">{desc}</p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-[var(--subtle)]">External research is disabled during live meetings. Raw transcripts are never sent to Tavily — only sanitized decision context.</p>
          </section>

          <section className="mt-8">
            <h2 className="text-[13px] font-[600] text-[var(--text)]">Data Classification</h2>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
              {["PUBLIC","INTERNAL","CONFIDENTIAL","HIGHLY_SENSITIVE","SECRET"].map((l, i)=> <span key={l} className={`rounded-full border px-2.5 py-1 font-[600] ${i>=3?"border-[color-mix(in_srgb,var(--red-2)_30%,transparent)] bg-[color-mix(in_srgb,var(--red-2)_10%,transparent)] text-[var(--red)]":i>=2?"border-[color-mix(in_srgb,var(--amber-2)_30%,transparent)] bg-[color-mix(in_srgb,var(--amber-2)_10%,transparent)] text-[var(--amber)]":"border-[var(--border)] bg-[var(--fg)]/5 text-[var(--muted)]"}`}>{l}</span>)}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-[var(--subtle)]">Highly sensitive or secret (credentials, API keys, PII, cloud identifiers) is blocked from external research and sanitized before any research query.</p>
          </section>

          <section className="mt-8 flex gap-3 rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-4">
            <Database className="h-5 w-5 shrink-0 text-[var(--subtle)]" />
            <div>
              <p className="text-[13px] font-[600] text-[var(--text)]">Retention & Deletion</p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--muted)]">Organization/tenant isolation, RBAC, audit logs, user-controlled retention and deletion, secure file handling and API authorization are enforced per §17. Data deletion is available via API and UI.</p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
