"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Nav } from "@/components/nav";
import { api } from "@/lib/api";
import { MetricCard } from "@/components/ui/metrics";
import { PageHero } from "@/components/ui/page-hero";
import { Reveal } from "@/components/immersive/3d/Reveal";
import { ShaderAurora } from "@/components/immersive/3d/ShaderAurora";
import { TiltCard } from "@/components/immersive/3d/TiltCard";
import { EmptyState, ErrorState, SkeletonRow } from "@/components/ui/states";
import { SectionLabel } from "@/components/ui/primitives";
import { Timer, Flame, PiggyBank, Scissors, ArrowUpRight, Upload } from "lucide-react";

const spark = (vals: number[]) => vals.map((y, x) => ({ x, y }));

const VERDICT_STYLE: Record<string, { color: string; bg: string; border: string; label: string }> = {
  MEET: { color: "#34D399", bg: "rgba(16,185,129,0.10)", border: "rgba(16,185,129,0.25)", label: "MEET" },
  ASYNC: { color: "#FBBF24", bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.25)", label: "ASYNC IT" },
  SKIP: { color: "#F87171", bg: "rgba(239,68,68,0.10)", border: "rgba(239,68,68,0.25)", label: "SKIP IT" },
};

export default function RoiPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ title: string; reason: string } | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const orgs = await api("/api/v1/organizations");
      if (!orgs?.[0]) { setLoading(false); return; }
      setData(await api(`/api/v1/roi/meetings?org_id=${orgs[0].id}`));
    } catch (e: any) {
      setError({ title: "We couldn't load meeting ROI", reason: e?.message?.slice(0, 160) || "Check that the Decentra server is running." });
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const rows: any[] = data?.rows || [];
  const offenders = useMemo(() => rows.filter((r) => r.barren).slice(0, 8), [rows]);
  const asyncable = useMemo(() => rows.filter((r) => r.verdict !== "MEET").length, [rows]);

  const metrics = useMemo(() => [
    { label: "Meeting hours", value: Math.round(data?.total_hours ?? 0), change: `${data?.meeting_count ?? 0} meetings scanned`, tone: "sky", icon: Timer, sparkline: spark(rows.slice(0, 7).map((r) => r.hours)) },
    { label: "Wasted hours", value: Math.round(data?.waste_hours ?? 0), change: "Zero decisions, zero actions", tone: "red", icon: Flame, sparkline: spark(rows.slice(0, 7).map((r) => (r.barren ? r.hours : 0))) },
    { label: "Waste rate", value: `${data?.waste_pct ?? 0}%`, change: "Of calendar time burned", tone: "amber", icon: PiggyBank, sparkline: spark([data?.waste_pct ?? 0, data?.waste_pct ?? 0]) },
    { label: "Async-able", value: asyncable, change: "Could be a thread, not a call", tone: "emerald", icon: Scissors, sparkline: spark(rows.slice(0, 7).map((r) => (r.verdict !== "MEET" ? 1 : 0))) },
  ], [data, rows, asyncable]);

  return (
    <div className="flex min-h-screen flex-col bg-[#08090B] lg:flex-row">
      <Nav />
      <main id="main" className="min-w-0 flex-1">
        <div className="relative mx-auto max-w-[1240px] px-5 pb-20 pt-8 lg:px-8 lg:pt-12">
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            <ShaderAurora className="opacity-[0.45]" speed={0.7} intensity={0.5} mouseInfluence={0.3} />
            <div className="orb orb-amber h-[340px] w-[380px] -right-[80px] -top-[40px] opacity-[0.12]" />
            <div className="orb orb-sky h-[260px] w-[300px] left-[22%] top-[280px] opacity-[0.10]" />
          </div>

          <PageHero
            kicker="Prevention layer · auto-elimination engine"
            title={<>Meeting <span className="thin text-[#9AA1AC]">ROI</span></>}
            sub="Your team spent hours in rooms this month. Here's exactly how many bought decisions — and which meetings should never have existed."
          />
          <section aria-label="Key metrics" className="relative mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {metrics.map((m, i) => <MetricCard key={m.label} {...m} index={i} immersive />)}
          </section>

          <div className="relative mt-10">
            {loading ? (
              <div className="space-y-4">{[0, 1, 2].map((i) => <SkeletonRow key={i} />)}</div>
            ) : error && !data ? (
              <div className="max-w-xl"><ErrorState {...error} actionLabel="Retry" onAction={load} /></div>
            ) : rows.length === 0 ? (
              <Reveal>
                <EmptyState
                  icon={<Upload className="h-5 w-5" />}
                  title="No meetings to audit yet"
                  body="Create a meeting and the elimination engine will score whether it deserves to exist."
                  action={<Link href="/meetings?new=1" className="btn h-[38px] bg-[#F5F7FA] px-5 text-[13px] font-[600] text-[#08090B] hover:bg-white">New meeting</Link>}
                />
              </Reveal>
            ) : (
              <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
                <section aria-label="Calendar audit">
                  <SectionLabel>Calendar audit · worst first</SectionLabel>
                  <div className="mt-3 space-y-2.5">
                    {rows.map((r: any, i: number) => {
                      const v = VERDICT_STYLE[r.verdict] || VERDICT_STYLE.MEET;
                      return (
                        <Reveal key={r.id} delay={Math.min(i * 0.03, 0.2)}>
                          <Link href={`/meetings/${r.id}/verdict`} className="group flex items-center gap-4 rounded-[16px] border border-white/[0.06] bg-[#101216] px-4 py-3.5 transition hover:border-white/[0.12] hover:bg-[#15181D]">
                            <span className="rounded-full border px-2 py-0.5 text-[10px] font-[700] tracking-wide" style={{ color: v.color, borderColor: v.border, background: v.bg }}>{v.label}</span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13.5px] font-[600] text-[#F0F3F7] group-hover:text-white">{r.title}</span>
                              <span className="mt-0.5 block text-[11.5px] tabular-nums text-[#656B75]">{r.attendees} people · {r.duration_min} min · {r.decisions} decisions · {r.actions} actions</span>
                            </span>
                            <span className="mono shrink-0 text-[12px] font-[700] tabular-nums text-[#9AA1AC]">{r.hours}h</span>
                            <ArrowUpRight className="h-4 w-4 shrink-0 text-[#656B75] transition group-hover:text-white" aria-hidden="true" />
                          </Link>
                        </Reveal>
                      );
                    })}
                  </div>
                </section>
                <section aria-label="Zero-outcome offenders">
                  <SectionLabel>Burned with nothing to show</SectionLabel>
                  {offenders.length === 0 ? (
                    <div className="glass mt-3 rounded-[16px] p-5 text-[13px] leading-relaxed text-[#9AA1AC]">
                      <span className="font-[600] text-[#34D399]">Clean calendar.</span> Every processed meeting produced at least one decision or action.
                    </div>
                  ) : (
                    <div className="mt-3 space-y-2.5">
                      {offenders.map((r: any) => (
                        <TiltCard key={r.id} max={2} scale={1.005}>
                          <Link href={`/meetings/${r.id}/verdict`} className="block rounded-[16px] border border-[#EF4444]/20 bg-[#EF4444]/[0.05] px-4 py-3.5 transition hover:bg-[#EF4444]/[0.08]">
                            <p className="truncate text-[13px] font-[600] text-[#F0F3F7]">{r.title}</p>
                            <p className="mono mt-1 text-[11.5px] tabular-nums text-[#F87171]">{r.hours}h · {r.attendees} people · 0 outcomes</p>
                          </Link>
                        </TiltCard>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
