"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Nav } from "@/components/nav";
import { DecisionPill } from "@/components/ui/primitives";
import { EmptyState, SkeletonRow } from "@/components/ui/states";
import { fmtDate, dayGroup } from "@/lib/format";
import { CheckCircle2, ArrowUpRight, Sparkles, Archive, Target, TrendingUp, BookOpen, Clock, Zap, Brain, BarChart3, LayoutGrid, List } from "lucide-react";
import { motion } from "framer-motion";
import { MetricCard } from "@/components/ui/metrics";
import { PageHero } from "@/components/ui/page-hero";
const ShaderAurora = dynamic(() => import("@/components/immersive/3d/ShaderAurora").then((m) => m.ShaderAurora), { ssr: false });

const FILTERS = [
  { key: "", label: "All" },
  { key: "DETECTED", label: "Detected", tone: "var(--amber)" },
  { key: "CONFIRMED", label: "Confirmed", tone: "var(--emerald)" },
  { key: "REVISED", label: "Revised", tone: "var(--sky)" },
  { key: "SUPERSEDED", label: "Superseded", tone: "var(--violet)" },
];

export default function DecisionCenter() {
  const [decisions, setDecisions] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [view, setView] = useState<"kanban" | "list">("kanban");

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const f = sp.get("f");
    if (f) setFilter(f);
  }, []);

  async function load() {
    try {
      const orgs = await api("/api/v1/organizations");
      if (!orgs?.[0]) { setLoading(false); return; }
      const oid = orgs[0].id;
      const [ds, ms] = await Promise.all([
        api(`/api/v1/decisions?org_id=${oid}`).catch(() => []),
        api(`/api/v1/meetings?org_id=${oid}`).catch(() => []),
      ]);
      setDecisions(ds || []);
      setMeetings(ms || []);
    } catch {}
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const meetingMap = useMemo(() => new Map(meetings.map((m) => [m.id, m])), [meetings]);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    decisions.forEach((d) => { c[d.status] = (c[d.status] || 0) + 1; });
    return c;
  }, [decisions]);
  const visible = useMemo(
    () => decisions
      .filter((d) => !filter || d.status === filter)
      .map((d) => ({ ...d, meeting: meetingMap.get(d.meeting_id) }))
      .sort((a, b) => new Date(b.meeting?.date || 0).getTime() - new Date(a.meeting?.date || 0).getTime()),
    [decisions, filter, meetingMap]
  );
  const groups = useMemo(() => {
    const g: Array<[string, any[]]> = [];
    visible.forEach((d) => {
      const label = dayGroup(d.meeting?.date).toUpperCase();
      const last = g[g.length - 1];
      if (last && last[0] === label) last[1].push(d);
      else g.push([label, [d]]);
    });
    return g;
  }, [visible]);

  const decisionMetrics = useMemo(() => [
    { label: "Total", value: decisions.length, change: `${counts.DETECTED || 0} awaiting review`, tone: "violet", icon: Target, sparkline: decisions.slice(-7).map((d, i) => ({ x: i, y: 1 })) },
    { label: "Confirmed", value: counts.CONFIRMED || 0, change: decisions.length ? `${Math.round(((counts.CONFIRMED || 0) / decisions.length) * 100)}% rate` : "No data", tone: "emerald", icon: CheckCircle2, sparkline: decisions.slice(-7).map((d, i) => ({ x: i, y: d.status === "CONFIRMED" ? 1 : 0 })) },
    { label: "Revised", value: counts.REVISED || 0, change: "Human-in-the-loop edits", tone: "sky", icon: BookOpen, sparkline: decisions.slice(-7).map((d, i) => ({ x: i, y: d.status === "REVISED" ? 1 : 0 })) },
    { label: "Health", value: decisions.length ? `${Math.round(((counts.CONFIRMED || 0) / decisions.length) * 100)}%` : "0%", change: `${counts.REJECTED || 0} rejected · ${counts.SUPERSEDED || 0} superseded`, tone: "gold", icon: TrendingUp, sparkline: decisions.slice(-7).map((d, i) => ({ x: i, y: d.status === "CONFIRMED" ? 100 : d.status === "REVISED" ? 75 : d.status === "DETECTED" ? 25 : 0 })) },
  ], [decisions, counts]);

  const kanbanCols = useMemo(() => {
    const cols: Record<string, any[]> = { DETECTED: [], CONFIRMED: [], REVISED: [], REJECTED: [], SUPERSEDED: [] };
    visible.forEach((d) => { if (cols[d.status]) cols[d.status].push(d); else cols.DETECTED.push(d); });
    return cols;
  }, [visible]);

  const colMeta: Record<string, { label: string; tone: string; desc: string }> = {
    DETECTED: { label: "Detected", tone: "var(--amber)", desc: "Awaiting your review" },
    CONFIRMED: { label: "Confirmed", tone: "var(--emerald)", desc: "Organizational memory" },
    REVISED: { label: "Revised", tone: "var(--sky)", desc: "Human-in-the-loop edits" },
    REJECTED: { label: "Rejected", tone: "var(--subtle)", desc: "Not adopted" },
    SUPERSEDED: { label: "Superseded", tone: "var(--violet)", desc: "Replaced by newer" },
  };

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)] lg:flex-row">
      <Nav />
      <main className="min-w-0 flex-1">
        <div className="relative mx-auto max-w-[1320px] px-5 pb-20 pt-8 lg:px-8 lg:pt-12">
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true"><ShaderAurora className="opacity-[0.25]" speed={0.65} intensity={0.4} mouseInfluence={0.25} /><div className="orb orb-sky h-[340px] w-[380px] -right-[60px] top-[20px] opacity-[0.14]" /></div>
          <PageHero kicker="Organization memory" title={<>Decision <span className="thin text-[var(--muted)]">Center</span></>} sub={loading ? "Loading…" : `${decisions.length} decision${decisions.length === 1 ? "" : "s"} across your organization — every one traceable to its moment`} />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] pb-4" role="group" aria-label="Filter by status">
              {FILTERS.map((f) => {
                const active = filter === f.key;
                const n = f.key ? counts[f.key] || 0 : decisions.length;
                return (
                  <button key={f.key} onClick={() => setFilter(f.key)} aria-pressed={active} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-[550] transition ${active ? "border-[var(--border-strong)] bg-[color-mix(in_srgb,var(--fg)_8%,transparent)] text-[var(--text)]" : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--border-strong)] hover:text-[var(--text)]"}`}>
                    {f.tone && <span className="h-1.5 w-1.5 rounded-full" style={{ background: f.tone }} aria-hidden="true" />}
                    {f.label}
                    <span className="mono text-[10.5px] tabular-nums text-[var(--subtle)]">{n}</span>
                  </button>
                );
              })}
            </div>
            <div className="glass-subtle hidden items-center gap-1 rounded-full p-1 sm:flex">
              <button onClick={() => setView("kanban")} className={`rounded-full px-3 py-1.5 text-[11.5px] font-[600] transition ${view === "kanban" ? "bg-[color-mix(in_srgb,var(--fg)_8%,transparent)] text-[var(--fg)]" : "text-[var(--subtle)] hover:text-[var(--muted)]"}`}><LayoutGrid className="inline h-3.5 w-3.5 mr-1" />Kanban</button>
              <button onClick={() => setView("list")} className={`rounded-full px-3 py-1.5 text-[11.5px] font-[600] transition ${view === "list" ? "bg-[color-mix(in_srgb,var(--fg)_8%,transparent)] text-[var(--fg)]" : "text-[var(--subtle)] hover:text-[var(--muted)]"}`}><List className="inline h-3.5 w-3.5 mr-1" />Timeline</button>
            </div>
          </div>

          {!loading && (
            <section aria-label="Decision metrics" className="reveal mt-6 grid gap-4 lg:grid-cols-4">
              {decisionMetrics.map((m, i) => <MetricCard key={m.label} {...m} index={i} immersive />)}
            </section>
          )}

          {loading ? (
            <div className="mt-6 divide-y divide-[var(--border)]">{[0, 1, 2, 3].map((i) => <SkeletonRow key={i} />)}</div>
          ) : visible.length === 0 ? (
            decisions.length === 0 ? (
              <EmptyState icon={<CheckCircle2 className="h-5 w-5" />} title="No decisions yet" body="Once your meetings produce decisions, they'll appear here as your organization's memory." action={<Link href="/meetings?new=1" className="btn h-[36px] bg-[var(--text)] px-4 text-[13px] font-[600] text-[var(--bg)] hover:bg-[var(--fg)]">Start a meeting</Link>} />
            ) : (
              <EmptyState icon={<Archive className="h-5 w-5" />} title={`No ${FILTERS.find((f) => f.key === filter)?.label.toLowerCase() || ""} decisions`} body="Try a different status filter." />
            )
          ) : view === "kanban" ? (
            <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }} className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {Object.keys(kanbanCols).map((col) => {
                const meta = colMeta[col];
                return (
                  <motion.div key={col} variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }} transition={{ duration: 0.4 }} className="flex flex-col gap-2">
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ background: meta.tone, boxShadow: `0 0 8px ${meta.tone}` }} aria-hidden="true" />
                        <span className="text-[11.5px] font-[700] uppercase tracking-[0.12em]" style={{ color: meta.tone }}>{meta.label}</span>
                      </div>
                      <span className="mono text-[11px] tabular-nums text-[var(--subtle)]">{kanbanCols[col].length}</span>
                    </div>
                    <p className="px-1 text-[10px] text-[var(--faint)]">{meta.desc}</p>
                    <div className="flex flex-col gap-2 rounded-[16px] border border-[var(--border)] bg-[color-mix(in_srgb,var(--fg)_15%,transparent)] p-2 min-h-[120px]">
                      {kanbanCols[col].map((d) => (
                        <Link key={d.id} href={`/meetings/${d.meeting_id}?item=${d.id}`} className="group block rounded-[12px] border border-[var(--border)] bg-[color-mix(in_srgb,var(--fg)_3%,transparent)] p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:bg-[color-mix(in_srgb,var(--fg)_5%,transparent)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
                          <p className={`text-[12.5px] font-[600] leading-snug ${d.status === "REJECTED" ? "text-[var(--subtle)] line-through" : "text-[var(--text)] group-hover:text-[var(--fg)]"}`}>{d.title}</p>
                          <div className="mt-2 flex items-center justify-between text-[10px] text-[var(--subtle)]">
                            <span className="truncate">{d.meeting?.title || "Meeting"}</span>
                            {d.meeting?.date && <span className="shrink-0">{fmtDate(d.meeting.date)}</span>}
                          </div>
                        </Link>
                      ))}
                      {kanbanCols[col].length === 0 && <div className="flex flex-1 items-center justify-center py-6 text-[11px] text-[var(--faint)]">Empty</div>}
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          ) : (
            <div className="rail mt-6 pl-7">
              {groups.map(([label, items]) => (
                <section key={label} aria-label={label}>
                  <h2 className="pt-6 pb-3 text-[11px] font-[700] uppercase tracking-[0.16em] text-[var(--subtle)] first:pt-1">{label}</h2>
                  <ul>
                    {items.map((d) => {
                      const dotColor = d.status === "CONFIRMED" ? "var(--emerald-2)" : d.status === "REVISED" ? "var(--sky-2)" : d.status === "SUPERSEDED" ? "var(--violet-2)" : d.status === "REJECTED" ? "var(--subtle)" : "var(--amber-2)";
                      return (
                        <li key={d.id} className="group relative py-3.5">
                          <span aria-hidden="true" className="absolute -left-7 top-[19px] h-[9px] w-[9px] rounded-full border-2 border-[var(--bg)]" style={{ background: dotColor }} />
                          <Link href={`/meetings/${d.meeting_id}?item=${d.id}`} className="flex items-center gap-3 rounded-[10px] px-2 -mx-2 py-1.5 transition hover:bg-[color-mix(in_srgb,var(--fg)_2%,transparent)]">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                                <span className={`text-[14.5px] font-[600] tracking-[-0.01em] ${d.status === "REJECTED" ? "text-[var(--subtle)] line-through decoration-[var(--subtle)]" : "text-[var(--text)] group-hover:text-[var(--fg)]"}`}>{d.title}</span>
                                <DecisionPill status={d.status} />
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[12px] text-[var(--subtle)]">
                                <span className="truncate">{d.meeting?.title || "Meeting"}</span>
                                {d.meeting?.date && <><span aria-hidden="true">·</span><span>{fmtDate(d.meeting.date)}</span></>}
                              </div>
                            </div>
                            <span className="hidden shrink-0 items-center gap-1 text-[11px] font-[550] text-[var(--sky)] opacity-0 transition group-hover:opacity-100 sm:inline-flex">
                              View evidence <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
