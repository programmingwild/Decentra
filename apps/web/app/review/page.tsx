"use client";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Nav } from "@/components/nav";
import { SectionLabel, ProvenancePill } from "@/components/ui/primitives";
import { humanizeKey } from "@/lib/format";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import { Check, X, Edit3, Sparkles, AlertTriangle, BookOpen, Target, TrendingUp, Zap, Brain, BarChart3 } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { MetricCard } from "@/components/ui/metrics";
import { PageHero } from "@/components/ui/page-hero";
import { ShaderAurora } from "@/components/immersive/3d/ShaderAurora";

export default function ReviewQueuePage() {
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [orgId, setOrgId] = useState("");
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState<any | null>(null);
  const [editTitle, setEditTitle] = useState("");

  // Bold metric cards for review
  const reviewMetrics = useMemo(() => {
    if (!items.length) return [];
    const pending = items.filter(i => i.status === "pending").length;
    const approved = items.filter(i => i.status === "approved").length;
    const rejected = items.filter(i => i.status === "rejected").length;
    return [
      { label: "Queue", value: pending, change: `${items.length} total`, tone: "amber", icon: Sparkles, sparkline: items.slice(-7).map((i, idx) => ({ x: idx, y: i.status === "pending" ? 1 : 0 })) },
      { label: "Approved", value: approved, change: "Human-validated", tone: "emerald", icon: Check, sparkline: items.slice(-7).map((i, idx) => ({ x: idx, y: i.status === "approved" ? 1 : 0 })) },
      { label: "Rejected", value: rejected, change: "Sent back", tone: "red", icon: X, sparkline: items.slice(-7).map((i, idx) => ({ x: idx, y: i.status === "rejected" ? 1 : 0 })) },
      { label: "Types", value: [...new Set(items.map(i => i.item_type))].length, change: "Decision · Risk · Question", tone: "violet", icon: BookOpen, sparkline: items.slice(-7).map((i, idx) => ({ x: idx, y: 1 })) },
    ];
  }, [items]);
  async function load() {
    try {
      const orgs = await api("/api/v1/organizations");
      if (!orgs?.[0]) return;
      setOrgId(orgs[0].id);
      const r = await api(`/api/v1/review_queue?org_id=${orgs[0].id}&status=pending`).catch(()=>({items:[]}));
      setItems(r.items || []);
    } catch {}
    setLoading(false);
  }
  useEffect(()=>{ load(); },[]);
  async function act(id:string, action:string) {
    try { await api(`/api/v1/review/${id}/decision`, {method:"POST", body: JSON.stringify({action})}); toast(action==="accept"?"Accepted — marked human-approved":"Rejected","success"); load(); } catch(e:any){ toast(e.message, "error"); }
  }
  return (
    <div className="flex min-h-screen flex-col bg-[#08090B] lg:flex-row">
      <Nav />
      <main className="min-w-0 flex-1">
        <div className="relative mx-auto max-w-[900px] px-5 pb-20 pt-8 lg:px-8 lg:pt-12">
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true"><ShaderAurora className="opacity-[0.28]" speed={0.7} intensity={0.45} mouseInfluence={0.3} /><div className="orb orb-amber h-[320px] w-[360px] -right-[60px] top-[40px] opacity-[0.14]" /></div>
          <header className="relative">
            <PageHero
              kicker="Human approval required — provenance matters"
              title={<>Review <span className="thin text-[#9AA1AC]">Queue</span></>}
              sub={<>{loading ? "Loading…" : `${items.length} items awaiting judgment — `}<span className="inline-flex items-center gap-1.5"><ProvenancePill value="AI_INFERRED" /><span className="text-[#656B75]">→</span><span className="text-[#9AA1AC]">human review</span><span className="text-[#656B75]">→</span><ProvenancePill value="HUMAN_APPROVED" /></span></>}
            />
            {!loading && items.length>0 && <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-white/10"><div className="h-full bg-gradient-to-r from-[#F59E0B] to-[#10B981]" style={{width: `${Math.min(100, items.length*8)}%`}} /></div>}
          </header>

          {/* Bold Metric Cards */}
          {!loading && (
            <section aria-label="Review metrics" className="reveal mt-6 grid gap-4 lg:grid-cols-4">
              {reviewMetrics.map((m: any, i: number) => (
                <MetricCard key={m.label} {...m} index={i} immersive />
              ))}
            </section>
          )}

          <div className="mt-6">
            {loading ? <div className="h-20 animate-pulse rounded-[14px] bg-white/[0.04]" /> : items.length===0 ? <EmptyState title="Nothing to review" body="Proposed decisions, risks and recommendations from meetings will appear here. Each needs Accept / Edit / Reject." /> : (
              <div className="stagger space-y-3">
                {items.map((it)=> (
                  <div key={it.id} className="reveal glass-strong sheen spotlight group relative overflow-hidden rounded-[18px] p-4 transition hover:bg-white/[0.04]">
                    <div className="pointer-events-none absolute inset-0 rounded-[18px] bg-gradient-to-br from-transparent via-white/[0.02] to-transparent" />
                    <div className="relative flex items-start gap-4">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]" style={{ background: it.item_type === "decision" ? "#FBBF2418" : it.item_type === "risk" ? "#F8717118" : "#38BDF818", color: it.item_type === "decision" ? "#FBBF24" : it.item_type === "risk" ? "#F87171" : "#38BDF8" }}>
                        {it.item_type === "decision" && <Target className="h-4 w-4" />}
                        {it.item_type === "risk" && <AlertTriangle className="h-4 w-4" />}
                        {it.item_type === "question" && <BookOpen className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-[11px]"><span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 font-[600] text-[#9AA1AC]">{humanizeKey(it.item_type) || "Item"}</span><ProvenancePill value={it.provenance || "TRANSCRIPT_DERIVED"} /></div>
                        <p className="mt-1.5 text-[13.5px] font-[550] text-[#F5F7FA]">{it.title}</p>
                        <Link href={`/meetings/${it.meeting_id}`} className="mt-1 inline-flex text-[11px] text-[#38BDF8] hover:text-white">Open meeting →</Link>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <button onClick={()=> act(it.id,"accept")} className="flex h-8 w-8 items-center justify-center rounded-full bg-[#10B981] text-[#06281E] hover:bg-[#0EA371]"><Check className="h-4 w-4" /></button>
                        <button onClick={()=> act(it.id,"reject")} className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-[#F87171] hover:bg-white/10"><X className="h-4 w-4" /></button>
                        <button onClick={() => { setEditItem(it); setEditTitle(it.title); }} className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-[#9AA1AC] hover:bg-white/10" aria-label="Revise title"><Edit3 className="h-4 w-4" /></button>
                      </div>
                    </div>
                    <div className="pointer-events-none absolute inset-0 rounded-[18px] opacity-0 group-hover:opacity-100 transition bg-gradient-to-r from-transparent via-white/[0.03] to-transparent" />
                  </div>
                ))}
              </div>
            )}
          </div>
          <p className="mt-6 text-[11px] text-[#656B75]">Never silently promote AI output — every acceptance changes provenance to <span className="text-[#34D399]">human-approved</span>.</p>

          <Modal open={!!editItem} onClose={() => setEditItem(null)} title="Revise proposal" width={440}>
            <label htmlFor="rev-title" className="text-[12px] font-[500] text-[#9AA1AC]">What should it say instead?</label>
            <textarea id="rev-title" rows={3} value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="input mt-2 resize-none leading-relaxed" aria-label="Revised title" />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setEditItem(null)} className="btn btn-subtle h-[34px] px-3 text-[13px]">Cancel</button>
              <button
                onClick={async () => {
                  if (!editItem || !editTitle.trim()) return;
                  try {
                    await api(`/api/v1/review/${editItem.id}/decision`, { method: "POST", body: JSON.stringify({ action: "edit", title: editTitle.trim() }) });
                    toast("Revision saved — still needs Accept", "success");
                    setEditItem(null);
                    load();
                  } catch (e: any) {
                    toast(e.message || "Couldn't save revision", "error");
                  }
                }}
                className="btn h-[34px] bg-[#F5F7FA] px-4 text-[13px] font-[600] text-[#08090B] hover:bg-white"
              >
                Save revision
              </button>
            </div>
          </Modal>
        </div>
      </main>
    </div>
  );
}
