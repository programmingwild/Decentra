"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, apiStream } from "@/lib/api";
import { Nav } from "@/components/nav";
import { SectionLabel } from "@/components/ui/primitives";
import { EmptyState, friendlyError, SpinnerDots } from "@/components/ui/states";
import { PageHero } from "@/components/ui/page-hero";
const ShaderAurora = dynamic(() => import("@/components/immersive/3d/ShaderAurora").then((m) => m.ShaderAurora), { ssr: false });
import { Sparkles, SendHorizontal, FileSearch, ArrowRight } from "lucide-react";

const QUICK = [
  "What did we decide about the database?",
  "What did Arun agree to do?",
  "Which actions are still pending?",
  "What is still unresolved about authentication?",
];

export default function AssistantPage() {
  const [orgId, setOrgId] = useState("");
  const [meetings, setMeetings] = useState<any[]>([]);
  const [question, setQuestion] = useState("");
  const [thread, setThread] = useState<Array<{ role: "user" | "decentra"; text?: string; data?: any; error?: string; streaming?: boolean; evCount?: number }>>([]);
  const [thinking, setThinking] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const reqRef = useRef(0);

  useEffect(() => {
    (async () => {
      try {
        const orgs = await api("/api/v1/organizations");
        if (orgs?.[0]) {
          setOrgId(orgs[0].id);
          setMeetings(await api(`/api/v1/meetings?org_id=${orgs[0].id}`).catch(() => []));
        }
      } catch {}
    })();
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [thread, thinking]);

  // A new question supersedes the old stream; unmount cancels it.
  useEffect(() => () => abortRef.current?.abort(), []);

  const patchLast = (fn: (t: { role: "user" | "decentra"; text?: string; data?: any; error?: string; streaming?: boolean; evCount?: number }) => any) =>
    setThread((t) => (t.length ? [...t.slice(0, -1), fn(t[t.length - 1])] : t));

  const meetingMap = useMemo(() => new Map(meetings.map((m) => [m.id, m])), [meetings]);

  async function ask(text?: string) {
    const q = (text ?? question).trim();
    if (!q || thinking) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const myId = ++reqRef.current;
    setQuestion("");
    setThread((t) => [...t, { role: "user", text: q }, { role: "decentra", streaming: true, text: "" }]);
    setThinking(true);
    try {
      const done = await apiStream(`/api/v1/assistant/query/stream?org_id=${orgId}`, { question: q }, {
        signal: ctrl.signal,
        onEvidence: (ev) => {
          const n = (ev?.evidence?.length || 0) + (ev?.segments?.length || 0);
          patchLast((turn) => ({ ...turn, evCount: n }));
        },
        onToken: (d) => patchLast((turn) => (turn.streaming ? { ...turn, text: (turn.text || "") + d } : turn)),
      });
      if (myId !== reqRef.current) return; // superseded — leave the newer turn alone
      patchLast(() => ({ role: "decentra", data: done }));
    } catch (e: any) {
      if (myId !== reqRef.current || ctrl.signal.aborted) return; // user moved on
      const f = friendlyError(e, "Decentra couldn't answer that");
      patchLast(() => ({ role: "decentra", error: `${f.title}. ${f.reason}` }));
    }
    if (myId === reqRef.current) setThinking(false);
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)] lg:flex-row">
      <Nav />
      <main className="min-w-0 flex-1">
        <div className="relative mx-auto flex min-h-[calc(100vh-56px)] max-w-[820px] flex-col px-5 lg:px-8">
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true"><ShaderAurora className="opacity-[0.25]" speed={0.65} intensity={0.4} mouseInfluence={0.3} /><div className="orb orb-sky h-[300px] w-[340px] -left-[80px] top-[60px] opacity-[0.12]" /></div>
          <div className="relative pt-8 lg:pt-12">
            <PageHero
              kicker="Decentra AI · grounded in your meetings"
              title={<>Ask <span className="thin text-[var(--muted)]">Decentra</span></>}
              sub="Answers grounded in your meetings — always with evidence"
            />
          </div>

          <div className="flex-1 space-y-6 py-8">
            {thread.length === 0 && !thinking && (
              <div>
                <p className="text-[14px] leading-relaxed text-[var(--muted)]">Ask about decisions, owners, deadlines or open questions across your meetings.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {QUICK.map((q) => (
                    <button key={q} onClick={() => ask(q)} className="rounded-full border border-[var(--border)] bg-[color-mix(in_srgb,var(--fg)_3%,transparent)] px-3.5 py-1.5 text-[12.5px] font-[500] text-[var(--muted)] transition hover:border-[var(--border-strong)] hover:bg-[color-mix(in_srgb,var(--fg)_6%,transparent)] hover:text-[var(--text)]">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {thread.map((turn, i) =>
              turn.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <p className="max-w-[80%] rounded-[16px] rounded-br-[6px] border border-[var(--border)] bg-[var(--elevated)] px-4 py-3 text-[13.5px] leading-relaxed text-[var(--text)]">{turn.text}</p>
                </div>
              ) : turn.error ? (
                <div key={i} className="rounded-[14px] border border-[color-mix(in_srgb,var(--red-2)_20%,transparent)] bg-[color-mix(in_srgb,var(--red-2)_6%,transparent)] p-4 text-[13px] leading-relaxed text-[var(--red)]" role="alert">
                  {turn.error}
                </div>
              ) : turn.streaming ? (
                <div key={i} className="animate-rise rounded-[16px] border border-[var(--border)] bg-[var(--surface)] p-5" aria-live="polite">
                  <SectionLabel accent="text-[var(--sky)]">Decentra — answering</SectionLabel>
                  <p className="mt-2.5 whitespace-pre-wrap text-[14px] leading-[1.7] text-[var(--text)]">
                    {turn.text || "Finding evidence…"}
                    <span aria-hidden="true" className="type-caret" />
                  </p>
                  {(turn.evCount || 0) > 0 && (
                    <p className="fragment mt-3 text-[10px] uppercase tracking-[0.16em] text-[var(--gold)]">
                      ◆ {turn.evCount} evidence moments pinned
                    </p>
                  )}
                </div>
              ) : (
                <AnswerBlock key={i} data={turn.data} meetingMap={meetingMap} />
              )
            )}

            {thinking && (
              <div className="flex items-center gap-3 rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5">
                <FileSearch className="h-4 w-4 animate-pulse text-[var(--sky)]" aria-hidden="true" />
                <span className="text-[13px] text-[var(--subtle)]">Searching decisions and commitments</span>
                <SpinnerDots className="text-[var(--sky)]" />
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="sticky bottom-0 z-10 border-t border-[var(--border)] bg-[color-mix(in_srgb,var(--bg)_90%,transparent)] py-4 backdrop-blur-xl">
            <div className="flex items-center gap-2.5 rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-4 focus-within:border-[color-mix(in_srgb,var(--sky-2)_40%,transparent)] transition">
              <Sparkles className="h-4 w-4 shrink-0 text-[color-mix(in_srgb,var(--sky)_60%,transparent)]" aria-hidden="true" />
              <input
                ref={inputRef}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && ask()}
                placeholder="What did we decide about…?"
                aria-label="Ask Decentra"
                className="h-[46px] w-full bg-transparent text-[14px] outline-none placeholder:text-[var(--subtle)]"
              />
              <button onClick={() => ask()} disabled={!question.trim() || thinking} className="btn h-[34px] shrink-0 gap-1.5 bg-[var(--text)] px-3.5 text-[12.5px] font-[600] text-[var(--bg)] hover:bg-[var(--fg)] disabled:opacity-40" aria-label="Send question">
                Ask <SendHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
            <p className="mt-2 px-1 text-center text-[10.5px] text-[var(--subtle)]">Every answer links back to the exact moment in the transcript.</p>
          </div>
        </div>
      </main>
    </div>
  );
}

function AnswerBlock({ data, meetingMap }: { data: any; meetingMap: Map<string, any> }) {
  const evidence = Array.isArray(data?.evidence) ? data.evidence : [];
  const related = Array.isArray(data?.decisions) ? data.decisions : [];
  const relActions = Array.isArray(data?.actions) ? data.actions : [];
  const segments = Array.isArray(data?.segments) ? data.segments : [];
  return (
    <div className="animate-rise rounded-[16px] border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex items-center gap-2">
        <SectionLabel accent="text-[var(--sky)]">Decentra — grounded</SectionLabel>
        {data?.cached && (
          <span className="fragment rounded-full border border-[color-mix(in_srgb,var(--gold)_30%,transparent)] bg-[color-mix(in_srgb,var(--gold)_10%,transparent)] px-2 py-0.5 text-[9px] uppercase tracking-[0.14em] text-[var(--gold)]">
            ⚡ instant
          </span>
        )}
      </div>
      <p className="mt-2.5 whitespace-pre-wrap text-[14px] leading-[1.7] text-[var(--text)]">{data?.answer || "No answer."}</p>

      {(related.length > 0 || relActions.length > 0) && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {related.map((d: string) => (
            <span key={`d-${d}`} className="inline-flex items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--emerald-2)_20%,transparent)] bg-[color-mix(in_srgb,var(--emerald-2)_6%,transparent)] px-2.5 py-1 text-[11px] font-[550] text-[var(--emerald)]"><span aria-hidden="true">◆</span>{d.slice(0, 48)}</span>
          ))}
          {relActions.map((a: string) => (
            <span key={`a-${a}`} className="inline-flex items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--sky-2)_20%,transparent)] bg-[color-mix(in_srgb,var(--sky-2)_6%,transparent)] px-2.5 py-1 text-[11px] font-[550] text-[var(--sky-3)]"><span aria-hidden="true">●</span>{a.slice(0, 48)}</span>
          ))}
        </div>
      )}

      {segments.length > 0 && (
        <div className="mt-4 space-y-2">
          {segments.slice(0, 3).map((s: any) => {
            const m = meetingMap.get(s.meeting_id);
            return (
              <a key={s.id} href={`/meetings/${s.meeting_id}?seg=${s.id}`} className="group block rounded-[10px] border border-[var(--border)] bg-[var(--bg-2)] px-3.5 py-2.5 transition hover:border-[color-mix(in_srgb,var(--sky-2)_30%,transparent)]">
                <div className="flex items-center gap-2 text-[11px]"><span className="mono text-[var(--sky)]">{Math.floor((s.start_ms || 0)/1000 / 60)}:{String(Math.floor((s.start_ms || 0)/1000 % 60)).padStart(2,"0")}</span><span className="truncate text-[var(--subtle)]">{m?.title || "Meeting"}</span></div>
                <p className="mt-1 line-clamp-2 text-[12.5px] leading-snug text-[var(--text-soft)] group-hover:text-[var(--fg)]">&ldquo;{s.text}&rdquo;</p>
              </a>
            );
          })}
        </div>
      )}

      {evidence.length > 0 && (
        <div className="mt-5 border-t border-[var(--border)] pt-4">
          <SectionLabel>Evidence trace</SectionLabel>
          <ul className="mt-2 space-y-2">
            {evidence.slice(0, 4).map((ev: any, i: number) => {
              const m = meetingMap.get(ev.meeting_id);
              const segIds = ev.segment_ids || [];
              if (segments.length > 0 && i < 2) return null;
              return (
                <li key={i}>
                  <a href={`/meetings/${ev.meeting_id}${segIds[0] ? `?seg=${segIds[0]}&item=${segIds[0]}` : ""}`} className="group flex items-center gap-3 rounded-[10px] border border-[var(--border)] bg-[var(--elevated)] px-3.5 py-2.5 transition hover:border-[color-mix(in_srgb,var(--sky-2)_30%,transparent)]">
                    <span className="mono text-[11px] tabular-nums text-[var(--sky)]">{segIds.length ? `${segIds.length} moment${segIds.length === 1 ? "" : "s"}` : "transcript"}</span>
                    <span className="min-w-0 flex-1 truncate text-[12.5px] text-[var(--text-soft)] group-hover:text-[var(--fg)]">{m?.title || "Meeting"}</span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[var(--subtle)] transition group-hover:translate-x-0.5 group-hover:text-[var(--sky)]" aria-hidden="true" />
                  </a>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-[10.5px] text-[var(--subtle)]">Every claim cites a transcript moment — click to jump.</p>
        </div>
      )}
    </div>
  );
}
