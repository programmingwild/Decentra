"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Nav } from "@/components/nav";
import { SectionLabel } from "@/components/ui/primitives";
import { EmptyState, SkeletonRow, friendlyError } from "@/components/ui/states";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { fmtDateTime, msToDuration, dayGroup } from "@/lib/format";
import { Clock, Plus, Search, Users, Video, X, ArrowUpRight, Mic, FileText, Sparkles, CheckCircle2, TrendingUp, Calendar, Zap, Target, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";
import { MetricCard } from "@/components/ui/metrics";
import { PageHero } from "@/components/ui/page-hero";
import { ShaderAurora } from "@/components/immersive/3d/ShaderAurora";

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

  const load = useCallback(async () => {
    try {
      const orgs = await api("/api/v1/organizations");
      if (!orgs?.[0]) {
        setLoading(false);
        return;
      }
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
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

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
    } catch (e: any) {
      toast((friendlyError(e)).reason, "error");
    }
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

  // Bold metric cards for meetings
  const meetingMetrics = useMemo(() => [
    { 
      label: "Total", 
      value: meetings.length, 
      change: `${meetings.filter(m => m.status === "ready").length} processed`, 
      tone: "violet", 
      icon: Calendar,
      sparkline: meetings.slice(-7).map((m, i) => ({ x: i, y: m.status === "ready" ? 1 : 0 }))
    },
    { 
      label: "Decisions", 
      value: meetings.reduce((sum, m) => sum + (m.decisions_count || 0), 0), 
      change: "From processed meetings", 
      tone: "amber", 
      icon: CheckCircle2,
      sparkline: meetings.slice(-7).map((m, i) => ({ x: i, y: m.decisions_count || 0 }))
    },
    { 
      label: "Actions", 
      value: meetings.reduce((sum, m) => sum + (m.actions_count || 0), 0), 
      change: "Tracked commitments", 
      tone: "sky", 
      icon: Sparkles,
      sparkline: meetings.slice(-7).map((m, i) => ({ x: i, y: m.actions_count || 0 }))
    },
    { 
      label: "Duration", 
      value: msToDuration(meetings.reduce((sum, m) => sum + (m.duration_ms || 0), 0)), 
      change: "Total meeting time", 
      tone: "emerald", 
      icon: Clock,
      sparkline: meetings.slice(-7).map((m, i) => ({ x: i, y: m.duration_ms || 0 }))
    },
  ], [meetings]);

  return (
    <div className="flex min-h-screen flex-col bg-[#08090B] lg:flex-row">
      <Nav />
      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-[1080px] px-5 pb-20 pt-8 lg:px-8 lg:pt-12">
          <header className="relative flex flex-wrap items-end justify-between gap-4">
            <div className="pointer-events-none absolute -left-4 -top-6 h-20 w-20 orb orb-sky opacity-[0.10]" />
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true"><ShaderAurora className="opacity-[0.25]" speed={0.6} intensity={0.35} mouseInfluence={0.25} /></div>
            <PageHero
              kicker="Traceable by design"
              title="Meetings"
              sub={loading ? "Loading…" : <><span className="font-[600] text-[#F5F7FA]">{meetings.length}</span> <span className="text-[#656B75]">meeting{meetings.length === 1 ? "" : "s"} · every one traceable to its transcript</span></>}
            />
            <button onClick={() => setShowCreate(true)} className="btn h-[38px] gap-2 bg-white px-4 text-[13.5px] font-[650] text-[#08090B] shadow-[0_4px_12px_rgba(255,255,255,0.08)] hover:bg-[#F5F7FA]">
              <Plus className="h-4 w-4" aria-hidden="true" /> New meeting
            </button>
          </header>

          {/* Bold Metric Cards */}
          {!loading && (
            <section aria-label="Meeting metrics" className="reveal mt-6 grid gap-4 lg:grid-cols-4">
              {meetingMetrics.map((m, i) => (
                <MetricCard key={m.label} {...m} index={i} immersive />
              ))}
            </section>
          )}

          <div className="mt-7 flex flex-wrap items-center gap-2.5 border-b border-white/[0.06] pb-5" role="search">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#656B75]" aria-hidden="true" />
              <input
                placeholder="Search by titleâ€¦"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && load()}
                onBlur={() => load()}
                className="input h-[38px] pl-9"
                aria-label="Search meetings"
              />
            </div>
            <select value={projectId} onChange={(e) => { setProjectId(e.target.value); setTimeout(load, 0); }} className="input h-[38px] w-[170px]" aria-label="Filter by project">
              <option value="">All projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="input h-[38px] w-[150px]" aria-label="Filter by status">
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="processing">Processing</option>
              <option value="ready">Processed</option>
              <option value="failed">Failed</option>
            </select>
            {(q || status || projectId) && (
              <button onClick={() => { setQ(""); setStatus(""); setProjectId(""); setTimeout(load, 0); }} className="btn btn-subtle h-[38px] gap-1 px-2.5 text-[12.5px]" aria-label="Clear filters">
                <X className="h-3.5 w-3.5" aria-hidden="true" /> Clear
              </button>
            )}
          </div>

          <div className="mt-2">
            {loading ? (
              <div className="divide-y divide-white/[0.05]">{[0, 1, 2, 3].map((i) => <SkeletonRow key={i} />)}</div>
            ) : meetings.length === 0 ? (
              <EmptyState
                icon={<Video className="h-5 w-5" />}
                title={q || status || projectId ? "No meetings match those filters" : "No meetings yet"}
                body={q || status || projectId ? "Try a different search or clear the filters." : "Create your first meeting and turn conversation into commitment."}
                action={!q && !status && !projectId ? <button onClick={() => setShowCreate(true)} className="btn h-[36px] bg-[#F5F7FA] px-4 text-[13px] font-[600] text-[#08090B] hover:bg-white"><Plus className="mr-1 inline h-4 w-4" aria-hidden="true" />New meeting</button> : undefined}
              />
            ) : (
              groups.map(([label, items]) => (
                <section key={label} aria-label={label}>
                  <div className="sticky top-14 z-10 -mx-5 bg-[#08090B]/90 px-5 py-3 backdrop-blur-lg max-lg:top-[104px] lg:-mx-8 lg:px-8">
                    <SectionLabel>{label}</SectionLabel>
                  </div>
                  <ul className="divide-y divide-white/[0.05]">
                    {items.map((m) => <MeetingRow key={m.id} m={m} />)}
                  </ul>
                </section>
              ))
            )}
          </div>
        </div>
      </main>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New meeting" width={500}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="m-title" className="text-[12px] font-[500] text-[#9AA1AC]">Title *</label>
            <input id="m-title" className="input mt-1.5" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Product Architecture Review" autoComplete="off" onKeyDown={(e) => e.key === "Enter" && create()} aria-label="Meeting title" />
          </div>
          <div>
            <label htmlFor="m-date" className="text-[12px] font-[500] text-[#9AA1AC]">Date</label>
            <input id="m-date" className="input mt-1.5 [color-scheme:dark]" type="datetime-local" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} aria-label="Date and time" />
          </div>
          <div>
            <label htmlFor="m-project" className="text-[12px] font-[500] text-[#9AA1AC]">Project</label>
            <select id="m-project" className="input mt-1.5" value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })} aria-label="Project">
              <option value="">No project</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="m-participants" className="text-[12px] font-[500] text-[#9AA1AC]">Participants</label>
            <input id="m-participants" className="input mt-1.5" value={form.participant_emails} onChange={(e) => setForm({ ...form, participant_emails: e.target.value })} placeholder="arun@co.com, priya@co.com" autoComplete="off" spellCheck={false} aria-describedby="m-participants-help" aria-label="Participant emails" />
            <p id="m-participants-help" className="mt-1.5 text-[11.5px] text-[#656B75]">Comma-separated emails. You&apos;ll be added automatically.</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => setShowCreate(false)} className="btn btn-subtle h-[36px] px-3.5 text-[13px]">Cancel</button>
          <button onClick={create} disabled={!form.title.trim() || creating} className="btn h-[36px] bg-[#F5F7FA] px-4 text-[13px] font-[600] text-[#08090B] hover:bg-white disabled:opacity-40">
            {creating ? "Creatingâ€¦" : "Create meeting"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

function MeetingRow({ m }: { m: any }) {
  const statusStyle: Record<string, string> = {
    ready: "text-[#34D399]",
    processing: "text-[#38BDF8]",
    draft: "text-[#656B75]",
    failed: "text-[#F87171]",
  };
  const color = statusStyle[m.status] || statusStyle.draft;
  const dot = m.status === "ready" ? "#10B981" : m.status === "processing" ? "#0EA5E9" : m.status === "failed" ? "#EF4444" : "#656B75";
  return (
    <li>
      <motion.a
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        href={`/meetings/${m.id}`}
        className="group flex items-center gap-5 py-5 px-4 rounded-[16px] transition hover:bg-white/[0.03]"
      >
        <span aria-hidden="true" className={`h-[8px] w-[8px] shrink-0 rounded-full ${m.status === "processing" ? "pulse-dot" : ""}`} style={{ background: dot }} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[16px] font-[600] tracking-[-0.01em] text-[#F0F3F7] transition group-hover:text-white">{m.title}</h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12.5px] text-[#656B75]">
            <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" aria-hidden="true" />{fmtDateTime(m.date)}</span>
            <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" aria-hidden="true" />{m.participant_count}</span>
            <span className="mono text-[#9AA1AC]">{msToDuration(m.duration_ms)}</span>
          </div>
        </div>
        <div className="hidden shrink-0 items-center gap-4 text-right sm:flex">
          <div className="min-w-[56px] text-center">
            <div className="mono text-[17px] font-[600] tabular-nums text-[#E5E9EF]">{m.decisions_count ?? 0}</div>
            <div className="text-[9.5px] font-[650] uppercase tracking-[0.12em] text-[#656B75]">Decisions</div>
          </div>
          <div className="min-w-[48px] text-center">
            <div className="mono text-[17px] font-[600] tabular-nums text-[#E5E9EF]">{m.actions_count ?? 0}</div>
            <div className="text-[9.5px] font-[650] uppercase tracking-[0.12em] text-[#656B75]">Actions</div>
          </div>
          <span className={`w-[90px] text-left text-[9.5px] font-[700] uppercase tracking-[0.12em] ${color}`}>{m.status}</span>
        </div>
        <ArrowUpRight className="h-4 w-4 shrink-0 text-[#656B75] opacity-0 transition group-hover:text-[#9AA1AC] group-hover:opacity-100" aria-hidden="true" />
      </motion.a>
    </li>
  );
}
