"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Nav } from "@/components/nav";
import { TiltCard } from "@/components/immersive/3d/TiltCard";
import { Reveal } from "@/components/immersive/3d/Reveal";
import { fmtDeadline } from "@/lib/format";
import {
  ArrowRight, CheckCircle2, TriangleAlert, UserX, Video, Sparkles,
  Radio, ChevronRight, Plus, Terminal,
} from "lucide-react";

/**
 * Command Deck — alternate dashboard. Same data as /overview, ops-console
 * voice: live clock, holographic metrics, dispatch queue, activity stream,
 * evidence ticker. Nothing here mutates data; every card links deep.
 */
type FeedItem = {
  id: string;
  kind: "decision" | "action" | "question" | "meeting";
  title: string;
  meta: string;
  tone: string;
  href: string;
  at: string;
};

function useClock() {
  const [now, setNow] = useState("--:--");
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setNow(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/** Isolated clock: re-renders only itself every second, not the deck. */
function Clock({ orgName }: { orgName: string }) {
  const clock = useClock();
  return (
    <span className="fragment hidden text-[10.5px] tabular-nums tracking-[0.14em] text-[#656B75] sm:inline">
      {orgName || "workspace"} · {clock} local
    </span>
  );
}

function StatBlock({ label, value, sub, tone, index }: { label: string; value: number; sub: string; tone: string; index: number }) {
  return (
    <TiltCard max={6} scale={1.02} glare={`${tone}1a`} className="group h-full">
      <div
        className="preserve-3d glass-depth animate-rise relative h-full overflow-hidden rounded-[18px] p-5"
        style={{ animationDelay: `${index * 0.07}s` }}
      >
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.2] to-transparent" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-20 blur-2xl [transform:translateZ(8px)]" style={{ background: tone }} />
        <p className="fragment text-[9.5px] uppercase tracking-[0.22em] text-[#656B75]">{label}</p>
        <p className="display-hero text-3d mt-2 text-[44px] leading-none text-[#F5F7FA] [transform:translateZ(28px)]">
          {value}
        </p>
        <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-[#9AA1AC]">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone, boxShadow: `0 0 8px ${tone}` }} />
          {sub}
        </p>
        {/* micro bar strip */}
        <div aria-hidden="true" className="mt-3 flex h-[3px] gap-[3px] overflow-hidden rounded-full">
          {Array.from({ length: 24 }, (_, i) => (
            <span
              key={i}
              className="h-full flex-1 rounded-full"
              style={{ background: i < Math.min(24, Math.max(2, value % 24 || 4)) ? tone : "rgba(255,255,255,0.08)", opacity: i < 8 ? 1 : 0.55 }}
            />
          ))}
        </div>
      </div>
    </TiltCard>
  );
}

export default function Deck() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [meetings, setMeetings] = useState<any[]>([]);
  const [decisions, setDecisions] = useState<any[]>([]);
  const [actions, setActions] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [orgName, setOrgName] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const orgs = await api("/api/v1/organizations");
        if (!orgs?.[0]) {
          setLoading(false);
          return;
        }
        setOrgName(orgs[0].name || "");
        const oid = orgs[0].id;
        const [ms, ds, as] = await Promise.all([
          api(`/api/v1/meetings?org_id=${oid}`).catch(() => []),
          api(`/api/v1/decisions?org_id=${oid}`).catch(() => []),
          api(`/api/v1/actions?org_id=${oid}`).catch(() => []),
        ]);
        setMeetings(ms || []);
        setDecisions(ds || []);
        setActions(as || []);
        const ready = (ms || []).filter((m: any) => m.status === "ready").slice(0, 6);
        const settled = await Promise.allSettled(ready.map((m: any) => api(`/api/v1/meetings/${m.id}/intelligence`)));
        const qs: any[] = [];
        settled.forEach((r) => {
          if (r.status === "fulfilled" && r.value?.questions) {
            r.value.questions.forEach((q: any) => qs.push(q));
          }
        });
        setQuestions(qs.filter((q) => (q.status || "OPEN") !== "ANSWERED").slice(0, 6));
        api(`/api/v1/health/score?org_id=${oid}`).then(setHealth).catch(() => {});
      } catch (e: any) {
        // Honest failure: never show confident zeros when the API is down.
        setError(e?.message?.slice(0, 140) || "Decentra server unreachable.");
      }
      setLoading(false);
    })();
  }, []);

  const detected = useMemo(() => decisions.filter((d) => d.status === "DETECTED"), [decisions]);
  const overdue = useMemo(
    () =>
      actions.filter((a) => {
        if (a.status === "COMPLETED" || a.status === "CANCELLED") return false;
        if (typeof a.overdue === "boolean") return a.overdue;
        try {
          return fmtDeadline(a.deadline_raw).overdue;
        } catch {
          return false;
        }
      }),
    [actions]
  );
  const unassigned = useMemo(
    () => actions.filter((a) => a.owner_name == null && a.status !== "COMPLETED"),
    [actions]
  );
  const done = useMemo(() => actions.filter((a) => a.status === "COMPLETED").length, [actions]);

  const feed: FeedItem[] = useMemo(() => {
    // Sort the FULL sets first, then slice — otherwise the newest
    // items fall outside the pre-slice window and never surface.
    const byDate = (x: FeedItem, y: FeedItem) => String(y.at).localeCompare(String(x.at));
    const dAll: FeedItem[] = decisions.map((d: any) => ({
      id: `d-${d.id}`, kind: "decision" as const, title: d.title,
      meta: `${d.status} · ${Math.round((d.confidence ?? 0) * 100)}%`,
      tone: d.status === "DETECTED" ? "#FBBF24" : "#34D399",
      href: "/decisions", at: d.created_at || d.confirmed_at || "",
    })).sort(byDate);
    const aAll: FeedItem[] = actions.map((a: any) => ({
      id: `a-${a.id}`, kind: "action" as const, title: a.task,
      meta: `${a.owner_name || "unassigned"} · ${a.status}`,
      tone: a.status === "COMPLETED" ? "#34D399" : "#38BDF8",
      href: "/actions", at: a.created_at || "",
    })).sort(byDate);
    const mAll: FeedItem[] = meetings.map((m: any) => ({
      id: `m-${m.id}`, kind: "meeting" as const, title: m.title,
      meta: m.status, tone: "#A78BFA", href: `/meetings/${m.id}`,
      at: m.created_at || m.date || "",
    })).sort(byDate);
    return [...dAll, ...aAll, ...mAll].sort(byDate).slice(0, 9);
  }, [decisions, actions, meetings]);

  const queue = [
    ...detected.slice(0, 3).map((d: any) => ({ icon: Sparkles, tone: "#FBBF24", title: d.title, meta: "Decision awaiting review", href: "/decisions?f=DETECTED" })),
    ...overdue.slice(0, 3).map((a: any) => ({ icon: TriangleAlert, tone: "#F87171", title: a.task, meta: `${a.owner_name || "Nobody"} · overdue`, href: "/actions" })),
    ...unassigned.slice(0, 2).map((a: any) => ({ icon: UserX, tone: "#38BDF8", title: a.task, meta: "No owner", href: "/actions" })),
  ].slice(0, 5);

  const stats = [
    { label: "Meetings tracked", value: meetings.length, sub: `${decisions.length} decisions extracted`, tone: "#38BDF8" },
    { label: "Review queue", value: detected.length, sub: detected.length ? "Needs human verdict" : "All clear", tone: "#FBBF24" },
    { label: "Actions closed", value: done, sub: `${overdue.length} overdue right now`, tone: "#34D399" },
    { label: "Open questions", value: questions.length, sub: "Awaiting answers", tone: "#A78BFA" },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-[#08090B] lg:flex-row">
      <Nav />
      <main id="main" className="min-w-0 flex-1">
        <div className="stage-3d relative mx-auto max-w-[1280px] px-5 pb-20 pt-6 lg:px-8 lg:pt-8">
          {/* ── command bar ── */}
          <Reveal>
            <div className="glass-depth flex flex-wrap items-center gap-3 rounded-[18px] px-5 py-3.5">
              <span className="flex h-2 w-2 animate-pulse rounded-full bg-[#34D399]" aria-hidden="true" />
              <span className="fragment text-[10.5px] uppercase tracking-[0.22em] text-[#E9EDF2]">
                Command deck
              </span>
              <Clock orgName={orgName} />
              {health && (
                <span
                  className="fragment ml-auto inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.14em]"
                  style={{
                    color: health.level === "high" ? "#D4A574" : health.level === "medium" ? "#FBBF24" : "#F87171",
                    borderColor: "rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)",
                  }}
                >
                  <Radio className="h-3 w-3" aria-hidden="true" /> Health {health.health}
                </span>
              )}
              <Link
                href="/overview"
                className="fragment inline-flex items-center gap-1 rounded-full border border-white/[0.1] bg-white/[0.03] px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-[#9AA1AC] transition hover:border-white/[0.2] hover:text-white"
              >
                Overview <ChevronRight className="h-3 w-3" aria-hidden="true" />
              </Link>
            </div>
          </Reveal>

          {/* ── holographic stats ── */}
          {!loading && error && (
            <div className="mt-5 rounded-[16px] border border-[#EF4444]/20 bg-[#EF4444]/[0.06] px-5 py-4 text-[13px] leading-relaxed text-[#FCA5A5]" role="alert">
              Deck offline — {error} Check that the Decentra server is running, then reload.
            </div>
          )}
          <section aria-label="Deck metrics" className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {loading
              ? Array.from({ length: 4 }, (_, i) => (
                  <div key={i} className="glass-depth h-[168px] animate-pulse rounded-[18px]" aria-hidden="true" />
                ))
              : stats.map((s, i) => <StatBlock key={s.label} {...s} index={i} />)}
          </section>

          <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1.1fr]">
            {/* ── dispatch queue ── */}
            <Reveal>
              <section aria-label="Dispatch queue" className="glass-depth relative h-full overflow-hidden rounded-[20px] p-2">
                <div aria-hidden="true" className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#FBBF24]/50 to-transparent" />
                <header className="flex items-center justify-between px-4 pb-1 pt-4">
                  <p className="fragment text-[10px] uppercase tracking-[0.22em] text-[#656B75]">Dispatch · needs a human</p>
                  <Link href="/review" className="fragment inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-[#38BDF8] hover:text-white">
                    Review <ChevronRight className="h-3 w-3" aria-hidden="true" />
                  </Link>
                </header>
                <div className="space-y-2 p-2">
                  {queue.length === 0 && (
                    <p className="flex items-center gap-2 px-4 py-6 text-[13px] text-[#656B75]">
                      <CheckCircle2 className="h-4 w-4 text-[#34D399]" aria-hidden="true" />
                      {loading ? "Scanning workspace…" : "Nothing pending. The deck is quiet."}
                    </p>
                  )}
                  {queue.map((q, i) => (
                    <Link
                      key={`${q.title}-${i}`}
                      href={q.href}
                      className="group flex items-center gap-3.5 rounded-[14px] border border-white/[0.05] bg-white/[0.015] px-4 py-3.5 transition hover:border-white/[0.12] hover:bg-white/[0.04]"
                    >
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border"
                        style={{ color: q.tone, borderColor: `${q.tone}40`, background: `${q.tone}12`, boxShadow: `0 0 18px ${q.tone}18` }}
                      >
                        <q.icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-[600] text-[#E9EDF2]">{q.title}</span>
                        <span className="fragment mt-0.5 block text-[10px] uppercase tracking-[0.14em] text-[#656B75]">{q.meta}</span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-[#454B54] transition group-hover:translate-x-0.5 group-hover:text-white" aria-hidden="true" />
                    </Link>
                  ))}
                </div>
              </section>
            </Reveal>

            {/* ── live activity stream ── */}
            <Reveal delay={0.08}>
              <section aria-label="Activity stream" className="glass-depth relative h-full overflow-hidden rounded-[20px] p-2">
                <div aria-hidden="true" className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#38BDF8]/50 to-transparent" />
                <header className="flex items-center justify-between px-4 pb-1 pt-4">
                  <p className="fragment flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[#656B75]">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#38BDF8]" aria-hidden="true" />
                    Activity stream
                  </p>
                  <Link href="/timeline" className="fragment inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-[#38BDF8] hover:text-white">
                    Timeline <ChevronRight className="h-3 w-3" aria-hidden="true" />
                  </Link>
                </header>
                <ol className="rail space-y-0 p-2 pl-4">
                  {feed.length === 0 && (
                    <li className="py-6 pl-5 text-[13px] text-[#656B75]">
                      {loading ? "Tuning frequencies…" : "No signals yet — process a meeting."}
                    </li>
                  )}
                  {feed.map((f) => (
                    <li key={f.id} className="relative py-2.5 pl-5">
                      <span
                        aria-hidden="true"
                        className="absolute left-[1px] top-[14px] h-2 w-2 rounded-full border-2 border-[#08090B]"
                        style={{ background: f.tone, boxShadow: `0 0 10px ${f.tone}` }}
                      />
                      <Link href={f.href} className="group block">
                        <p className="truncate text-[13px] font-[550] text-[#E9EDF2] group-hover:text-white">{f.title}</p>
                        <p className="fragment mt-0.5 text-[10px] uppercase tracking-[0.14em] text-[#656B75]">
                          {f.kind} · <span style={{ color: f.tone }}>{f.meta}</span>
                        </p>
                      </Link>
                    </li>
                  ))}
                </ol>
              </section>
            </Reveal>
          </div>

          {/* ── quick actions ── */}
          <Reveal delay={0.12}>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                { href: "/meetings?new=1", icon: Plus, label: "New meeting", sub: "Record · understand · decide", tone: "#38BDF8" },
                { href: "/assistant", icon: Terminal, label: "Ask Decentra", sub: "Grounded answers, live", tone: "#A78BFA" },
                { href: "/meetings", icon: Video, label: "Open meetings", sub: "Replays + evidence", tone: "#D4A574" },
              ].map((a) => (
                <Link
                  key={a.href}
                  href={a.href}
                  className="glass-depth depth-lift group flex items-center gap-3.5 rounded-[16px] px-5 py-4"
                >
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border transition-transform duration-300 group-hover:scale-110"
                    style={{ color: a.tone, borderColor: `${a.tone}40`, background: `${a.tone}12` }}
                  >
                    <a.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-[14px] font-[650] text-[#F5F7FA]">
                      {a.label}
                      <ArrowRight className="h-3.5 w-3.5 text-[#656B75] transition group-hover:translate-x-0.5 group-hover:text-white" aria-hidden="true" />
                    </span>
                    <span className="block truncate text-[12px] text-[#656B75]">{a.sub}</span>
                  </span>
                </Link>
              ))}
            </div>
          </Reveal>
        </div>
      </main>
    </div>
  );
}
