"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Nav } from "@/components/nav";
import { SectionLabel } from "@/components/ui/primitives";
import { SkeletonRow, EmptyState } from "@/components/ui/states";
import { PageHero } from "@/components/ui/page-hero";
const ShaderAurora = dynamic(() => import("@/components/immersive/3d/ShaderAurora").then((m) => m.ShaderAurora), { ssr: false });
import { Sparkles, ExternalLink, ShieldAlert } from "lucide-react";

export default function IntelligencePage() {
  const [decisions, setDecisions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        const orgs = await api("/api/v1/organizations");
        if (!orgs?.[0]) return;
        const decs = await api(`/api/v1/decisions?org_id=${orgs[0].id}`).catch(()=>[]);
        setDecisions(decs || []);
      } catch {}
      setLoading(false);
    })();
  }, []);
  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)] lg:flex-row">
      <Nav />
      <main className="min-w-0 flex-1">
        <div className="relative mx-auto max-w-[980px] px-5 pb-20 pt-8 lg:px-8 lg:pt-12">
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true"><ShaderAurora className="opacity-[0.22]" speed={0.6} intensity={0.35} mouseInfluence={0.2} /><div className="orb orb-violet h-[300px] w-[340px] -right-[60px] top-[30px] opacity-[0.12]" /></div>
          <PageHero
            kicker="External research · Tavily layer"
            title="Intelligence"
            sub="Research findings, best practices, risks and alternatives — every claim cites a source. Privacy: Balanced mode — sanitized decision context only."
          />
          <div className="mt-6 rounded-[14px] border border-[color-mix(in_srgb,var(--amber-2)_20%,transparent)] bg-[color-mix(in_srgb,var(--amber-2)_6%,transparent)] p-4 flex gap-3">
            <ShieldAlert className="h-4 w-4 shrink-0 text-[var(--amber-2)]" />
            <div className="text-[12.5px] leading-relaxed text-[var(--muted)]"><span className="font-[600] text-[var(--amber)]">Privacy</span> — raw transcripts are never sent to external research. Only sanitized decision context is researched. Current mode: <span className="font-[600] text-[var(--text)]">Balanced</span> · <span className="text-[var(--subtle)]">Maximum / Balanced / Research</span></div>
          </div>
          <div className="mt-6">
            <SectionLabel>Decisions ready for intelligence</SectionLabel>
            {loading ? <div className="mt-3 space-y-2">{[0,1].map(i=> <SkeletonRow key={i} />)}</div> : decisions.length===0 ? <EmptyState icon={<Sparkles className="h-5 w-5" />} title="No decisions yet" body="Process a meeting to generate decisions, then intelligence will appear here." /> : (
              <div className="mt-3 space-y-3">
                {decisions.slice(0,6).map((d:any)=> (
                  <div key={d.id} className="glass rounded-[14px] p-4">
                    <div className="flex items-center gap-2 text-[11px]"><span className="rounded-full bg-[color-mix(in_srgb,var(--sky-2)_15%,transparent)] px-1.5 py-0.5 font-[600] text-[var(--sky)]">{d.status}</span><span className="text-[var(--subtle)]">{d.confidence ? `${Math.round(d.confidence*100)}%` : ""}</span></div>
                    <p className="mt-2 text-[14px] font-[600] text-[var(--text)]">{d.title}</p>
                    <p className="mt-1 text-[12px] text-[var(--muted)]">{d.description || "No description"}</p>
                    <div className="mt-3 flex gap-2">
                      <a href={`/meetings/${d.meeting_id}`} className="text-[11px] font-[600] text-[var(--sky)] hover:text-[var(--fg)] inline-flex items-center gap-1">View decision <ExternalLink className="h-3 w-3" /></a>
                      <span className="text-[11px] text-[var(--subtle)]">· Research: Tavily integration pending — sanitized query will be shown here with sources</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="mt-8 rounded-[14px] border border-[var(--border)] bg-[color-mix(in_srgb,var(--fg)_2%,transparent)] p-4">
            <p className="text-[12px] font-[600] text-[var(--text)]">How intelligence works</p>
            <p className="mt-1 text-[12px] leading-relaxed text-[var(--muted)]">Private transcript → extraction → privacy classification → sanitization → research query → Tavily → external sources → LLM analysis → Recommendation with confidence and sources → Review Queue → Human approval → Verified knowledge.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
