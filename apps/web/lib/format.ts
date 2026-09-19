export function msToClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function msToDuration(ms: number | null | undefined): string {
  if (!ms) return "—";
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "No date";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (isNaN(dt.getTime())) return "No date";
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function fmtDateTime(d: string | Date | null | undefined): string {
  if (!d) return "No date";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (isNaN(dt.getTime())) return "No date";
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " · " + dt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** Formal, locale-stable long date: "Aug 24, 2026". Never locale-numeric. */
export function fmtDateLong(d: string | Date | null | undefined): string {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (isNaN(dt.getTime())) return "";
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Turn raw enum keys into formal labels: due_soon -> Due Soon,
    decision.confirmed -> Decision Confirmed, TRANSCRIPT_DERIVED -> Transcript Derived. */
export function humanizeKey(s: string | null | undefined): string {
  if (!s) return "";
  return String(s)
    .split(/[_.\s-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export function dayGroup(d: string | Date | null | undefined): string {
  if (!d) return "UNDATED";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (isNaN(dt.getTime())) return "UNDATED";
  const now = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(dt)) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays > 1 && diffDays < 7) return "This week";
  if (diffDays >= 7 && diffDays < 30) return "Earlier this month";
  return dt.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/** Best-effort parse of free-text deadline. Returns null when ambiguous — callers must show "Needs confirmation". */
export function parseDeadline(raw: string | null | undefined, from: Date = new Date()): Date | null {
  if (!raw) return null;
  const t = raw.trim().toLowerCase();
  if (!t) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return isNaN(d.getTime()) ? null : d;
  }
  if (/^today$|^now$/.test(t)) return new Date(from);
  if (/^tomorrow$/.test(t)) { const d = new Date(from); d.setDate(d.getDate() + 1); return d; }
  if (/next week/.test(t)) { const d = new Date(from); d.setDate(d.getDate() + 7); return d; }
  if (/end of (the )?week/.test(t)) { const d = new Date(from); d.setDate(d.getDate() + (5 - d.getDay())); return d; }
  if (/end of (the )?month/.test(t)) return new Date(from.getFullYear(), from.getMonth() + 1, 0);
  for (let i = 0; i < 7; i++) {
    if (new RegExp(`^(this |next )?${WEEKDAYS[i]}$`).test(t) || new RegExp(`^(this |next )?${WEEKDAYS[i].slice(0, 3)}$`).test(t)) {
      const d = new Date(from);
      let delta = (i - d.getDay() + 7) % 7;
      if (delta === 0) delta = 7;
      if (/^next/.test(t) && delta < 7) delta += 0;
      d.setDate(d.getDate() + delta);
      return d;
    }
  }
  const slash = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/.exec(t);
  if (slash) {
    const y = slash[3] ? Number(slash[3].length === 2 ? `20${slash[3]}` : slash[3]) : from.getFullYear();
    const d = new Date(y, Number(slash[1]) - 1, Number(slash[2]));
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function fmtDeadline(raw: string | null | undefined): { label: string; due: Date | null; overdue: boolean; today: boolean } {
  const due = parseDeadline(raw);
  if (!due) return { label: raw || "", due: null, overdue: false, today: false };
  const now = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(due) - startOf(now)) / 86400000);
  const label = diffDays === 0 ? "Today" : diffDays === 1 ? "Tomorrow" : diffDays === -1 ? "1 day late" : diffDays < 0 ? `${Math.abs(diffDays)} days late` : due.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return { label, due, overdue: diffDays < 0, today: diffDays === 0 };
}

export function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

const SPEAKER_HUES = [
  { bg: "rgba(14,165,233,0.16)", fg: "#7DD3FC" },
  { bg: "rgba(139,92,246,0.16)", fg: "#C4B5FD" },
  { bg: "rgba(16,185,129,0.16)", fg: "#6EE7B7" },
  { bg: "rgba(245,158,11,0.16)", fg: "#FCD34D" },
  { bg: "rgba(244,63,94,0.14)", fg: "#FDA4AF" },
  { bg: "rgba(34,211,238,0.14)", fg: "#67E8F9" },
  { bg: "rgba(99,102,241,0.16)", fg: "#A5B4FC" },
  { bg: "rgba(20,184,166,0.14)", fg: "#5EEAD4" },
];

export function speakerColor(name: string | null | undefined): { bg: string; fg: string } {
  if (!name) return SPEAKER_HUES[0];
  const unknown = /unknown|null/i.test(name);
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const c = SPEAKER_HUES[hash % SPEAKER_HUES.length];
  return unknown ? { bg: "rgba(245,158,11,0.14)", fg: "#FCD34D" } : c;
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}
