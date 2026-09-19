"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Nav } from "@/components/nav";
import { SectionLabel } from "@/components/ui/primitives";
import { EmptyState, SkeletonRow } from "@/components/ui/states";
import { PageHero } from "@/components/ui/page-hero";
import { ShaderAurora } from "@/components/immersive/3d/ShaderAurora";
import { useToast } from "@/components/ui/toast";
import { friendlyError } from "@/components/ui/states";
import { FolderKanban, Plus, ArrowUpRight, Video } from "lucide-react";

export default function ProjectsPage() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [orgId, setOrgId] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  async function load() {
    try {
      const orgs = await api("/api/v1/organizations");
      if (orgs?.[0]) {
        setOrgId(orgs[0].id);
        const [ps, ms] = await Promise.all([
          api(`/api/v1/projects?org_id=${orgs[0].id}`).catch(() => []),
          api(`/api/v1/meetings?org_id=${orgs[0].id}`).catch(() => []),
        ]);
        setProjects(ps);
        setMeetings(ms);
      }
    } catch {}
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function create() {
    if (!name.trim() || !orgId) return;
    setCreating(true);
    try {
      await api(`/api/v1/projects?org_id=${orgId}`, { method: "POST", body: JSON.stringify({ name: name.trim() }) });
      toast("Project created", "success");
      setName("");
      await load();
    } catch (e: any) {
      toast(friendlyError(e).title, "error");
    }
    setCreating(false);
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#08090B] lg:flex-row">
      <Nav />
      <main className="min-w-0 flex-1">
        <div className="relative mx-auto max-w-[860px] px-5 pb-20 pt-8 lg:px-8 lg:pt-12">
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true"><ShaderAurora className="opacity-[0.22]" speed={0.6} intensity={0.35} mouseInfluence={0.2} /><div className="orb orb-sky h-[280px] w-[320px] -right-[60px] top-[40px] opacity-[0.12]" /></div>
          <PageHero
            kicker="Initiatives"
            title="Projects"
            sub="Group meetings by initiative"
          />

          <div className="mt-7 flex items-center gap-2.5 border-b border-white/[0.06] pb-5">
            <input
              className="input h-[38px] flex-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && create()}
              placeholder="New project name…"
              aria-label="Project name"
            />
            <button onClick={create} disabled={!name.trim() || creating} className="btn h-[38px] gap-1.5 bg-[#F5F7FA] px-4 text-[13px] font-[600] text-[#08090B] hover:bg-white disabled:opacity-40">
              <Plus className="h-4 w-4" aria-hidden="true" /> Create
            </button>
          </div>

          <div className="mt-4">
            {loading ? (
              <div className="divide-y divide-white/[0.05]">{[0, 1].map((i) => <SkeletonRow key={i} />)}</div>
            ) : projects.length === 0 ? (
              <EmptyState icon={<FolderKanban className="h-5 w-5" />} title="No projects yet" body="Create a project to group related meetings — like 'Platform v1' or 'Q3 Planning'." />
            ) : (
              <ul className="divide-y divide-white/[0.05]">
                {projects.map((p) => {
                  const count = meetings.filter((m) => m.project_id === p.id).length;
                  return (
                    <li key={p.id}>
                      <Link href={`/meetings`} className="group flex items-center gap-4 py-4 transition">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] border border-white/[0.07] bg-white/[0.03] text-[#38BDF8]/80">
                          <FolderKanban className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14.5px] font-[600] tracking-[-0.01em] text-[#F0F3F7] group-hover:text-white">{p.name}</p>
                          <p className="mt-0.5 truncate text-[12px] text-[#656B75]">{p.description || `${count} meeting${count === 1 ? "" : "s"}`}</p>
                        </div>
                        <span className="hidden shrink-0 items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[11px] font-[550] text-[#9AA1AC] sm:inline-flex">
                          <Video className="h-3 w-3" aria-hidden="true" /> {count}
                        </span>
                        <ArrowUpRight className="h-4 w-4 shrink-0 text-[#656B75] opacity-0 transition group-hover:text-[#9AA1AC] group-hover:opacity-100" aria-hidden="true" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
