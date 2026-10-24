"use client";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AuthShell } from "@/components/ui/auth-shell";

export default function Register() {
  const { register } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      await register(email, password, name);
      window.location.href = "/onboarding";
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <AuthShell
      title="Create account"
      sub="Start your decision workspace"
      footer={<>Have an account? <Link href="/login" className="font-[600] text-[var(--text)] underline decoration-[var(--subtle)] underline-offset-4">Sign in</Link></>}
    >
      <form onSubmit={submit} className="space-y-5">
        <div className="space-y-3">
          <div>
            <label htmlFor="name" className="text-[12px] font-[500] text-[var(--muted)]">
              Full name
            </label>
            <input id="name" className="input mt-1.5" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada Lovelace" autoComplete="name" />
          </div>
          <div>
            <label htmlFor="email" className="text-[12px] font-[500] text-[var(--muted)]">
              Work email
            </label>
            <input id="email" className="input mt-1.5" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ada@company.com" autoComplete="email" spellCheck={false} />
          </div>
          <div>
            <label htmlFor="password" className="text-[12px] font-[500] text-[var(--muted)]">
              Password
            </label>
            <input id="password" className="input mt-1.5" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
          </div>
        </div>
        {err && <div className="rounded-[10px] bg-[color-mix(in_srgb,var(--red-2)_10%,transparent)] border border-[color-mix(in_srgb,var(--red-2)_20%,transparent)] text-[13px] text-[var(--red-2)] px-3 py-2.5 break-all">{err}</div>}
        <button className="btn bg-[var(--text)] text-[var(--bg)] hover:bg-[var(--fg)] w-full h-[42px] gap-2" type="submit" disabled={loading}>
          {loading ? "Creating…" : "Create account"} <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </form>
    </AuthShell>
  );
}
