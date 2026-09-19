"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Nav } from "@/components/nav";
import { api } from "@/lib/api";
import { MetricCard, AreaChart } from "@/components/ui/metrics";
import { TiltCard } from "@/components/immersive/3d/TiltCard";
import { Reveal } from "@/components/immersive/3d/Reveal";
import { ShaderAurora } from "@/components/immersive/3d/ShaderAurora";
import { EmptyState, ErrorState, SkeletonRow } from "@/components/ui/states";
import { SectionLabel } from "@/components/ui/primitives";
import { BarChart3, TrendingUp, GitCompare, Database, Upload, Table2 } from "lucide-react";

const spark = (vals: number[]) => vals.map((y, x) => ({ x, y }));
const num = (v: any) => (typeof v === "number" && isFinite(v) ? v : null);
const fmt = (v: any) => {
  const n = num(v);
  if (n === null) return "—";
  return Math.abs(n) >= 1000 ? n.toLocaleString(undefined, { maximumFractionDigits: 1 }) : String(Math.round(n * 100) / 100);
};

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [dsName, setDsName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ title: string; reason: string } | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const o = await api("/api/v1/organizations");
      if (!o?.[0]) { setLoading(false); return; }
      const ds = await api(`/api/v1/datasets?org_id=${o[0].id}`);
      if (!ds?.[0]) { setLoading(false); return; }
      setDsName(ds[0].name || "Dataset");
      const r = await api(`/api/v1/datasets/${ds[0].id}/analytics/overview`);
      setData(r);
    } catch (e: any) {
      setError({ title: "We couldn't load analytics", reason: e?.message?.slice(0, 160) || "Check that the Decentra server is running." });
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const describe: Record<string, any> = data?.describe && typeof data.describe === "object" ? data.describe : {};
  const columns = Object.keys(describe);
  const numericCols = columns.filter((c) => num(describe[c]?.mean) !== null || num(describe[c]?.avg) !== null);

  const corrPairs = useMemo(() => {
    const c = data?.correlation;
    if (!c || typeof c !== "object") return [];
    const pairs: Array<{ a: string; b: string; v: number }> = [];
    for (const a of Object.keys(c)) {
      const row = c[a];
      if (!row || typeof row !== "object") continue;
      for (const b of Object.keys(row)) {
        if (b <= a) continue;
        const v = num(row[b]);
        if (v !== null) pairs.push({ a, b, v });
      }
    }
    return pairs.sort((p, q) => Math.abs(q.v) - Math.abs(p.v)).slice(0, 6);
  }, [data]);

  const segments: Array<{ label: string; value: number }> = useMemo(() => {
    const s = data?.segmentation;
    const arr = Array.isArray(s) ? s : Array.isArray(s?.groups) ? s.groups : Array.isArray(s?.segments) ? s.segments : [];
    return arr.slice(0, 7).map((g: any, i: number) => {
      const label = String(g?.key ?? g?.name ?? g?.label ?? g?.group ?? `Group ${i + 1}`);
      const cand = [g?.value, g?.sum, g?.total, g?.count, g?.n].map(num).find((v) => v !== null);
      return { label, value: cand ?? 0 };
    });
  }, [data]);

  const trendSeries: Array<{ name: string; vals: number[] }> = useMemo(() => {
    const t = data?.trends;
    if (!t || typeof t !== "object") return [];
    const out: Array<{ name: string; vals: number[] }> = [];
    for (const k of Object.keys(t)) {
      if (["date_column", "date", "column"].includes(k)) continue;
      const v = t[k];
      const arr = Array.isArray(v) ? v.map(num).filter((x: number | null): x is number => x !== null)
        : Array.isArray(v?.values) ? v.values.map(num).filter((x: number | null): x is number => x !== null) : [];
      if (arr.length > 1) out.push({ name: k, vals: arr.slice(-24) });
      if (out.length >= 3) break;
    }
    return out;
  }, [data]);

  const segMax = Math.max(...segments.map((s) => s.value), 1);

  const metrics = useMemo(() => [
    { label: "Columns profiled", value: columns.length, change: `${numericCols.length} numeric`, tone: "sky", icon: Table2, sparkline: spark(columns.map((_, i) => i)) },
    { label: "Trend series", value: trendSeries.length, change: data?.trends?.date_column ? `by ${data.trends.date_column}` : "No date column", tone: "violet", icon: TrendingUp, sparkline: spark(trendSeries[0]?.vals ?? [0, 0]) },
    { label: "Top correlation", value: corrPairs.length ? `${Math.abs(corrPairs[0].v).toFixed(2)}` : "—", change: corrPairs.length ? `${corrPairs[0].a} × ${corrPairs[0].b}` : "No pairs", tone: "amber", icon: GitCompare, sparkline: spark(corrPairs.map((p) => Math.abs(p.v))) },
    { label: "Segments", value: segments.length, change: dsName || "No dataset", tone: "emerald", icon: Database, sparkline: spark(segments.map((s) => s.value)) },
  ], [columns, numericCols, trendSeries, corrPairs, segments, data, dsName]);

  return (
    <div className="flex min-h-screen flex-col bg-[#08090B] lg:flex-row">
      <Nav />
      <main id="main" className="min-w-0 flex-1">
        <div className="relative mx-auto max-w-[1240px] px-5 pb-20 pt-8 lg:px-8 lg:pt-12">
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            <ShaderAurora className="opacity-[0.45]" speed={0.7} intensity={0.5} mouseInfluence={0.3} />
            <div className="orb orb-sky h-[340px] w-[380px] -right-[80px] -top-[40px] opacity-[0.14]" />
            <div className="orb orb-violet h-[280px] w-[320px] left-[24%] top-[300px] opacity-[0.10]" />
          </div>

          <header className="relative">
            <p className="fragment text-[10.5px] uppercase tracking-[0.2em] text-[#656B75]">Descriptive stats · trends · segments · correlations</p>
            <h1 className="display-hero mt-2 text-[36px] text-[#F5F7FA] lg:text-[48px]">Analytics <span className="thin text-[#9AA1AC]">of {dsName || "your data"}</span></h1>
            <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-[#9AA1AC]">Every column profiled, every trend traced — the statistical bedrock under your decisions.</p>
            <section aria-label="Key metrics" className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {metrics.map((m, i) => <MetricCard key={m.label} {...m} index={i} immersive />)}
            </section>
          </header>

          <div className="relative mt-10">
            {loading ? (
              <div className="space-y-4">{[0, 1, 2].map((i) => <SkeletonRow key={i} />)}</div>
            ) : error && !data ? (
              <div className="max-w-xl"><ErrorState {...error} actionLabel="Retry" onAction={load} /></div>
            ) : !data || columns.length === 0 ? (
              <Reveal>
                <EmptyState
                  icon={<Upload className="h-5 w-5" />}
                  title="No dataset to analyze yet"
                  body="Upload a CSV or XLSX and Decentra profiles every column — distributions, trends, segments and correlations appear here."
                  action={<Link href="/datasets" className="btn h-[38px] bg-[#F5F7FA] px-5 text-[13px] font-[600] text-[#08090B] hover:bg-white">Upload a dataset</Link>}
                />
              </Reveal>
            ) : (
              <div className="space-y-10">
                <section aria-label="Column profiles">
                  <SectionLabel>Column profiles · {columns.length}</SectionLabel>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {columns.map((c, i) => {
                      const s = describe[c] || {};
                      const mean = num(s.mean ?? s.avg);
                      const stats: Array<[string, any]> = [["min", s.min], ["mean", mean], ["max", s.max], ["unique", s.unique ?? s.n_unique ?? s.distinct]];
                      return (
                        <Reveal key={c} delay={Math.min(i * 0.04, 0.2)}>
                          <TiltCard max={4} className="h-full">
                            <div className="glass-strong h-full rounded-[18px] p-5">
                              <div className="flex items-center gap-2.5">
                                <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#38BDF8]/10 text-[#38BDF8]"><BarChart3 className="h-4 w-4" /></span>
                                <p className="truncate text-[14px] font-[650] text-[#F0F3F7]">{c}</p>
                              </div>
                              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5">
                                {stats.map(([k, v]) => (
                                  <div key={k}>
                                    <dt className="text-[10px] font-[600] uppercase tracking-[0.12em] text-[#656B75]">{k}</dt>
                                    <dd className="mono mt-0.5 text-[14px] font-[600] tabular-nums text-[#E5E9EF]">{fmt(v)}</dd>
                                  </div>
                                ))}
                              </dl>
                            </div>
                          </TiltCard>
                        </Reveal>
                      );
                    })}
                  </div>
                </section>

                {trendSeries.length > 0 && (
                  <section aria-label="Trends">
                    <SectionLabel>Trends{data?.trends?.date_column ? ` · by ${data.trends.date_column}` : ""}</SectionLabel>
                    <div className="mt-3 grid gap-4 lg:grid-cols-3">
                      {trendSeries.map((t, i) => (
                        <Reveal key={t.name} delay={i * 0.06}>
                          <TiltCard max={4} className="h-full">
                            <div className="glass-strong h-full rounded-[18px] p-5">
                              <p className="text-[13px] font-[650] text-[#F0F3F7]">{t.name}</p>
                              <p className="mono mt-1 text-[11px] text-[#656B75]">last {t.vals.length} periods · now {fmt(t.vals[t.vals.length - 1])}</p>
                              <div className="mt-2"><AreaChart data={spark(t.vals)} color="#A78BFA" /></div>
                            </div>
                          </TiltCard>
                        </Reveal>
                      ))}
                    </div>
                  </section>
                )}

                <div className="grid gap-10 lg:grid-cols-2">
                  {corrPairs.length > 0 && (
                    <section aria-label="Correlations">
                      <SectionLabel>Strongest correlations · Pearson</SectionLabel>
                      <div className="mt-3 space-y-2.5">
                        {corrPairs.map((p) => (
                          <div key={`${p.a}-${p.b}`} className="glass rounded-[14px] px-4 py-3.5">
                            <div className="flex items-center justify-between gap-3 text-[12.5px]">
                              <span className="min-w-0 truncate font-[550] text-[#E9EDF2]">{p.a} <span className="text-[#656B75]">×</span> {p.b}</span>
                              <span className={`mono shrink-0 font-[700] tabular-nums ${p.v >= 0 ? "text-[#34D399]" : "text-[#F87171]"}`}>{p.v >= 0 ? "+" : ""}{p.v.toFixed(2)}</span>
                            </div>
                            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                              <div className={`h-full rounded-full ${p.v >= 0 ? "bg-[#34D399]" : "bg-[#F87171]"}`} style={{ width: `${Math.min(Math.abs(p.v) * 100, 100)}%` }} />
                            </div>
                          </div>
                        ))}
                        <p className="text-[11px] text-[#656B75]">Correlations do not imply causality.</p>
                      </div>
                    </section>
                  )}

                  {segments.length > 0 && (
                    <section aria-label="Segmentation">
                      <SectionLabel>Segmentation · top groups</SectionLabel>
                      <div className="mt-3 space-y-2.5">
                        {segments.map((s) => (
                          <div key={s.label} className="glass rounded-[14px] px-4 py-3.5">
                            <div className="flex items-center justify-between gap-3 text-[12.5px]">
                              <span className="min-w-0 truncate font-[550] text-[#E9EDF2]">{s.label}</span>
                              <span className="mono shrink-0 font-[700] tabular-nums text-[#FBBF24]">{fmt(s.value)}</span>
                            </div>
                            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                              <div className="h-full rounded-full bg-gradient-to-r from-[#D4A574] to-[#FBBF24]" style={{ width: `${Math.max((s.value / segMax) * 100, 3)}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </div>

                <details className="glass rounded-[14px] p-4">
                  <summary className="cursor-pointer text-[12px] font-[500] text-[#9AA1AC] hover:text-[#F5F7FA]">Analyst raw view — full statistical payload</summary>
                  <pre className="mono mt-3 max-h-[320px] overflow-auto rounded-[10px] border border-white/[0.06] bg-[#0D0F12] p-4 text-[11.5px] text-[#9AA1AC]">{JSON.stringify(data, null, 2)}</pre>
                </details>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
