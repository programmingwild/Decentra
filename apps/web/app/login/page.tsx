"use client";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Eye, EyeOff, Fingerprint, ShieldCheck, Zap } from "lucide-react";
import { HeroScene } from "@/components/immersive/3d/HeroScene";
import { TiltCard } from "@/components/immersive/3d/TiltCard";

// Demo build for presentations: the single demo account is the way in,
// so its credentials are shown and prefilled in every environment.
const DEMO_EMAIL = "demo@decentra.ai";
const DEMO_PASSWORD = "demo1234";

function returnTo(): string {
  try {
    const next = new URLSearchParams(window.location.search).get("next");
    if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  } catch { /* fall through to default */ }
  return "/overview";
}

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState(DEMO_EMAIL);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      await login(email, password);
      window.location.href = returnTo();
    } catch (e: any) {
      setErr(e.message?.includes("Invalid credentials") ? "Invalid email or password." : e.message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <main className="relative grid min-h-screen overflow-hidden bg-[#08090B] lg:grid-cols-[1.1fr_0.9fr]">
      {/* ═══ left: live capture stage (desktop) ═══ */}
      <div className="stage-3d relative hidden overflow-hidden lg:block" aria-hidden="true">
        <HeroScene />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_40%_45%,rgba(8,9,11,0.25)_0%,rgba(8,9,11,0.82)_78%,#08090B_100%)]" />
        <span className="display-hero text-stroke pointer-events-none absolute left-10 top-14 select-none text-[clamp(4rem,9vw,8rem)] leading-none opacity-60">
          42:17
        </span>
        <div className="absolute inset-0 flex flex-col justify-end p-12">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="preserve-3d max-w-[520px]"
          >
            <p className="fragment text-[10.5px] uppercase tracking-[0.24em] text-[#656B75]">
              Meeting intelligence
            </p>
            <p className="display-hero text-3d mt-3 text-[clamp(2.2rem,4vw,3.6rem)] leading-[1.0] text-[#F5F7FA]">
              Meetings end.
              <span className="thin block text-[#D4A574]">Commitments shouldn&apos;t.</span>
            </p>
            <div className="preserve-3d mt-8 space-y-3 [transform:translateZ(40px)]">
              <div className="glass float-3d max-w-[340px] rounded-[14px] px-4 py-3 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
                <p className="fragment text-[10px] uppercase tracking-[0.14em] text-[#FBBF24]">◆ Decision detected · 92%</p>
                <p className="serif mt-1 text-[13px] leading-snug text-[#E9EDF2]">&ldquo;PostgreSQL selected for version one.&rdquo;</p>
              </div>
              <div className="glass float-3d-slow ml-16 max-w-[300px] rounded-[14px] px-4 py-3 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
                <p className="fragment text-[10px] uppercase tracking-[0.14em] text-[#34D399]">● Arun · Due Friday</p>
                <p className="mt-1 text-[13px] font-[600] text-[#E9EDF2]">Prepare database schema</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ═══ right: floating sign-in ═══ */}
      <div className="relative flex items-center justify-center px-6 py-12">
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="orb orb-sky float-3d-slow right-[-100px] top-[6%] h-[320px] w-[320px] opacity-[0.12]" />
          <div className="orb orb-amber float-3d left-[-80px] bottom-[4%] h-[260px] w-[260px] opacity-[0.10]" />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-[400px]"
        >
          <TiltCard max={2.5} scale={1.005} glare="rgba(212,165,116,0.10)">
            <div className="glass-depth relative overflow-hidden rounded-[24px] p-7 sm:p-8">
              <div aria-hidden="true" className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-[#D4A574]/70 to-transparent" />
              <Link href="/" className="flex items-center gap-2.5" aria-label="Decentra home">
                <span className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-gradient-to-br from-[#D4A574] to-[#38BDF8] text-[14px] font-[800] text-[#08090B] shadow-[0_8px_28px_rgba(212,165,116,0.3)]">D</span>
                <span className="text-[13px] font-[700] tracking-[0.08em] text-[#F5F7FA]">DECENTRA</span>
              </Link>
              <h1 className="display-hero text-3d mt-6 text-[32px] text-[#F5F7FA]">
                Welcome <span className="thin text-[#9AA1AC]">back.</span>
              </h1>
              <p className="mt-2 text-[13.5px] leading-relaxed text-[#9AA1AC]">
                Your workspace kept every commitment pinned while you were gone.
              </p>

              <form onSubmit={submit} className="mt-6 space-y-4">
                <div>
                  <label htmlFor="email" className="fragment text-[10px] uppercase tracking-[0.16em] text-[#656B75]">
                    Email
                  </label>
                  <input
                    id="email"
                    className="input mt-1.5 focus:shadow-[0_0_0_4px_rgba(56,189,248,0.12)]"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    autoComplete="email"
                    spellCheck={false}
                  />
                </div>
                <div>
                  <label htmlFor="password" className="fragment text-[10px] uppercase tracking-[0.16em] text-[#656B75]">
                    Password
                  </label>
                  <div className="relative mt-1.5">
                    <input
                      id="password"
                      className="input pr-11 focus:shadow-[0_0_0_4px_rgba(56,189,248,0.12)]"
                      type={showPw ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      aria-label={showPw ? "Hide password" : "Show password"}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-[8px] p-1.5 text-[#656B75] transition hover:bg-white/[0.06] hover:text-white"
                    >
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {err && (
                  <div key={err} className="shake rounded-[10px] border border-[#EF4444]/20 bg-[#EF4444]/10 px-3 py-2.5 text-[13px] text-[#F87171]" role="alert">
                    {err}
                  </div>
                )}

                <button
                  className="ring-conic group inline-flex h-[48px] w-full items-center justify-center gap-2 rounded-full bg-white text-[14px] font-[650] text-[#08090B] shadow-[0_12px_40px_rgba(255,255,255,0.16)] transition hover:bg-[#F5F7FA] disabled:opacity-60"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? "Signing in…" : "Enter workspace"}
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  onClick={() => { setEmail(DEMO_EMAIL); setPassword(DEMO_PASSWORD); setErr(""); }}
                  className="glass group flex w-full items-center gap-3 rounded-[14px] px-4 py-3 text-left transition hover:bg-white/[0.06]"
                >
                  <Zap className="h-4 w-4 shrink-0 text-[#D4A574]" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="fragment block text-[9.5px] uppercase tracking-[0.16em] text-[#656B75]">One-tap demo</span>
                    <span className="mono block truncate text-[12px] text-[#C7CCD4]">{DEMO_EMAIL} / {DEMO_PASSWORD}</span>
                  </span>
                  <span className="shrink-0 text-[11px] font-[600] text-[#38BDF8] opacity-0 transition group-hover:opacity-100">Fill →</span>
                </button>
              </form>

              <div className="mt-5 flex items-center justify-between text-[12.5px]">
                <span className="text-[#656B75]">No account?</span>
                <Link href="/register" className="font-[600] text-[#F5F7FA] underline decoration-white/20 underline-offset-4 hover:decoration-white/50">
                  Create one
                </Link>
              </div>
            </div>
          </TiltCard>

          <div className="mt-6 flex items-center justify-center gap-4 text-[#454B54]">
            <span className="fragment inline-flex items-center gap-1.5 text-[9.5px] uppercase tracking-[0.16em]"><ShieldCheck className="h-3.5 w-3.5" /> Evidence-first</span>
            <span className="fragment inline-flex items-center gap-1.5 text-[9.5px] uppercase tracking-[0.16em]"><Fingerprint className="h-3.5 w-3.5" /> You own your data</span>
          </div>
        </motion.div>
      </div>
    </main>
  );
}
