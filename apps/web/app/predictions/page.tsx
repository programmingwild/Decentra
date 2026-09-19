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
import { Target, TrendingUp, Activity, Upload } from "lucide-react";

const spark = (vals: number[]) => vals.map((y, x) => ({ x, y }));
const num = (v: any) => (typeof v === "number" && isFinite(v) ? v : null);

export default function PredictionsPage() {
  const [fc, setFc] = useState<any>(null);
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
      const r = await api(`/api/v1/datasets/${ds[0].id}/predictions?horizon=6`);
      setFc(r);
    } catch (e: any) {
      setError({ title: "We couldn't load predictions", reason: e?.message?.slice(0, 160) || "Check that the Decentra server is running." });
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const rows: any[] = Array.isArray(fc?.forecast) ? fc.forecast : [];
  const predicted = rows.map((r) => num(r?.predicted)).filter((v): v is number => v !== null);
  const rmse = num(fc?.evaluation?.rmse);
  const last = predicted[predicted.length - 1];
  const first = predicted[0];
  const lift = last !== undefined && first ? ((last - first) / Math.abs(first)) * 100 : null;

  const metrics = useMemo(() => [
    { label: "Target", value: rows.length, change: fc?.target ? `Forecasting ${fc.target}` : "No forecast", tone: "sky", icon: Target, sparkline: spark(predicted.length ? predicted : [0, 0]) },
    { label: "Model RMSE", value: rmse !== null && rmse !== undefined ? Math.round(rmse * 10) / 10 : 0, change: fc?.model ? `Model: ${fc.model}` : "No model", tone: "violet", icon: Activity, sparkline: spark([rmse ?? 0, rmse ?? 0]) },
    { label: "Horizon", value: fc?.horizon ?? rows.length, change: lift !== null ? `${lift >= 0 ? "+" : ""}${lift.toFixed(1)}% end-to-end` : `${rows.length} periods`, tone: lift !== null && lift >= 0 ? "emerald" : "amber", icon: TrendingUp, sparkline: spark(predicted.length ? predicted : [0, 0]) },
  ], [fc, rows, predicted, rmse, lift]);

  return (
    <div className="flex min-h-screen flex-col bg-[#08090B] lg:flex-row">
      <Nav />
      <main id="main" className="min-w-0 flex-1">
        <div className="relative mx-auto max-w-[1240px] px-5 pb-20 pt-8 lg:px-8 lg:pt-12">
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            <ShaderAurora className="opacity-[0.45]" speed={0.7} intensity={0.5} mouseInfluence={0.3} />
            <div className="orb orb-violet h-[340px] w-[380px] -right-[80px] -top-[40px] opacity-[0.14]" />
            <div className="orb orb-amber h-[260px] w-[300px] left-[20%] top-[280px] opacity-[0.10]" />
          </div>

          <header className="relative">
            <p className="fragment text-[10.5px] uppercase tracking-[0.2em] text-[#656B75]">Forecasts · with honest uncertainty</p>
            <h1 className="display-hero mt-2 text-[36px] text-[#F5F7FA] lg:text-[48px]">Predictions <span className="thin text-[#9AA1AC]">{fc?.target ? `for ${fc.target}` : "of what's next"}</span></h1>
            <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-[#9AA1AC]">Every forecast ships with its error bars. Ranges are promises about uncertainty — not decoration.</p>
            <section aria-label="Key metrics" className="mt-8 grid gap-4 sm:grid-cols-3">
              {metrics.map((m, i) => <MetricCard key={m.label} {...m} index={i} immersive />)}
            </section>
          </header>

          <div className="relative mt-10">
            {loading ? (
              <div className="space-y-4">{[0, 1, 2].map((i) => <SkeletonRow key={i} />)}</div>
            ) : error && !fc ? (
              <div className="max-w-xl"><ErrorState {...error} actionLabel="Retry" onAction={load} /></div>
            ) : rows.length === 0 ? (
              <Reveal>
                <EmptyState
                  icon={<Upload className="h-5 w-5" />}
                  title={fc?.message || "No forecast yet"}
                  body="Upload a dataset with a date column and Decentra will project the next periods — with RMSE and uncertainty bands."
                  action={<Link href="/datasets" className="btn h-[38px] bg-[#F5F7FA] px-5 text-[13px] font-[600] text-[#08090B] hover:bg-white">Upload a dataset</Link>}
                />
              </Reveal>
            ) : (
              <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
                <Reveal>
                  <TiltCard max={3} className="h-full">
                    <div className="glass-strong h-full overflow-hidden rounded-[20px]">
                      <div className="border-b border-white/[0.06] px-5 py-4">
                        <p className="text-[14px] font-[650] text-[#F0F3F7]">Revenue Forecast · {fc.target}</p>
                        <p className="fragment mt-1 text-[11px] text-[#656B75]">MODEL {fc.model} · RMSE {rmse?.toFixed?.(2) ?? "—"} · NEXT {fc.horizon} PERIODS</p>
                      </div>
                      <table className="w-full text-[13px]">
                        <thead>
                          <tr className="border-b border-white/[0.06] text-left text-[11px] font-[600] uppercase tracking-widest text-[#656B75]">
                            <th className="px-5 py-2.5">Period</th>
                            <th className="py-2.5">Predicted</th>
                            <th className="py-2.5 pr-5">Range</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((r: any, i: number) => (
                            <tr key={r.period ?? i} className="border-t border-white/[0.06] transition first:border-0 hover:bg-white/[0.02]">
                              <td className="px-5 py-3 font-[500] text-[#F5F7FA]">{r.period}</td>
                              <td className="mono font-[600] tabular-nums text-[#F5F7FA]">{num(r.predicted)?.toFixed(1) ?? "—"}</td>
                              <td className="mono py-3 pr-5 text-[12px] tabular-nums text-[#9AA1AC]">{num(r.lower)?.toFixed(0) ?? "—"} – {num(r.upper)?.toFixed(0) ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {fc.uncertainty_note && (
                        <div className="mx-5 mb-5 rounded-[10px] border border-[#F59E0B]/15 bg-[#F59E0B]/10 px-3 py-2.5 text-[12px] leading-relaxed text-[#F59E0B]">{fc.uncertainty_note}</div>
                      )}
                    </div>
                  </TiltCard>
                </Reveal>
                <Reveal delay={0.08}>
                  <TiltCard max={4} className="h-full">
                    <div className="glass-strong h-full rounded-[20px] p-5">
                      <p className="text-[13px] font-[650] text-[#F0F3F7]">Trajectory</p>
                      <p className="mono mt-1 text-[11px] text-[#656B75]">{lift !== null ? `${lift >= 0 ? "▲" : "▼"} ${Math.abs(lift).toFixed(1)}% across horizon` : "Predicted path"}</p>
                      <div className="mt-3"><AreaChart data={spark(predicted)} color="#A78BFA" /></div>
                      <div className="mt-4 space-y-2.5 border-t border-white/[0.06] pt-4 text-[12.5px]">
                        <div className="flex justify-between"><span className="text-[#656B75]">First period</span><span className="mono font-[600] tabular-nums text-[#E5E9EF]">{first?.toFixed(1)}</span></div>
                        <div className="flex justify-between"><span className="text-[#656B75]">Last period</span><span className="mono font-[600] tabular-nums text-[#E5E9EF]">{last?.toFixed(1)}</span></div>
                        <div className="flex justify-between"><span className="text-[#656B75]">Model error (RMSE)</span><span className="mono font-[600] tabular-nums text-[#E5E9EF]">{rmse?.toFixed(2) ?? "—"}</span></div>
                      </div>
                    </div>
                  </TiltCard>
                </Reveal>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
