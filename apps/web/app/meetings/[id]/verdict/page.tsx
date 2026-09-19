"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Nav } from "@/components/nav";
import { api } from "@/lib/api";
import { PageHero } from "@/components/ui/page-hero";
import { Reveal } from "@/components/immersive/3d/Reveal";
import { ShaderAurora } from "@/components/immersive/3d/ShaderAurora";
import { TiltCard } from "@/components/immersive/3d/TiltCard";
import { EmptyState, ErrorState, SkeletonRow } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { ArrowLeft, Copy, Check, Ban, Zap, Mail } from "lucide-react";

const VERDICT_STYLE: Record<string, { color: string; bg: string; border: string; headline: string }> = {
  MEET: { color: "#34D399", bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.25)", headline: "Hold this meeting." },
  ASYNC: { color: "#FBBF24", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.25)", headline: "Don't meet. Run it async." },
  SKIP: { color: "#F87171", bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.25)", headline: "Cancel it." },
};

function ScoreRing({ score, color }: { score: number; color: string }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-[136px] w-[136px] shrink-0" role="img" aria-label={`Need score ${score} of 100`}>
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="9" />
        <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (c * score) / 100} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[32px] font-[800] tabular-nums text-[#F5F7FA]">{score}</span>
        <span className="fragment text-[9px] uppercase tracking-[0.18em] text-[#656B75]">need score</span>
      </div>
    </div>
  );
}

