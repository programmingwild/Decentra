"use client";

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

export function SkeletonLines({ n = 3, className = "" }: { n?: number; className?: string }) {
  return (
    <div className={`space-y-2.5 ${className}`}>
      {Array.from({ length: n }).map((_, i) => (
        <Skeleton key={i} className={`h-3.5 ${i === n - 1 ? "w-2/5" : i % 3 === 1 ? "w-4/5" : "w-full"}`} />
      ))}
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 py-4">
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-6 w-16 rounded-full" />
    </div>
  );
}

export function SpinnerDots({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`} role="status" aria-label="Loading">
      {[0, 1, 2].map((i) => (
        <span key={i} className="thinking-dot h-1 w-1 rounded-full bg-current" />
      ))}
    </span>
  );
}

export function EmptyState({ icon, title, body, action }: { icon?: React.ReactNode; title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="reveal group relative flex flex-col items-center justify-center overflow-hidden rounded-[20px] border border-white/[0.04] bg-white/[0.015] px-6 py-14 text-center">
      <div className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-[#D4A574]/50 to-transparent" aria-hidden="true" />
      <div className="pointer-events-none absolute -top-10 left-1/2 h-32 w-64 -translate-x-1/2 orb orb-violet opacity-[0.08]" />
      {icon && <div className="relative mb-4 flex h-11 w-11 items-center justify-center rounded-[14px] border border-white/[0.08] bg-white/[0.04] text-[#D4A574] shadow-[0_4px_12px_rgba(0,0,0,0.2)] transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3">{icon}</div>}
      <div className="relative text-[14.5px] font-[650] tracking-[-0.01em] text-[#E9EDF2]">{title}</div>
      {body && <p className="relative mt-1.5 max-w-[360px] text-[13px] leading-relaxed text-[#9AA1AC]">{body}</p>}
      {action && <div className="relative mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ title, reason, hint, actionLabel, onAction }: { title: string; reason?: string; hint?: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <div role="alert" className="rounded-[14px] border border-[#EF4444]/20 bg-[#EF4444]/[0.06] p-5">
      <div className="text-[13.5px] font-[650] tracking-[-0.01em] text-[#FCA5A5]">{title}</div>
      {reason && <p className="mt-1 text-[13px] leading-relaxed text-[#9AA1AC]">{reason}</p>}
      {hint && <p className="mt-1 text-[12px] text-[#656B75]">{hint}</p>}
      {actionLabel && onAction && (
        <button onClick={onAction} className="btn mt-4 h-[32px] border border-[#EF4444]/30 bg-[#EF4444]/15 px-3.5 text-[12.5px] font-[600] text-[#FCA5A5] hover:bg-[#EF4444]/25">
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export function friendlyError(e: any, fallback = "Something went wrong"): { title: string; reason: string } {
  let raw = "";
  try {
    if (e?.message) {
      try {
        const j = JSON.parse(e.message);
        raw = j.detail || j.message || e.message;
      } catch {
        raw = e.message;
      }
    }
  } catch {}
  raw = String(raw || fallback);
  const lower = raw.toLowerCase();
  if (lower.includes("format") || lower.includes("unsupported")) return { title: "We couldn't process this file", reason: "The audio format isn't supported. Upload MP3, WAV, M4A, WEBM, MP4, MOV or OGG." };
  if (lower.includes("too large") || lower.includes("size")) return { title: "That file is too large", reason: "Recordings can be up to 200MB. Try compressing the audio first." };
  if (lower.includes("empty")) return { title: "The file appears to be empty", reason: "Nothing was uploaded. Check the file and try again." };
  if (lower.includes("transcription")) return { title: "Transcription failed", reason: "We couldn't generate a transcript from this recording." };
  if (lower.includes("extraction")) return { title: "Intelligence extraction failed", reason: "The transcript was created, but we couldn't extract decisions from it." };
  if (lower.includes("network") || lower.includes("failed to fetch")) return { title: "Connection problem", reason: "Decentra couldn't reach the server. Check your connection and retry." };
  if (lower.includes("403") || lower.includes("not a member")) return { title: "You don't have access", reason: "Your account isn't a member of this workspace." };
  return { title: fallback, reason: raw.length > 200 ? raw.slice(0, 200) + "…" : raw };
}
