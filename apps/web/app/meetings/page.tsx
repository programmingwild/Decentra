"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Nav } from "@/components/nav";
import { SectionLabel } from "@/components/ui/primitives";
import { EmptyState, SkeletonRow, friendlyError } from "@/components/ui/states";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { fmtDateTime, msToDuration, dayGroup } from "@/lib/format";
import { Clock, Plus, Search, Users, Video, X, ArrowUpRight, Mic, FileText, Sparkles, CheckCircle2, TrendingUp, Calendar, Zap, Target, BarChart3, Filter, LayoutGrid, List } from "lucide-react";
import { motion } from "framer-motion";
import { MetricCard } from "@/components/ui/metrics";
import { PageHero } from "@/components/ui/page-hero";
const ShaderAurora = dynamic(() => import("@/components/immersive/3d/ShaderAurora").then((m) => m.ShaderAurora), { ssr: false });

export default function MeetingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [meetings, setMeetings] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [projectId, setProjectId] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: "", date: "", project_id: "", participant_emails: "" });
  const [view, setView] = useState<"grid" | "list">("grid");

  const load = useCallback(async () => {
    try {
      const orgs = await api("/api/v1/organizations");
      if (!orgs?.[0]) { setLoading(false); return; }
      setOrgId(orgs[0].id);
      const ps = await api(`/api/v1/projects?org_id=${orgs[0].id}`).catch(() => []);
      setProjects(ps);
      const params = new URLSearchParams({ org_id: orgs[0].id });
      if (status) params.set("status", status);
      if (q) params.set("q", q);
      if (projectId) params.set("project_id", projectId);
      const ms = await api(`/api/v1/meetings?${params.toString()}`);
      setMeetings(ms || []);
    } catch {}
    setLoading(false);
  }, [status, q, projectId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("new") === "1") setShowCreate(true);
  }, []);

  async function create() {
    if (!form.title.trim() || !orgId) return;
    setCreating(true);
    try {
      const body: any = { title: form.title.trim() };
      if (form.date) body.date = new Date(form.date).toISOString();
      if (form.project_id) body.project_id = form.project_id;
      if (form.participant_emails.trim()) body.participant_emails = form.participant_emails.split(",").map((s) => s.trim()).filter(Boolean);
      const m = await api(`/api/v1/meetings?org_id=${orgId}`, { method: "POST", body: JSON.stringify(body) });
      toast("Meeting created", "success");
      setShowCreate(false);
      setForm({ title: "", date: "", project_id: "", participant_emails: "" });
      router.push(`/meetings/${m.id}`);
    } catch (e: any) { toast((friendlyError(e)).reason, "error"); }
    setCreating(false);
  }

  const groups = useMemo(() => {
    const g: Array<[string, any[]]> = [];
    meetings.forEach((m) => {
      const label = dayGroup(m.date).toUpperCase();
      const last = g[g.length - 1];
      if (last && last[0] === label) last[1].push(m);
      else g.push([label, [m]]);
    });
    return g;
  }, [meetings]);

  const meetingMetrics = useMemo(() => [
    { label: "Total", value: meetings.length, change: `${meetings.filter(m => m.status === "ready").length} processed`, tone: "violet", icon: Calendar, sparkline: meetings.slice(-7).map((m, i) => ({ x: i, y: m.status === "ready" ? 1 : 0 })) },
    { label: "Decisions", value: meetings.reduce((s, m) => s + (m.decisions_count || 0), 0), change: "From processed meetings", tone: "amber", icon: CheckCircle2, sparkline: meetings.slice(-7).map((m, i) => ({ x: i, y: m.decisions_count || 0 })) },
    { label: "Actions", value: meetings.reduce((s, m) => s + (m.actions_count || 0), 0), change: "Tracked commitments", tone: "sky", icon: Sparkles, sparkline: meetings.slice(-7).map((m, i) => ({ x: i, y: m.actions_count || 0 })) },
    { label: "Duration", value: msToDuration(meetings.reduce((s, m) => s + (m.duration_ms || 0), 0)), change: "Total meeting time", tone: "emerald", icon: Clock, sparkline: meetings.slice(-7).map((m, i) => ({ x: i, y: m.duration_ms || 0 })) },
  ], [meetings]);

  const hasFilters = q || status || projectId;

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)] lg:flex-row">
      <Nav />
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-[1180px] px-5 pb-20 pt-8 lg:px-8 lg:pt-12">
          <header className="relative flex flex-wrap items-end justify-between gap-4">
            <div className="pointer-events-none absolute -left-4 -top-6 h-20 w-20 orb orb-sky opacity-[0.10]" />
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true"><ShaderAurora className="opacity-[0.25]" speed={0.6} intensity={0.35} mouseInfluence={0.25} /></div>
            <PageHero
              kicker="Traceable by design"
              title="Meetings"
              sub={loading ? "Loading…" : <><span className="font-[600] text-[var(--text)]">{meetings.length}</span> <span className="text-[var(--subtle)]">meeting{meetings.length === 1 ? "" : "s"} · every one traceable to its transcript</span></>}
            />
            <div className="flex items-center gap-2">
              <div className="glass-subtle hidden items-center gap-1 rounded-full p-1 sm:flex">
                <button onClick={() => setView("grid")} className={`rounded-full px-3 py-1.5 text-[11.5px] font-[600] transition ${view === "grid" ? "bg-[color-mix(in_srgb,var(--fg)_8%,transparent)] text-[var(--fg)]" : "text-[var(--subtle)] hover:text-[var(--muted)]"}`}><LayoutGrid className="inline h-3.5 w-3.5 mr-1" />Grid</button>
                <button onClick={() => setView("list")} className={`rounded-full px-3 py-1.5 text-[11.5px] font-[600] transition ${view === "list" ? "bg-[color-mix(in_srgb,var(--fg)_8%,transparent)] text-[var(--fg)]" : "text-[var(--subtle)] hover:text-[var(--muted)]"}`}><List className="inline h-3.5 w-3.5 mr-1" />List</button>
              </div>
              <button onClick={() => setShowCreate(true)} className="btn h-[38px] gap-2 bg-[var(--fg)] px-4 text-[13.5px] font-[650] text-[var(--bg)] shadow-[0_4px_12px_rgba(255,255,255,0.08)] hover:bg-[var(--text)]">
                <Plus className="h-4 w-4" aria-hidden="true" /> New meeting
              </button>
            </div>
          </header>

          {!loading && (
            <section aria-label="Meeting metrics" className="reveal mt-6 grid gap-4 lg:grid-cols-4">
              {meetingMetrics.map((m, i) => <MetricCard key={m.label} {...m} index={i} immersive />)}
            </section>
          )}

          <div className="mt-7 flex flex-wrap items-center gap-2.5 border-b border-[var(--border)] pb-5" role="search">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--subtle)]" aria-hidden="true" />
              <input placeholder="Search by title…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} onBlur={() => load()} className="input h-[38px] pl-9" aria-label="Search meetings" />
            </div>
            <div className="relative">
              <Filter className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--subtle)]" aria-hidden="true" />
              <select value={projectId} onChange={(e) => { setProjectId(e.target.value); setTimeout(load, 0); }} className="input h-[38px] w-[170px] pl-9" aria-label="Filter by project">
                <option value="">All projects</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="input h-[38px] w-[150px]" aria-label="Filter by status">
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="processing">Processing</option>
              <option value="ready">Processed</option>
              <option value="failed">Failed</option>
            </select>
            {hasFilters && (
              <button onClick={() => { setQ(""); setStatus(""); setProjectId(""); setTimeout(load, 0); }} className="btn btn-subtle h-[38px] gap-1 px-2.5 text-[12.5px]" aria-label="Clear filters">
                <X className="h-3.5 w-3.5" aria-hidden="true" /> Clear
              </button>
            )}
          </div>

          <div className="mt-6">
            {loading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0,1,2,3,4,5].map((i) => <SkeletonRow key={i} />)}</div>
            ) : meetings.length === 0 ? (
              <EmptyState
                icon={<Video className="h-5 w-5" />}
                title={hasFilters ? "No meetings match those filters" : "No meetings yet"}
                body={hasFilters ? "Try a different search or clear the filters." : "Create your first meeting and turn conversation into commitment."}
                action={!hasFilters ? <button onClick={() => setShowCreate(true)} className="btn h-[36px] bg-[var(--text)] px-4 text-[13px] font-[600] text-[var(--bg)] hover:bg-[var(--fg)]"><Plus className="mr-1 inline h-4 w-4" aria-hidden="true" />New meeting</button> : undefined}
              />
            ) : view === "grid" ? (
              <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {meetings.map((m) => <MeetingCard key={m.id} m={m} />)}
              </motion.div>
            ) : (
              <div>
                {groups.map(([label, items]) => (
                  <section key={label} aria-label={label}>
                    <div className="sticky top-14 z-10 -mx-5 bg-[color-mix(in_srgb,var(--bg)_9%,transparent)] px-5 py-3 backdrop-blur-lg max-lg:top-[104px] lg:-mx-8 lg:px-8">
                      <SectionLabel>{label}</SectionLabel>
                    </div>
                    <ul className="divide-y divide-[var(--border)]">
                      {items.map((m) => <MeetingRow key={m.id} m={m} />)}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New meeting" width={500}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="m-title" className="text-[12px] font-[500] text-[var(--muted)]">Title *</label>
            <input id="m-title" className="input mt-1.5" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Product Architecture Review" autoComplete="off" onKeyDown={(e) => e.key === "Enter" && create()} aria-label="Meeting title" />
          </div>
          <div>
            <label htmlFor="m-date" className="text-[12px] font-[500] text-[var(--muted)]">Date</label>
            <input id="m-date" className="input mt-1.5" type="datetime-local" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} aria-label="Date and time" />
          </div>
          <div>
            <label htmlFor="m-project" className="text-[12px] font-[500] text-[var(--muted)]">Project</label>
            <select id="m-project" className="input mt-1.5" value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })} aria-label="Project">
              <option value="">No project</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="m-participants" className="text-[12px] font-[500] text-[var(--muted)]">Participants</label>
            <input id="m-participants" className="input mt-1.5" value={form.participant_emails} onChange={(e) => setForm({ ...form, participant_emails: e.target.value })} placeholder="arun@co.com, priya@co.com" autoComplete="off" spellCheck={false} aria-describedby="m-participants-help" aria-label="Participant emails" />
            <p id="m-participants-help" className="mt-1.5 text-[11.5px] text-[var(--subtle)]">Comma-separated emails. You'll be added automatically.</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => setShowCreate(false)} className="btn btn-subtle h-[36px] px-3.5 text-[13px]">Cancel</button>
          <button onClick={create} disabled={!form.title.trim() || creating} className="btn h-[36px] bg-[var(--text)] px-4 text-[13px] font-[600] text-[var(--bg)] hover:bg-[var(--fg)] disabled:opacity-40">
            {creating ? "Creating…" : "Create meeting"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

const statusColor: Record<string, string> = { ready: "#34D399", processing: "#38BDF8", draft: "#656B75", failed: "#F87171" };

function MeetingCard({ m }: { m: any }) {
  const color = statusColor[m.status] || statusColor.draft;
  return (
    <motion.a
      variants={{ hidden: { opacity: 0, y: 16, scale: 0.97 }, show: { opacity: 1, y: 0, scale: 1 } }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      href={`/meetings/${m.id}`}
      className="group relative flex flex-col overflow-hidden rounded-[20px] border border-[var(--border)] bg-[color-mix(in_srgb,var(--fg)_2.5%,transparent)] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-[var(--border-strong)] hover:bg-[color-mix(in_srgb,var(--fg)_4%,transparent)] hover:shadow-[0_20px_50px_rgba(0,0,0,0.45)]"
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-20" style={{ background: color }} aria-hidden="true" />
      <div className="relative flex items-start justify-between gap-3">
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[9.5px] font-[700] uppercase tracking-[0.1em]`} style={{ color, borderColor: `${color}40`, background: `${color}12` }}>
          <span className={`h-1.5 w-1.5 rounded-full ${m.status === "processing" ? "pulse-dot" : ""}`} style={{ background: color }} aria-hidden="true" />
          {m.status}
        </span>
        <ArrowUpRight className="h-4 w-4 shrink-0 text-[var(--subtle)] opacity-0 transition group-hover:text-[var(--muted)] group-hover:opacity-100" aria-hidden="true" />
      </div>
      <h3 className="relative mt-3 line-clamp-2 text-[15px] font-[650] tracking-[-0.01em] text-[var(--text)] transition group-hover:text-[var(--fg)]">{m.title}</h3>
      <div className="relative mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11.5px] text-[var(--subtle)]">
        <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" aria-hidden="true" />{fmtDateTime(m.date)}</span>
        <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" aria-hidden="true" />{m.participant_count}</span>
        <span className="mono text-[var(--muted)]">{msToDuration(m.duration_ms)}</span>
      </div>
      <div className="relative mt-4 flex items-center gap-4 border-t border-[var(--border)] pt-4">
        <div className="flex-1">
          <div className="mono text-[15px] font-[600] tabular-nums text-[var(--text)]">{m.decisions_count ?? 0}</div>
          <div className="text-[9px] font-[650] uppercase tracking-[0.12em] text-[var(--subtle)]">Decisions</div>
        </div>
        <div className="flex-1">
          <div className="mono text-[15px] font-[600] tabular-nums text-[var(--text)]">{m.actions_count ?? 0}</div>
          <div className="text-[9px] font-[650] uppercase tracking-[0.12em] text-[var(--subtle)]">Actions</div>
        </div>
        <div className="flex-1 text-right">
          <div className="mono text-[15px] font-[600] tabular-nums text-[var(--text)]">{m.questions_count ?? 0}</div>
          <div className="text-[9px] font-[650] uppercase tracking-[0.12em] text-[var(--subtle)]">Questions</div>
        </div>
      </div>
    </motion.a>
  );
}

function MeetingRow({ m }: { m: any }) {
  const color = statusColor[m.status] || statusColor.draft;
  return (
    <li>
      <motion.a initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} href={`/meetings/${m.id}`} className="group flex items-center gap-5 py-5 px-4 rounded-[16px] transition hover:bg-[color-mix(in_srgb,var(--fg)_3%,transparent)]">
        <span aria-hidden="true" className={`h-[8px] w-[8px] shrink-0 rounded-full ${m.status === "processing" ? "pulse-dot" : ""}`} style={{ background: color }} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[16px] font-[600] tracking-[-0.01em] text-[var(--text)] transition group-hover:text-[var(--fg)]">{m.title}</h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12.5px] text-[var(--subtle)]">
            <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" aria-hidden="true" />{fmtDateTime(m.date)}</span>
            <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" aria-hidden="true" />{m.participant_count}</span>
            <span className="mono text-[var(--muted)]">{msToDuration(m.duration_ms)}</span>
          </div>
        </div>
        <div className="hidden shrink-0 items-center gap-4 text-right sm:flex">
          <div className="min-w-[56px] text-center">
            <div className="mono text-[17px] font-[600] tabular-nums text-[var(--text)]">{m.decisions_count ?? 0}</div>
            <div className="text-[9.5px] font-[650] uppercase tracking-[0.12em] text-[var(--subtle)]">Decisions</div>
          </div>
          <div className="min-w-[48px] text-center">
            <div className="mono text-[17px] font-[600] tabular-nums text-[var(--text)]">{m.actions_count ?? 0}</div>
            <div className="text-[9.5px] font-[650] uppercase tracking-[0.12em] text-[var(--subtle)]">Actions</div>
          </div>
          <span className={`w-[90px] text-left text-[9.5px] font-[700] uppercase tracking-[0.12em] ${color}`}>{m.status}</span>
        </div>
        <ArrowUpRight className="h-4 w-4 shrink-0 text-[var(--subtle)] opacity-0 transition group-hover:text-[var(--muted)] group-hover:opacity-100" aria-hidden="true" />
      </motion.a>
    </li>
  );
}
