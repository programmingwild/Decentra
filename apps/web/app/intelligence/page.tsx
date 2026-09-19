"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Nav } from "@/components/nav";
import { SectionLabel } from "@/components/ui/primitives";
import { SkeletonRow, EmptyState } from "@/components/ui/states";
import { PageHero } from "@/components/ui/page-hero";
import { ShaderAurora } from "@/components/immersive/3d/ShaderAurora";
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
    <div className="flex min-h-screen flex-col bg-[#08090B] lg:flex-row">
      <Nav />
      <main className="min-w-0 flex-1">
        <div className="relative mx-auto max-w-[980px] px-5 pb-20 pt-8 lg:px-8 lg:pt-12">
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true"><ShaderAurora className="opacity-[0.22]" speed={0.6} intensity={0.35} mouseInfluence={0.2} /><div className="orb orb-violet h-[300px] w-[340px] -right-[60px] top-[30px] opacity-[0.12]" /></div>
          <PageHero
            kicker="External research · Tavily layer"
            title="Intelligence"
            sub="Research findings, best practices, risks and alternatives — every claim cites a source. Privacy: Balanced mode — sanitized decision context only."
          />
          <div className="mt-6 rounded-[14px] border border-[#F59E0B]/20 bg-[#F59E0B]/[0.06] p-4 flex gap-3">
            <ShieldAlert className="h-4 w-4 shrink-0 text-[#F59E0B]" />
            <div className="text-[12.5px] leading-relaxed text-[#9AA1AC]"><span className="font-[600] text-[#FBBF24]">Privacy</span> — raw transcripts are never sent to external research. Only sanitized decision context is researched. Current mode: <span className="font-[600] text-[#F5F7FA]">Balanced</span> · <span className="text-[#656B75]">Maximum / Balanced / Research</span></div>
          </div>
          <div className="mt-6">
            <SectionLabel>Decisions ready for intelligence</SectionLabel>
            {loading ? <div className="mt-3 space-y-2">{[0,1].map(i=> <SkeletonRow key={i} />)}</div> : decisions.length===0 ? <EmptyState icon={<Sparkles className="h-5 w-5" />} title="No decisions yet" body="Process a meeting to generate decisions, then intelligence will appear here." /> : (
              <div className="mt-3 space-y-3">
                {decisions.slice(0,6).map((d:any)=> (
                  <div key={d.id} className="glass rounded-[14px] p-4">
                    <div className="flex items-center gap-2 text-[11px]"><span className="rounded-full bg-[#0EA5E9]/15 px-1.5 py-0.5 font-[600] text-[#38BDF8]">{d.status}</span><span className="text-[#656B75]">{d.confidence ? `${Math.round(d.confidence*100)}%` : ""}</span></div>
                    <p className="mt-2 text-[14px] font-[600] text-[#F5F7FA]">{d.title}</p>
                    <p className="mt-1 text-[12px] text-[#9AA1AC]">{d.description || "No description"}</p>
                    <div className="mt-3 flex gap-2">
                      <a href={`/meetings/${d.meeting_id}`} className="text-[11px] font-[600] text-[#38BDF8] hover:text-white inline-flex items-center gap-1">View decision <ExternalLink className="h-3 w-3" /></a>
                      <span className="text-[11px] text-[#656B75]">· Research: Tavily integration pending — sanitized query will be shown here with sources</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="mt-8 rounded-[14px] border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-[12px] font-[600] text-[#F5F7FA]">How intelligence works</p>
            <p className="mt-1 text-[12px] leading-relaxed text-[#9AA1AC]">Private transcript → extraction → privacy classification → sanitization → research query → Tavily → external sources → LLM analysis → Recommendation with confidence and sources → Review Queue → Human approval → Verified knowledge.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
