"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Nav } from "@/components/nav";
import { DecisionPill, ActionPill, Avatar, SectionLabel } from "@/components/ui/primitives";
import { EmptyState, ErrorState, SkeletonLines, SkeletonRow } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { greeting, fmtDate, fmtDeadline, dayGroup } from "@/lib/format";
import { CompleteToggle, DueLine } from "@/components/ui/action-widgets";
import { ArrowRight, CheckCircle2, ClipboardList, HelpCircle, Sparkles, TriangleAlert, UserX, Video, Check, TrendingUp, TrendingDown, Clock, Users, Target, Zap, Brain, BarChart3 } from "lucide-react";
import { SpotlightCard } from "@/components/thrill";
import { MetricCard } from "@/components/ui/metrics";
import { GettingStarted } from "@/components/ui/getting-started";
import { motion } from "framer-motion";
import { ShaderAurora } from "@/components/immersive/3d/ShaderAurora";

export default function Overview() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ title: string; reason: string } | null>(null);
  const [userName, setUserName] = useState("");
  const [meetings, setMeetings] = useState<any[]>([]);
  const [decisions, setDecisions] = useState<any[]>([]);
  const [actions, setActions] = useState<any[]>([]);
  const [myActions, setMyActions] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [health, setHealth] = useState<any>(null);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const me = await api("/api/v1/auth/me").catch(() => null);
      if (me) setUserName(me.full_name?.split(" ")[0] || me.email?.split("@")[0] || "");
      const orgs = await api("/api/v1/organizations");
      if (!orgs?.[0]) {
        setLoading(false);
        return;
      }
      const oid = orgs[0].id;
      const [ms, ds, as, mine] = await Promise.all([
        api(`/api/v1/meetings?org_id=${oid}`).catch(() => []),
        api(`/api/v1/decisions?org_id=${oid}`).catch(() => []),
        api(`/api/v1/actions?org_id=${oid}`).catch(() => []),
        api(`/api/v1/actions?org_id=${oid}&owner=me`).catch(() => []),
      ]);
      setMeetings(ms || []);
      setDecisions(ds || []);
      setActions(as || []);
      setMyActions(mine || []);
      const readyMeetings = (ms || []).filter((m: any) => m.status === "ready").slice(0, 10);
      const intelResults = await Promise.allSettled(readyMeetings.map((m: any) => api(`/api/v1/meetings/${m.id}/intelligence`)));
      const qs: any[] = [];
      intelResults.forEach((r, i) => {
        if (r.status === "fulfilled" && r.value?.questions) {
          r.value.questions.forEach((q: any) => qs.push({ ...q, meeting: readyMeetings[i] }));
        }
      });
      setQuestions(qs.filter((q) => (q.status || "OPEN") !== "ANSWERED"));
      api(`/api/v1/health/score?org_id=${oid}`).then(setHealth).catch(()=>{});
    } catch (e: any) {
      setError(friendly(e));
    }
    setLoading(false);
  }

  function friendly(e: any) {
    return { title: "We couldn't load your workspace", reason: e?.message?.slice(0, 160) || "Check that the Decentra server is running." };
  }

  useEffect(() => {
    loadAll();
  }, []);

  const detected = useMemo(() => decisions.filter((d) => d.status === "DETECTED"), [decisions]);
  const overdue = useMemo(
    () =>
      actions.filter((a) => {
        if (a.status === "COMPLETED" || a.status === "CANCELLED") return false;
        if (typeof a.overdue === "boolean") return a.overdue;
        const dl = fmtDeadline(a.deadline_raw);
        return dl.overdue;
      }),
    [actions]
  );
  const unassigned = useMemo(() => actions.filter((a) => a.owner_name == null && a.status !== "COMPLETED"), [actions]);
  const meetingMap = useMemo(() => new Map(meetings.map((m) => [m.id, m])), [meetings]);

  const attention: Array<{ icon: any; tone: string; count: number; label: string; href: string }> = [];
  if (detected.length) attention.push({ icon: Sparkles, tone: "#FBBF24", count: detected.length, label: detected.length === 1 ? "decision awaiting your review" : "decisions awaiting your review", href: "/decisions?f=DETECTED" });
  if (overdue.length) attention.push({ icon: TriangleAlert, tone: "#F87171", count: overdue.length, label: overdue.length === 1 ? "overdue action" : "overdue actions", href: "/actions" });
  if (unassigned.length) attention.push({ icon: UserX, tone: "#38BDF8", count: unassigned.length, label: unassigned.length === 1 ? "action without an owner" : "actions without an owner", href: "/actions" });

  const sentenceParts: string[] = [];
  if (detected.length) sentenceParts.push(`${detected.length} decision${detected.length === 1 ? "" : "s"} to review`);
  if (overdue.length) sentenceParts.push(`${overdue.length} overdue action${overdue.length === 1 ? "" : "s"}`);
  if (!sentenceParts.length && actions.length) sentenceParts.push("everything on track");

  // Bold metric cards data
  const metrics = useMemo(() => [
    { 
      label: "Decisions", 
      value: decisions.length, 
      change: detected.length > 0 ? `+${detected.length} new` : "All reviewed", 
      tone: detected.length > 0 ? "amber" : "emerald", 
      icon: Target,
      sparkline: decisions.slice(-7).map((d, i) => ({ x: i, y: d.status === "CONFIRMED" ? 1 : 0 }))
    },
    { 
      label: "Actions", 
      value: actions.length, 
      change: overdue.length > 0 ? `${overdue.length} overdue` : `${actions.filter(a => a.status === "COMPLETED").length} done`, 
      tone: overdue.length > 0 ? "red" : "sky", 
      icon: CheckCircle2,
      sparkline: actions.slice(-7).map((a, i) => ({ x: i, y: a.status === "COMPLETED" ? 1 : 0 }))
    },
    { 
      label: "Meetings", 
      value: meetings.length, 
      change: `${meetings.filter(m => m.status === "ready").length} processed`, 
      tone: "violet", 
      icon: Users,
      sparkline: meetings.slice(-7).map((m, i) => ({ x: i, y: m.status === "ready" ? 1 : 0 }))
    },
    { 
      label: "Health", 
      value: health?.health || 0, 
      change: health ? `${health.metrics.confirmed_rate}% confirmed` : "No data", 
      tone: health?.level === "high" ? "gold" : health?.level === "medium" ? "amber" : "red", 
      icon: TrendingUp,
      sparkline: health ? [
        { x: 0, y: health.metrics.confirmed_rate * 0.6 },
        { x: 1, y: health.metrics.confirmed_rate * 0.7 },
        { x: 2, y: health.metrics.confirmed_rate * 0.8 },
        { x: 3, y: health.metrics.confirmed_rate * 0.9 },
        { x: 4, y: health.metrics.confirmed_rate },
        { x: 5, y: health.metrics.confirmed_rate * 1.05 },
        { x: 6, y: health.metrics.confirmed_rate }
      ] : Array.from({ length: 7 }, (_, i) => ({ x: i, y: 0 }))
    },
  ], [decisions, detected, actions, overdue, meetings, health]);

  const recentMeetings = meetings.slice(0, 5);
  const recentDecisions = decisions.slice(0, 6);

  return (
    <div className="flex min-h-screen flex-col bg-[#08090B] lg:flex-row">
      <Nav />
      <main id="main" className="min-w-0 flex-1">
        <div className="relative mx-auto max-w-[1240px] px-5 pb-20 pt-8 lg:px-8 lg:pt-12">
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            <ShaderAurora className="opacity-[0.5]" speed={0.7} intensity={0.5} mouseInfluence={0.3} />
            <div className="orb orb-sky h-[380px] w-[420px] -right-[80px] -top-[60px] opacity-[0.16]" />
            <div className="orb orb-violet h-[300px] w-[340px] left-[18%] top-[220px] opacity-[0.10]" />
          </div>
          <header className="relative">
            <p className="fragment text-[10.5px] uppercase tracking-[0.2em] text-[#656B75]">{greeting()} <span className="text-white/20">—</span> workspace</p>
            <h1 className="display-hero text-3d mt-2 text-[36px] text-[#F5F7FA] lg:text-[48px]">
              {userName ? `${userName},` : ""}
              <span className="thin ml-2 text-[#9AA1AC] lg:text-[44px]">{sentenceParts.length ? "here's your focus." : "all clear."}</span>
            </h1>
            {sentenceParts.length > 0 && (
              <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-[#9AA1AC]">
                You have{" "}
                {detected.length > 0 && (
                  <>
                    <Link href="/decisions?f=DETECTED" className="font-[600] text-[#FBBF24] underline decoration-[#FBBF24]/30 underline-offset-4 hover:decoration-[#FBBF24]">{detected.length} decision{detected.length === 1 ? "" : "s"} to review</Link>
                    {overdue.length > 0 ? " and " : "."}
                  </>
                )}
                {overdue.length > 0 && (
                  <>
                    <Link href="/actions" className="font-[600] text-[#F87171] underline decoration-[#F87171]/30 underline-offset-4 hover:decoration-[#F87171]">{overdue.length} overdue action{overdue.length === 1 ? "" : "s"}</Link>.
                  </>
                )}
                {!detected.length && !overdue.length && actions.length > 0 && <span className="text-[#C7CCD4]">everything is on track.</span>}
              </p>
            )}
            {health && (
              <div className="reveal mt-6 flex flex-wrap items-center gap-3">
                <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-[600] ${health.level==="high"?"gold-border gold-glow bg-[#D4A574]/10 text-[#D4A574]":health.level==="medium"?"border-[#F59E0B]/20 bg-[#F59E0B]/10 text-[#FBBF24]":"border-[#EF4444]/20 bg-[#EF4444]/10 text-[#F87171]"}`}>
                  <span className="h-2 w-2 rounded-full" style={{background: health.level==="high"?"#D4A574":health.level==="medium"?"#F59E0B":"#EF4444"}} /> Health {health.health} · {health.level}
                </div>
                <span className="text-[11px] text-[#656B75]">{health.metrics.confirmed_rate}% decisions confirmed · {health.metrics.completed_rate}% actions done</span>
                <Link href="/timeline" className="ml-auto hidden text-[11px] font-[600] text-[#38BDF8] hover:text-white sm:inline-flex">View timeline →</Link>
                <Link href="/deck" className="hidden items-center gap-1 rounded-full border border-[#D4A574]/25 bg-[#D4A574]/[0.07] px-3 py-1 text-[11px] font-[600] text-[#D4A574] transition hover:border-[#D4A574]/45 hover:text-white sm:inline-flex">Command deck →</Link>
              </div>
            )}

            {/* Bold Metric Cards — 3D depth stage */}
            <section aria-label="Key metrics" className="stage-3d reveal mt-8 grid gap-4 lg:grid-cols-4">
              {metrics.map((m, i) => (
                <MetricCard key={m.label} {...m} index={i} immersive />
              ))}
            </section>
          </header>

          {!loading && <GettingStarted meetings={meetings.length} />}

          {error && (
            <div className="mt-6 max-w-xl">
              <ErrorState {...error} actionLabel="Retry" onAction={loadAll} />
            </div>
          )}

          {loading ? (
            <div className="mt-10 space-y-8">
              <SkeletonLines n={2} className="max-w-md" />
              <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
                <div className="space-y-4">{[0, 1, 2].map((i) => <SkeletonRow key={i} />)}</div>
                <SkeletonLines n={6} />
              </div>
            </div>
          ) : (
            <>
              {attention.length > 0 && (
                <section aria-label="Needs attention" className="stagger glass-strong sheen spotlight relative mt-8 overflow-hidden rounded-[18px]">
                  {attention.map(({ icon: Icon, tone, count, label, href }) => (
                    <Link key={`${href}-${label}`} href={href} className="group flex items-center gap-4 border-b border-white/[0.04] px-5 py-4 transition last:border-0 hover:bg-white/[0.03]">
                      <span className="flex h-7 w-7 items-center justify-center rounded-[9px]" style={{ background: `${tone}18`, color: tone }}>
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="mono text-[15px] font-[600] tabular-nums text-[#F5F7FA]">{count}</span>
                      <span className="flex-1 text-[13.5px] text-[#C7CCD4]">{label}</span>
                      <ArrowRight className="h-4 w-4 text-[#656B75] transition group-hover:translate-x-0.5 group-hover:text-[#9AA1AC]" aria-hidden="true" />
                    </Link>
                  ))}
                </section>
              )}

              <div className="mt-10 grid gap-x-10 gap-y-12 lg:grid-cols-[1.45fr_1fr]">
                <section aria-label="Recent meetings">
                  <div className="flex items-baseline justify-between">
                    <SectionLabel>Recent meetings</SectionLabel>
                    <Link href="/meetings" className="text-[12px] font-[550] text-[#38BDF8] hover:text-white">View all</Link>
                  </div>
                  <div className="mt-3">
                    {recentMeetings.length === 0 ? (
                      <EmptyState
                        icon={<Video className="h-5 w-5" />}
                        title="No meetings yet"
                        body="Your first meeting is where it all starts — record or upload it and Decentra does the rest."
                        action={<Link href="/meetings?new=1" className="btn h-[36px] bg-[#F5F7FA] px-4 text-[13px] font-[600] text-[#08090B] hover:bg-white">Start a meeting</Link>}
                      />
                    ) : (
                      <div className="divide-y divide-white/[0.05]">
                        {recentMeetings.map((m) => (
                          <Link key={m.id} href={`/meetings/${m.id}`} className="group flex items-center gap-4 py-3.5 transition">
                            <div className="w-[52px] shrink-0 text-center">
                              <div className="text-[11px] font-[650] uppercase tracking-wider text-[#656B75]">{fmtDate(m.date).split(" ")[0]}</div>
                              <div className="mono text-[19px] font-[600] tabular-nums leading-tight text-[#E5E9EF]">{new Date(m.date).getDate()}</div>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[14px] font-[600] tracking-[-0.01em] text-[#F0F3F7] group-hover:text-white">{m.title}</div>
                              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11.5px] text-[#656B75]">
                                <span>{m.participant_count} participants</span>
                                {(m.decisions_count > 0 || m.actions_count > 0) && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span>{m.decisions_count} decisions · {m.actions_count} actions</span>
                                  </>
                                )}
                              </div>
                            </div>
                            <StatusDot status={m.status} />
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </section>

                <section aria-label="My actions">
                  <div className="flex items-baseline justify-between">
                    <SectionLabel count={myActions.filter((a) => a.status !== "COMPLETED").length}>My actions</SectionLabel>
                    <Link href="/actions" className="text-[12px] font-[550] text-[#38BDF8] hover:text-white">Action Center</Link>
                  </div>
                  <div className="mt-3">
                    {myActions.length === 0 ? (
                      <EmptyState icon={<ClipboardList className="h-5 w-5" />} title="Nothing assigned to you" body="When a meeting assigns you an action item, it lands here." />
                    ) : (
                      <ul className="space-y-0 divide-y divide-white/[0.05]">
                        {myActions.slice(0, 6).map((a) => (
                          <li key={a.id} className="flex items-start gap-3 py-3">
                            <CompleteToggle id={a.id} done={a.status === "COMPLETED"} onDone={() => { toast("Action completed", "success"); loadAll(); }} />
                            <div className="min-w-0 flex-1">
                              <p className={`truncate text-[13.5px] font-[550] text-[#E9EDF2] ${a.status === "COMPLETED" ? "text-[#656B75] line-through" : ""}`}>{a.task}</p>
                              <DueLine raw={a.deadline_raw} status={a.status} />
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </section>

                <section aria-label="Recent decisions">
                  <div className="flex items-baseline justify-between">
                    <SectionLabel>Decision stream</SectionLabel>
                    <Link href="/decisions" className="text-[12px] font-[550] text-[#38BDF8] hover:text-white">Decision Center</Link>
                  </div>
                  <div className="mt-3">
                    {recentDecisions.length === 0 ? (
                      <EmptyState icon={<CheckCircle2 className="h-5 w-5" />} title="No decisions yet" body="Once your meetings produce decisions, they'll appear here as your organization's memory." />
                    ) : (
                      <div className="rail space-y-4 pl-7">
                        {recentDecisions.map((d) => {
                          const m = meetingMap.get(d.meeting_id);
                          return (
                            <div key={d.id} className="relative">
                              <span className="absolute -left-7 top-1 h-[9px] w-[9px] rounded-full border-2 border-[#08090B]" style={{ background: d.status === "CONFIRMED" ? "#10B981" : d.status === "REJECTED" ? "#656B75" : "#FBBF24" }} aria-hidden="true" />
                              <Link href={`/meetings/${d.meeting_id}?item=${d.id}`} className="group block">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={`truncate text-[13.5px] font-[550] text-[#E9EDF2] group-hover:text-white ${d.status === "REJECTED" ? "text-[#656B75] line-through" : ""}`}>{d.title}</span>
                                  <DecisionPill status={d.status} />
                                </div>
                                <div className="mt-0.5 truncate text-[11.5px] text-[#656B75]">{m?.title || "Meeting"}{m?.date ? ` · ${fmtDate(m.date)}` : ""}</div>
                              </Link>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </section>

                <section aria-label="Open questions">
                  <div className="flex items-baseline justify-between">
                    <SectionLabel count={questions.length}>Open questions</SectionLabel>
                    <Link href="/questions" className="text-[12px] font-[550] text-[#38BDF8] hover:text-white">All questions</Link>
                  </div>
                  <div className="mt-3">
                    {questions.length === 0 ? (
                      <EmptyState icon={<HelpCircle className="h-5 w-5" />} title="Nothing unresolved" body="Open questions from your meetings will surface here until they're answered." />
                    ) : (
                      <ul className="divide-y divide-white/[0.05]">
                        {questions.slice(0, 5).map((q) => (
                          <li key={q.id}>
                            <Link href={`/meetings/${q.meeting.id}?item=${q.id}`} className="group flex gap-3 py-3">
                              <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#A78BFA]/70" aria-hidden="true" />
                              <div className="min-w-0">
                                <p className="line-clamp-2 text-[13px] leading-snug text-[#DDE2E9] group-hover:text-white">{q.text}</p>
                                <p className="mt-0.5 truncate text-[11.5px] text-[#656B75]">{q.meeting.title}</p>
                              </div>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </section>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const map: Record<string, [string, string]> = { ready: ["#10B981", "Processed"], processing: ["#0EA5E9", "Processing"], draft: ["#656B75", "Draft"], failed: ["#EF4444", "Failed"], recording: ["#EF4444", "Recording"] };
  const [c, label] = map[status] || map.draft;
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.02] px-2 py-1 text-[9.5px] font-[700] uppercase tracking-[0.08em]" style={{ color: c }}>
      <span className={`h-1.5 w-1.5 rounded-full ${status === "processing" ? "pulse-dot" : ""}`} style={{ background: c }} aria-hidden="true" />
      {label}
    </span>
  );
}
