"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowLeft, Check, Rocket, Video, FileJson, Play, ShieldCheck, Sparkles, UploadCloud, HelpCircle } from "lucide-react";
import { AuthShell } from "@/components/ui/auth-shell";
import { api } from "@/lib/api";

type Step = "welcome" | "meeting" | "transcript" | "process" | "review";

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");
  const [orgName, setOrgName] = useState("My Workspace");
  const [slug, setSlug] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [meetingId, setMeetingId] = useState<string | null>(null);

  async function createWorkspace() {
    setLoading(true);
    setMsg("");
    try {
      const o = await api("/api/v1/organizations", { method: "POST", body: JSON.stringify({ name: orgName, slug: slug || undefined }) });
      setOrgId(o.id);
      setMsg(`✓ Created ${o.name}`);
      setTimeout(() => setStep("meeting"), 700);
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function createMeeting() {
    if (!orgId) return;
    setLoading(true);
    setMsg("");
    try {
      const m = await api(`/api/v1/meetings?org_id=${orgId}`, { method: "POST", body: JSON.stringify({ title: "My first meeting", participant_emails: [] }) });
      setMeetingId(m.id);
      setStep("transcript");
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  }

  const steps = [
    { label: "Workspace", active: step === "welcome", done: step !== "welcome" },
    { label: "First meeting", active: step === "meeting", done: step === "transcript" || step === "process" || step === "review" },
    { label: "Transcript", active: step === "transcript", done: step === "process" || step === "review" },
    { label: "Decisions", active: step === "process" || step === "review", done: step === "review" },
  ];

  return (
    <AuthShell title="Welcome to Decentra" sub="Four steps to your first decision. About two minutes." steps={steps}>
      <AnimatePresence mode="wait">
        {step === "welcome" && (
          <motion.div key="welcome" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.35 }} className="space-y-5">
            <div className="rounded-[14px] border border-[var(--border)] bg-[color-mix(in_srgb,var(--fg)_3%,transparent)] p-4">
              <p className="text-[13.5px] leading-relaxed text-[var(--text-soft)]">
                Decentra turns conversation into <span className="font-[600] text-[var(--text)]">decisions, owners, and actions</span> —
                every one pinned to the second it was spoken. Let's set up your workspace.
              </p>
            </div>
            <div>
              <label htmlFor="name" className="text-[12px] font-[500] text-[var(--muted)]">Workspace name</label>
              <input id="name" className="input mt-1.5" value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Acme Analytics" autoComplete="organization" spellCheck={false} />
            </div>
            <div>
              <label htmlFor="slug" className="text-[12px] font-[500] text-[var(--muted)]">Slug <span className="text-[var(--subtle)] font-normal">(auto-generated)</span></label>
              <input id="slug" className="input mt-1.5" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="acme-analytics" autoComplete="off" spellCheck={false} />
            </div>
            {msg && <div className={`rounded-[10px] px-3 py-2.5 text-[13px] border ${msg.startsWith("✓") ? "bg-[color-mix(in_srgb,var(--emerald-2)_1%,transparent)] border-[color-mix(in_srgb,var(--emerald-2)_2%,transparent)] text-[var(--emerald-2)]" : "bg-[color-mix(in_srgb,var(--red-2)_1%,transparent)] border-[color-mix(in_srgb,var(--red-2)_2%,transparent)] text-[var(--red-2)]"}`}>{msg}</div>}
            <button onClick={createWorkspace} disabled={loading} className="btn bg-[var(--text)] text-[var(--bg)] hover:bg-[var(--fg)] w-full h-[42px] gap-2">
              {loading ? "Creating…" : "Create workspace"} <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </motion.div>
        )}

        {step === "meeting" && (
          <motion.div key="meeting" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.35 }} className="space-y-5">
            <div className="rounded-[14px] border border-[var(--border)] bg-[color-mix(in_srgb,var(--fg)_3%,transparent)] p-4">
              <p className="text-[13.5px] leading-relaxed text-[var(--text-soft)]">
                <span className="font-[600] text-[var(--text)]">Step 2.</span> Create your first meeting. Give it a title — you can add participants later.
              </p>
            </div>
            <button onClick={createMeeting} disabled={loading} className="btn bg-[var(--text)] text-[var(--bg)] hover:bg-[var(--fg)] w-full h-[42px] gap-2">
              {loading ? "Creating…" : "Create my first meeting"} <Video className="h-4 w-4" aria-hidden="true" />
            </button>
            {msg && <div className="rounded-[10px] px-3 py-2.5 text-[13px] border bg-[color-mix(in_srgb,var(--red-2)_1%,transparent)] border-[color-mix(in_srgb,var(--red-2)_2%,transparent)] text-[var(--red-2)]">{msg}</div>}
            <button onClick={() => setStep("welcome")} className="text-[12px] text-[var(--subtle)] hover:text-[var(--muted)] inline-flex items-center gap-1"><ArrowLeft className="h-3.5 w-3.5" /> Back</button>
          </motion.div>
        )}

        {step === "transcript" && (
          <motion.div key="transcript" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.35 }} className="space-y-5">
            <div className="rounded-[14px] border border-[var(--border)] bg-[color-mix(in_srgb,var(--fg)_3%,transparent)] p-4">
              <p className="text-[13.5px] leading-relaxed text-[var(--text-soft)]">
                <span className="font-[600] text-[var(--text)]">Step 3.</span> Add a transcript. Two options:
              </p>
              <ul className="mt-3 space-y-2 text-[12.5px] text-[var(--muted)]">
                <li className="flex items-start gap-2"><FileJson className="h-4 w-4 shrink-0 text-[var(--gold)] mt-0.5" /> <span><span className="font-[600] text-[var(--text)]">Upload a .json transcript</span> — works with no API key. Format: <code className="font-mono text-[11px] text-[var(--sky-3)]">{`{"segments":[{"speaker":"Priya","start":0,"end":9,"text":"…"}`}</code></span></li>
                <li className="flex items-start gap-2"><UploadCloud className="h-4 w-4 shrink-0 text-[var(--sky)] mt-0.5" /> <span><span className="font-[600] text-[var(--text)]">Upload audio/video</span> — needs <code className="font-mono text-[11px] text-[var(--sky-3)]">OPENAI_API_KEY</code> on the server for Whisper transcription.</span></li>
              </ul>
            </div>
            {meetingId && (
              <Link href={`/meetings/${meetingId}`} className="btn bg-[var(--text)] text-[var(--bg)] hover:bg-[var(--fg)] w-full h-[42px] gap-2">
                Open my meeting to upload <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            )}
            <button onClick={() => setStep("meeting")} className="text-[12px] text-[var(--subtle)] hover:text-[var(--muted)] inline-flex items-center gap-1"><ArrowLeft className="h-3.5 w-3.5" /> Back</button>
          </motion.div>
        )}

        {step === "process" && (
          <motion.div key="process" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.35 }} className="space-y-5">
            <div className="rounded-[14px] border border-[var(--border)] bg-[color-mix(in_srgb,var(--fg)_3%,transparent)] p-4">
              <p className="text-[13.5px] leading-relaxed text-[var(--text-soft)]">
                <span className="font-[600] text-[var(--text)]">Step 4.</span> Click <span className="font-[600] text-[var(--gold)]">Process</span>. Status moves
                <code className="font-mono text-[11px] text-[var(--sky-3)]"> draft → processing → ready</code>. When ready, switch to the
                <span className="font-[600] text-[var(--sky)]"> Intelligence</span> tab.
              </p>
            </div>
            <div className="grid gap-2">
              {[
                { icon: Sparkles, label: "Decisions detected", desc: "Each starts as DETECTED — confirm, revise, or reject." },
                { icon: Check, label: "Actions with owners", desc: "Owner + deadline extracted; edit inline." },
                { icon: HelpCircle, label: "Open questions", desc: "Unresolved items from the meeting." },
                { icon: ShieldCheck, label: "Risks flagged", desc: "Concerns with severity." },
              ].map(({ icon: Icon, label, desc }) => (
                <div key={label} className="flex items-start gap-3 rounded-[12px] border border-[var(--border)] bg-[color-mix(in_srgb,var(--fg)_2%,transparent)] p-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-[color-mix(in_srgb,var(--gold)_1%,transparent)] text-[var(--gold)]"><Icon className="h-4 w-4" aria-hidden="true" /></span>
                  <div>
                    <p className="text-[13px] font-[600] text-[var(--text)]">{label}</p>
                    <p className="text-[11.5px] text-[var(--subtle)]">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[12px] text-[var(--subtle)]">Every item carries an evidence link (e.g. 42:17) — click it to jump to the exact transcript moment.</p>
            <div className="flex gap-2">
              <button onClick={() => setStep("transcript")} className="btn btn-ghost flex-1 h-[38px] text-[12.5px]">Back</button>
              <button onClick={() => { if (meetingId) router.push(`/meetings/${meetingId}`); }} className="btn bg-[var(--text)] text-[var(--bg)] hover:bg-[var(--fg)] flex-1 h-[38px] gap-2 text-[12.5px]">
                Go to my meeting <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-6 flex items-center justify-between text-[12px]">
        <Link href="/login" className="text-[var(--subtle)] hover:text-[var(--muted)]">Sign in instead</Link>
        <Link href="/overview" className="text-[var(--sky)] hover:text-[var(--fg)] font-[550]">Skip to dashboard →</Link>
      </div>
    </AuthShell>
  );
}
