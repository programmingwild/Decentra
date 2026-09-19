"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Nav } from "@/components/nav";
import { Avatar, SectionLabel } from "@/components/ui/primitives";
import { EmptyState, SkeletonRow, friendlyError } from "@/components/ui/states";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { fmtDeadline } from "@/lib/format";
import { Check, CalendarClock, ClipboardList, Search, UserPlus, ArrowUpRight, Target, TrendingUp, Clock, AlertTriangle, CheckCircle2, Zap, Brain, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";
import { MetricCard } from "@/components/ui/metrics";
import { PageHero } from "@/components/ui/page-hero";
import { ShaderAurora } from "@/components/immersive/3d/ShaderAurora";

type Bucket = { key: string; label: string; tone?: string; hint?: string };

export default function ActionCenter() {
  const { toast } = useToast();
  const [actions, setActions] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mineOnly, setMineOnly] = useState(false);
  const [q, setQ] = useState("");
  const [ownerA, setOwnerA] = useState<any | null>(null);
  const [ownerVal, setOwnerVal] = useState("");
  const [dlA, setDlA] = useState<any | null>(null);
  const [dlDate, setDlDate] = useState("");
  const [dlText, setDlText] = useState("");
  const animRef = useRef<Set<string>>(new Set());

  async function load() {
    try {
      const orgs = await api("/api/v1/organizations");
      if (!orgs?.[0]) {
        setLoading(false);
        return;
      }
      const oid = orgs[0].id;
      const [as, ms] = await Promise.all([
        api(`/api/v1/actions?org_id=${oid}${mineOnly ? "&owner=me" : ""}`).catch(() => []),
        api(`/api/v1/meetings?org_id=${oid}`).catch(() => []),
      ]);
      setActions(as || []);
      setMeetings(ms || []);
    } catch {}
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, [mineOnly]);

  const meetingMap = useMemo(() => new Map(meetings.map((m) => [m.id, m])), [meetings]);

  const enriched = useMemo(
    () =>
      actions.map((a) => {
        const parsed = fmtDeadline(a.deadline_raw);
        const dl = { ...parsed, overdue: typeof a.overdue === "boolean" ? a.overdue : parsed.overdue };
        return { ...a, dl, meeting: meetingMap.get(a.meeting_id) };
      }),
    [actions, meetingMap]
  );

  const filtered = useMemo(() => {
    if (!q.trim()) return enriched;
    const needle = q.toLowerCase();
    return enriched.filter((a) => a.task.toLowerCase().includes(needle) || (a.owner_name || "").toLowerCase().includes(needle));
  }, [enriched, q]);

  const buckets: Record<string, any[]> = {
    overdue: filtered.filter((a) => a.status !== "COMPLETED" && a.dl.overdue),
    today: filtered.filter((a) => a.status !== "COMPLETED" && a.dl.today),
    upcoming: filtered.filter((a) => a.status !== "COMPLETED" && a.dl.due && !a.dl.overdue && !a.dl.today),
    unscheduled: filtered.filter((a) => a.status !== "COMPLETED" && !a.dl.due),
    completed: filtered.filter((a) => a.status === "COMPLETED"),
  };
  const order: Bucket[] = [
    { key: "overdue", label: "Overdue", tone: "#F87171" },
    { key: "today", label: "Today", tone: "#FBBF24" },
    { key: "upcoming", label: "Upcoming", tone: "#38BDF8" },
    { key: "unscheduled", label: "Needs scheduling", hint: "deadline never confirmed", tone: "#9AA1AC" },
    { key: "completed", label: "Completed" },
  ];
  const openCount = filtered.filter((a) => a.status !== "COMPLETED").length;

  // Bold metric cards for actions
  const actionMetrics = useMemo(() => [
    { 
      label: "Open", 
      value: openCount, 
      change: `${buckets.overdue.length} overdue · ${buckets.today.length} today`, 
      tone: "red", 
      icon: AlertTriangle,
      sparkline: filtered.slice(-7).map((a, i) => ({ x: i, y: a.status !== "COMPLETED" ? 1 : 0 }))
    },
    { 
      label: "Completed", 
      value: buckets.completed.length, 
      change: actions.length ? `${Math.round((buckets.completed.length / actions.length) * 100)}% rate` : "0%", 
      tone: "emerald", 
      icon: CheckCircle2,
      sparkline: filtered.slice(-7).map((a, i) => ({ x: i, y: a.status === "COMPLETED" ? 1 : 0 }))
    },
    { 
      label: "Overdue", 
      value: buckets.overdue.length, 
      change: "Needs immediate attention", 
      tone: "amber", 
      icon: Clock,
      sparkline: filtered.slice(-7).map((a, i) => ({ x: i, y: a.dl?.overdue ? 1 : 0 }))
    },
    { 
      label: "Velocity", 
      value: actions.length ? `${Math.round((buckets.completed.length / actions.length) * 100)}%` : "0%", 
      change: "Completion rate", 
      tone: "gold", 
      icon: TrendingUp,
      sparkline: filtered.slice(-7).map((a, i) => ({ x: i, y: a.status === "COMPLETED" ? 100 : 0 }))
    },
  ], [filtered, buckets, actions]);

  async function patch(a: any, body: any, msg: string) {
    try {
      await api(`/api/v1/actions/${a.id}`, { method: "PATCH", body: JSON.stringify(body) });
      toast(msg, "success");
      load();
    } catch (e: any) {
      toast(friendlyError(e).title, "error");
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#08090B] lg:flex-row">
      <Nav />
      <main className="min-w-0 flex-1">
        <div className="relative mx-auto max-w-[900px] px-5 pb-20 pt-8 lg:px-8 lg:pt-12">
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true"><ShaderAurora className="opacity-[0.25]" speed={0.6} intensity={0.35} mouseInfluence={0.2} /><div className="orb orb-violet h-[320px] w-[360px] -right-[50px] top-[30px] opacity-[0.13]" /></div>
          <header className="relative flex flex-wrap items-end justify-between gap-4">
            <PageHero
              kicker="Execution"
              title={<>Action <span className="thin text-[#9AA1AC]">Center</span></>}
              sub={loading ? "Loading…" : `${openCount} open · ${buckets.completed.length} completed`}
            />
            <button
              onClick={() => setMineOnly(!mineOnly)}
              aria-pressed={mineOnly}
              className={`btn h-[36px] px-3.5 text-[12.5px] font-[600] transition ${mineOnly ? "bg-[#F5F7FA] text-[#08090B] hover:bg-white" : "border border-white/[0.09] bg-white/[0.04] text-[#C7CCD4] hover:bg-white/[0.07]"}`}
            >
              Assigned to me
            </button>
          </header>

          {/* Bold Metric Cards */}
          {!loading && (
            <section aria-label="Action metrics" className="reveal mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {actionMetrics.map((m, i) => (
                <MetricCard key={m.label} {...m} index={i} immersive />
              ))}
            </section>
          )}

          <div className="relative mt-6 border-b border-white/[0.06] pb-4">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#656B75]" aria-hidden="true" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by task or owner…" className="input h-[38px] pl-9" aria-label="Filter actions" />
          </div>

          {loading ? (
            <div className="mt-2 divide-y divide-white/[0.05]">{[0, 1, 2, 3].map((i) => <SkeletonRow key={i} />)}</div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<ClipboardList className="h-5 w-5" />}
              title={q ? "Nothing matches that filter" : mineOnly ? "Nothing assigned to you" : "No action items yet"}
              body={q ? "Try a different search." : mineOnly ? "When meetings assign you follow-ups, they'll land here." : "Process a meeting and Decentra extracts the commitments made in it."}
            />
          ) : (
            <div className="rail mt-6 pl-7">
              {order.map(({ key, label, tone, hint }) =>
                buckets[key].length === 0 ? null : (
                  <section key={key} aria-label={label}>
                    <div className="flex items-baseline gap-2 pt-6 pb-2 first:pt-1">
                      {tone && <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone }} aria-hidden="true" />}
                      <h2 className={`text-[11px] font-[700] uppercase tracking-[0.16em] ${tone || "text-[#656B75]"}`} style={tone ? { color: tone } : undefined}>{label}</h2>
                      <span className="mono text-[11px] tabular-nums text-[#656B75]">{buckets[key].length}</span>
                      {hint && <span className="text-[10.5px] italic text-[#656B75]/70">— {hint}</span>}
                    </div>
                    <ul className="divide-y divide-white/[0.05]">
                      {buckets[key].map((a) => (
                        <ActionRow
                          key={a.id}
                          a={a}
                          pop={animRef.current.has(a.id)}
                          onToggle={async () => {
                            const done = a.status === "COMPLETED";
                            await patch(a, { status: done ? "NOT_STARTED" : "COMPLETED" }, done ? "Reopened" : "Completed");
                            if (!done) animRef.current.add(a.id);
                          }}
                          onOwner={() => { setOwnerA(a); setOwnerVal(a.owner_name || ""); }}
                          onDeadline={() => { setDlA(a); setDlText(a.deadline_raw || ""); setDlDate(""); }}
                        />
                      ))}
                    </ul>
                  </section>
                )
              )}
            </div>
          )}
        </div>
      </main>

      <Modal open={!!ownerA} onClose={() => setOwnerA(null)} title="Assign owner" width={420}>
        <label htmlFor="ac-owner" className="text-[12px] font-[500] text-[#9AA1AC]">Who is accountable?</label>
        <input id="ac-owner" value={ownerVal} onChange={(e) => setOwnerVal(e.target.value)} placeholder="e.g. Priya Nair" className="input mt-2" autoComplete="off" />
        <p className="mt-2 text-[11.5px] text-[#656B75]">Leave empty to mark unassigned.</p>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => setOwnerA(null)} className="btn btn-subtle h-[34px] px-3 text-[13px]">Cancel</button>
          <button onClick={async () => { if (!ownerA) return; await patch(ownerA, { owner_name: ownerVal.trim() || null }, ownerVal.trim() ? "Owner assigned" : "Owner cleared"); setOwnerA(null); }} className="btn h-[34px] bg-[#F5F7FA] px-4 text-[13px] font-[600] text-[#08090B] hover:bg-white">
            Save
          </button>
        </div>
      </Modal>

      <Modal open={!!dlA} onClose={() => setDlA(null)} title="Set deadline" width={440}>
        <label htmlFor="ac-dl-date" className="text-[12px] font-[500] text-[#9AA1AC]">Pick a date</label>
        <input id="ac-dl-date" type="date" value={dlDate} onChange={(e) => setDlDate(e.target.value)} className="input mt-2 [color-scheme:dark]" />
        <div className="my-4 flex items-center gap-3 text-[11px] font-[600] uppercase tracking-[0.14em] text-[#656B75]">
          <span className="h-px flex-1 bg-white/[0.06]" /> or as discussed <span className="h-px flex-1 bg-white/[0.06]" />
        </div>
        <label htmlFor="ac-dl-text" className="text-[12px] font-[500] text-[#9AA1AC]">Free text exactly as said</label>
        <input id="ac-dl-text" value={dlText} onChange={(e) => setDlText(e.target.value)} placeholder='e.g. "before Friday standup"' className="input mt-2" autoComplete="off" />
        <p className="mt-2 text-[11.5px] text-[#656B75]">Ambiguous dates are kept verbatim rather than guessed.</p>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => setDlA(null)} className="btn btn-subtle h-[34px] px-3 text-[13px]">Cancel</button>
          <button onClick={async () => { if (!dlA) return; const iso = dlDate ? dlDate : dlText.trim() || null; await patch(dlA, { deadline_raw: iso }, iso ? "Deadline saved" : "Deadline cleared"); setDlA(null); }} className="btn h-[34px] bg-[#F5F7FA] px-4 text-[13px] font-[600] text-[#08090B] hover:bg-white">
            Save
          </button>
        </div>
      </Modal>
    </div>
  );
}

