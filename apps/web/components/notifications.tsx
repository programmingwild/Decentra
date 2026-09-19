"use client";
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, CheckCheck, X } from "lucide-react";
import { api } from "@/lib/api";
import { fmtDateLong, humanizeKey } from "@/lib/format";

const LABEL: Record<string, string> = {
  assigned: "Assigned to you",
  overdue: "Overdue",
  due_soon: "Due soon",
  unassigned: "Needs owner",
  completed: "Completed",
  mention: "Mentioned you",
};

const DOT: Record<string, string> = {
  overdue: "bg-[#EF4444] shadow-[0_0_8px_rgba(239,68,68,0.9)]",
  due_soon: "bg-[#F59E0B] shadow-[0_0_8px_rgba(245,158,11,0.8)]",
  assigned: "bg-[#38BDF8] shadow-[0_0_8px_rgba(56,189,248,0.8)]",
  unassigned: "bg-[#A78BFA] shadow-[0_0_8px_rgba(167,139,250,0.8)]",
  completed: "bg-[#34D399] shadow-[0_0_8px_rgba(52,211,153,0.8)]",
};

function useNotifications() {
  const [notifs, setNotifs] = useState<any[]>([]);
  const load = useCallback(async () => {
    try {
      const data = await api("/api/v1/notifications");
      setNotifs(data || []);
    } catch {}
  }, []);
  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);
  const unread = notifs.filter((n) => !n.read_at).length;
  async function markRead(id: string) {
    try {
      await api(`/api/v1/notifications/${id}/read`, { method: "POST" });
      load();
    } catch {}
  }
  async function clearAll() {
    const pending = notifs.filter((n) => !n.read_at);
    await Promise.allSettled(pending.map((n) => api(`/api/v1/notifications/${n.id}/read`, { method: "POST" })));
    load();
  }
  return { notifs, unread, load, markRead, clearAll };
}

/**
 * Windows-Action-Center-style notification hub: floating bell top-right,
 * slide-over panel from the right edge. Mounted once via <Nav/> so it
 * exists on every dashboard page.
 */
export function NotificationCenter() {
  const { notifs, unread, markRead, clearAll } = useNotifications();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open ]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={unread > 0 ? `Open action center, ${unread} unread notifications` : "Open action center"}
        title="Action center"
        className="group fixed bottom-5 right-4 z-[70] flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] bg-[#101216]/90 shadow-[0_8px_28px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-all duration-200 hover:border-[#38BDF8]/30 hover:shadow-[0_0_24px_rgba(56,189,248,0.15)] lg:bottom-auto lg:top-4"
      >
        <Bell className="h-[17px] w-[17px] text-[#9AA1AC] transition-all duration-200 group-hover:-rotate-12 group-hover:text-white" strokeWidth={1.75} aria-hidden="true" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border border-[#08090B] bg-[#EF4444] px-1 text-[10px] font-[700] tabular-nums text-white shadow-[0_0_10px_rgba(239,68,68,0.8)]">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-[75] bg-black/60 backdrop-blur-sm"
              aria-hidden="true"
            />
            <motion.aside
              initial={{ x: 400, opacity: 0.5 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 400, opacity: 0 }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              role="dialog"
              aria-label="Action center"
              className="fixed bottom-0 right-0 top-0 z-[80] flex w-[380px] max-w-[92vw] flex-col border-l border-white/[0.08] bg-[#0B0D10]/98 shadow-[-32px_0_80px_rgba(0,0,0,0.6)] backdrop-blur-2xl"
            >
              <div className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-4">
                <span className="relative flex h-2 w-2 shrink-0">
                  {unread > 0 && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#38BDF8] opacity-40" />}
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#38BDF8]" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-[15px] font-[700] tracking-[-0.01em] text-[#F5F7FA]">Action center</h2>
                  <p className="fragment mt-0.5 text-[10px] uppercase tracking-[0.18em] text-[#656B75]">
                    {unread > 0 ? `${unread} need${unread === 1 ? "s" : ""} attention` : "All caught up"}
                  </p>
                </div>
                {unread > 0 && (
                  <button onClick={clearAll} className="inline-flex items-center gap-1.5 rounded-[8px] px-2 py-1.5 text-[11.5px] font-[550] text-[#9AA1AC] transition hover:bg-white/[0.06] hover:text-white">
                    <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" /> Clear all
                  </button>
                )}
                <button onClick={() => setOpen(false)} aria-label="Close action center" className="rounded-[8px] p-1.5 text-[#656B75] transition hover:bg-white/[0.06] hover:text-white">
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-3 py-3">
                {notifs.length === 0 ? (
                  <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3 text-center">
                    <span className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-white/[0.08] bg-white/[0.03] text-[#38BDF8]">
                      <Bell className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
                    </span>
                    <p className="text-[13.5px] font-[600] text-[#E9EDF2]">All quiet</p>
                    <p className="max-w-[240px] text-[12px] leading-relaxed text-[#656B75]">Assignments, overdue work and due-soon items land here the moment they happen.</p>
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {notifs.slice(0, 30).map((n) => (
                      <li key={n.id}>
                        <button
                          onClick={() => {
                            markRead(n.id);
                            if (n.resource_type === "action" && n.resource_id) {
                              setOpen(false);
                              window.location.href = `/actions`;
                            }
                          }}
                          className={`group flex w-full items-start gap-3 rounded-[12px] border border-transparent px-3 py-3 text-left transition hover:border-white/[0.07] hover:bg-white/[0.035] ${!n.read_at ? "bg-white/[0.02]" : ""}`}
                        >
                          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[n.type] || "bg-[#656B75]"}`} aria-hidden="true" />
                          <span className="min-w-0 flex-1">
                            <span className="block text-[13px] font-[600] text-[#E9EDF2]">{LABEL[n.type] || n.type}</span>
                            <span className="mt-0.5 block truncate text-[11.5px] text-[#656B75]">
                              {LABEL[n.type] || humanizeKey(n.type)}{n.created_at ? ` · ${fmtDateLong(n.created_at)}` : ""}
                            </span>
                          </span>
                          {!n.read_at && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#38BDF8]" aria-label="Unread" />}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="border-t border-white/[0.06] px-5 py-3">
                <p className="fragment text-center text-[9.5px] uppercase tracking-[0.2em] text-[#454B54]">Decentra · never miss a commitment</p>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
