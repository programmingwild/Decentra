"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Nav } from "@/components/nav";
import { DecisionPill } from "@/components/ui/primitives";
import { EmptyState, SkeletonRow } from "@/components/ui/states";
import { fmtDate, dayGroup } from "@/lib/format";
import { CheckCircle2, ArrowUpRight, Sparkles, Archive, Target, TrendingUp, BookOpen, Clock, Zap, Brain, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";
import { MetricCard } from "@/components/ui/metrics";
import { PageHero } from "@/components/ui/page-hero";
import { ShaderAurora } from "@/components/immersive/3d/ShaderAurora";

const FILTERS = [
  { key: "", label: "All" },
  { key: "DETECTED", label: "Detected", tone: "#FBBF24" },
  { key: "CONFIRMED", label: "Confirmed", tone: "#34D399" },
  { key: "REVISED", label: "Revised", tone: "#38BDF8" },
  { key: "SUPERSEDED", label: "Superseded", tone: "#A78BFA" },
];

export default function DecisionCenter() {
  const [decisions, setDecisions] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const f = sp.get("f");
    if (f) setFilter(f);
  }, []);

  async function load() {
    try {
      const orgs = await api("/api/v1/organizations");
      if (!orgs?.[0]) {
        setLoading(false);
        return;
      }
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
  useEffect(() => {
    load();
  }, []);

  const meetingMap = useMemo(() => new Map(meetings.map((m) => [m.id, m])), [meetings]);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    decisions.forEach((d) => { c[d.status] = (c[d.status] || 0) + 1; });
    return c;
  }, [decisions]);
  const visible = useMemo(
    () =>
      decisions
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

  // Bold metric cards for decisions
  const decisionMetrics = useMemo(() => [
    { 
      label: "Total", 
      value: decisions.length, 
      change: `${counts.DETECTED || 0} awaiting review`, 
      tone: "violet", 
      icon: Target,
      sparkline: decisions.slice(-7).map((d, i) => ({ x: i, y: 1 }))
    },
    { 
      label: "Confirmed", 
      value: counts.CONFIRMED || 0, 
      change: decisions.length ? `${Math.round(((counts.CONFIRMED || 0) / decisions.length) * 100)}% rate` : "No data", 
      tone: "emerald", 
      icon: CheckCircle2,
      sparkline: decisions.slice(-7).map((d, i) => ({ x: i, y: d.status === "CONFIRMED" ? 1 : 0 }))
    },
    { 
      label: "Revised", 
      value: counts.REVISED || 0, 
      change: "Human-in-the-loop edits", 
      tone: "sky", 
      icon: BookOpen,
      sparkline: decisions.slice(-7).map((d, i) => ({ x: i, y: d.status === "REVISED" ? 1 : 0 }))
    },
    { 
      label: "Health", 
      value: decisions.length ? `${Math.round(((counts.CONFIRMED || 0) / decisions.length) * 100)}%` : "0%", 
      change: `${counts.REJECTED || 0} rejected · ${counts.SUPERSEDED || 0} superseded`, 
      tone: "gold", 
      icon: TrendingUp,
      sparkline: decisions.slice(-7).map((d, i) => ({ x: i, y: d.status === "CONFIRMED" ? 100 : d.status === "REVISED" ? 75 : d.status === "DETECTED" ? 25 : 0 }))
    },
  ], [decisions, counts]);

  return (
    <div className="flex min-h-screen flex-col bg-[#08090B] lg:flex-row">
      <Nav />
      <main className="min-w-0 flex-1">
        <div className="relative mx-auto max-w-[980px] px-5 pb-20 pt-8 lg:px-8 lg:pt-12">
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true"><ShaderAurora className="opacity-[0.25]" speed={0.65} intensity={0.4} mouseInfluence={0.25} /><div className="orb orb-sky h-[340px] w-[380px] -right-[60px] top-[20px] opacity-[0.14]" /></div>
          <PageHero
            kicker="Organization memory"
            title={<>Decision <span className="thin text-[#9AA1AC]">Center</span></>}
            sub={loading ? "Loading…" : `${decisions.length} decision${decisions.length === 1 ? "" : "s"} across your organization — every one traceable to its moment`}
          />

          {/* Bold Metric Cards */}
          {!loading && (
            <section aria-label="Decision metrics" className="reveal mt-6 grid gap-4 lg:grid-cols-4">
              {decisionMetrics.map((m, i) => (
                <MetricCard key={m.label} {...m} index={i} immersive />
              ))}
            </section>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-2 border-b border-white/[0.06] pb-4" role="group" aria-label="Filter by status">
            {FILTERS.map((f) => {
              const active = filter === f.key;
              const n = f.key ? counts[f.key] || 0 : decisions.length;
              return (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  aria-pressed={active}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-[550] transition ${
                    active ? "border-white/[0.16] bg-white/[0.08] text-[#F5F7FA]" : "border-white/[0.07] text-[#9AA1AC] hover:border-white/[0.12] hover:text-[#E5E9EF]"
                  }`}
                >
                  {f.tone && <span className="h-1.5 w-1.5 rounded-full" style={{ background: f.tone }} aria-hidden="true" />}
                  {f.label}
                  <span className="mono text-[10.5px] tabular-nums text-[#656B75]">{n}</span>
                </button>
              );
            })}
          </div>

          {loading ? (
            <div className="mt-2 divide-y divide-white/[0.05]">{[0, 1, 2, 3].map((i) => <SkeletonRow key={i} />)}</div>
          ) : visible.length === 0 ? (
            decisions.length === 0 ? (
              <EmptyState
                icon={<CheckCircle2 className="h-5 w-5" />}
                title="No decisions yet"
                body="Once your meetings produce decisions, they'll appear here as your organization's memory."
                action={<Link href="/meetings?new=1" className="btn h-[36px] bg-[#F5F7FA] px-4 text-[13px] font-[600] text-[#08090B] hover:bg-white">Start a meeting</Link>}
              />
            ) : (
              <EmptyState icon={<Archive className="h-5 w-5" />} title={`No ${FILTERS.find((f) => f.key === filter)?.label.toLowerCase() || ""} decisions`} body="Try a different status filter." />
            )
          ) : (
            <div className="rail mt-6 pl-7">
              {groups.map(([label, items]) => (
                <section key={label} aria-label={label}>
                  <h2 className="pt-6 pb-3 text-[11px] font-[700] uppercase tracking-[0.16em] text-[#656B75] first:pt-1">{label}</h2>
                  <ul>
                    {items.map((d) => {
                      const dotColor = d.status === "CONFIRMED" ? "#10B981" : d.status === "REVISED" ? "#0EA5E9" : d.status === "SUPERSEDED" ? "#8B5CF6" : d.status === "REJECTED" ? "#656B75" : "#F59E0B";
                      return (
                        <li key={d.id} className="group relative py-3.5">
                          <span aria-hidden="true" className="absolute -left-7 top-[19px] h-[9px] w-[9px] rounded-full border-2 border-[#08090B]" style={{ background: dotColor }} />
                          <Link href={`/meetings/${d.meeting_id}?item=${d.id}`} className="flex items-center gap-3 rounded-[10px] px-2 -mx-2 py-1.5 transition hover:bg-white/[0.02]">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                                <span className={`text-[14.5px] font-[600] tracking-[-0.01em] ${d.status === "REJECTED" ? "text-[#656B75] line-through decoration-white/20" : "text-[#F0F3F7] group-hover:text-white"}`}>{d.title}</span>
                                <DecisionPill status={d.status} />
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[12px] text-[#656B75]">
                                <span className="truncate">{d.meeting?.title || "Meeting"}</span>
                                {d.meeting?.date && <><span aria-hidden="true">·</span><span>{fmtDate(d.meeting.date)}</span></>}
                                {d.meeting && d.meeting.decisions_count > 0 && <><span aria-hidden="true">·</span><Sparkles className="h-3 w-3" aria-hidden="true" /></>}
                              </div>
                            </div>
                            <span className="hidden shrink-0 items-center gap-1 text-[11px] font-[550] text-[#38BDF8] opacity-0 transition group-hover:opacity-100 sm:inline-flex">
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


