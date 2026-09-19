"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Nav } from "@/components/nav";
import { DecisionPill, ActionPill, SectionLabel, Avatar, SpeakerChip, Confidence, SeverityDot, MeetingStatusPill, ProvenancePill } from "@/components/ui/primitives";
import { EmptyState, ErrorState, friendlyError, SkeletonLines } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import { EvidenceDrawer, TranscriptBlock, type Segment } from "@/components/evidence";
import { msToClock, msToDuration, fmtDateTime, fmtDeadline, fmtDateLong, humanizeKey } from "@/lib/format";
import {
  Check, ChevronRight, HelpCircle, UploadCloud,
  Sparkles, ShieldAlert, UserPlus, CalendarClock, RotateCcw, FileAudio,
} from "lucide-react";
import { SpotlightCard } from "@/components/thrill";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function MeetingWorkspace() {
  const params = useParams() as any;
  const id = params.id as string;
  const { toast } = useToast();

  const [meeting, setMeeting] = useState<any>(null);
  const [transcript, setTranscript] = useState<Segment[]>([]);
  const [intel, setIntel] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [busy, setBusy] = useState<null | "uploading" | "processing">(null);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<{ title: string; reason: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [ev, setEv] = useState<{ type: string; item: any } | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [mTab, setMTab] = useState<"transcript" | "intelligence">("transcript");

  const [editD, setEditD] = useState<any | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [ownerA, setOwnerA] = useState<any | null>(null);
  const [ownerVal, setOwnerVal] = useState("");
  const [dlA, setDlA] = useState<any | null>(null);
  const [dlDate, setDlDate] = useState("");
  const [dlText, setDlText] = useState("");
  const [audit, setAudit] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState("");
  const [commentPosting, setCommentPosting] = useState(false);
  const [understanding, setUnderstanding] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [dismissD, setDismissD] = useState<any | null>(null);
  const [dnaData, setDnaData] = useState<any | null>(null);

  const deepLinked = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const m = await api(`/api/v1/meetings/${id}`).catch(() => null);
    if (m) {
      setMeeting(m);
      api(`/api/v1/meetings/${id}/activity`).then((res: any) => {
        setAudit(res.audit || []);
        setComments(res.comments || []);
      }).catch(() => {
        api(`/api/v1/audit?org_id=${m.org_id}&limit=20`).then((logs: any[]) => setAudit(logs || [])).catch(() => {});
      });
    }
    const tr = await api(`/api/v1/meetings/${id}/transcript`).catch(() => ({ segments: [] }));
    setTranscript(tr.segments || []);
    const intelRes = await api(`/api/v1/meetings/${id}/intelligence`).catch(() => null);
    if (intelRes) setIntel(intelRes);
    const und = await api(`/api/v1/meetings/${id}/understanding`).catch(() => null);
    if (und) { setUnderstanding(und.understanding); setParticipants(und.participants || []); }
    setLoading(false);
    return { m, intel: intelRes };
  }, [id]);

  useEffect(() => {
    load();
    api("/api/v1/organizations")
      .then((orgs) => {
        if (orgs?.[0]) return api(`/api/v1/projects?org_id=${orgs[0].id}`);
        return [];
      })
      .then(setProjects)
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    if (loading || deepLinked.current || !intel) return;
    deepLinked.current = true;
    const sp = new URLSearchParams(window.location.search);
    const itemId = sp.get("item");
    const seg = sp.get("seg");
    if (itemId) {
      const lists: Array<[string, any[]]> = [["decision", intel.decisions || []], ["action", intel.actions || []], ["question", intel.questions || []], ["risk", intel.risks || []]];
      for (const [type, arr] of lists) {
        const found = arr.find((x) => x.id === itemId);
        if (found) {
          openEvidence(type, found);
          break;
        }
      }
    } else if (seg) {
      flashSegment(seg);
    }
  }, [loading, intel]);

  const segMap = useMemo(() => new Map(transcript.map((s) => [s.id, s])), [transcript]);

  const linkMap = useMemo(() => {
    const m = new Map<string, Array<{ type: string; item: any }>>();
    const add = (ids: string[] | null | undefined, type: string, item: any) =>
      (ids || []).forEach((sid) => {
        const arr = m.get(sid) || [];
        arr.push({ type, item });
        m.set(sid, arr);
      });
    (intel?.decisions || []).forEach((d: any) => add(d.evidence_segment_ids, "decision", d));
    (intel?.actions || []).forEach((a: any) => add(a.evidence_segment_ids, "action", a));
    (intel?.questions || []).forEach((q: any) => add(q.evidence_segment_ids, "question", q));
    return m;
  }, [intel]);

  const speakers = useMemo(() => Array.from(new Set(transcript.map((s) => s.speaker_label))).slice(0, 5), [transcript]);
  const projectName = projects.find((p) => p.id === meeting?.project_id)?.name;

  function flashSegment(segId: string) {
    setHighlight(null);
    requestAnimationFrame(() => {
      setHighlight(segId);
      document.getElementById(`seg-${segId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => setHighlight(null), 2400);
    });
  }

  function openEvidence(type: string, item: any) {
    setMTab("intelligence");
    setEv({ type, item });
  }

  function openTranscriptAt(segId: string) {
    setEv(null);
    setMTab("transcript");
    setTimeout(() => flashSegment(segId), 60);
  }

  async function handleProcess(file?: File) {
    setError(null);
    try {
      if (file) {
        setBusy("uploading");
        setStep(0);
        const fd = new FormData();
        fd.append("file", file);
        await api(`/api/v1/meetings/${id}/recording`, { method: "POST", body: fd });
      }
      setBusy("processing");
      setStep(file ? 1 : 0);
      await api(`/api/v1/meetings/${id}/process`, { method: "POST" });
      // poll status endpoint (new async pipeline)
      for (let attempts = 0; attempts < 32; attempts++) {
        await delay(850);
        try {
          const st: any = await api(`/api/v1/meetings/${id}/status`);
          const prog = st?.job?.progress ?? (st?.status === "ready" ? 100 : st?.status === "failed" ? 0 : 40);
          if (prog < 30) setStep(0);
          else if (prog < 65) setStep(1);
          else if (prog < 100) setStep(2);
          else setStep(3);
          if (st.status === "ready") {
            setBusy(null);
            await load();
            toast("Meeting processed — review what Decentra found", "success");
            return;
          }
          if (st.status === "failed") {
            setBusy(null);
            const err = st.job?.error || "Processing failed";
            setError({ title: "Processing failed", reason: err.slice(0, 320) });
            toast("Processing failed", "error");
            await load();
            return;
          }
        } catch {}
      }
      // timeout fallback: still processing
      setBusy(null);
      await load();
      toast("Still processing — refresh to check status", "error");
    } catch (e: any) {
      setBusy(null);
      const f = friendlyError(e, "We couldn't process this recording");
      setError(f);
      toast(f.title, "error");
      load();
    }
  }

  async function patchDecision(item: any, body: any, msg: string) {
    try {
      await api(`/api/v1/decisions/${item.id}`, { method: "PATCH", body: JSON.stringify(body) });
      toast(msg, "success");
      load();
    } catch (e: any) {
      const f = friendlyError(e);
      toast(f.title, "error");
    }
  }

  async function patchAction(item: any, body: any, msg: string) {
    try {
      await api(`/api/v1/actions/${item.id}`, { method: "PATCH", body: JSON.stringify(body) });
      toast(msg, "success");
      load();
    } catch (e: any) {
      const f = friendlyError(e);
      toast(f.title, "error");
    }
  }

  async function postComment() {
    if (!commentText.trim()) return;
    setCommentPosting(true);
    try {
      await api(`/api/v1/meetings/${id}/comments`, { method: "POST", body: JSON.stringify({ text: commentText.trim() }) });
      setCommentText("");
      toast("Comment added", "success");
      load();
    } catch (e: any) {
      toast(friendlyError(e).title, "error");
    }
    setCommentPosting(false);
  }

  async function openDNA(d:any) {
    try { const r=await api(`/api/v1/decisions/${d.id}/dna`); setDnaData({decision:d, ...r}); } catch(e:any){ toast(friendlyError(e).title,"error"); }
  }

  const evSegments: Segment[] = useMemo(() => {
    if (!ev) return [];
    return (ev.item.evidence_segment_ids || []).map((sid: string) => segMap.get(sid)).filter(Boolean) as Segment[];
  }, [ev, segMap]);

  const ready = meeting?.status === "ready";
  const hasContent = transcript.length > 0;
  const showHero = !loading && !hasContent && !busy && meeting && meeting.status !== "processing";
  const decisionsCount = intel?.decisions?.length ?? 0;
  const actionsCount = intel?.actions?.length ?? 0;

  const stageLabels = busy === "uploading" ? ["Uploading recording", "Generating transcript", "Extracting intelligence"] : ["Generating transcript", "Extracting intelligence", "Finalizing"];
  const stepIndex = busy === "uploading" ? step : Math.max(0, step - 1);

  if (loading && !meeting) {
    return (
      <div className="flex min-h-screen flex-col bg-[#08090B] lg:flex-row">
        <Nav />
        <main className="min-w-0 flex-1 px-6 py-8">
          <SkeletonLines n={4} className="max-w-xl" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#08090B] lg:flex-row">
      <Nav />
      <main className="relative flex min-w-0 flex-1 flex-col lg:h-screen lg:overflow-hidden">
        <input ref={fileRef} type="file" accept=".mp3,.wav,.m4a,.webm,.mp4,.mov,.ogg,audio/*,video/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleProcess(f); e.target.value = ""; }} aria-hidden="true" />

        <header className="glass-strong sticky top-0 z-20 px-5 py-3 max-lg:top-14 lg:px-6">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
            <div className="w-full min-w-0 sm:w-auto sm:flex-1">
              <div className="flex items-center gap-1.5 text-[11px] font-[550] text-[#656B75]">
                <Link href="/meetings" className="rounded px-1 py-0.5 transition hover:text-[#9AA1AC]">Meetings</Link>
                <ChevronRight className="h-3 w-3" aria-hidden="true" />
                <span className="truncate text-[#9AA1AC]">{projectName || "Workspace"}</span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
                <h1 className="truncate text-[20px] font-[800] tracking-[-0.03em] text-[#F5F7FA] lg:text-[22px]">{meeting?.title}</h1>
                {meeting && <MeetingStatusPill status={meeting.status} />}
                {ready && <span className="fragment hidden text-[10px] uppercase tracking-[0.16em] text-[#656B75] sm:inline-flex">· evidence-linked</span>}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[#656B75]">
                <span>{fmtDateTime(meeting?.date)}</span>
                <span aria-hidden="true">·</span>
                <span>{msToDuration(meeting?.duration_ms)}</span>
                {speakers.length > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="flex items-center -space-x-1.5">
                      {speakers.map((s) => <Avatar key={s} name={s} size={20} />)}
                    </span>
                    <span>{meeting?.participant_count ?? speakers.length} participants</span>
                  </>
                )}
                {ready && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-[#9AA1AC]">{decisionsCount} decision{decisionsCount === 1 ? "" : "s"} · {actionsCount} action{actionsCount === 1 ? "" : "s"}</span>
                  </>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {(meeting?.status === "draft" || meeting?.status === "failed") && (
                <button onClick={() => fileRef.current?.click()} disabled={!!busy} className="btn h-[32px] gap-1.5 bg-white/[0.07] px-3 text-[12.5px] font-[600] text-[#F5F7FA] hover:bg-white/[0.10] disabled:opacity-50">
                  <FileAudio className="h-3.5 w-3.5" aria-hidden="true" /> Upload
                </button>
              )}
              {!hasContent || meeting?.status !== "ready" ? (
                <button onClick={() => handleProcess()} disabled={!!busy} className="btn h-[32px] gap-1.5 bg-[#F5F7FA] px-3.5 text-[12.5px] font-[600] text-[#08090B] hover:bg-white disabled:opacity-50">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Process meeting
                </button>
              ) : (
                <>
                  <button onClick={() => handleProcess()} disabled={!!busy} className="btn btn-subtle h-[32px] gap-1.5 px-3 text-[12.5px] font-[550]">
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Reprocess
                  </button>
                  <button onClick={async ()=> { const r=await api(`/api/v1/meetings/${id}/report`); const blob=new Blob([JSON.stringify(r,null,2)],{type:"application/json"}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=`Decentra-Report-${meeting?.title?.slice(0,20) || id}.json`; a.click(); }} className="btn h-[32px] border border-white/10 bg-white/[0.04] px-3 text-[12.5px] font-[550] text-[#9AA1AC] hover:text-white">Report</button>
                </>
              )}
            </div>
          </div>

          {(busy || meeting?.status === "processing") && (
            <ol className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5" aria-live="polite" aria-label="Processing progress">
              {stageLabels.map((label, i) => {
                const isDone = step >= 3 || i < stepIndex;
                const isCurrent = i === stepIndex && step < 3;
                return (
                  <li key={label} className="flex items-center gap-1.5 text-[12px]">
                    {isDone ? (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#10B981]/20"><Check className="h-2.5 w-2.5 text-[#34D399]" aria-hidden="true" /></span>
                    ) : isCurrent ? (
                      <span className="text-[#38BDF8]"><SpinnerMini /></span>
                    ) : (
                      <span className="h-4 w-4 rounded-full border border-white/[0.12]" aria-hidden="true" />
                    )}
                    <span className={isDone ? "text-[#9AA1AC]" : isCurrent ? "font-[550] text-[#E5E9EF]" : "text-[#656B75]"}>{label}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </header>

        <div className="sticky top-[113px] z-10 flex gap-1 border-b border-white/[0.06] bg-[#08090B]/90 px-4 py-2 backdrop-blur-lg lg:hidden">
          {(["transcript", "intelligence"] as const).map((t) => (
            <button key={t} onClick={() => setMTab(t)} aria-pressed={mTab === t} className={`rounded-[8px] px-3 py-1.5 text-[12.5px] font-[550] capitalize transition ${mTab === t ? "bg-white/[0.08] text-[#F5F7FA]" : "text-[#656B75]"}`}>
              {t}
            </button>
          ))}
        </div>

        {error && (
          <div className="px-5 pt-4 lg:px-6">
            <ErrorState {...error} actionLabel="Retry processing" onAction={() => handleProcess()} />
          </div>
        )}

        {showHero ? (
          <div
            className="relative flex flex-1 items-center justify-center overflow-hidden px-5 py-14"
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) handleProcess(f); }}
          >
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
              <div className="orb orb-sky h-[500px] w-[560px] left-[18%] top-[12%]" />
              <div className="orb orb-violet h-[420px] w-[480px] right-[12%] bottom-[8%]" />
            </div>
            <div className="relative w-full max-w-[560px] text-center">
              <p className="fragment text-[10px] uppercase tracking-[0.18em] text-[#656B75]">01 — Start here</p>
              <h2 className="display-hero mt-3 text-[30px] text-[#F5F7FA] lg:text-[36px]">Ready <span className="thin text-[#656B75]">when</span> you are.</h2>
              <p className="mx-auto mt-3 max-w-[420px] text-[13.5px] leading-relaxed text-[#9AA1AC]">
                Drop the recording and watch the transcript, decisions, owners and deadlines assemble — evidence-linked.
              </p>
              <button
                onClick={() => fileRef.current?.click()}
                className={`sheen group relative mt-7 flex w-full flex-col items-center overflow-hidden rounded-[20px] border border-dashed px-8 py-12 backdrop-blur transition ${dragOver ? "border-[#0EA5E9]/60 bg-[#0EA5E9]/[0.06]" : "glass-subtle border-white/[0.12] hover:border-white/[0.20]"}`}
                aria-label="Upload recording"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-[14px] border border-white/[0.08] bg-[#15181D] text-[#38BDF8] transition group-hover:scale-105">
                  <UploadCloud className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="mt-4 text-[14px] font-[600] text-[#F5F7FA]">Drop a recording here</span>
                <span className="fragment mt-1 text-[11px] text-[#656B75]">or click to browse · MP3, WAV, M4A, WEBM, MP4, MOV, OGG · up to 200MB</span>
              </button>
              <div className="my-6 flex items-center gap-3 text-[11px] font-[600] uppercase tracking-[0.14em] text-[#656B75]">
                <span className="h-px flex-1 bg-white/[0.06]" /> or <span className="h-px flex-1 bg-white/[0.06]" />
              </div>
              <button onClick={() => handleProcess()} className="btn btn-ghost mx-auto h-[36px] px-4 text-[13px]">
                Generate demo transcript
              </button>
              <p className="mt-3 text-[11.5px] text-[#656B75]">Demo workspace — creates a sample product-review conversation so you can explore the full workflow.</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1.65fr)_minmax(380px,1fr)] lg:overflow-hidden">
            <section aria-label="Transcript timeline" className={`${mTab === "transcript" ? "" : "hidden"} lg:block lg:overflow-y-auto`} key="transcript-pane">
              <div className="glass-subtle sticky top-0 z-10 flex items-center justify-between px-5 pb-3 pt-4 lg:px-6">
                <SectionLabel count={transcript.length}>Transcript</SectionLabel>
                <span className="fragment text-[10px] uppercase tracking-[0.14em] text-[#656B75]">click a marker → evidence</span>
              </div>
              <div className="pb-16">
                {transcript.map((seg) => {
                  const links = linkMap.get(seg.id) || [];
                  return (
                    <article
                      key={seg.id}
                      id={`seg-${seg.id}`}
                      onMouseMove={(e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); (e.currentTarget as HTMLElement).style.setProperty("--mx", `${e.clientX - r.left}px`); (e.currentTarget as HTMLElement).style.setProperty("--my", `${e.clientY - r.top}px`); }}
                      className={`spotlight relative border-b border-white/[0.04] px-5 py-4 transition-colors lg:px-6 ${highlight === seg.id ? "flash-target" : ""}`}
                    >
                      <div className="flex gap-4">
                        <span className="mono w-[44px] shrink-0 pt-0.5 text-right text-[11px] tabular-nums text-[#656B75]">{msToClock(seg.start_ms)}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <SpeakerChip name={seg.speaker_label} />
                            {seg.confidence != null && seg.confidence < 0.6 && (
                              <span className="rounded-full border border-[#F59E0B]/25 bg-[#F59E0B]/[0.10] px-1.5 py-px text-[9px] font-[700] uppercase tracking-[0.08em] text-[#FBBF24]">low confidence</span>
                            )}
                          </div>
                          <p className="serif mt-1 text-[14.5px] leading-[1.68] text-[#E6EAF0]">{seg.text}</p>
                          {links.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {links.map(({ type, item }, i) => (
                                <MarkerChip key={`${type}-${item.id}-${i}`} type={type} item={item} onClick={() => openEvidence(type, item)} />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
                {transcript.length === 0 && (
                  <div className="px-6 py-10">
                    <EmptyState icon={<Sparkles className="h-5 w-5" />} title="No transcript yet" body="Process this meeting to generate its transcript and extract decisions." />
                  </div>
                )}
              </div>
            </section>

            <aside aria-label="Intelligence panel" className={`${mTab === "intelligence" ? "" : "hidden"} border-t border-white/[0.06] bg-[#0D0F12]/40 lg:block lg:overflow-y-auto lg:border-l lg:border-t-0 lg:backdrop-blur-[2px]`}>
              <div className="space-y-1 pb-20">
                {understanding && (
                  <section aria-label="Meeting understanding" className="reveal relative overflow-hidden border-b border-white/[0.06] bg-white/[0.02] px-5 py-4">
                    <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 orb orb-sky opacity-[0.12]" />
                    <SectionLabel>Understanding · Meeting DNA</SectionLabel>
                    <p className="mt-2 text-[12.5px] leading-relaxed text-[#C7CCD4]"><span className="font-[600] text-[#F5F7FA]">Objective:</span> {understanding.objective}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="tilt-card rounded-full bg-[#0EA5E9]/15 px-2.5 py-1 text-[10px] font-[700] tracking-wide text-[#38BDF8] border border-[#0EA5E9]/20">{understanding.primary_theme}</span>
                      {(understanding.secondary_themes || []).map((t:string)=> <span key={t} className="glass-subtle rounded-full px-2.5 py-1 text-[10px] font-[500] text-[#9AA1AC]">{t}</span>)}
                    </div>
                    {understanding.topics?.length>0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {(understanding.topics||[]).slice(0,5).map((tp:any)=> <span key={tp.topic} className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] text-[#C7CCD4]"><span className="h-1.5 w-1.5 rounded-full bg-[#A78BFA]" />{tp.topic} · {tp.count}</span>)}
                      </div>
                    )}
                    {participants.length>0 && (
                      <div className="stagger mt-3 space-y-1.5">
                        {participants.map((p:any)=> (
                          <div key={p.speaker_label} className="spotlight flex items-center gap-2 rounded-[10px] border border-white/[0.04] bg-white/[0.02] px-2.5 py-1.5 text-[11px] transition hover:bg-white/[0.04]"><span className="font-[700] tracking-[-0.01em] text-[#E9EDF2]">{p.speaker_label}</span><span className={`rounded-full px-1.5 py-px text-[9px] font-[700] ${p.participation_level==="high"?"bg-[#10B981]/15 text-[#34D399]":p.participation_level==="medium"?"bg-[#F59E0B]/15 text-[#FBBF24]":"bg-white/10 text-[#9AA1AC]"}`}>{humanizeKey(p.participation_level) || "Unknown"}</span><span className="truncate text-[#656B75]">{(p.topics_discussed||[]).join(" · ")}</span><span className={`ml-auto rounded-full bg-white/5 px-1.5 py-px text-[9px] font-[600] ${p.stance==="agree"?"text-[#10B981]":p.stance==="disagree"?"text-[#EF4444]":"text-[#656B75]"}`}>{humanizeKey(p.stance) || "Neutral"}</span></div>
                        ))}
                      </div>
                    )}
                  </section>
                )}
                <section aria-label="Decisions">
                  <div className="px-5 pb-1 pt-5"><SectionLabel count={intel?.decisions?.length || 0} accent="text-[#34D399]">Decisions</SectionLabel></div>
                  {(intel?.decisions || []).map((d: any) => (
                    <DecisionRow key={d.id} d={d} onEvidence={() => openEvidence("decision", d)} onConfirm={() => patchDecision(d, { status: "CONFIRMED" }, "Decision confirmed")} onEdit={() => { setEditD(d); setEditTitle(d.title); }} onDismiss={() => setDismissD(d)} onReview={() => patchDecision(d, { status: "DETECTED" }, "Moved back to review")} onDNA={() => openDNA(d)} />
                  ))}
                  {intel && !intel.decisions?.length && <QuietEmpty text="No decisions detected yet." />}
                </section>

                <section aria-label="Action items">
                  <div className="px-5 pb-1 pt-5"><SectionLabel count={intel?.actions?.length || 0}>Action items</SectionLabel></div>
                  {(intel?.actions || []).map((a: any) => (
                    <ActionRow key={a.id} a={a} segMap={segMap} onToggle={() => patchAction(a, { status: a.status === "COMPLETED" ? "NOT_STARTED" : "COMPLETED" }, a.status === "COMPLETED" ? "Action reopened" : "Action completed")} onOwner={() => { setOwnerA(a); setOwnerVal(a.owner_name || ""); }} onDeadline={() => { setDlA(a); setDlText(a.deadline_raw || ""); setDlDate(""); }} onStatus={(s) => patchAction(a, { status: s }, "Status updated")} onEvidence={() => openEvidence("action", a)} />
                  ))}
                  {intel && !intel.actions?.length && <QuietEmpty text="No action items detected yet." />}
                </section>

                <section aria-label="Open questions">
                  <div className="px-5 pb-1 pt-5"><SectionLabel count={intel?.questions?.length || 0} accent="text-[#A78BFA]">Questions</SectionLabel></div>
                  {(intel?.questions || []).map((q: any) => (
                    <div key={q.id} className="border-b border-white/[0.04] px-5 py-3.5">
                      <div className="flex gap-2.5">
                        <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#A78BFA]" aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] leading-snug text-[#DDE2E9]">{q.text}</p>
                          <div className="mt-1.5 flex items-center gap-2">
                            <span className="rounded-full border border-white/[0.08] px-1.5 py-px text-[9px] font-[700] uppercase tracking-[0.08em] text-[#9AA1AC]">{q.status || "OPEN"}</span>
                            <EvidenceChip ids={q.evidence_segment_ids} segMap={segMap} onClick={() => openEvidence("question", q)} />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {intel && !intel.questions?.length && <QuietEmpty text="Nothing unresolved." />}
                </section>

                <section aria-label="Risks">
                  <div className="px-5 pb-1 pt-5"><SectionLabel count={intel?.risks?.length || 0} accent="text-[#F87171]">Risks</SectionLabel></div>
                  {(intel?.risks || []).map((r: any) => (
                    <div key={r.id} className="border-b border-white/[0.04] px-5 py-3.5">
                      <div className="flex gap-2.5">
                        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#F87171]/80" aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <SeverityDot severity={r.severity} />
                            <p className="text-[13px] font-[550] leading-snug text-[#DDE2E9]">{r.title}</p>
                            <span className="text-[10px] uppercase tracking-wider text-[#656B75]">{r.severity}</span>
                          </div>
                          {r.description && <p className="mt-1 text-[12px] leading-relaxed text-[#9AA1AC]">{r.description}</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                  {intel && !intel.risks?.length && <QuietEmpty text="No risks flagged." />}
                </section>

                <section aria-label="Execution history">
                  <div className="px-5 pb-1 pt-5"><SectionLabel>Collaboration</SectionLabel></div>
                  <div className="px-5 py-3">
                    <div className="flex gap-2">
                      <input value={commentText} onChange={(e) => setCommentText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), postComment())} placeholder="Add a comment — use @name to mention" className="input h-[38px] flex-1 text-[13px]" aria-label="Add comment" />
                      <button onClick={postComment} disabled={!commentText.trim() || commentPosting} className="btn h-[38px] bg-[#F5F7FA] px-3.5 text-[12.5px] font-[600] text-[#08090B] hover:bg-white disabled:opacity-40">Post</button>
                    </div>
                    <p className="mt-1.5 text-[11px] text-[#656B75]">Comments notify mentioned teammates. <span className="text-[#9AA1AC]">Try @demo@decentra.ai</span></p>
                  </div>
                  {comments.length === 0 ? (
                    <p className="px-5 py-2 text-[12px] text-[#656B75]">No comments yet — start the discussion.</p>
                  ) : (
                    <div className="divide-y divide-white/[0.04]">
                      {comments.map((c) => (
                        <div key={c.id} className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] font-[600] text-[#E9EDF2]">{c.author_name}</span>
                            <span className="text-[11px] text-[#656B75]">{fmtDateLong(c.created_at)} · {new Date(c.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                          </div>
                          <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-[#C7CCD4]">{c.text}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 border-t border-white/[0.04]" />
                  <div className="px-5 pb-1 pt-4"><SectionLabel>Recent activity</SectionLabel></div>
                  {audit.length === 0 ? (
                    <QuietEmpty text="Decisions and actions you confirm will appear here." />
                  ) : (
                    <div className="divide-y divide-white/[0.04]">
                      {audit
                        .filter((l) => {
                          const ids = new Set([...(intel?.decisions || []).map((d: any) => d.id), ...(intel?.actions || []).map((a: any) => a.id)]);
                          return ids.has(l.resource_id);
                        })
                        .slice(0, 6)
                        .map((l) => (
                          <div key={l.id} className="px-5 py-3">
                            <div className="flex items-center gap-2 text-[11px]">
                              <span className="rounded-full bg-white/[0.06] px-1.5 py-px font-[600] tracking-wide text-[#9AA1AC]">{humanizeKey(l.action)}</span>
                              <span className="text-[#656B75]">{fmtDateLong(l.created_at)} · {new Date(l.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                            </div>
                            <p className="mt-1 truncate text-[12px] text-[#9AA1AC]">{l.meta?.title || l.meta?.task || l.resource_id.slice(0, 8)}</p>
                          </div>
                        ))}
                      {audit.filter((l) => {
                        const ids = new Set([...(intel?.decisions || []).map((d: any) => d.id), ...(intel?.actions || []).map((a: any) => a.id)]);
                        return ids.has(l.resource_id);
                      }).length === 0 && <p className="px-5 py-3 text-[12px] text-[#656B75]">No activity for this meeting yet.</p>}
                    </div>
                  )}
                </section>
              </div>
            </aside>
          </div>
        )}
      </main>

      <EvidenceDrawer open={!!ev} onClose={() => setEv(null)} eyebrow={ev?.type || ""} title={ev?.item?.title || ev?.item?.task || ev?.item?.text || ""} entries={evSegments} onOpenTranscript={openTranscriptAt} />

      <Modal open={!!editD} onClose={() => setEditD(null)} title="Revise decision">
        <label htmlFor="dec-title" className="text-[12px] font-[500] text-[#9AA1AC]">What was actually decided?</label>
        <textarea id="dec-title" rows={3} value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="input mt-2 resize-none leading-relaxed" aria-label="Decision title" />
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => setEditD(null)} className="btn btn-subtle h-[34px] px-3 text-[13px]">Cancel</button>
          <button
            onClick={async () => {
              if (!editD || !editTitle.trim()) return;
              await patchDecision(editD, { title: editTitle.trim(), status: "REVISED" }, "Decision revised");
              setEditD(null);
            }}
            className="btn h-[34px] bg-[#F5F7FA] px-4 text-[13px] font-[600] text-[#08090B] hover:bg-white"
          >
            Save revision
          </button>
        </div>
      </Modal>

      <Modal open={!!dismissD} onClose={() => setDismissD(null)} title="Dismiss decision" width={420}>
        <p className="text-[13.5px] leading-relaxed text-[#9AA1AC]">
          Dismissing tells Decentra this wasn&apos;t actually decided. It stays in your records as <span className="font-[600] text-[#C7CCD4]">rejected</span> — nothing is deleted.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={() => setDismissD(null)} className="btn btn-subtle h-[34px] px-3 text-[13px]">Keep reviewing</button>
          <button
            onClick={async () => {
              if (!dismissD) return;
              await patchDecision(dismissD, { status: "REJECTED" }, "Decision dismissed");
              setDismissD(null);
            }}
            className="btn h-[34px] bg-[#EF4444] px-4 text-[13px] font-[600] text-white hover:bg-[#DC2626]"
          >
            Dismiss
          </button>
        </div>
      </Modal>

      <Modal open={!!ownerA} onClose={() => setOwnerA(null)} title="Assign owner" width={420}>
        <label htmlFor="owner-name" className="text-[12px] font-[500] text-[#9AA1AC]">Who is accountable?</label>
        <input id="owner-name" value={ownerVal} onChange={(e) => setOwnerVal(e.target.value)} placeholder="e.g. Arun Kumar" className="input mt-2" autoComplete="off" />
        <p className="mt-2 text-[11.5px] text-[#656B75]">Leave empty to mark unassigned — unowned work won&apos;t silently disappear from reports.</p>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => setOwnerA(null)} className="btn btn-subtle h-[34px] px-3 text-[13px]">Cancel</button>
          <button
            onClick={async () => {
              if (!ownerA) return;
              await patchAction(ownerA, { owner_name: ownerVal.trim() || null }, ownerVal.trim() ? "Owner assigned" : "Owner cleared");
              setOwnerA(null);
            }}
            className="btn h-[34px] bg-[#F5F7FA] px-4 text-[13px] font-[600] text-[#08090B] hover:bg-white"
          >
            <UserPlus className="mr-1.5 inline h-3.5 w-3.5" aria-hidden="true" /> Save
          </button>
        </div>
      </Modal>

      <Modal open={!!dlA} onClose={() => setDlA(null)} title="Set deadline" width={440}>
        <label htmlFor="dl-date" className="text-[12px] font-[500] text-[#9AA1AC]">Pick a date</label>
        <input id="dl-date" type="date" value={dlDate} onChange={(e) => setDlDate(e.target.value)} className="input mt-2 [color-scheme:dark]" />
        <div className="my-4 flex items-center gap-3 text-[11px] font-[600] uppercase tracking-[0.14em] text-[#656B75]">
          <span className="h-px flex-1 bg-white/[0.06]" /> or as discussed <span className="h-px flex-1 bg-white/[0.06]" />
        </div>
        <label htmlFor="dl-text" className="text-[12px] font-[500] text-[#9AA1AC]">Free text exactly as said</label>
        <input id="dl-text" value={dlText} onChange={(e) => setDlText(e.target.value)} placeholder='e.g. "before Friday standup"' className="input mt-2" autoComplete="off" />
        <p className="mt-2 text-[11.5px] text-[#656B75]">Ambiguous dates are kept verbatim and shown as “needs confirmation” instead of being guessed.</p>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => setDlA(null)} className="btn btn-subtle h-[34px] px-3 text-[13px]">Cancel</button>
          <button
            onClick={async () => {
              if (!dlA) return;
              const iso = dlDate ? dlDate : dlText.trim() || null;
              await patchAction(dlA, { deadline_raw: iso }, iso ? "Deadline saved" : "Deadline cleared");
              setDlA(null);
            }}
            className="btn h-[34px] bg-[#F5F7FA] px-4 text-[13px] font-[600] text-[#08090B] hover:bg-white"
          >
            <CalendarClock className="mr-1.5 inline h-3.5 w-3.5" aria-hidden="true" /> Save
          </button>
        </div>
      </Modal>

      <Modal open={!!dnaData} onClose={() => setDnaData(null)} title="Decision DNA" width={560}>
        {dnaData && (
          <div className="space-y-4 text-[12.5px] leading-relaxed">
            <div>
              <p className="text-[13px] font-[600] text-[#F5F7FA]">{dnaData.decision?.title}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-[600] tracking-wide text-[#9AA1AC]">{humanizeKey(dnaData.dna?.decision_class) || "Decision"}</span>
                <ProvenancePill value={dnaData.dna?.provenance} />
                <span className="text-[11px] text-[#656B75]">v{dnaData.dna?.version}</span>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><p className="text-[11px] font-[600] uppercase tracking-[0.12em] text-[#656B75]">Requirements</p><ul className="mt-1 list-disc pl-4 text-[#9AA1AC]">{(dnaData.dna?.requirements||[]).map((r:string)=><li key={r}>{r}</li>)}</ul></div>
              <div><p className="text-[11px] font-[600] uppercase tracking-[0.12em] text-[#656B75]">Constraints</p><ul className="mt-1 list-disc pl-4 text-[#9AA1AC]">{(dnaData.dna?.constraints||[]).map((r:string)=><li key={r}>{r}</li>)}</ul></div>
              <div><p className="text-[11px] font-[600] uppercase tracking-[0.12em] text-[#656B75]">Affected</p><p className="text-[#9AA1AC]">Systems: {(dnaData.dna?.affected_systems||[]).join(", ") || "—"}<br/>Teams: {(dnaData.dna?.affected_teams||[]).join(", ") || "—"}</p></div>
              <div><p className="text-[11px] font-[600] uppercase tracking-[0.12em] text-[#656B75]">Expected outcome</p><p className="text-[#9AA1AC]">{dnaData.dna?.expected_outcome || "—"}</p></div>
            </div>
            {dnaData.branches?.length>0 && (
              <div>
                <p className="text-[11px] font-[600] uppercase tracking-[0.12em] text-[#656B75]">Branching — consequences</p>
                <div className="stagger mt-2 space-y-2">
                  {dnaData.branches.map((b:any, i:number)=> (
                    <div key={b.id} className="group relative overflow-hidden rounded-[12px] border border-white/[0.08] bg-white/[0.03] p-3 transition hover:bg-white/[0.05] hover:border-white/15">
                      <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-gradient-to-b from-[#0EA5E9]/50 to-[#A78BFA]/30" />
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0EA5E9]/15 text-[10px] font-[700] text-[#38BDF8]">{i+1}</span>
                        <span className="text-[10px] font-[700] uppercase tracking-[0.12em] text-[#38BDF8]">{humanizeKey(b.branch_type)}</span>
                        <span className="ml-auto"><ProvenancePill value={b.provenance} /></span>
                      </div>
                      <p className="mt-1.5 text-[12.5px] font-[600] leading-snug text-[#F5F7FA]">{b.title}</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-[#9AA1AC]">{b.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <p className="text-[11px] text-[#656B75]">Version {dnaData.dna?.version} · Provenance determines trust: <span className="text-[#F5F7FA]">human-approved</span> is verified organizational knowledge.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}

function SpinnerMini() {
  return <span className="inline-flex items-center gap-0.5" role="status" aria-label="In progress"><span className="thinking-dot h-1 w-1 rounded-full bg-current" /><span className="thinking-dot h-1 w-1 rounded-full bg-current" /><span className="thinking-dot h-1 w-1 rounded-full bg-current" /></span>;
}

function MarkerChip({ type, item, onClick }: { type: string; item: any; onClick: () => void }) {
  const cfg =
    type === "decision"
      ? { dot: item.status === "CONFIRMED" ? "#34D399" : item.status === "REJECTED" ? "#656B75" : "#FBBF24", label: "Decision" }
      : type === "action"
      ? { dot: "#38BDF8", label: "Action" }
      : { dot: "#A78BFA", label: "Question" };
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick(); }} className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[10px] font-[600] tracking-wide text-[#9AA1AC] transition hover:border-white/[0.16] hover:text-[#F5F7FA]" aria-label={`View evidence for ${cfg.label.toLowerCase()}`}>
      <span aria-hidden="true" className="text-[9px]" style={{ color: cfg.dot }}>{type === "decision" ? "◆" : type === "action" ? "●" : "?"}</span>
      {cfg.label}
    </button>
  );
}

function EvidenceChip({ ids, segMap, onClick }: { ids?: string[] | null; segMap: Map<string, Segment>; onClick: () => void }) {
  if (!ids?.length) return <span className="text-[10.5px] text-[#656B75]">no evidence linked</span>;
  const times = ids.slice(0, 2).map((sid) => segMap.get(sid)).filter(Boolean).map((s: any) => msToClock(s.start_ms));
  return (
    <button onClick={onClick} className="mono inline-flex items-center gap-1 rounded-[6px] border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 text-[10px] tabular-nums text-[#9AA1AC] transition hover:border-[#0EA5E9]/40 hover:text-[#38BDF8]" aria-label="View transcript evidence">
      ◆ {times.join(" · ")}{ids.length > 2 ? ` +${ids.length - 2}` : ""}
    </button>
  );
}

function QuietEmpty({ text }: { text: string }) {
  return <p className="px-5 py-3 text-[12.5px] text-[#656B75]">{text}</p>;
}

function DecisionRow({ d, onEvidence, onConfirm, onEdit, onDismiss, onReview, onDNA }: { d: any; onEvidence: () => void; onConfirm: () => void; onEdit: () => void; onDismiss: () => void; onReview: () => void; onDNA: () => void }) {
  const rejected = d.status === "REJECTED";
  return (
    <div className={`border-b border-white/[0.04] px-5 py-4 transition hover:bg-white/[0.015] ${rejected ? "opacity-55" : ""}`}>
      <div className="flex items-center gap-2">
        <DecisionPill status={d.status} />
        <Confidence value={d.confidence} />
      </div>
      <p className={`mt-2 text-[14px] font-[600] leading-snug tracking-[-0.005em] text-[#F0F3F7] ${rejected ? "line-through decoration-white/25" : ""}`}>{d.title}</p>
      {d.description && <p className="mt-1 text-[12.5px] leading-relaxed text-[#9AA1AC]">{d.description}</p>}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <button onClick={onEvidence} className="mono inline-flex items-center gap-1 rounded-[6px] border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 text-[10px] tabular-nums text-[#9AA1AC] transition hover:border-[#0EA5E9]/40 hover:text-[#38BDF8]" aria-label="View evidence in transcript">
          ◆ Evidence
        </button>
        <button onClick={onDNA} className="inline-flex items-center gap-1 rounded-[6px] border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 text-[10px] font-[600] tracking-wide text-[#9AA1AC] hover:border-white/15 hover:text-white" aria-label="View Decision DNA">DNA</button>
        {d.status === "DETECTED" && (
          <>
            <button onClick={onConfirm} className="ml-auto inline-flex items-center gap-1 rounded-[8px] bg-[#10B981] px-2.5 py-1 text-[11px] font-[650] text-[#06281E] transition hover:bg-[#0EA371]">
              <Check className="h-3 w-3" aria-hidden="true" /> Confirm
            </button>
            <button onClick={onEdit} className="rounded-[8px] border border-white/[0.09] px-2.5 py-1 text-[11px] font-[550] text-[#C7CCD4] transition hover:bg-white/[0.06]">Edit</button>
            <button onClick={onDismiss} className="px-1.5 py-1 text-[11px] font-[550] text-[#F87171]/80 transition hover:text-[#F87171]">Dismiss</button>
          </>
        )}
        {(d.status === "CONFIRMED" || d.status === "REVISED") && (
          <button onClick={onReview} className="ml-auto px-1.5 py-1 text-[11px] font-[550] text-[#656B75] transition hover:text-[#9AA1AC]">Move back to review</button>
        )}
        {rejected && (
          <button onClick={onReview} className="ml-auto inline-flex items-center gap-1 px-1.5 py-1 text-[11px] font-[550] text-[#656B75] transition hover:text-[#9AA1AC]">
            <RotateCcw className="h-3 w-3" aria-hidden="true" /> Restore to review
          </button>
        )}
      </div>
    </div>
  );
}

function ActionRow({ a, segMap, onToggle, onOwner, onDeadline, onStatus, onEvidence }: { a: any; segMap: Map<string, Segment>; onToggle: () => void; onOwner: () => void; onDeadline: () => void; onStatus: (s: string) => void; onEvidence: () => void }) {
  const completed = a.status === "COMPLETED";
  const dl = fmtDeadline(a.deadline_raw);
  return (
    <div className={`border-b border-white/[0.04] px-5 py-4 transition hover:bg-white/[0.015] ${completed ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-3">
        <button
          onClick={onToggle}
          aria-label={completed ? "Mark as not started" : "Mark complete"}
          aria-pressed={completed}
          className={`mt-0.5 flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full border transition ${completed ? "border-[#10B981] bg-[#10B981]" : "border-white/[0.18] hover:border-white/[0.35]"}`}
        >
          {completed && <Check className="animate-pop h-3 w-3 text-[#06281E]" strokeWidth={3} aria-hidden="true" />}
        </button>
        <div className="min-w-0 flex-1">
          <p className={`text-[13.5px] font-[550] leading-snug text-[#E9EDF2] ${completed ? "line-through decoration-white/25" : ""}`}>{a.task}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <button
              onClick={onOwner}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-[550] transition ${a.owner_name ? "border-white/[0.08] bg-white/[0.03] text-[#9AA1AC] hover:border-white/[0.16] hover:text-[#F5F7FA]" : "border-dashed border-[#F59E0B]/40 bg-[#F59E0B]/[0.07] text-[#FBBF24] hover:bg-[#F59E0B]/[0.12]"}`}
              aria-label={a.owner_name ? `Change owner, currently ${a.owner_name}` : "Assign an owner"}
            >
              {a.owner_name ? <Avatar name={a.owner_name} size={14} /> : <UserPlus className="h-3 w-3" aria-hidden="true" />}
              {a.owner_name || "Assign owner"}
            </button>
            <button
              onClick={onDeadline}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-[550] transition ${
                !a.deadline_raw
                  ? "border-dashed border-[#F59E0B]/40 bg-[#F59E0B]/[0.07] text-[#FBBF24] hover:bg-[#F59E0B]/[0.12]"
                  : dl.overdue
                  ? "border-[#EF4444]/30 bg-[#EF4444]/[0.08] text-[#F87171]"
                  : dl.today
                  ? "border-[#F59E0B]/30 bg-[#F59E0B]/[0.08] text-[#FBBF24]"
                  : "border-white/[0.08] bg-white/[0.03] text-[#9AA1AC] hover:border-white/[0.16] hover:text-[#F5F7FA]"
              }`}
              aria-label={a.deadline_raw ? `Change deadline, currently ${a.deadline_raw}` : "Set a deadline"}
            >
              <CalendarClock className="h-3 w-3" aria-hidden="true" />
              {a.deadline_raw ? dl.label || a.deadline_raw : "Needs confirmation"}
            </button>
            <EvidenceChip ids={a.evidence_segment_ids} segMap={segMap} onClick={onEvidence} />
          </div>
          <div>
            <select
              value={a.status}
              onChange={(e) => onStatus(e.target.value)}
              aria-label="Action status"
              className="mt-2 cursor-pointer rounded-[8px] border border-white/[0.08] bg-transparent px-1.5 py-0.5 text-[10.5px] font-[550] uppercase tracking-wider text-[#9AA1AC] outline-none transition hover:border-white/[0.16] focus:border-[#0EA5E9]/40"
            >
              <option value="NOT_STARTED">Not started</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="BLOCKED">Blocked</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
