"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Nav } from "@/components/nav";
import { api } from "@/lib/api";
import { humanizeKey } from "@/lib/format";
import { MetricCard } from "@/components/ui/metrics";
import { TiltCard } from "@/components/immersive/3d/TiltCard";
import { Reveal } from "@/components/immersive/3d/Reveal";
const ShaderAurora = dynamic(() => import("@/components/immersive/3d/ShaderAurora").then((m) => m.ShaderAurora), { ssr: false });
import { EmptyState, ErrorState, SkeletonRow } from "@/components/ui/states";
import { Sparkles, Target, CheckCircle2, Upload, ArrowUpRight } from "lucide-react";

const spark = (vals: number[]) => vals.map((y, x) => ({ x, y }));

export default function RecommendationsPage() {
  const [recs, setRecs] = useState<any[]>([]);
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
      const r = await api(`/api/v1/datasets/${ds[0].id}/recommendations`);
      setRecs(r.recommendations || []);
    } catch (e: any) {
      setError({ title: "We couldn't load recommendations", reason: e?.message?.slice(0, 160) || "Check that the Decentra server is running." });
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const high = useMemo(() => recs.filter((r) => String(r.priority || "").toLowerCase() === "high"), [recs]);

  const metrics = useMemo(() => [
    { label: "Open recommendations", value: recs.length, change: dsName || "No dataset", tone: "sky", icon: Sparkles, sparkline: spark(recs.map((_, i) => i)) },
    { label: "High priority", value: high.length, change: high.length ? "Act first here" : "Nothing urgent", tone: high.length ? "amber" : "emerald", icon: Target, sparkline: spark([recs.length, high.length]) },
    { label: "With evidence", value: recs.filter((r) => r.evidence).length, change: "Grounded, not guessed", tone: "violet", icon: CheckCircle2, sparkline: spark([recs.length, recs.filter((r) => r.evidence).length]) },
  ], [recs, high, dsName]);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)] lg:flex-row">
      <Nav />
      <main id="main" className="min-w-0 flex-1">
        <div className="relative mx-auto max-w-[1240px] px-5 pb-20 pt-8 lg:px-8 lg:pt-12">
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            <ShaderAurora className="opacity-[0.45]" speed={0.7} intensity={0.5} mouseInfluence={0.3} />
            <div className="orb orb-violet h-[320px] w-[360px] -right-[80px] -top-[40px] opacity-[0.14]" />
            <div className="orb orb-sky h-[260px] w-[300px] left-[22%] top-[300px] opacity-[0.10]" />
          </div>

          <header className="relative">
            <p className="fragment text-[10.5px] uppercase tracking-[0.2em] text-[var(--subtle)]">Prioritized attention · evidence strength</p>
            <h1 className="display-hero mt-2 text-[36px] text-[var(--text)] lg:text-[48px]">Recommendations <span className="thin text-[var(--muted)]">worth acting on</span></h1>
            <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-[var(--muted)]">Ranked by impact, each with the evidence behind it and the action ahead of it.</p>
            <section aria-label="Key metrics" className="mt-8 grid gap-4 sm:grid-cols-3">
              {metrics.map((m, i) => <MetricCard key={m.label} {...m} index={i} immersive />)}
            </section>
          </header>

          <div className="relative mt-10">
            {loading ? (
              <div className="space-y-4">{[0, 1, 2].map((i) => <SkeletonRow key={i} />)}</div>
            ) : error && recs.length === 0 ? (
              <div className="max-w-xl"><ErrorState {...error} actionLabel="Retry" onAction={load} /></div>
            ) : recs.length === 0 ? (
              <Reveal>
                <EmptyState
                  icon={<Sparkles className="h-5 w-5" />}
                  title="No recommendations — all signals nominal"
                  body="Upload a dataset and Decentra prioritizes exactly where your attention pays off, with evidence attached to each call."
                  action={<Link href="/datasets" className="btn h-[38px] bg-[var(--text)] px-5 text-[13px] font-[600] text-[var(--bg)] hover:bg-[var(--fg)]">Upload a dataset</Link>}
                />
              </Reveal>
            ) : (
              <>
                <p className="fragment text-[11px] font-[700] uppercase tracking-[0.16em] text-[var(--subtle)]">{recs.length} area{recs.length === 1 ? "" : "s"} deserve{recs.length === 1 ? "s" : ""} attention</p>
                <div className="mt-4 space-y-4">
                  {recs.map((r: any, i: number) => {
                    const hot = String(r.priority || "").toLowerCase() === "high";
                    return (
                      <Reveal key={i} delay={Math.min(i * 0.04, 0.2)}>
                        <TiltCard max={2} scale={1.005}>
                          <div className={`rounded-[18px] border p-5 ${hot ? "border-[color-mix(in_srgb,var(--amber-2)_25%,transparent)] bg-[color-mix(in_srgb,var(--amber-2)_5%,transparent)]" : "border-[var(--border)] bg-[var(--surface)]"}`}>
                            <div className="flex flex-wrap items-center gap-2 text-[11px] font-[700] uppercase tracking-widest text-[var(--muted)]">
                              <span className="mono text-[var(--subtle)]">0{i + 1}</span>
                              <span className={`rounded-full border px-2 py-0.5 ${hot ? "border-[color-mix(in_srgb,var(--amber-2)_30%,transparent)] bg-[color-mix(in_srgb,var(--amber-2)_15%,transparent)] text-[var(--amber)]" : "border-[var(--border)] bg-[color-mix(in_srgb,var(--fg)_4%,transparent)] text-[var(--muted)]"}`}>Priority: {humanizeKey(r.priority) || "Normal"}</span>
                              {r.evidence && <span className="inline-flex items-center gap-1 text-[var(--emerald)]"><CheckCircle2 className="h-3.5 w-3.5" /> Evidence strong</span>}
                            </div>
                            <p className="mt-2.5 text-[14.5px] font-[650] leading-snug tracking-[-0.01em] text-[var(--text)]">{r.observation}</p>
                            <div className="mt-3.5 flex gap-2.5 rounded-[12px] border border-[color-mix(in_srgb,var(--sky-2)_15%,transparent)] bg-[color-mix(in_srgb,var(--sky-2)_10%,transparent)] p-3.5 text-[12.5px] leading-relaxed text-[var(--text-soft)]">
                              <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-[var(--sky)]" />
                              <span>{r.action}</span>
                            </div>
                          </div>
                        </TiltCard>
                      </Reveal>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
