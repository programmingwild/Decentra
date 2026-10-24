"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Nav } from "@/components/nav";
import { api } from "@/lib/api";
import { MetricCard } from "@/components/ui/metrics";
import { TiltCard } from "@/components/immersive/3d/TiltCard";
import { Reveal } from "@/components/immersive/3d/Reveal";
const ShaderAurora = dynamic(() => import("@/components/immersive/3d/ShaderAurora").then((m) => m.ShaderAurora), { ssr: false });
import { EmptyState, ErrorState, SkeletonRow } from "@/components/ui/states";
import { TriangleAlert, Zap, ShieldAlert, Upload } from "lucide-react";

const spark = (vals: number[]) => vals.map((y, x) => ({ x, y }));
const num = (v: any) => (typeof v === "number" && isFinite(v) ? v : null);

export default function AnomaliesPage() {
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [dsName, setDsName] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "severe" | "moderate">("all");
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
      const r = await api(`/api/v1/datasets/${ds[0].id}/anomalies`);
      setAnomalies(r.anomalies || []);
    } catch (e: any) {
      setError({ title: "We couldn't load anomalies", reason: e?.message?.slice(0, 160) || "Check that the Decentra server is running." });
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const severe = useMemo(() => anomalies.filter((a) => (num(a.deviation_pct) ?? 0) > 30), [anomalies]);
  const methods = useMemo(() => Array.from(new Set(anomalies.map((a) => String(a.method || "unknown")))), [anomalies]);
  const maxDev = useMemo(() => Math.max(...anomalies.map((a) => Math.abs(num(a.deviation_pct) ?? 0)), 0), [anomalies]);
  const shown = filter === "all" ? anomalies : filter === "severe" ? severe : anomalies.filter((a) => (num(a.deviation_pct) ?? 0) <= 30);

  const metrics = useMemo(() => [
    { label: "Flagged", value: anomalies.length, change: dsName || "No dataset", tone: anomalies.length ? "red" : "emerald", icon: TriangleAlert, sparkline: spark(anomalies.map((a) => Math.abs(num(a.deviation_pct) ?? 0))) },
    { label: "Severe", value: severe.length, change: "> 30% deviation", tone: "amber", icon: Zap, sparkline: spark(severe.map((a) => Math.abs(num(a.deviation_pct) ?? 0))) },
    { label: "Methods", value: methods.length, change: methods.slice(0, 2).join(" · ") || "z-score · IQR · Isolation Forest", tone: "sky", icon: ShieldAlert, sparkline: spark([methods.length, methods.length]) },
  ], [anomalies, severe, methods, dsName]);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)] lg:flex-row">
      <Nav />
      <main id="main" className="min-w-0 flex-1">
        <div className="relative mx-auto max-w-[1240px] px-5 pb-20 pt-8 lg:px-8 lg:pt-12">
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            <ShaderAurora className="opacity-[0.45]" speed={0.7} intensity={0.5} mouseInfluence={0.3} />
            <div className="orb orb-amber h-[320px] w-[360px] -right-[80px] -top-[40px] opacity-[0.12]" />
            <div className="orb orb-sky h-[260px] w-[300px] left-[22%] top-[280px] opacity-[0.10]" />
          </div>

          <header className="relative">
            <p className="fragment text-[10.5px] uppercase tracking-[0.2em] text-[var(--subtle)]">z-score · IQR · Isolation Forest · with evidence</p>
            <h1 className="display-hero mt-2 text-[36px] text-[var(--text)] lg:text-[48px]">Anomalies <span className="thin text-[var(--muted)]">that refuse to hide</span></h1>
            <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-[var(--muted)]">Outliers surface with expected-vs-observed evidence — never a black box, always a trace.</p>
            <section aria-label="Key metrics" className="mt-8 grid gap-4 sm:grid-cols-3">
              {metrics.map((m, i) => <MetricCard key={m.label} {...m} index={i} immersive />)}
            </section>
          </header>

          <div className="relative mt-10">
            {loading ? (
              <div className="space-y-4">{[0, 1, 2].map((i) => <SkeletonRow key={i} />)}</div>
            ) : error && anomalies.length === 0 ? (
              <div className="max-w-xl"><ErrorState {...error} actionLabel="Retry" onAction={load} /></div>
            ) : anomalies.length === 0 ? (
              <Reveal>
                <EmptyState
                  icon={<Upload className="h-5 w-5" />}
                  title="No anomalies detected"
                  body="Upload a dataset and three detection methods sweep every column for the points that don't belong."
                  action={<Link href="/datasets" className="btn h-[38px] bg-[var(--text)] px-5 text-[13px] font-[600] text-[var(--bg)] hover:bg-[var(--fg)]">Upload a dataset</Link>}
                />
              </Reveal>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  {(["all", "severe", "moderate"] as const).map((f) => (
                    <button key={f} onClick={() => setFilter(f)} className={`rounded-full border px-3.5 py-1.5 text-[12px] font-[600] transition ${filter === f ? "border-[var(--border-strong)] bg-[color-mix(in_srgb,var(--fg)_8%,transparent)] text-[var(--fg)]" : "border-[var(--border)] bg-[color-mix(in_srgb,var(--fg)_2%,transparent)] text-[var(--muted)] hover:text-[var(--fg)]"}`}>
                      {f === "all" ? `All ${anomalies.length}` : f === "severe" ? `Severe ${severe.length}` : `Moderate ${anomalies.length - severe.length}`}
                    </button>
                  ))}
                  <span className="fragment ml-auto hidden text-[10px] uppercase tracking-[0.16em] text-[var(--subtle)] sm:block">Max deviation {maxDev.toFixed(1)}%</span>
                </div>
                <div className="mt-4 space-y-3">
                  {shown.map((a: any, i: number) => {
                    const dev = num(a.deviation_pct) ?? 0;
                    const hot = dev > 30;
                    return (
                      <Reveal key={i} delay={Math.min(i * 0.04, 0.2)}>
                        <TiltCard max={2} scale={1.005}>
                          <div className={`flex items-center justify-between gap-4 rounded-[16px] border px-4 py-3.5 transition ${hot ? "border-[color-mix(in_srgb,var(--red-2)_20%,transparent)] bg-[color-mix(in_srgb,var(--red-2)_5%,transparent)]" : "border-[var(--border)] bg-[var(--surface)]"}`}>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2 text-[13px] font-[600] text-[var(--text)]">
                                {a.column}
                                <span className="rounded-full border border-[var(--border)] bg-[color-mix(in_srgb,var(--fg)_5%,transparent)] px-1.5 py-0.5 text-[10px] font-[700] uppercase tracking-wide text-[var(--muted)]">{a.method}</span>
                              </div>
                              <div className="mt-1 text-[11.5px] text-[var(--subtle)]">
                                Expected <span className="font-[500] text-[var(--muted)]">{num(a.expected_min)?.toFixed?.(0) ?? "—"} – {num(a.expected_max)?.toFixed?.(0) ?? "—"}</span> · Observed <span className="font-[600] text-[var(--text)]">{Number(a.value).toLocaleString()}</span>
                              </div>
                            </div>
                            <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-[700] tabular-nums ${hot ? "border-[color-mix(in_srgb,var(--red-2)_20%,transparent)] bg-[color-mix(in_srgb,var(--red-2)_15%,transparent)] text-[var(--red-2)]" : "border-[color-mix(in_srgb,var(--amber-2)_20%,transparent)] bg-[color-mix(in_srgb,var(--amber-2)_15%,transparent)] text-[var(--amber-2)]"}`}>{dev > 0 ? "+" : ""}{dev.toFixed?.(1) ?? "—"}%</span>
                          </div>
                        </TiltCard>
                      </Reveal>
                    );
                  })}
                  {shown.length === 0 && <p className="py-8 text-center text-[13px] text-[var(--subtle)]">Nothing in this band — try another filter.</p>}
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
