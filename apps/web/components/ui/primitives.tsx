"use client";
import { speakerColor, initials, humanizeKey } from "@/lib/format";

const DECISION_LABELS: Record<string, string> = {
  DETECTED: "Detected",
  CONFIRMED: "Confirmed",
  REVISED: "Revised",
  REJECTED: "Rejected",
  SUPERSEDED: "Superseded",
};

const DECISION_STYLES: Record<string, string> = {
  DETECTED: "bg-[#F59E0B]/[0.12] text-[#FBBF24] border-[#F59E0B]/25 border-dashed",
  CONFIRMED: "bg-[#10B981]/[0.12] text-[#34D399] border-[#10B981]/25",
  REVISED: "bg-[#0EA5E9]/[0.12] text-[#38BDF8] border-[#0EA5E9]/25",
  REJECTED: "bg-white/[0.04] text-[#656B75] border-white/[0.08]",
  SUPERSEDED: "bg-[#8B5CF6]/[0.12] text-[#A78BFA] border-[#8B5CF6]/25",
};

const MEETING_LABELS: Record<string, string> = {
  draft: "Draft",
  recording: "Recording",
  processing: "Processing",
  ready: "Ready",
  failed: "Failed",
};

const MEETING_STYLES: Record<string, string> = {
  draft: "bg-white/[0.05] text-[#9AA1AC] border-white/[0.08]",
  recording: "bg-[#EF4444]/[0.12] text-[#F87171] border-[#EF4444]/25",
  processing: "bg-[#0EA5E9]/[0.12] text-[#38BDF8] border-[#0EA5E9]/25",
  ready: "bg-[#10B981]/[0.12] text-[#34D399] border-[#10B981]/25",
  failed: "bg-[#EF4444]/[0.12] text-[#F87171] border-[#EF4444]/25",
};

const ACTION_LABELS: Record<string, { style: string; label: string }> = {
  NOT_STARTED: { style: "bg-white/[0.05] text-[#9AA1AC] border-white/[0.08]", label: "Not started" },
  IN_PROGRESS: { style: "bg-[#0EA5E9]/[0.12] text-[#38BDF8] border-[#0EA5E9]/25", label: "In progress" },
  BLOCKED: { style: "bg-[#F59E0B]/[0.12] text-[#FBBF24] border-[#F59E0B]/25", label: "Blocked" },
  COMPLETED: { style: "bg-[#10B981]/[0.12] text-[#34D399] border-[#10B981]/25", label: "Completed" },
  OVERDUE: { style: "bg-[#EF4444]/[0.12] text-[#F87171] border-[#EF4444]/25", label: "Overdue" },
  CANCELLED: { style: "bg-white/[0.04] text-[#656B75] border-white/[0.08]", label: "Cancelled" },
};

export function DecisionPill({ status, className = "" }: { status: string; className?: string }) {
  const style = DECISION_STYLES[status] || DECISION_STYLES.REJECTED;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-[700] tracking-[0.08em] uppercase ${style} ${className}`}>
      {status === "DETECTED" && <span className="h-1 w-1 rounded-full bg-current pulse-dot" aria-hidden="true" />}
      {status === "CONFIRMED" && <svg viewBox="0 0 10 10" className="h-2 w-2" aria-hidden="true"><path d="M1.5 5.5l2.2 2.2L8.5 2.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      {DECISION_LABELS[status] || status}
    </span>
  );
}

const PROVENANCE_STYLES: Record<string, { label: string; style: string }> = {
  HUMAN_APPROVED: { label: "Human approved", style: "bg-[#10B981]/[0.12] text-[#34D399] border-[#10B981]/25" },
  AI_INFERRED: { label: "AI inferred", style: "bg-[#F59E0B]/[0.12] text-[#FBBF24] border-[#F59E0B]/25 border-dashed" },
  TRANSCRIPT_DERIVED: { label: "Transcript derived", style: "bg-white/[0.05] text-[#9AA1AC] border-white/[0.08]" },
  EXTERNAL_RESEARCH: { label: "External research", style: "bg-[#0EA5E9]/[0.12] text-[#38BDF8] border-[#0EA5E9]/25" },
  AI_RECOMMENDATION: { label: "AI recommendation", style: "bg-[#8B5CF6]/[0.12] text-[#A78BFA] border-[#8B5CF6]/25" },
};

/** Formal provenance badge — never render raw PROVENANCE_CONSTANTS in UI. */
export function ProvenancePill({ value, className = "" }: { value: string | null | undefined; className?: string }) {
  const key = (value || "").toUpperCase();
  const cfg = PROVENANCE_STYLES[key];
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-[600] tracking-wide ${cfg ? cfg.style : "bg-white/[0.05] text-[#9AA1AC] border-white/[0.08]"} ${className}`}>
      {cfg ? cfg.label : humanizeKey(value)}
    </span>
  );
}

