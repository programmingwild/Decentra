"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Nav } from "@/components/nav";
import { SectionLabel } from "@/components/ui/primitives";
import { EmptyState, SkeletonRow } from "@/components/ui/states";
import { PageHero } from "@/components/ui/page-hero";
const ShaderAurora = dynamic(() => import("@/components/immersive/3d/ShaderAurora").then((m) => m.ShaderAurora), { ssr: false });
import { fmtDate, dayGroup } from "@/lib/format";
import { HelpCircle, ArrowUpRight } from "lucide-react";

export default function QuestionsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const orgs = await api("/api/v1/organizations");
        if (orgs?.[0]) {
          const ms = await api(`/api/v1/meetings?org_id=${orgs[0].id}`).catch(() => []);
          const ready = (ms || []).filter((m: any) => m.status === "ready");
          const results = await Promise.allSettled(ready.map((m: any) => api(`/api/v1/meetings/${m.id}/intelligence`)));
          const all: any[] = [];
          results.forEach((r, i) => {
            if (r.status === "fulfilled" && r.value?.questions) {
              r.value.questions.forEach((q: any) => all.push({ ...q, meeting: ready[i] }));
            }
          });
          all.sort((a, b) => new Date(b.meeting?.date || 0).getTime() - new Date(a.meeting?.date || 0).getTime());
          setItems(all);
        }
      } catch {}
      setLoading(false);
    })();
  }, []);

  const open = useMemo(() => items.filter((q) => (q.status || "OPEN") !== "ANSWERED"), [items]);
  const groups = useMemo(() => {
    const g: Array<[string, any[]]> = [];
    open.forEach((q) => {
      const label = dayGroup(q.meeting?.date);
      const last = g[g.length - 1];
      if (last && last[0] === label) last[1].push(q);
      else g.push([label, [q]]);
    });
    return g;
  }, [open]);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)] lg:flex-row">
      <Nav />
      <main className="min-w-0 flex-1">
        <div className="relative mx-auto max-w-[860px] px-5 pb-20 pt-8 lg:px-8 lg:pt-12">
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true"><ShaderAurora className="opacity-[0.22]" speed={0.6} intensity={0.35} mouseInfluence={0.2} /><div className="orb orb-violet h-[280px] w-[320px] -right-[60px] top-[40px] opacity-[0.12]" /></div>
          <PageHero
            kicker="Unresolved threads"
            title={<>Open <span className="thin text-[var(--muted)]">Questions</span></>}
            sub={loading ? "Scanning every processed meeting…" : `${open.length} unresolved · pulled from ${new Set(open.map((q) => q.meeting_id)).size} meeting${new Set(open.map((q) => q.meeting_id)).size === 1 ? "" : "s"}`}
          />

          {loading ? (
            <div className="mt-8 divide-y divide-[var(--border)]">{[0, 1, 2].map((i) => <SkeletonRow key={i} />)}</div>
          ) : open.length === 0 ? (
            <EmptyState
              icon={<HelpCircle className="h-5 w-5" />}
              title={items.length ? "Nothing unresolved" : "No questions captured yet"}
              body={items.length ? "Every question raised has been answered or closed. Rare and excellent." : "When a discussion leaves something undecided, Decentra captures it here so it never silently disappears."}
            />
          ) : (
            <div className="mt-8 space-y-9">
              {groups.map(([label, qs]) => (
                <section key={label} aria-label={label}>
                  <SectionLabel>{label}</SectionLabel>
                  <ul className="mt-2 divide-y divide-[var(--border)]">
                    {qs.map((q) => (
                      <li key={q.id}>
                        <Link href={`/meetings/${q.meeting_id}?item=${q.id}`} className="group flex gap-3.5 py-4">
                          <span className="mono mt-px shrink-0 text-[15px] font-[600] text-[color-mix(in_srgb,var(--violet)_80%,transparent)]" aria-hidden="true">?</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[14.5px] font-[550] leading-snug tracking-[-0.005em] text-[var(--text)] group-hover:text-[var(--fg)]">{q.text}</p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[12px] text-[var(--subtle)]">
                              <span className="rounded-full border border-[var(--border)] px-1.5 py-px text-[9px] font-[700] uppercase tracking-[0.08em] text-[var(--muted)]">{q.status || "OPEN"}</span>
                              <span>Discussed {fmtDate(q.meeting?.date)}</span>
                              <span className="inline-flex items-center gap-0.5 transition group-hover:text-[var(--sky)]">
                                in {q.meeting?.title} <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                              </span>
                            </div>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
