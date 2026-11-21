"use client";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { getMeAndOrgs } from "@/lib/auth";
import { Nav } from "@/components/nav";
import { SectionLabel } from "@/components/ui/primitives";
import { ErrorState, SkeletonLines } from "@/components/ui/states";
import { GitBranch, Video, CheckCircle2, ClipboardList, HelpCircle, Sparkles, Network, Target, TrendingUp, Zap, Brain, BarChart3 } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { MetricCard } from "@/components/ui/metrics";
const ShaderAurora = dynamic(() => import("@/components/immersive/3d/ShaderAurora").then((m) => m.ShaderAurora), { ssr: false });
const GraphCanvas = dynamic(() => import("@/components/immersive/GraphCanvas"), { ssr: false });

export default function KnowledgeGraphPage() {
  const [meetings, setMeetings] = useState<any[]>([]);
  const [decisions, setDecisions] = useState<any[]>([]);
  const [actions, setActions] = useState<any[]>([]);
  const [error, setError] = useState<{ title: string; reason: string } | null>(null);
  const [ready, setReady] = useState(false);

  async function loadAll() {
    setError(null);
    try {
      // Shared burst with the AuthProvider/overview page: GET /me + GET /organizations.
      const [, orgs] = await getMeAndOrgs();
      const oid = orgs?.[0]?.id;
      if (!oid) { setReady(true); return; }
      const [ms, ds, as] = await Promise.all([
        api(`/api/v1/meetings?org_id=${oid}`).catch(()=>[]),
        api(`/api/v1/decisions?org_id=${oid}`).catch(()=>[]),
        api(`/api/v1/actions?org_id=${oid}`).catch(()=>[]),
      ]);
      setMeetings(ms||[]); setDecisions(ds||[]); setActions(as||[]);
    } catch (e: any) {
      setError({ title: "We couldn't load your knowledge graph", reason: e?.message?.slice(0, 160) || "Check that the Decentra server is running." });
    } finally {
      setReady(true);
    }
  }
  useEffect(() => { loadAll(); }, []);

  // Bold metric cards for knowledge graph
  const graphMetrics = useMemo(() => [
    { label: "Meetings", value: meetings.length, change: "Nodes in graph", tone: "violet", icon: Network, sparkline: meetings.slice(-7).map((m, i) => ({ x: i, y: 1 })) },
    { label: "Decisions", value: decisions.length, change: "From meetings", tone: "amber", icon: Target, sparkline: decisions.slice(-7).map((d, i) => ({ x: i, y: 1 })) },
    { label: "Actions", value: actions.length, change: "Tracked commitments", tone: "sky", icon: Sparkles, sparkline: actions.slice(-7).map((a, i) => ({ x: i, y: 1 })) },
    { label: "Density", value: decisions.length > 0 ? `${Math.round((decisions.length / Math.max(1, meetings.length)) * 100)}%` : "0%", change: "Decisions per meeting", tone: "gold", icon: TrendingUp, sparkline: Array.from({ length: 7 }, (_, i) => ({ x: i, y: Math.random() * 100 })) },
  ], [meetings, decisions, actions]);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)] lg:flex-row">
      <Nav />
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-[1080px] px-5 pb-20 pt-8 lg:px-8 lg:pt-12">
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true"><ShaderAurora className="opacity-[0.22]" speed={0.6} intensity={0.38} mouseInfluence={0.28} /></div>
          <header className="relative overflow-hidden rounded-[20px] border border-[var(--border)] bg-[color-mix(in_srgb,var(--fg)_2%,transparent)] p-6">
            <div className="pointer-events-none absolute -right-10 -top-10 h-64 w-64 opacity-60"><GraphCanvas count={meetings.length || 5} /></div>
            <p className="fragment relative text-[10px] uppercase tracking-[0.18em] text-[var(--subtle)]">Navigable graph · 3D</p>
            <h1 className="display-hero relative mt-1 text-[32px] text-[var(--text)]">Knowledge Graph</h1>
            <p className="relative mt-1.5 max-w-xl text-[13.5px] leading-relaxed text-[var(--muted)]">Meetings → Decisions → Actions → Risks → Topics — click through to source records. The center is your organization, orbiting nodes are meetings.</p>
          </header>

          {/* Bold Metric Cards */}
          <section aria-label="Graph metrics" className="reveal mt-6 grid gap-4 lg:grid-cols-4">
            {graphMetrics.map((m, i) => (
              <MetricCard key={m.label} {...m} index={i} immersive />
            ))}
          </section>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            {error && <ErrorState {...error} actionLabel="Retry" onAction={loadAll} />}
            {!error && !ready && <SkeletonLines n={4} className="max-w-md" />}
            {!error && ready && (<>
            <section className="space-y-3">
              <SectionLabel>Graph</SectionLabel>
              <div className="glass-strong rounded-[18px] p-5">
                <div className="space-y-4">
                  {meetings.slice(0,5).map((m)=> {
                    const decs = decisions.filter((d)=> d.meeting_id===m.id);
                    return (
                      <div key={m.id} className="border-l border-[var(--border)] pl-4">
                        <Link href={`/meetings/${m.id}`} className="flex items-center gap-2 text-[13px] font-[600] text-[var(--sky)] hover:text-[var(--fg)]"><Video className="h-3.5 w-3.5" />{m.title}</Link>
                        <div className="mt-2 space-y-2">
                          {decs.length===0 ? <p className="text-[11px] text-[var(--subtle)]">— no decisions</p> : decs.map((d)=> {
                            const acts = actions.filter((a)=> a.meeting_id===m.id && a.task.toLowerCase().includes(d.title.toLowerCase().slice(0,8)));
                            return (
                              <div key={d.id} className="ml-2 border-l border-[var(--border)] pl-3">
                                <Link href={`/meetings/${m.id}?item=${d.id}`} className="flex items-center gap-1.5 text-[12px] text-[var(--text)] hover:text-[var(--fg)]"><CheckCircle2 className="h-3 w-3 text-[var(--emerald-2)]" />{d.title}</Link>
                                {acts.length>0 && <div className="mt-1 ml-4 space-y-1">{acts.slice(0,2).map((a)=> <Link key={a.id} href={`/meetings/${m.id}?item=${a.id}`} className="flex items-center gap-1 text-[11px] text-[var(--muted)] hover:text-[var(--fg)]"><ClipboardList className="h-3 w-3" />{a.task}</Link>)}</div>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-4 text-[11px] text-[var(--subtle)]">D3 visualization pending — current view is navigable list. Each node links to its transcript evidence.</p>
              </div>
            </section>
            <section>
              <SectionLabel>Legend</SectionLabel>
              <div className="mt-3 space-y-2 text-[12px] text-[var(--muted)]">
                <div className="flex items-center gap-2"><Video className="h-4 w-4 text-[var(--sky)]" /> Meeting</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[var(--emerald-2)]" /> Decision</div>
                <div className="flex items-center gap-2"><ClipboardList className="h-4 w-4 text-[var(--violet)]" /> Action</div>
                <div className="flex items-center gap-2"><HelpCircle className="h-4 w-4 text-[var(--amber-2)]" /> Question / Risk</div>
                <div className="flex items-center gap-2"><GitBranch className="h-4 w-4 text-[var(--subtle)]" /> Branch / Dependency</div>
              </div>
              <div className="mt-6 reveal glass-strong rounded-[16px] p-5">
                <p className="text-[12px] font-[600] text-[var(--text)]">Decision Memory</p>
                <p className="mt-1 text-[12px] leading-relaxed text-[var(--muted)]">Decisions persist across future meetings. Query: "Why did we make this decision? What evidence supported it? Which decisions depend on this one?"</p>
              </div>
            </section>
            </>)}
          </div>
        </div>
      </main>
    </div>
  );
}