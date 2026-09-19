"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { fmtDeadline } from "@/lib/format";
import { Check } from "lucide-react";

export function CompleteToggle({ id, done, onDone }: { id: string; done: boolean; onDone?: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await api(`/api/v1/actions/${id}`, { method: "PATCH", body: JSON.stringify({ status: done ? "NOT_STARTED" : "COMPLETED" }) });
          onDone?.();
        } finally {
          setBusy(false);
        }
      }}
      aria-label={done ? "Mark as not started" : "Mark complete"}
      aria-pressed={done}
      className={`mt-0.5 flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full border transition ${done ? "border-[#10B981] bg-[#10B981]" : "border-white/[0.18] hover:border-white/[0.35]"}`}
    >
      {done && <Check className="animate-pop h-3 w-3 text-[#06281E]" strokeWidth={3} aria-hidden="true" />}
    </button>
  );
}

export function DueLine({ raw, status }: { raw: string | null | undefined; status: string }) {
  if (status === "COMPLETED") return <span className="text-[11px] uppercase tracking-wider text-[#10B981]/80">Completed</span>;
  const dl = fmtDeadline(raw);
  if (!raw) return <span className="text-[11px] uppercase tracking-wider text-[#FBBF24]/80">No deadline confirmed</span>;
  return (
    <span className={`text-[11px] uppercase tracking-wider ${dl.overdue ? "text-[#F87171]" : dl.today ? "text-[#FBBF24]" : "text-[#656B75]"}`}>
      {dl.overdue ? "Overdue · " : dl.today ? "Due today · " : "Due "}
      {dl.label || raw}
    </span>
  );
}
