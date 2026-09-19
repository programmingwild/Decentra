"use client";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import {
  LayoutDashboard, Video, CheckCircle2, ClipboardList, HelpCircle, FolderKanban,
  Sparkles, Search, Plus, CornerDownLeft, ArrowUpDown,
} from "lucide-react";

type Item = { id: string; group: string; label: string; hint?: string; icon: any; href: string };
type Ctx = { open: boolean; setOpen: (v: boolean) => void };
const PaletteCtx = createContext<Ctx>({ open: false, setOpen: () => {} });
export const usePalette = () => useContext(PaletteCtx);

const NAV_ITEMS: Item[] = [
  { id: "n1", group: "Navigate", label: "Overview", icon: LayoutDashboard, href: "/overview" },
  { id: "n2", group: "Navigate", label: "Meetings", icon: Video, href: "/meetings" },
  { id: "n3", group: "Navigate", label: "Decision Center", icon: CheckCircle2, href: "/decisions" },
  { id: "n4", group: "Navigate", label: "Action Center", icon: ClipboardList, href: "/actions" },
  { id: "n5", group: "Navigate", label: "Open Questions", icon: HelpCircle, href: "/questions" },
  { id: "n6", group: "Navigate", label: "Projects", icon: FolderKanban, href: "/projects" },
  { id: "n7", group: "Navigate", label: "Ask Decentra", hint: "AI", icon: Sparkles, href: "/assistant" },
];

