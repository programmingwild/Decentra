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
      className={`mt-0.5 flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full border transition ${done ? "border-[var(--emerald-2)] bg-[var(--emerald-2)]" : "border-[var(--border-strong)] hover:border-[var(--border-strong)]"}`}
    >
      {done && <Check className="animate-pop h-3 w-3 text-[#06281E]" strokeWidth={3} aria-hidden="true" />}
    </button>
  );
}

export function DueLine({ raw, status }: { raw: string | null | undefined; status: string }) {
  if (status === "COMPLETED") return <span className="text-[11px] uppercase tracking-wider text-[color-mix(in_srgb,var(--emerald-2)_80%,transparent)]">Completed</span>;
  const dl = fmtDeadline(raw);
  if (!raw) return <span className="text-[11px] uppercase tracking-wider text-[color-mix(in_srgb,var(--amber)_80%,transparent)]">No deadline confirmed</span>;
  return (
    <span className={`text-[11px] uppercase tracking-wider ${dl.overdue ? "text-[var(--red)]" : dl.today ? "text-[var(--amber)]" : "text-[var(--subtle)]"}`}>
      {dl.overdue ? "Overdue · " : dl.today ? "Due today · " : "Due "}
      {dl.label || raw}
    </span>
  );
}
