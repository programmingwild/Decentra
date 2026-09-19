"use client";
import { SpeakerChip } from "@/components/ui/primitives";
import { msToClock } from "@/lib/format";
import { X, ArrowRight } from "lucide-react";

export type Segment = { id: string; speaker_label: string; start_ms: number; end_ms: number; text: string; confidence?: number | null };

export function TranscriptBlock({ seg, dense = false }: { seg: Segment; dense?: boolean }) {
  const lowConf = seg.confidence != null && seg.confidence < 0.6;
  return (
    <div className={dense ? "" : "py-0.5"}>
      <div className={`flex items-baseline gap-3 ${dense ? "" : "mb-1"}`}>
        <span className="mono w-[44px] shrink-0 text-right text-[11px] tabular-nums text-[#656B75]">{msToClock(seg.start_ms)}</span>
        <SpeakerChip name={seg.speaker_label} />
        {lowConf && <span className="rounded-full border border-[#F59E0B]/25 bg-[#F59E0B]/[0.10] px-1.5 py-px text-[9px] font-[700] uppercase tracking-[0.08em] text-[#FBBF24]">low confidence</span>}
      </div>
      <p className={`mt-1 pl-[56px] text-[13.5px] leading-[1.65] text-[#C9CFD8] ${dense ? "text-[13px]" : ""}`}>&ldquo;{seg.text}&rdquo;</p>
    </div>
  );
}

export function EvidenceDrawer({
  open,
  onClose,
  eyebrow,
  title,
  entries,
  onOpenTranscript,
}: {
  open: boolean;
  onClose: () => void;
  eyebrow: string;
  title: string;
  entries: Segment[];
  onOpenTranscript: (segmentId: string) => void;
}) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-[2px] lg:bg-black/30" onClick={onClose} aria-hidden="true" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Evidence: ${title}`}
        className="animate-drawer fixed inset-x-0 bottom-0 z-[130] flex max-h-[72vh] flex-col rounded-t-[18px] border-t border-white/[0.09] bg-[#101216] shadow-[0_-16px_60px_rgba(0,0,0,0.7)] lg:inset-x-auto lg:right-0 lg:top-0 lg:max-h-none lg:h-full lg:w-[440px] lg:rounded-none lg:rounded-l-[18px] lg:border-l lg:border-t-0 animate-rise"
      >
        <header className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
          <div className="min-w-0">
            <div className="text-[10px] font-[700] uppercase tracking-[0.16em] text-[#38BDF8]">Evidence · {eyebrow}</div>
            <h2 className="mt-1.5 truncate text-[14.5px] font-[650] tracking-[-0.01em] text-[#F5F7FA]">{title}</h2>
            <p className="mt-1 text-[11.5px] text-[#656B75]">{entries.length} moment{entries.length === 1 ? "" : "s"} this is based on</p>
          </div>
          <button onClick={onClose} className="rounded-[8px] p-1.5 text-[#656B75] transition hover:bg-white/[0.06] hover:text-white" aria-label="Close evidence">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="flex-1 space-y-5 overflow-auto px-5 py-5">
          {entries.length === 0 && (
            <p className="py-8 text-center text-[13px] text-[#656B75]">No transcript moments are linked to this item yet.</p>
          )}
          {entries.map((s) => (
            <button key={s.id} onClick={() => onOpenTranscript(s.id)} className="group block w-full rounded-[12px] border border-white/[0.06] bg-[#15181D] p-4 text-left transition hover:border-[#0EA5E9]/25 hover:bg-[#171B21]">
              <TranscriptBlock seg={s} dense />
              <span className="mt-2 inline-flex items-center gap-1 pl-[56px] text-[11px] font-[550] text-[#38BDF8] opacity-0 transition group-hover:opacity-100">
                Open in transcript <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </span>
            </button>
          ))}
        </div>
        <footer className="border-t border-white/[0.06] px-5 py-3.5">
          <button onClick={() => entries[0] && onOpenTranscript(entries[0].id)} disabled={!entries[0]} className="btn h-[34px] w-full gap-2 bg-[#F5F7FA] text-[12.5px] font-[600] text-[#08090B] hover:bg-white disabled:opacity-40">
            Open transcript at first moment
          </button>
        </footer>
      </aside>
    </>
  );
}