export function PaletteProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [data, setData] = useState<{ meetings: any[]; decisions: any[]; actions: any[] }>({ meetings: [], decisions: [], actions: [] });
  const [searchHits, setSearchHits] = useState<any>(null);
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fetchedAt = useRef(0);
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    const onEvent = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("decentra:palette", onEvent);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("decentra:palette", onEvent);
    };
  }, []);

  async function load() {
    if (Date.now() - fetchedAt.current < 30000) return;
    try {
      const orgs = await api("/api/v1/organizations");
      if (!orgs?.[0]) return;
      const oid = orgs[0].id;
      const [ms, ds, as] = await Promise.all([
        api(`/api/v1/meetings?org_id=${oid}`).catch(() => []),
        api(`/api/v1/decisions?org_id=${oid}`).catch(() => []),
        api(`/api/v1/actions?org_id=${oid}`).catch(() => []),
      ]);
      setData({ meetings: ms || [], decisions: ds || [], actions: as || [] });
      fetchedAt.current = Date.now();
    } catch {}
  }

  useEffect(() => {
    if (open) {
      setQuery("");
      setSel(0);
      load();
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) { setSearchHits(null); return; }
    const id = setTimeout(async () => {
      try {
        const orgs = await api("/api/v1/organizations");
        if (!orgs?.[0]) return;
        const r = await api(`/api/v1/search?org_id=${orgs[0].id}&q=${encodeURIComponent(query)}&limit=10`);
        setSearchHits(r);
      } catch {}
    }, 220);
    return () => clearTimeout(id);
  }, [query]);

  const items: Item[] = useMemo(() => {
    if (searchHits && query.trim().length >= 2) {
      const hits: Item[] = [
        ...(searchHits.meetings || []).map((m: any) => ({ id: `sm-${m.id}`, group: "Meetings", label: m.title, hint: `${m.score.toFixed(1)}`, icon: Video, href: `/meetings/${m.id}` })),
        ...(searchHits.decisions || []).map((d: any) => ({ id: `sd-${d.id}`, group: "Decisions", label: d.title, hint: d.status?.toLowerCase(), icon: CheckCircle2, href: `/meetings/${d.meeting_id}` })),
        ...(searchHits.actions || []).map((a: any) => ({ id: `sa-${a.id}`, group: "Action items", label: a.task, hint: a.owner_name || undefined, icon: ClipboardList, href: `/meetings/${a.meeting_id}` })),
        ...(searchHits.segments || []).slice(0, 3).map((s: any) => ({ id: `ss-${s.id}`, group: "Transcript", label: s.text.slice(0, 56), hint: `${Math.floor(s.start_ms/1000/60)}:${String(Math.floor(s.start_ms/1000%60)).padStart(2,"0")}`, icon: Search, href: `/meetings/${s.meeting_id}?seg=${s.id}` })),
      ];
      if (hits.length) return hits.slice(0, 16);
    }
    const dynamic: Item[] = [
      ...data.meetings.slice(0, 40).map((m: any) => ({ id: `m-${m.id}`, group: "Meetings", label: m.title, hint: m.status, icon: Video, href: `/meetings/${m.id}` })),
      ...data.decisions.slice(0, 40).map((d: any) => ({ id: `d-${d.id}`, group: "Decisions", label: d.title, hint: d.status?.toLowerCase(), icon: CheckCircle2, href: `/meetings/${d.meeting_id}` })),
      ...data.actions.slice(0, 40).map((a: any) => ({ id: `a-${a.id}`, group: "Action items", label: a.task, hint: a.owner_name || undefined, icon: ClipboardList, href: `/meetings/${a.meeting_id}` })),
    ];
    const quick: Item = { id: "quick-new", group: "Actions", label: "New meeting", hint: "Create", icon: Plus, href: "/meetings?new=1" };
    const all = [...NAV_ITEMS.slice(0, 2), quick, ...NAV_ITEMS.slice(2), ...dynamic];
    if (!query.trim()) return all.filter((i) => i.group !== "Meetings" || data.meetings.length <= 8).slice(0, 14);
    const q = query.toLowerCase();
    return all.filter((i) => i.label.toLowerCase().includes(q)).slice(0, 16);
  }, [query, data, searchHits]);

  useEffect(() => setSel(0), [query]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${sel}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  function choose(item: Item) {
    setOpen(false);
    router.push(item.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, items.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    if (e.key === "Enter" && items[sel]) choose(items[sel]);
  }

  let lastGroup = "";
  return (
    <PaletteCtx.Provider value={{ open, setOpen }}>
      {children}
      {open && (
        <div className="fixed inset-0 z-[180]">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[3px]" onClick={() => setOpen(false)} aria-hidden="true" />
          <div role="dialog" aria-modal="true" aria-label="Command palette" className="glass-strong animate-pop relative mx-auto mt-[11vh] w-[min(600px,calc(100vw-32px))] overflow-hidden rounded-[20px] shadow-[0_32px_90px_rgba(0,0,0,0.75)]">
            <div className="flex items-center gap-3 border-b border-white/[0.06] px-4">
              <Search className="h-4 w-4 shrink-0 text-[#656B75]" aria-hidden="true" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search meetings, decisions, actions…"
                aria-label="Search"
                className="h-[52px] w-full bg-transparent text-[14.5px] text-[#F5F7FA] outline-none placeholder:text-[#656B75]"
              />
              <span className="mono text-[10px] text-[#656B75]">ESC</span>
            </div>
            <div ref={listRef} role="listbox" aria-label="Results" className="max-h-[380px] overflow-auto p-2">
              {items.length === 0 && (
                <div className="px-3 py-10 text-center text-[13px] text-[#656B75]">No matches for “{query}”</div>
              )}
              {items.map((item, idx) => {
                const showGroup = item.group !== lastGroup;
                lastGroup = item.group;
                const Icon = item.icon;
                return (
                  <div key={item.id}>
                    {showGroup && <div className="px-3 pb-1 pt-3 text-[10px] font-[700] uppercase tracking-[0.14em] text-[#656B75]">{item.group}</div>}
                    <button
                      data-idx={idx}
                      role="option"
                      aria-selected={idx === sel}
                      onMouseEnter={() => setSel(idx)}
                      onClick={() => choose(item)}
                      className={`flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left transition ${idx === sel ? "bg-white/[0.07]" : ""}`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${idx === sel ? "text-[#38BDF8]" : "text-[#656B75]"}`} aria-hidden="true" />
                      <span className={`flex-1 truncate text-[13.5px] ${idx === sel ? "text-[#F5F7FA]" : "text-[#C7CCD4]"}`}>{item.label}</span>
                      {item.hint && <span className="rounded-full border border-white/[0.07] px-2 py-0.5 text-[10px] font-[600] uppercase tracking-wider text-[#9AA1AC]">{item.hint}</span>}
                      {idx === sel ? <CornerDownLeft className="h-3.5 w-3.5 text-[#656B75]" aria-hidden="true" /> : <ArrowUpDown className="h-3 w-3 text-white/[0.12]" aria-hidden="true" />}
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 border-t border-white/[0.06] px-4 py-2.5 text-[10.5px] text-[#656B75]">
              <span className="flex items-center gap-1.5"><kbd className="rounded border border-white/[0.09] bg-white/[0.04] px-1 font-mono">↑↓</kbd> navigate</span>
              <span className="flex items-center gap-1.5"><kbd className="rounded border border-white/[0.09] bg-white/[0.04] px-1 font-mono">↵</kbd> open</span>
              <span className="ml-auto flex items-center gap-1.5"><kbd className="rounded border border-white/[0.09] bg-white/[0.04] px-1 font-mono">⌘K</kbd> toggle</span>
            </div>
          </div>
        </div>
      )}
    </PaletteCtx.Provider>
  );
}
