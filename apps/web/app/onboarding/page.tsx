"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { ArrowRight } from "lucide-react";
import { AuthShell } from "@/components/ui/auth-shell";

export default function Onboarding() {
  const [name, setName] = useState("My Workspace");
  const [slug, setSlug] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  async function create() {
    setLoading(true);
    setMsg("");
    try {
      const o = await api("/api/v1/organizations", { method: "POST", body: JSON.stringify({ name, slug: slug || undefined }) });
      setMsg(`✓ Created ${o.name} — welcome in.`);
      setTimeout(() => (window.location.href = "/overview"), 800);
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <AuthShell
      title="Create workspace"
      sub="Your team's decision home — meetings, memory, and momentum live here."
      steps={[
        { label: "Workspace", active: true },
        { label: "First meeting", done: false },
        { label: "Decisions", done: false },
      ]}
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="name" className="text-[12px] font-[500] text-[#9AA1AC]">
            Workspace name
          </label>
          <input id="name" className="input mt-1.5" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Analytics" autoComplete="organization" spellCheck={false} />
        </div>
        <div>
          <label htmlFor="slug" className="text-[12px] font-[500] text-[#9AA1AC]">
            Slug <span className="text-[#656B75] font-normal">(auto-generated)</span>
          </label>
          <input id="slug" className="input mt-1.5" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="acme-analytics" autoComplete="off" spellCheck={false} />
        </div>
        <button onClick={create} disabled={loading} className="btn bg-[#F5F7FA] text-[#08090B] hover:bg-white w-full h-[42px] gap-2">
          {loading ? "Creating…" : "Create workspace"} <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
        {msg && <div className={`rounded-[10px] px-3 py-2.5 text-[13px] border ${msg.startsWith("✓") ? "bg-[#10B981]/10 border-[#10B981]/20 text-[#10B981]" : "bg-[#EF4444]/10 border-[#EF4444]/20 text-[#EF4444]"}`}>{msg}</div>}
      </div>
    </AuthShell>
  );
}