export default function VerdictPage() {
  const params = useParams() as any;
  const id = params.id as string;
  const { toast } = useToast();
  const [data, setData] = useState<any>(null);
  const [brief, setBrief] = useState<any>(null);
  const [role, setRole] = useState("lead");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ title: string; reason: string } | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const v = await api(`/api/v1/meetings/${id}/elimination`);
      setData(v);
      setBrief(await api(`/api/v1/meetings/${id}/brief?role=${role}`).catch(() => null));
    } catch (e: any) {
      setError({ title: "We couldn't score this meeting", reason: e?.message?.slice(0, 160) || "Check that the Decentra server is running." });
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, [id]);

  async function switchRole(r: string) {
    setRole(r);
    try {
      setBrief(await api(`/api/v1/meetings/${id}/brief?role=${r}`));
    } catch {}
  }

  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(data?.async_draft || "");
      setCopied(true);
      toast("Async thread copied — paste it where the invite was", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("Copy failed — select the text manually", "error");
    }
  }

  const v = data ? VERDICT_STYLE[data.verdict] || VERDICT_STYLE.MEET : null;

  return (
    <div className="flex min-h-screen flex-col bg-[#08090B] lg:flex-row">
      <Nav />
      <main id="main" className="min-w-0 flex-1">
        <div className="relative mx-auto max-w-[980px] px-5 pb-20 pt-8 lg:px-8 lg:pt-12">
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            <ShaderAurora className="opacity-[0.4]" speed={0.7} intensity={0.5} mouseInfluence={0.3} />
            <div className="orb orb-amber h-[300px] w-[340px] -right-[60px] top-[40px] opacity-[0.12]" />
          </div>

          <Link href={`/meetings/${id}`} className="relative inline-flex items-center gap-1.5 text-[12.5px] font-[550] text-[#656B75] transition hover:text-white">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back to meeting
          </Link>

          <div className="relative mt-4">
            {loading ? (
              <div className="space-y-4">{[0, 1, 2].map((i) => <SkeletonRow key={i} />)}</div>
            ) : error && !data ? (
              <div className="max-w-xl"><ErrorState {...error} actionLabel="Retry" onAction={load} /></div>
            ) : data && v ? (
              <div className="space-y-8">
                <PageHero
                  kicker="Prevention layer · should this exist"
                  title={<>Elimination <span className="thin text-[#9AA1AC]">verdict</span></>}
                  sub={<>For <span className="font-[600] text-[#E9EDF2]">{data.title}</span> · {data.attendee_count} people · {data.duration_min} min</>}
                />

                <Reveal>
                  <TiltCard max={3}>
                    <div className="glass-strong flex flex-col items-center gap-6 rounded-[22px] p-7 sm:flex-row sm:gap-8" style={{ borderColor: v.border }}>
                      <ScoreRing score={data.need_score} color={v.color} />
                      <div className="min-w-0 flex-1 text-center sm:text-left">
                        <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-[700] tracking-widest" style={{ color: v.color, borderColor: v.border, background: v.bg }}>
                          {data.verdict === "MEET" ? <Zap className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />} {data.verdict === "MEET" ? "MEET" : data.verdict === "ASYNC" ? "ASYNC IT" : "SKIP IT"}
                        </span>
                        <p className="mt-3 text-[22px] font-[750] tracking-[-0.02em] text-[#F5F7FA]">{v.headline}</p>
                        <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#9AA1AC]">{data.guidance}</p>
                        {data.hours_saved > 0 && (
                          <p className="mono mt-2 text-[12px] tabular-nums text-[#34D399]">−{data.hours_saved}h reclaimed if cancelled</p>
                        )}
                      </div>
                    </div>
                  </TiltCard>
                </Reveal>

                <section aria-label="Why">
                  <p className="fragment text-[10px] uppercase tracking-[0.18em] text-[#656B75]">Why · every reason carries its score</p>
                  <div className="mt-3 space-y-2.5">
                    {data.reasons.map((r: any, i: number) => (
                      <Reveal key={i} delay={Math.min(i * 0.04, 0.2)}>
                        <div className="glass rounded-[14px] px-4 py-3.5">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-[13px] leading-snug text-[#DDE2E9]">{r.detail}</p>
                            <span className={`mono shrink-0 text-[12px] font-[700] tabular-nums ${r.impact >= 0 ? "text-[#34D399]" : "text-[#F87171]"}`}>
                              {r.impact >= 0 ? "+" : ""}{r.impact}
                            </span>
                          </div>
                          <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                            <div className={`h-full rounded-full ${r.impact >= 0 ? "bg-[#34D399]" : "bg-[#F87171]"}`} style={{ width: `${Math.min(Math.abs(r.impact) * 4, 100)}%` }} />
                          </div>
                        </div>
                      </Reveal>
                    ))}
                  </div>
                </section>

                {data.verdict !== "MEET" && (
                  <section aria-label="Async replacement">
                    <p className="fragment text-[10px] uppercase tracking-[0.18em] text-[#656B75]">Run this instead · copy-paste ready</p>
                    <div className="glass-strong mt-3 rounded-[18px] p-5">
                      <pre className="whitespace-pre-wrap text-[13px] leading-relaxed text-[#C7CCD4]">{data.async_draft}</pre>
                      <button onClick={copyDraft} className="btn mt-4 h-[36px] gap-1.5 bg-[#F5F7FA] px-4 text-[12.5px] font-[600] text-[#08090B] hover:bg-white">
                        {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                        {copied ? "Copied" : "Copy async thread"}
                      </button>
                    </div>
                  </section>
                )}

                <section aria-label="Personal digest">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="fragment flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-[#656B75]"><Mail className="h-3.5 w-3.5" /> 3-bullet digest</p>
                    <div className="flex gap-1.5">
                      {(["lead", "owner", "default"] as const).map((r) => (
                        <button key={r} onClick={() => switchRole(r)} className={`rounded-full border px-3 py-1.5 text-[11.5px] font-[600] capitalize transition ${role === r ? "border-white/[0.16] bg-white/[0.08] text-white" : "border-white/[0.08] text-[#9AA1AC] hover:text-white"}`}>
                          {r === "default" ? "Everyone" : r}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mt-3 space-y-2.5">
                    {(brief?.bullets || []).map((b: string, i: number) => (
                      <div key={i} className="glass flex gap-3 rounded-[14px] px-4 py-3.5">
                        <span className="mono shrink-0 text-[12px] font-[700] text-[#D4A574]">0{i + 1}</span>
                        <p className="text-[13.5px] leading-relaxed text-[#E9EDF2]">{b}</p>
                      </div>
                    ))}
                    {(!brief || !brief.bullets?.length) && (
                      <EmptyState title="No digest yet" body="Process this meeting first — the digest is distilled from its decisions, actions and questions." />
                    )}
                  </div>
                </section>
              </div>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