export function MeetingStatusPill({ status, className = "" }: { status: string; className?: string }) {
  const style = MEETING_STYLES[status] || MEETING_STYLES.draft;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-[700] tracking-[0.08em] uppercase ${style} ${className}`}>
      {status === "processing" && <span className="h-1 w-1 rounded-full bg-current pulse-dot" aria-hidden="true" />}
      {MEETING_LABELS[status] || status}
    </span>
  );
}

export function ActionPill({ status, className = "" }: { status: string; className?: string }) {
  const cfg = ACTION_LABELS[status] || ACTION_LABELS.NOT_STARTED;
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-[700] tracking-[0.08em] uppercase ${cfg.style} ${className}`}>{cfg.label}</span>;
}

export function SectionLabel({ children, count, accent }: { children: React.ReactNode; count?: number; accent?: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className={`text-[11px] font-[700] tracking-[0.14em] uppercase ${accent || "text-[#656B75]"}`}>{children}</span>
      {count != null && <span className="mono text-[11px] text-[#656B75]">{count}</span>}
    </div>
  );
}

export function Avatar({ name, size = 24 }: { name: string | null | undefined; size?: number }) {
  const c = speakerColor(name);
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-full border border-white/[0.06] font-[700]"
      style={{ width: size, height: size, background: c.bg, color: c.fg, fontSize: Math.max(9, size * 0.36) }}
    >
      {initials(name)}
    </span>
  );
}

export function SpeakerChip({ name }: { name: string | null | undefined }) {
  const unknown = !name || /unknown/i.test(name);
  const c = speakerColor(name);
  return (
    <span
      className={`text-[10.5px] font-[700] tracking-[0.1em] uppercase ${unknown ? "text-[#FBBF24]" : ""}`}
      style={unknown ? undefined : { color: c.fg }}
    >
      {name || "Unknown"}
    </span>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[5px] border border-white/[0.09] bg-white/[0.05] px-1 font-mono text-[10px] font-[500] text-[#9AA1AC]">{children}</kbd>;
}

export function Confidence({ value }: { value: number | null | undefined }) {
  if (value == null) return null;
  const pct = Math.round(value * 100);
  return (
    <span className="inline-flex items-center gap-1.5" title={`Extraction confidence ${pct}%`}>
      <span className="relative h-[3px] w-9 overflow-hidden rounded-full bg-white/[0.07]">
        <span className="absolute inset-y-0 left-0 rounded-full bg-[#0EA5E9]/70" style={{ width: `${pct}%` }} />
      </span>
      <span className="mono text-[10px] text-[#656B75]">{pct}%</span>
    </span>
  );
}

export function SeverityDot({ severity }: { severity: string | null | undefined }) {
  const s = (severity || "").toLowerCase();
  const color = s.includes("high") ? "#F87171" : s.includes("medium") ? "#FBBF24" : s.includes("low") ? "#656B75" : "#9AA1AC";
  return <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} aria-label={`${severity || "unknown"} severity`} />;
}
