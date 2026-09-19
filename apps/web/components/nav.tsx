"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { motion } from "framer-motion";
import { LayoutDashboard, Video, CheckCircle2, ClipboardList, HelpCircle, Sparkles, Search, LogOut, ChevronDown, Command, Menu, X, Plus, History, TrendingDown, ChevronsLeft, ChevronsRight } from "lucide-react";
import { useEffect, useState } from "react";
import { NotificationCenter } from "@/components/notifications";

// ── nav model: same routes + functionality, grouped for hierarchy ──
const GROUPS = [
  {
    label: "Workspace",
    items: [
      { href: "/overview", label: "Overview", icon: LayoutDashboard },
      { href: "/meetings", label: "Meetings", icon: Video },
      { href: "/roi", label: "Meeting ROI", icon: TrendingDown },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { href: "/decisions", label: "Decisions", icon: CheckCircle2 },
      { href: "/intelligence", label: "Intelligence", icon: Sparkles },
      { href: "/knowledge-graph", label: "Knowledge Graph", icon: History },
      { href: "/review", label: "Review Queue", icon: ClipboardList },
    ],
  },
  {
    label: "System",
    items: [{ href: "/settings", label: "Settings", icon: HelpCircle }],
  },
];

/** Collapsed-rail tooltip. Rendered only when collapsed. */
function Tip({ label }: { label: string }) {
  return (
    <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 hidden -translate-y-1/2 whitespace-nowrap rounded-[8px] border border-white/10 bg-[#15181D] px-2.5 py-1.5 text-[12px] font-[500] text-white opacity-0 shadow-[0_12px_32px_rgba(0,0,0,0.5)] transition-all duration-150 group-hover:opacity-100 lg:group-hover:block" aria-hidden="true">
      {label}
    </span>
  );
}

function SidebarContent({ onNavigate, collapsed, onToggleCollapse }: { onNavigate?: () => void; collapsed?: boolean; onToggleCollapse?: () => void }) {
  const path = usePathname();
  const { user, logout, orgs } = useAuth();
  const [orgOpen, setOrgOpen] = useState(false);
  const currentOrg = orgs?.[0];
  const c = !!collapsed;

  return (
    <>
      {/* ── brand ── */}
      <div className="px-4 pb-2 pt-5">
        <div className={`flex items-center gap-2.5 ${c ? "lg:justify-center" : ""}`}>
          <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-gradient-to-br from-[#F5F7FA] to-[#8E959E] text-[13px] font-[800] text-[#08090B] shadow-[0_2px_12px_rgba(0,0,0,0.4)]">
            D
            <span className="absolute -right-[3px] -top-[3px] h-[7px] w-[7px] rounded-full bg-[#38BDF8] shadow-[0_0_8px_rgba(56,189,248,1)]" aria-hidden="true" title="Intelligence online" />
          </span>
          <span className={`min-w-0 ${c ? "lg:hidden" : ""}`}>
            <span className="block text-[13px] font-[700] leading-none tracking-[0.1em] text-[#F5F7FA]">DECENTRA</span>
            <span className="mt-[5px] block text-[8.5px] font-[600] uppercase leading-none tracking-[0.24em] text-[#38BDF8]/75">Meeting Intelligence</span>
          </span>
        </div>

        {/* ── workspace switcher ── */}
        <button
          onClick={() => setOrgOpen(!orgOpen)}
          aria-expanded={orgOpen}
          aria-label="Switch workspace"
          title={c ? (currentOrg?.name || "Select workspace") : undefined}
          className={`mt-4 flex w-full items-center gap-2.5 rounded-[11px] border border-white/[0.07] bg-white/[0.025] px-2.5 py-2 text-left transition-all duration-200 hover:border-[#38BDF8]/25 hover:bg-[#38BDF8]/[0.05] hover:shadow-[0_0_20px_rgba(56,189,248,0.08)] ${c ? "lg:justify-center lg:px-0 lg:py-2" : ""}`}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] border border-white/10 bg-gradient-to-br from-[#38BDF8]/25 to-[#A78BFA]/15 text-[11px] font-[700] text-[#7DD3FC]" aria-hidden="true">
            {(currentOrg?.name?.[0] || "D").toUpperCase()}
          </span>
          <span className={`min-w-0 flex-1 ${c ? "lg:hidden" : ""}`}>
            <span className="block text-[9px] font-[600] uppercase leading-none tracking-[0.16em] text-[#5B6169]">Workspace</span>
            <span className="mt-1 block truncate text-[13px] font-[550] leading-none text-[#F5F7FA]">{currentOrg?.name || "Select workspace"}</span>
          </span>
          <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-[#5B6169] transition-transform duration-200 ${orgOpen ? "rotate-180" : ""} ${c ? "lg:hidden" : ""}`} aria-hidden="true" />
        </button>
        {orgOpen && !c && (
          <div className="mt-1.5 overflow-hidden rounded-[12px] border border-white/[0.08] bg-[#0D0F12] shadow-[0_16px_40px_rgba(0,0,0,0.5)]">
            {orgs?.length ? orgs.map((o: any) => (
              <div key={o.id} className="px-3 py-2.5 transition hover:bg-white/[0.04]">
                <div className="text-[13px] font-[500] text-[#F5F7FA]">{o.name}</div>
                <div className="text-[10px] font-[600] uppercase tracking-[0.14em] text-[#5B6169]">{o.slug}</div>
              </div>
            )) : <div className="px-3 py-3 text-[13px] text-[#656B75]">No workspaces</div>}
            <Link href="/onboarding" onClick={onNavigate} className="block border-t border-white/[0.06] px-3 py-2.5 text-[13px] font-[500] text-[#38BDF8] transition hover:bg-[#38BDF8]/[0.06]">+ New workspace</Link>
          </div>
        )}
      </div>

      {/* ── command + primary action ── */}
      <div className="space-y-2 px-3 pt-2">
        <button
          onClick={() => window.dispatchEvent(new Event("decentra:palette"))}
          title={c ? "Search (⌘K)" : undefined}
          className={`group flex w-full items-center gap-2.5 rounded-[10px] border border-white/[0.06] bg-white/[0.02] px-3 py-[9px] text-left transition-all duration-200 hover:border-white/[0.13] hover:bg-white/[0.045] hover:shadow-[0_0_16px_rgba(56,189,248,0.07)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8]/40 ${c ? "lg:justify-center lg:px-0" : ""}`}
          aria-label="Open command palette"
        >
          <Search className="h-4 w-4 shrink-0 text-[#5B6169] transition-all duration-200 group-hover:scale-110 group-hover:text-[#7DD3FC]" strokeWidth={1.75} aria-hidden="true" />
          <span className={`flex-1 text-[13px] text-[#656B75] transition group-hover:text-[#9AA1AC] ${c ? "lg:hidden" : ""}`}>Search anything…</span>
          <kbd className={`inline-flex items-center gap-0.5 rounded-[6px] border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] font-[500] text-[#656B75] transition group-hover:border-white/[0.14] group-hover:text-[#9AA1AC] ${c ? "lg:hidden" : ""}`}>
            <Command className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />K
          </kbd>
        </button>
        <Link
          href="/meetings?new=1"
          onClick={onNavigate}
          title={c ? "New meeting" : undefined}
          aria-label="Start a new meeting"
          className={`group relative flex w-full items-center gap-2.5 overflow-hidden rounded-[11px] bg-gradient-to-b from-[#FFFFFF] to-[#D9DEE5] px-3.5 py-[9px] text-[13.5px] font-[650] text-[#08090B] transition-all duration-200 hover:shadow-[0_0_28px_rgba(56,189,248,0.4)] hover:brightness-[1.03] active:scale-[0.98] ${c ? "lg:justify-center lg:px-0" : ""}`}
        >
          <span className="absolute inset-0 rounded-[11px] opacity-0 ring-1 ring-inset ring-[#38BDF8]/60 transition-opacity duration-200 group-hover:opacity-100" aria-hidden="true" />
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#08090B] text-white transition-transform duration-300 group-hover:rotate-90" aria-hidden="true">
            <Plus className="h-3 w-3" strokeWidth={2.5} />
          </span>
          <span className={c ? "lg:hidden" : ""}>New meeting</span>
        </Link>
      </div>

      {/* ── grouped navigation ── */}
      <nav aria-label="Primary" className="min-h-0 flex-1 space-y-4 overflow-auto px-3 py-4">
        {GROUPS.map((g) => (
          <div key={g.label}>
            <p className={`px-2.5 pb-1.5 text-[9.5px] font-[700] uppercase tracking-[0.22em] text-[#454B54] ${c ? "lg:hidden" : ""}`} aria-hidden="true">
              {g.label}
            </p>
            <div className="space-y-[3px]">
              {g.items.map((it) => {
                const active = path === it.href || path?.startsWith(it.href + "/");
                const Icon = it.icon;
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    aria-label={c ? it.label : undefined}
                    title={c ? it.label : undefined}
                    className={`group relative flex items-center gap-2.5 rounded-[9px] border border-transparent px-2.5 py-[7px] text-[13px] font-[500] transition-all duration-200 ${active ? "nav-active-3d text-white" : "text-[#8B919B] hover:bg-white/[0.045] hover:text-[#E5E9EF]"} ${c ? "lg:justify-center lg:gap-0 lg:px-0" : ""}`}
                  >
                    {active && (
                      <motion.span
                        layoutId="nav-active-edge"
                        className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-[#38BDF8] shadow-[0_0_10px_rgba(56,189,248,0.9)]"
                        aria-hidden="true"
                      />
                    )}
                    <Icon
                      className={`h-4 w-4 shrink-0 transition-all duration-200 group-hover:translate-x-[1px] ${active ? "text-[#7DD3FC] drop-shadow-[0_0_6px_rgba(56,189,248,0.5)]" : "text-[#5B6169] group-hover:text-[#9AA1AC]"}`}
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                    <span className={`flex-1 truncate ${c ? "lg:hidden" : ""}`}>{it.label}</span>
                    {c && <Tip label={it.label} />}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* ── collapse toggle (desktop rail) ── */}
      <div className="hidden px-3 pb-1.5 lg:block">
        <button
          onClick={onToggleCollapse}
          title={c ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={c ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!c}
          className="flex w-full items-center gap-2 rounded-[8px] px-2 py-1.5 text-[11px] font-[500] text-[#5B6169] transition hover:bg-white/[0.04] hover:text-white"
        >
          {c ? <ChevronsRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /> : <ChevronsLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />}
          {!c && <span>Collapse</span>}
        </button>
      </div>

      {/* ── identity module ── */}
      <div className="border-t border-white/[0.06] p-3">
        <div className={`flex items-center gap-2.5 rounded-[12px] border border-white/[0.06] bg-white/[0.02] p-2.5 transition-colors duration-200 hover:border-white/[0.1] ${c ? "lg:justify-center lg:px-0" : ""}`}>
          <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#F5F7FA] to-[#9AA1AC] text-[12px] font-[700] text-[#08090B]" aria-hidden="true">
            {(user?.email?.[0] || "U").toUpperCase()}
            <span className={`absolute -bottom-px -right-px h-2.5 w-2.5 rounded-full border-2 border-[#0B0D10] ${user ? "bg-[#34D399] shadow-[0_0_6px_rgba(52,211,153,0.9)]" : "bg-[#656B75]"}`} aria-hidden="true" />
          </span>
          <span className={`min-w-0 flex-1 ${c ? "lg:hidden" : ""}`}>
            <span className="block truncate text-[13px] font-[500] leading-none text-[#F5F7FA]">{user?.email || "Not signed in"}</span>
            <span className="mt-[5px] flex items-center gap-1.5 text-[11px] leading-none text-[#656B75]">
              {user ? "Authenticated" : "Guest"}
              <span className={`h-1 w-1 rounded-full ${user ? "bg-[#34D399]" : "bg-[#656B75]"}`} aria-hidden="true" />
            </span>
          </span>
          {user ? (
            <button onClick={logout} title="Sign out" aria-label="Sign out" className={`rounded-[8px] p-1.5 text-[#5B6169] transition hover:bg-white/[0.06] hover:text-white ${c ? "lg:hidden" : ""}`}>
              <LogOut className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            </button>
          ) : (
            <Link href="/login" onClick={onNavigate} className={`text-[12px] font-[500] text-[#F5F7FA] transition hover:text-[#7DD3FC] ${c ? "lg:hidden" : ""}`}>Sign in</Link>
          )}
        </div>
        {c && user && (
          <button onClick={logout} title="Sign out" aria-label="Sign out" className="mx-auto mt-2 hidden rounded-[8px] p-1.5 text-[#5B6169] transition hover:bg-white/[0.06] hover:text-white lg:block">
            <LogOut className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          </button>
        )}
      </div>
    </>
  );
}

export function Nav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const path = usePathname();
  useEffect(() => setMobileOpen(false), [path]);
  useEffect(() => {
    try {
      if (localStorage.getItem("dec:nav-collapsed") === "1") setCollapsed(true);
    } catch {}
  }, []);
  function toggleCollapsed() {
    setCollapsed((v) => {
      const n = !v;
      try {
        localStorage.setItem("dec:nav-collapsed", n ? "1" : "0");
      } catch {}
      return n;
    });
  }
  return (
    <>
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] bg-[#08090B]/90 px-4 backdrop-blur-xl lg:hidden">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-[#F5F7FA] text-[12px] font-[800] text-[#08090B]">D</div>
          <span className="text-[13px] font-[700] tracking-[-0.02em]">DECENTRA</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => window.dispatchEvent(new Event("decentra:palette"))} className="rounded-[8px] p-2 text-[#9AA1AC] transition hover:bg-white/[0.06] hover:text-white" aria-label="Search"><Search className="h-[18px] w-[18px]" /></button>
          <button onClick={() => setMobileOpen(true)} className="rounded-[8px] p-2 text-[#9AA1AC] transition hover:bg-white/[0.06] hover:text-white" aria-label="Open menu" aria-expanded={mobileOpen}><Menu className="h-[18px] w-[18px]" /></button>
        </div>
      </header>

      {mobileOpen && <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} aria-hidden="true" />}

      <div
        className={`fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col border-r border-white/[0.06] bg-[#0B0D10] transition-[width,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:translate-x-0 lg:shrink-0 ${collapsed ? "lg:w-[76px]" : "lg:w-[272px]"} ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
        role="navigation"
        aria-label="Sidebar"
      >
        <button onClick={() => setMobileOpen(false)} className="absolute right-3 top-3 rounded-[8px] p-1.5 text-[#656B75] transition hover:bg-white/[0.06] hover:text-white lg:hidden" aria-label="Close menu">
          <X className="h-4 w-4" />
        </button>
        <SidebarContent onNavigate={() => setMobileOpen(false)} collapsed={collapsed} onToggleCollapse={toggleCollapsed} />
      </div>

      {/* action center lives outside the sidebar so it works in every state */}
      <NotificationCenter />
    </>
  );
}

export function TopBar({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#08090B]/85 backdrop-blur-xl max-lg:top-14">
      <div className="flex h-[58px] items-center justify-between gap-4 px-5 lg:px-8">
        <div className="min-w-0">
          <h1 className="truncate text-[16.5px] font-[650] leading-none tracking-[-0.015em] text-[#F5F7FA]">{title}</h1>
          {subtitle && <p className="mt-1.5 truncate text-[12px] text-[#656B75]">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
