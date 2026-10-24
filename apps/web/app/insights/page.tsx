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
import { Lightbulb, AlertTriangle, TrendingUp, ShieldAlert, Upload } from "lucide-react";

const spark = (vals: number[]) => vals.map((y, x) => ({ x, y }));

const iconFor = (cat: string) => {
  if (cat === "TREND") return TrendingUp;
  if (cat === "RISK") return ShieldAlert;
  if (cat === "PERFORMANCE") return AlertTriangle;
  return Lightbulb;
};

export default function InsightsPage() {
  const [insights, setInsights] = useState<any[]>([]);
  const [dsName, setDsName] = useState("");
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState<string>("all");
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
      const r = await api(`/api/v1/datasets/${ds[0].id}/insights`);
      setInsights(r.insights || []);
    } catch (e: any) {
      setError({ title: "We couldn't load insights", reason: e?.message?.slice(0, 160) || "Check that the Decentra server is running." });
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const high = useMemo(() => insights.filter((i) => i.severity === "high"), [insights]);
  const cats = useMemo(() => Array.from(new Set(insights.map((i) => String(i.category || "GENERAL")))), [insights]);
  const shown = cat === "all" ? insights : insights.filter((i) => String(i.category || "GENERAL") === cat);

  const metrics = useMemo(() => [
    { label: "Signals", value: insights.length, change: dsName || "No dataset", tone: "sky", icon: Lightbulb, sparkline: spark(insights.map((_, i) => i)) },
    { label: "High severity", value: high.length, change: high.length ? "Needs a look" : "All calm", tone: high.length ? "amber" : "emerald", icon: AlertTriangle, sparkline: spark([insights.length, high.length]) },
    { label: "Categories", value: cats.length, change: cats.slice(0, 2).join(" · ") || "Trend · Risk · Performance", tone: "violet", icon: TrendingUp, sparkline: spark([cats.length, cats.length]) },
  ], [insights, high, cats, dsName]);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)] lg:flex-row">
      <Nav />
      <main id="main" className="min-w-0 flex-1">
        <div className="relative mx-auto max-w-[1240px] px-5 pb-20 pt-8 lg:px-8 lg:pt-12">
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            <ShaderAurora className="opacity-[0.45]" speed={0.7} intensity={0.5} mouseInfluence={0.3} />
            <div className="orb orb-sky h-[320px] w-[360px] -right-[80px] -top-[40px] opacity-[0.14]" />
            <div className="orb orb-amber h-[260px] w-[300px] left-[22%] top-[300px] opacity-[0.10]" />
          </div>

          <header className="relative">
            <p className="fragment text-[10.5px] uppercase tracking-[0.2em] text-[var(--subtle)]">Automated signals · evidence-backed</p>
            <h1 className="display-hero mt-2 text-[36px] text-[var(--text)] lg:text-[48px]">Insights <span className="thin text-[var(--muted)]">your data volunteers</span></h1>
            <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-[var(--muted)]">Machine-found, human-judged. Every signal carries its evidence — expand any card to inspect it.</p>
            <section aria-label="Key metrics" className="mt-8 grid gap-4 sm:grid-cols-3">
              {metrics.map((m, i) => <MetricCard key={m.label} {...m} index={i} immersive />)}
            </section>
          </header>

          <div className="relative mt-10">
            {loading ? (
              <div className="space-y-4">{[0, 1, 2].map((i) => <SkeletonRow key={i} />)}</div>
            ) : error && insights.length === 0 ? (
              <div className="max-w-xl"><ErrorState {...error} actionLabel="Retry" onAction={load} /></div>
            ) : insights.length === 0 ? (
              <Reveal>
                <EmptyState
                  icon={<Upload className="h-5 w-5" />}
                  title="No insights yet"
                  body="Upload a dataset and Decentra reads it for trends, risks and performance signals — each one backed by evidence."
                  action={<Link href="/datasets" className="btn h-[38px] bg-[var(--text)] px-5 text-[13px] font-[600] text-[var(--bg)] hover:bg-[var(--fg)]">Upload a dataset</Link>}
                />
              </Reveal>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  {(["all", ...cats] as string[]).map((c) => (
                    <button key={c} onClick={() => setCat(c)} className={`rounded-full border px-3.5 py-1.5 text-[12px] font-[600] transition ${cat === c ? "border-[var(--border-strong)] bg-[color-mix(in_srgb,var(--fg)_8%,transparent)] text-[var(--fg)]" : "border-[var(--border)] bg-[color-mix(in_srgb,var(--fg)_2%,transparent)] text-[var(--muted)] hover:text-[var(--fg)]"}`}>
                      {c === "all" ? `All ${insights.length}` : c}
                    </button>
                  ))}
                </div>
                <div className="mt-4 space-y-4">
                  {shown.map((ins: any, i: number) => {
                    const Icon = iconFor(ins.category);
                    const hot = ins.severity === "high";
                    return (
                      <Reveal key={i} delay={Math.min(i * 0.04, 0.2)}>
                        <TiltCard max={2} scale={1.005}>
                          <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-5 transition hover:bg-[var(--elevated)]">
                            <div className="flex gap-3.5">
                              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border ${hot ? "border-[color-mix(in_srgb,var(--amber-2)_20%,transparent)] bg-[color-mix(in_srgb,var(--amber-2)_15%,transparent)] text-[var(--amber-2)]" : "border-[var(--border)] bg-[color-mix(in_srgb,var(--fg)_6%,transparent)] text-[var(--muted)]"}`}>
                                <Icon className="h-5 w-5" aria-hidden="true" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="rounded-full bg-[var(--text)] px-2 py-1 text-[11px] font-[700] uppercase tracking-widest text-[var(--bg)]">{ins.category}</span>
                                  <span className={`rounded-full border px-2 py-1 text-[11px] font-[600] uppercase tracking-wide ${hot ? "border-[color-mix(in_srgb,var(--amber-2)_20%,transparent)] bg-[color-mix(in_srgb,var(--amber-2)_15%,transparent)] text-[var(--amber-2)]" : "border-[var(--border)] bg-[color-mix(in_srgb,var(--fg)_6%,transparent)] text-[var(--muted)]"}`}>{ins.severity}</span>
                                </div>
                                <div className="mt-3 text-[14px] font-[650] tracking-[-0.01em] text-[var(--text)]">{ins.title}</div>
                                <div className="mt-1.5 text-[13px] leading-relaxed text-[var(--muted)]">{ins.summary}</div>
                                <details className="mt-4">
                                  <summary className="cursor-pointer text-[12px] font-[500] text-[var(--muted)] hover:text-[var(--text)]">View evidence</summary>
                                  <pre className="mono mt-2 max-h-[240px] overflow-auto rounded-[10px] border border-[var(--border)] bg-[var(--bg-2)] p-3 text-[11.5px] text-[var(--muted)]">{JSON.stringify({ evidence: ins.evidence, explanation: ins.explanation }, null, 2)}</pre>
                                </details>
                              </div>
                            </div>
                          </div>
                        </TiltCard>
                      </Reveal>
                    );
                  })}
                  {shown.length === 0 && <p className="py-8 text-center text-[13px] text-[var(--subtle)]">Nothing in this category — try another.</p>}
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
