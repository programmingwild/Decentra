"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { getMeAndOrgs } from "@/lib/auth";
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
const ShaderAurora = dynamic(() => import("@/components/immersive/3d/ShaderAurora").then((m) => m.ShaderAurora), { ssr: false });

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
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);
  // greeting() depends on the viewer's local clock — rendering it during SSR
  // gives a different string than the browser (UTC vs IST) → React #418 → the
  // "section crashed" screen. Start empty on both sides, set it after mount.
  const [greet, setGreet] = useState("");

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      // Shared burst: GET /me + GET /organizations (same promise the
      // AuthProvider fires on mount). Historically this was a serial chain
      // me → orgs → rest; now they're one parallel round trip.
      const [me, orgs] = await getMeAndOrgs();
      if (me) setUserName(me.full_name?.split(" ")[0] || me.email?.split("@")[0] || "");
      const oid = orgs?.[0]?.id;
      if (!oid) { setLoading(false); return; }

      // Parallel batch 2 — all the dashboard widgets load together instead of
      // the meetings→decisions→actions serial chain.
      const [ms, ds, as, mine, health] = await Promise.all([
        api(`/api/v1/meetings?org_id=${oid}`).catch(() => []),
        api(`/api/v1/decisions?org_id=${oid}`).catch(() => []),
        api(`/api/v1/actions?org_id=${oid}`).catch(() => []),
        api(`/api/v1/actions?org_id=${oid}&owner=me`).catch(() => []),
        api(`/api/v1/health/score?org_id=${oid}`).catch(() => null),
      ]);
      setMeetings(ms || []);
      setDecisions(ds || []);
      setActions(as || []);
      setMyActions(mine || []);
      setHealth(health);
      const readyMeetings = (ms || []).filter((m: any) => m.status === "ready").slice(0, 10);
      // Parallel batch 3: per-meeting intelligence (needed for "Next steps" pop).
      const intelResults = await Promise.allSettled(readyMeetings.map((m: any) => api(`/api/v1/meetings/${m.id}/intelligence`)));
      const qs: any[] = [];
      intelResults.forEach((r, i) => {
        if (r.status === "fulfilled" && r.value?.questions) {
          r.value.questions.forEach((q: any) => qs.push({ ...q, meeting: readyMeetings[i] }));
        }
      });
      setQuestions(qs.filter((q) => (q.status || "OPEN") !== "ANSWERED"));
    } catch (e: any) {
      setError(friendly(e));
    }
    setSyncedAt(new Date());
    setLoading(false);
  }

  function friendly(e: any) {
    return { title: "We couldn't load your workspace", reason: e?.message?.slice(0, 160) || "Check that the Decentra server is running." };
  }

  useEffect(() => {
    setGreet(greeting());
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
  if (detected.length) attention.push({ icon: Sparkles, tone: "var(--amber)", count: detected.length, label: detected.length === 1 ? "decision awaiting your review" : "decisions awaiting your review", href: "/decisions?f=DETECTED" });
  if (overdue.length) attention.push({ icon: TriangleAlert, tone: "var(--red)", count: overdue.length, label: overdue.length === 1 ? "overdue action" : "overdue actions", href: "/actions" });
  if (unassigned.length) attention.push({ icon: UserX, tone: "var(--sky)", count: unassigned.length, label: unassigned.length === 1 ? "action without an owner" : "actions without an owner", href: "/actions" });

  const sentenceParts: string[] = [];
  if (detected.length) sentenceParts.push(`${detected.length} decision${detected.length === 1 ? "" : "s"} to review`);
  if (overdue.length) sentenceParts.push(`${overdue.length} overdue action${overdue.length === 1 ? "" : "s"}`);
  if (!sentenceParts.length && actions.length) sentenceParts.push("everything on track");

  // Bold metric cards data
  const healthRate = health?.metrics?.confirmed_rate ?? 0;
  const metrics = useMemo(() => [
    { 
      label: "Decisions", 
      value: decisions.length, 
      change: detected.length > 0 ? `+${detected.length} new` : "All reviewed", 
      tone: detected.length > 0 ? "amber" : "emerald", 
      icon: Target,
      href: detected.length > 0 ? "/decisions?f=DETECTED" : "/decisions",
      sparkline: decisions.slice(-7).map((_, i) => ({ x: i, y: i + 1 }))
    },
    { 
      label: "Actions", 
      value: actions.length, 
      change: overdue.length > 0 ? `${overdue.length} overdue` : `${actions.filter(a => a.status === "COMPLETED").length} done`, 
      tone: overdue.length > 0 ? "red" : "sky", 
      icon: CheckCircle2,
      href: "/actions",
      sparkline: actions.slice(-7).map((_, i) => ({ x: i, y: i + 1 }))
    },
    { 
      label: "Meetings", 
      value: meetings.length, 
      change: `${meetings.filter(m => m.status === "ready").length} processed`, 
      tone: "violet", 
      icon: Users,
      href: "/meetings",
      sparkline: meetings.slice(-7).map((_, i) => ({ x: i, y: i + 1 }))
    },
    { 
      label: "Health", 
      value: health?.health || 0, 
      change: health?.metrics ? `${healthRate}% confirmed` : "No data",
      tone: health?.level === "high" ? "gold" : health?.level === "medium" ? "amber" : "red",
      icon: TrendingUp,
      href: "/timeline",
      sparkline: health?.metrics ? [
        { x: 0, y: healthRate * 0.6 },
        { x: 1, y: healthRate * 0.7 },
        { x: 2, y: healthRate * 0.8 },
        { x: 3, y: healthRate * 0.9 },
        { x: 4, y: healthRate },
        { x: 5, y: healthRate * 1.05 },
        { x: 6, y: healthRate }
      ] : Array.from({ length: 7 }, (_, i) => ({ x: i, y: 0 }))
    },
  ], [decisions, detected, actions, overdue, meetings, health, healthRate]);

  const recentMeetings = meetings.slice(0, 5);
  const recentDecisions = decisions.slice(0, 6);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)] lg:flex-row">
      <Nav />
      <main id="main" className="min-w-0 flex-1">
        <div className="relative mx-auto max-w-[1240px] px-5 pb-20 pt-8 lg:px-8 lg:pt-12">
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            <ShaderAurora className="opacity-[0.5]" speed={0.7} intensity={0.5} mouseInfluence={0.3} />
            <div className="orb orb-sky h-[380px] w-[420px] -right-[80px] -top-[60px] opacity-[0.16]" />
            <div className="orb orb-violet h-[300px] w-[340px] left-[18%] top-[220px] opacity-[0.10]" />
          </div>
          <motion.header
            initial={{opacity: 0, y: 22}}
            animate={{ opacity: 1, y: 0 }}
            transition={{duration: 0.55, ease: [0.16, 1, 0.3, 1]}}
            className="relative"
          >
            <div className="flex items-center justify-between gap-4">
              <p className="fragment text-[10.5px] uppercase tracking-[0.2em] text-[var(--subtle)]">{greet} <span className="text-[var(--fg)]/20">—</span> workspace</p>
              {!loading && syncedAt && (
                <span className="glass-subtle inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-[10.5px] font-[600] tabular-nums text-[var(--muted)]">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--emerald)] opacity-60" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--emerald)]" />
                  </span>
                  Live · synced {syncedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
              )}
            </div>
            <h1 className="display-hero text-3d mt-2 text-[36px] text-[var(--text)] lg:text-[48px]">
              {userName ? `${userName},` : ""}
              <span className="thin ml-2 text-[var(--muted)] lg:text-[44px]">{sentenceParts.length ? "here's your focus." : "all clear."}</span>
            </h1>
            {sentenceParts.length > 0 && (
              <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-[var(--muted)]">
                You have{" "}
                {detected.length > 0 && (
                  <>
                    <Link href="/decisions?f=DETECTED" className="font-[600] text-[var(--amber)] underline decoration-[color-mix(in_srgb,var(--amber)_30%,transparent)] underline-offset-4 hover:decoration-[var(--amber)]">{detected.length} decision{detected.length === 1 ? "" : "s"} to review</Link>
                    {overdue.length > 0 ? " and " : "."}
                  </>
                )}
                {overdue.length > 0 && (
                  <>
                    <Link href="/actions" className="font-[600] text-[var(--red)] underline decoration-[color-mix(in_srgb,var(--red)_30%,transparent)] underline-offset-4 hover:decoration-[var(--red)]">{overdue.length} overdue action{overdue.length === 1 ? "" : "s"}</Link>.
                  </>
                )}
                {!detected.length && !overdue.length && actions.length > 0 && <span className="text-[var(--text-soft)]">everything is on track.</span>}
              </p>
            )}
            {health && (
              <div className="reveal mt-6 flex flex-wrap items-center gap-3">
                <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-[600] ${health.level==="high"?"gold-border gold-glow bg-[color-mix(in_srgb,var(--gold)_10%,transparent)] text-[var(--gold)]":health.level==="medium"?"border-[color-mix(in_srgb,var(--amber-2)_20%,transparent)] bg-[color-mix(in_srgb,var(--amber-2)_10%,transparent)] text-[var(--amber)]":"border-[color-mix(in_srgb,var(--red-2)_20%,transparent)] bg-[color-mix(in_srgb,var(--red-2)_10%,transparent)] text-[var(--red)]"}`}>
                  <span className="h-2 w-2 rounded-full" style={{background: health.level==="high"?"var(--gold)":health.level==="medium"?"var(--amber-2)":"var(--red-2)"}} /> Health {health.health} · {health.level}
                </div>
                <span className="text-[11px] text-[var(--subtle)]">{health?.metrics ? `${healthRate}% decisions confirmed · ${health.metrics.completed_rate}% actions done` : "No health data yet"}</span>
                <Link href="/timeline" className="ml-auto hidden text-[11px] font-[600] text-[var(--sky)] hover:text-[var(--fg)] sm:inline-flex">View timeline →</Link>
                <Link href="/deck" className="hidden items-center gap-1 rounded-full border border-[color-mix(in_srgb,var(--gold)_25%,transparent)] bg-[color-mix(in_srgb,var(--gold)_7%,transparent)] px-3 py-1 text-[11px] font-[600] text-[var(--gold)] transition hover:border-[color-mix(in_srgb,var(--gold)_45%,transparent)] hover:text-[var(--fg)] sm:inline-flex">Command deck →</Link>
              </div>
            )}

            {/* Bold Metric Cards — 3D depth stage */}
            <section aria-label="Key metrics" className="stage-3d reveal mt-8 grid gap-4 lg:grid-cols-4">
              {metrics.map((m, i) => (
                <Link key={m.label} href={m.href} className="group/metric block h-full rounded-[24px] focus-visible:outline-none" aria-label={`${m.label}: ${m.value}, ${m.change}. Open ${m.label.toLowerCase()}.`}>
                  <div className="relative h-full transition-all duration-300 group-hover/metric:-translate-y-1">
                    <MetricCard key={m.label} {...m} index={i} immersive />
                    <span className="pointer-events-none absolute right-5 top-5 z-10 flex h-7 w-7 translate-y-1 items-center justify-center rounded-full border border-[var(--border)] bg-black/40 text-[var(--muted)] opacity-0 backdrop-blur transition-all duration-300 group-hover/metric:translate-y-0 group-hover/metric:opacity-100" aria-hidden="true">
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </Link>
              ))}
            </section>
          </motion.header>

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
                <motion.section
                  initial={{opacity: 0, y: 18}}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{duration: 0.5, delay: 0.3, ease: [0.16, 1, 0.3, 1]}}
                  aria-label="Needs attention"
                  className="stagger glass-strong sheen spotlight relative mt-8 overflow-hidden rounded-[18px]"
                >
                  {attention.map(({ icon: Icon, tone, count, label, href }) => (
                    <Link key={`${href}-${label}`} href={href} className="group relative flex items-center gap-4 border-b border-[var(--border)] px-5 py-4 transition last:border-0 hover:bg-[color-mix(in_srgb,var(--fg)_3%,transparent)]">
                      <span className="absolute inset-y-3 left-0 w-[3px] rounded-full" style={{ background: tone, boxShadow: `0 0 12px ${tone}80` }} aria-hidden="true" />
                      <span className="flex h-7 w-7 items-center justify-center rounded-[9px] transition-transform duration-300 group-hover:scale-110" style={{ background: `${tone}18`, color: tone }}>
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="mono text-[15px] font-[600] tabular-nums text-[var(--text)]">{count}</span>
                      <span className="flex-1 text-[13.5px] text-[var(--text-soft)]">{label}</span>
                      <ArrowRight className="h-4 w-4 text-[var(--subtle)] transition group-hover:translate-x-0.5 group-hover:text-[var(--muted)]" aria-hidden="true" />
                    </Link>
                  ))}
                </motion.section>
              )}

              <div className="mt-10 grid gap-x-10 gap-y-12 lg:grid-cols-[1.45fr_1fr]">
                <motion.section
                  initial={{opacity: 0, y: 24}}
                  whileInView={{opacity: 1, y: 0}}
                  viewport={{once: true, margin: "-60px"}}
                  transition={{duration: 0.5, delay: 0, ease: [0.16, 1, 0.3, 1]}}
                  aria-label="Recent meetings"
                >
                  <div className="flex items-baseline justify-between">
                    <SectionLabel>Recent meetings</SectionLabel>
                    <Link href="/meetings" className="text-[12px] font-[550] text-[var(--sky)] hover:text-[var(--fg)]">View all</Link>
                  </div>
                  <div className="mt-3">
                    {recentMeetings.length === 0 ? (
                      <EmptyState
                        icon={<Video className="h-5 w-5" />}
                        title="No meetings yet"
                        body="Your first meeting is where it all starts — record or upload it and Decentra does the rest."
                        action={<Link href="/meetings?new=1" className="btn h-[36px] bg-[var(--text)] px-4 text-[13px] font-[600] text-[var(--bg)] hover:bg-[var(--fg)]">Start a meeting</Link>}
                      />
                    ) : (
                      <div className="divide-y divide-[var(--border)]">
                        {recentMeetings.map((m) => (
                          <Link key={m.id} href={`/meetings/${m.id}`} className="group -mx-3 flex items-center gap-4 rounded-[14px] px-3 py-3.5 transition-all duration-200 hover:bg-[color-mix(in_srgb,var(--fg)_4%,transparent)] hover:shadow-[0_8px_28px_rgba(0,0,0,0.35)]">
                            <div className="w-[52px] shrink-0 text-center">
                              <div className="text-[11px] font-[650] uppercase tracking-wider text-[var(--subtle)]">{fmtDate(m.date).split(" ")[0]}</div>
                              <div className="mono text-[19px] font-[600] tabular-nums leading-tight text-[var(--text)]">{new Date(m.date).getDate()}</div>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[14px] font-[600] tracking-[-0.01em] text-[var(--text)] group-hover:text-[var(--fg)]">{m.title}</div>
                              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11.5px] text-[var(--subtle)]">
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
                            <ArrowRight className="h-4 w-4 shrink-0 -translate-x-1 text-[var(--subtle)] opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:text-[var(--muted)] group-hover:opacity-100" aria-hidden="true" />
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.section>

                <motion.section
                  initial={{opacity: 0, y: 24}}
                  whileInView={{opacity: 1, y: 0}}
                  viewport={{once: true, margin: "-60px"}}
                  transition={{duration: 0.5, delay: 0.08, ease: [0.16, 1, 0.3, 1]}}
                  aria-label="My actions"
                >
                  <div className="flex items-baseline justify-between">
                    <SectionLabel count={myActions.filter((a) => a.status !== "COMPLETED").length}>My actions</SectionLabel>
                    <Link href="/actions" className="text-[12px] font-[550] text-[var(--sky)] hover:text-[var(--fg)]">Action Center</Link>
                  </div>
                  <div className="mt-3">
                    {myActions.length === 0 ? (
                      <EmptyState icon={<ClipboardList className="h-5 w-5" />} title="Nothing assigned to you" body="When a meeting assigns you an action item, it lands here." />
                    ) : (
                      <ul className="space-y-0 divide-y divide-[var(--border)]">
                        {myActions.slice(0, 6).map((a) => (
                          <li key={a.id} className="flex items-start gap-3 py-3">
                            <CompleteToggle id={a.id} done={a.status === "COMPLETED"} onDone={() => { toast("Action completed", "success"); loadAll(); }} />
                            <div className="min-w-0 flex-1">
                              <p className={`truncate text-[13.5px] font-[550] text-[var(--text)] ${a.status === "COMPLETED" ? "text-[var(--subtle)] line-through" : ""}`}>{a.task}</p>
                              <DueLine raw={a.deadline_raw} status={a.status} />
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </motion.section>

                <motion.section
                  initial={{opacity: 0, y: 24}}
                  whileInView={{opacity: 1, y: 0}}
                  viewport={{once: true, margin: "-60px"}}
                  transition={{duration: 0.5, delay: 0.12, ease: [0.16, 1, 0.3, 1]}}
                  aria-label="Recent decisions"
                >
                  <div className="flex items-baseline justify-between">
                    <SectionLabel>Decision stream</SectionLabel>
                    <Link href="/decisions" className="text-[12px] font-[550] text-[var(--sky)] hover:text-[var(--fg)]">Decision Center</Link>
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
                              <span className="absolute -left-7 top-1 h-[9px] w-[9px] rounded-full border-2 border-[var(--bg)] transition-all duration-300 group-hover:scale-125" style={{ background: d.status === "CONFIRMED" ? "var(--emerald-2)" : d.status === "REJECTED" ? "var(--subtle)" : "var(--amber)", boxShadow: d.status === "CONFIRMED" ? "0 0 10px rgba(16,185,129,0.5)" : d.status === "REJECTED" ? "none" : "0 0 10px rgba(251,191,36,0.55)" }} aria-hidden="true" />
                              <Link href={`/meetings/${d.meeting_id}?item=${d.id}`} className="group block">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={`truncate text-[13.5px] font-[550] text-[var(--text)] group-hover:text-[var(--fg)] ${d.status === "REJECTED" ? "text-[var(--subtle)] line-through" : ""}`}>{d.title}</span>
                                  <DecisionPill status={d.status} />
                                </div>
                                <div className="mt-0.5 truncate text-[11.5px] text-[var(--subtle)]">{m?.title || "Meeting"}{m?.date ? ` · ${fmtDate(m.date)}` : ""}</div>
                              </Link>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </motion.section>

                <motion.section
                  initial={{opacity: 0, y: 24}}
                  whileInView={{opacity: 1, y: 0}}
                  viewport={{once: true, margin: "-60px"}}
                  transition={{duration: 0.5, delay: 0.16, ease: [0.16, 1, 0.3, 1]}}
                  aria-label="Open questions"
                >
                  <div className="flex items-baseline justify-between">
                    <SectionLabel count={questions.length}>Open questions</SectionLabel>
                    <Link href="/questions" className="text-[12px] font-[550] text-[var(--sky)] hover:text-[var(--fg)]">All questions</Link>
                  </div>
                  <div className="mt-3">
                    {questions.length === 0 ? (
                      <EmptyState icon={<HelpCircle className="h-5 w-5" />} title="Nothing unresolved" body="Open questions from your meetings will surface here until they're answered." />
                    ) : (
                      <ul className="divide-y divide-[var(--border)]">
                        {questions.slice(0, 5).map((q) => (
                          <li key={q.id}>
                            <Link href={`/meetings/${q.meeting.id}?item=${q.id}`} className="group flex gap-3 py-3">
                              <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-[color-mix(in_srgb,var(--violet)_70%,transparent)]" aria-hidden="true" />
                              <div className="min-w-0">
                                <p className="line-clamp-2 text-[13px] leading-snug text-[var(--text-soft)] group-hover:text-[var(--fg)]">{q.text}</p>
                                <p className="mt-0.5 truncate text-[11.5px] text-[var(--subtle)]">{q.meeting.title}</p>
                              </div>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </motion.section>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const map: Record<string, [string, string]> = { ready: ["var(--emerald-2)", "Processed"], processing: ["var(--sky-2)", "Processing"], draft: ["var(--subtle)", "Draft"], failed: ["var(--red-2)", "Failed"], recording: ["var(--red-2)", "Recording"] };
  const [c, label] = map[status] || map.draft;
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[color-mix(in_srgb,var(--fg)_2%,transparent)] px-2 py-1 text-[9.5px] font-[700] uppercase tracking-[0.08em]" style={{ color: c }}>
      <span className={`h-1.5 w-1.5 rounded-full ${status === "processing" ? "pulse-dot" : ""}`} style={{ background: c }} aria-hidden="true" />
      {label}
    </span>
  );
}
