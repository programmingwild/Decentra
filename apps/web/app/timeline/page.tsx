"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Nav } from "@/components/nav";
import { fmtDateLong } from "@/lib/format";
import { DecisionPill } from "@/components/ui/primitives";
import { SkeletonRow } from "@/components/ui/states";
import Link from "next/link";
import dynamic from "next/dynamic";

// Lazy: keeps three.js out of this route's initial bundle.
const HelixScene = dynamic(() => import("@/components/immersive/3d/HelixScene").then((m) => m.HelixScene), {
  ssr: false,
  loading: () => <div className="absolute inset-0" aria-hidden="true" />,
});

export default function TimelinePage() {
  const [timeline, setTimeline] = useState<any[]>([]);
  const [ledger, setLedger] = useState<any[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [scroll, setScroll] = useState(0);
  const [sel, setSel] = useState<any | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const orgs = await api("/api/v1/organizations");
        if (!orgs?.[0]) return;
        const oid = orgs[0].id;
        const [mem, led, h] = await Promise.all([
          api(`/api/v1/memory?org_id=${oid}&limit=18`).catch(() => ({ timeline: [] })),
          api(`/api/v1/ledger?org_id=${oid}`).catch(() => ({ ledger: [] })),
          api(`/api/v1/health/score?org_id=${oid}`).catch(() => null),
        ]);
        setTimeline(mem.timeline || []);
        setLedger(led.ledger || []);
        setHealth(h);
      } catch {}
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    const onScroll = () => setScroll(window.scrollY / 1200);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)] lg:flex-row">
      <Nav />
      <main className="min-w-0 flex-1">
        <div className="relative h-[42vh] overflow-hidden border-b border-[var(--border)]">
          <HelixScene count={Math.max(timeline.length, 7)} scroll={scroll} />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[var(--bg)] via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-5 lg:p-8">
            <p className="fragment text-[10px] uppercase tracking-[0.18em] text-[var(--fg)]/50">Immersive · Commitment Graph</p>
            <h1 className="display-hero mt-1 text-[30px] text-[var(--fg)] lg:text-[40px]">Timeline <span className="thin text-[var(--fg)]/60">of commitments</span></h1>
            <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-[var(--fg)]/60">Every confirmed decision is an immutable obligation. Scroll to orbit the helix — each node is a decision, color is strength.</p>
          </div>
        </div>

        <div className="mx-auto max-w-[980px] px-5 py-8 lg:px-8">
          {health && (
            <div className="glass flex flex-wrap items-center gap-4 rounded-[16px] p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border-2" style={{ borderColor: health.level === "high" ? "#10B981" : health.level === "medium" ? "#F59E0B" : "#EF4444", color: health.level === "high" ? "#10B981" : health.level === "medium" ? "#F59E0B" : "#EF4444" }}>
                <span className="text-[16px] font-[800]">{health.health}</span>
              </div>
              <div>
                <div className="text-[13px] font-[600] text-[var(--text)]">Org health {health.level}</div>
                <div className="text-[11px] text-[var(--muted)]">{health.metrics.confirmed_rate}% decisions confirmed · {health.metrics.completed_rate}% actions done · {health.metrics.overdue} overdue</div>
              </div>
              <div className="ml-auto hidden gap-2 sm:flex">
                <span className="rounded-full bg-[color-mix(in_srgb,var(--fg)_6%,transparent)] px-2.5 py-1 text-[11px] text-[var(--muted)]">{health.metrics.total_decisions} decisions</span>
                <span className="rounded-full bg-[color-mix(in_srgb,var(--fg)_6%,transparent)] px-2.5 py-1 text-[11px] text-[var(--muted)]">{health.metrics.total_actions} actions</span>
              </div>
            </div>
          )}

          <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <section>
              <h2 className="fragment text-[11px] uppercase tracking-[0.14em] text-[var(--subtle)]">Memory — cross-meeting decisions</h2>
              {loading ? <div className="mt-3 space-y-2">{[0,1,2].map(i=> <SkeletonRow key={i} />)}</div> : timeline.length===0 ? <p className="mt-3 text-[13px] text-[var(--subtle)]">No decisions yet.</p> : (
                <div className="mt-3 space-y-2">
                  {timeline.map((d) => (
                    <button key={d.id} onClick={()=> setSel(d)} className={`w-full text-left rounded-[14px] border p-4 text-left transition ${sel?.id===d.id ? "glass-strong border-[var(--border-strong)]" : "glass-subtle hover:bg-[color-mix(in_srgb,var(--fg)_4%,transparent)]"}`}>
                      <div className="flex items-center gap-2"><DecisionPill status={d.status} /><span className={`h-1.5 w-1.5 rounded-full ${d.strength?.level==="high"?"bg-[var(--emerald-2)]":d.strength?.level==="medium"?"bg-[var(--amber-2)]":"bg-[var(--subtle)]"}`} /><span className="text-[11px] text-[var(--muted)]">{d.strength?.score} · {d.strength?.level}</span></div>
                      <p className="mt-2 text-[13.5px] font-[600] leading-snug text-[var(--text)]">{d.title}</p>
                      <p className="mt-1 text-[11px] text-[var(--subtle)]">{d.meeting_title} · {fmtDateLong(d.meeting_date)} · {d.evidence_segment_ids?.length || 0} moments</p>
                    </button>
                  ))}
                </div>
              )}
            </section>
            <section>
              <h2 className="fragment text-[11px] uppercase tracking-[0.14em] text-[var(--subtle)]">Ledger — immutable obligations</h2>
              {ledger.length===0 ? <p className="mt-3 text-[13px] text-[var(--subtle)]">No confirmed decisions yet.</p> : (
                <div className="mt-3 space-y-2">
                  {ledger.slice(0,8).map((l) => (
                    <Link key={l.id} href={`/meetings/${l.meeting_id}`} className="block rounded-[14px] border border-[color-mix(in_srgb,var(--emerald-2)_15%,transparent)] bg-[color-mix(in_srgb,var(--emerald-2)_6%,transparent)] p-4 hover:bg-[color-mix(in_srgb,var(--emerald-2)_9%,transparent)] transition">
                      <p className="text-[13px] font-[600] text-[var(--text)]">{l.title}</p>
                      <p className="mt-1 text-[11px] text-[var(--muted)]">{l.meeting_title} · confirmed {fmtDateLong(l.confirmed_at)} {l.confirmed_by ? `by ${l.confirmed_by.split("@")[0]}` : ""}</p>
                    </Link>
                  ))}
                </div>
              )}
              {sel && (
                <div className="glass-strong mt-6 rounded-[16px] p-4">
                  <p className="fragment text-[10px] uppercase tracking-[0.14em] text-[var(--subtle)]">Selected · Evidence strength</p>
                  <p className="mt-1 text-[14px] font-[600] text-[var(--text)]">{sel.title}</p>
                  <div className="mt-2 flex items-center gap-2 text-[11px]"><span className={`rounded-full px-2 py-0.5 font-[700] ${sel.strength?.level==="high"?"bg-[color-mix(in_srgb,var(--emerald-2)_15%,transparent)] text-[var(--emerald-2)]":sel.strength?.level==="medium"?"bg-[color-mix(in_srgb,var(--amber-2)_15%,transparent)] text-[var(--amber-2)]":"bg-[var(--fg)]/10 text-[var(--muted)]"}`}>{sel.strength?.score} {sel.strength?.level}</span><span className="text-[var(--subtle)]">{sel.strength?.factors?.join(" · ")}</span></div>
                  <Link href={`/meetings/${sel.meeting_id}`} className="mt-3 inline-flex text-[11px] font-[600] text-[var(--sky)] hover:text-[var(--fg)]">Open meeting →</Link>
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