function ActionRow({ a, pop, onToggle, onOwner, onDeadline }: { a: any; pop: boolean; onToggle: () => void; onOwner: () => void; onDeadline: () => void }) {
  const done = a.status === "COMPLETED";
  return (
    <li className="group flex items-start gap-3 py-3.5 pr-1 transition">
      <span aria-hidden="true" className="absolute -left-7 top-[21px] h-[7px] w-[7px] rounded-full border-2 border-[#08090B]" style={{ background: done ? "#10B981" : a.dl.overdue ? "#EF4444" : a.dl.today ? "#F59E0B" : "#38BDF8" }} />
      <button
        onClick={onToggle}
        disabled={done}
        aria-label={done ? "Completed" : "Mark complete"}
        aria-pressed={done}
        className={`mt-0.5 flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full border transition ${done ? "border-[#10B981] bg-[#10B981]" : "border-white/[0.18] hover:border-[#10B981]/70"}`}
      >
        {done && <Check className={`animate-pop h-3 w-3 text-[#06281E] ${pop ? "" : ""}`} strokeWidth={3} aria-hidden="true" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <p className={`text-[14px] font-[550] leading-snug tracking-[-0.005em] ${done ? "text-[#656B75] line-through decoration-white/25" : "text-[#E9EDF2]"}`}>{a.task}</p>
          {a.status === "IN_PROGRESS" && <span className="rounded-full bg-[#0EA5E9]/10 px-1.5 py-px text-[9px] font-[700] uppercase tracking-[0.08em] text-[#38BDF8]">In progress</span>}
          {a.status === "BLOCKED" && <span className="rounded-full bg-[#F59E0B]/10 px-1.5 py-px text-[9px] font-[700] uppercase tracking-[0.08em] text-[#FBBF24]">Blocked</span>}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
          <button onClick={onOwner} className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-[550] transition ${a.owner_name ? "border-white/[0.08] text-[#9AA1AC] hover:border-white/[0.16] hover:text-[#F5F7FA]" : "border-dashed border-[#F59E0B]/40 bg-[#F59E0B]/[0.07] text-[#FBBF24] hover:bg-[#F59E0B]/[0.12]"}`}>
            {a.owner_name ? <Avatar name={a.owner_name} size={14} /> : <UserPlus className="h-3 w-3" aria-hidden="true" />}
            {a.owner_name || "Assign owner"}
          </button>
          <button onClick={onDeadline} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-[550] transition ${
            !a.deadline_raw ? "border-dashed border-[#F59E0B]/40 bg-[#F59E0B]/[0.07] text-[#FBBF24] hover:bg-[#F59E0B]/[0.12]" : a.dl.overdue ? "border-[#EF4444]/30 bg-[#EF4444]/[0.08] text-[#F87171]" : a.dl.today ? "border-[#F59E0B]/30 bg-[#F59E0B]/[0.08] text-[#FBBF24]" : "border-white/[0.08] text-[#9AA1AC] hover:border-white/[0.16] hover:text-[#F5F7FA]"
          }`}>
            <CalendarClock className="h-3 w-3" aria-hidden="true" />
            {!a.deadline_raw ? "Needs confirmation" : a.dl.overdue ? `Overdue · ${a.dl.label}` : a.dl.today ? "Due today" : a.dl.label || a.deadline_raw}
          </button>
          {a.meeting && (
            <Link href={`/meetings/${a.meeting_id}`} className="ml-auto hidden truncate text-[11.5px] text-[#656B75] transition hover:text-[#38BDF8] sm:inline-flex sm:max-w-[220px] sm:items-center sm:gap-1">
              {a.meeting.title} <ArrowUpRight className="h-3 w-3 shrink-0" aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>
    </li>
  );
}
