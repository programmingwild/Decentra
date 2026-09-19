"use client";
import { Nav } from "@/components/nav";
import { PageHero } from "@/components/ui/page-hero";
import { ShaderAurora } from "@/components/immersive/3d/ShaderAurora";
import { ShieldCheck, Lock, EyeOff, Database } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#08090B] lg:flex-row">
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
            <h2 className="text-[13px] font-[600] text-[#F5F7FA]">Privacy Mode</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {[
                {icon: Lock, title:"Maximum Privacy", desc:"No external research. All intelligence stays on-device.", active:false},
                {icon: ShieldCheck, title:"Balanced", desc:"Only sanitized decision context may be researched.", active:true},
                {icon: EyeOff, title:"Research Mode", desc:"Org-approved external research policies.", active:false},
              ].map(({icon:Icon,title,desc,active})=> (
                <div key={title} className={`rounded-[14px] border p-4 ${active?"border-[#0EA5E9]/30 bg-[#0EA5E9]/[0.06]":"border-white/[0.06] bg-white/[0.02]"}`}>
                  <Icon className={`h-5 w-5 ${active?"text-[#38BDF8]":"text-[#656B75]"}`} />
                  <p className="mt-2 text-[13px] font-[600] text-[#F5F7FA]">{title} {active&&<span className="ml-1 rounded-full bg-[#0EA5E9]/20 px-1.5 py-0.5 text-[10px] text-[#38BDF8]">Active</span>}</p>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-[#9AA1AC]">{desc}</p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-[#656B75]">External research is disabled during live meetings. Raw transcripts are never sent to Tavily — only sanitized decision context.</p>
          </section>

          <section className="mt-8">
            <h2 className="text-[13px] font-[600] text-[#F5F7FA]">Data Classification</h2>
            <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
              {["PUBLIC","INTERNAL","CONFIDENTIAL","HIGHLY_SENSITIVE","SECRET"].map((l, i)=> <span key={l} className={`rounded-full border px-2.5 py-1 font-[600] ${i>=3?"border-[#EF4444]/30 bg-[#EF4444]/10 text-[#F87171]":i>=2?"border-[#F59E0B]/30 bg-[#F59E0B]/10 text-[#FBBF24]":"border-white/10 bg-white/5 text-[#9AA1AC]"}`}>{l}</span>)}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-[#656B75]">Highly sensitive or secret (credentials, API keys, PII, cloud identifiers) is blocked from external research and sanitized before any research query.</p>
          </section>

          <section className="mt-8 flex gap-3 rounded-[14px] border border-white/[0.06] bg-[#101216] p-4">
            <Database className="h-5 w-5 shrink-0 text-[#656B75]" />
            <div>
              <p className="text-[13px] font-[600] text-[#F5F7FA]">Retention & Deletion</p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-[#9AA1AC]">Organization/tenant isolation, RBAC, audit logs, user-controlled retention and deletion, secure file handling and API authorization are enforced per §17. Data deletion is available via API and UI.</p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
