"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useScroll, useTransform, useMotionValue, useSpring, useMotionValueEvent, type MotionValue } from "framer-motion";
import { useRef, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, ArrowUpRight, Mic, CheckCircle2, UserCheck, Play, Waves, Scan, ShieldCheck, Users, Fingerprint, ListChecks } from "lucide-react";
import { Magnetic, Marquee } from "@/components/thrill";
import SmoothScroll from "@/components/immersive/SmoothScroll";
import { TiltCard } from "@/components/immersive/3d/TiltCard";
import { Reveal } from "@/components/immersive/3d/Reveal";
import { Deferred } from "@/components/immersive/3d/Deferred";
import { Preloader } from "@/components/immersive/3d/Preloader";
import type { ManifestoSeg } from "@/components/immersive/3d/Manifesto";
import dynamic from "next/dynamic";

// Lazy-load every three.js-backed scene. three.js is ~500 kB; keeping it out
// of the initial bundle lets the hero type + CTA paint immediately, with the
// WebGL scenes streaming in afterwards.
const HeroScene = dynamic(() => import("@/components/immersive/3d/HeroScene").then((m) => m.HeroScene), {
  ssr: false,
  loading: () => <div className="pointer-events-none absolute inset-0" aria-hidden="true" />,
});
const ShaderAurora = dynamic(() => import("@/components/immersive/3d/ShaderAurora").then((m) => m.ShaderAurora), { ssr: false });
const ParticleField3D = dynamic(() => import("@/components/immersive/3d/ParticleField").then((m) => m.ParticleField), { ssr: false });
const Scroll3DScene = dynamic(() => import("@/components/immersive/3d/Scroll3DScene").then((m) => m.Scroll3DScene), { ssr: false });
const ManifestoScrub = dynamic(() => import("@/components/immersive/3d/ManifestoScrub").then((m) => m.ManifestoScrub), { ssr: false });
const Magnetic3DButton = dynamic(() => import("@/components/immersive/3d/Magnetic3DButton").then((m) => m.Magnetic3DButton), { ssr: false });
import { AnimatedNumber, AreaChart, TONE_COLORS } from "@/components/ui/metrics";
import { useAuth } from "@/lib/auth";

/* ── live transcript ticker ─────────────────────────────── */
const TICKER = [
  { ts: "42:17", who: "RAHUL", text: "Let's go with PostgreSQL for version one.", color: "var(--sky-3)" },
  { ts: "42:29", who: "PRIYA", text: "Agreed — I'll own the API spec.", color: "var(--muted)" },
  { ts: "46:12", who: "ARUN", text: "Schema lands before Friday, committed.", color: "var(--violet)" },
  { ts: "47:03", who: "DECENTRA", text: "◆ Decision detected · 92% · needs review", color: "var(--amber)" },
];

function Ticker() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((v) => (v + 1) % TICKER.length), 2600);
    return () => clearInterval(id);
  }, []);
  const line = TICKER[i];
  return (
    <div className="glass mx-auto mt-10 flex h-[58px] max-w-[620px] items-center gap-4 overflow-hidden rounded-[16px] px-5" aria-live="off" aria-label="Sample transcript feed">
      <span className="flex h-2 w-2 shrink-0 animate-pulse rounded-full bg-[var(--red-2)]" />
      <AnimatePresence mode="wait">
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="flex min-w-0 items-baseline gap-3"
        >
          <span className="fragment shrink-0 text-[12px] tabular-nums text-[var(--subtle)]">{line.ts}</span>
          <span className="shrink-0 text-[10px] font-[700] uppercase tracking-[0.12em]" style={{ color: line.color }}>{line.who}</span>
          <span className="serif truncate text-[14px] text-[var(--text)]">&ldquo;{line.text}&rdquo;</span>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ── section kicker: numbered editorial label ────────────── */
function Kicker({ n, label, center = false }: { n: string; label: string; center?: boolean }) {
  return (
    <div className={`flex items-center gap-4 ${center ? "justify-center" : ""}`}>
      <span className="fragment text-[11px] tabular-nums text-[var(--gold)]">{n}</span>
      <span className="h-px w-12 bg-gradient-to-r from-[color-mix(in_srgb,var(--gold)_60%,transparent)] to-transparent" aria-hidden="true" />
      <span className="fragment text-[10px] uppercase tracking-[0.24em] text-[var(--subtle)]">{label}</span>
    </div>
  );
}

/* ── pipeline: sticky-stacking 3D cards ──────────────────── */
const STEPS = [
  {
    id: "record", n: "01", title: "Record", tag: "SPEAKER-AWARE", icon: Waves, accent: "var(--sky)",
    body: "Every voice captured with timestamps. Not a summary — the source, second by second.",
    visual: (
      <div className="space-y-3">
        {[["42:17", "RAHUL", "Okay, let's go with PostgreSQL for version one.", "var(--sky-3)"], ["42:29", "PRIYA", "Agreed. I'll handle the API spec.", "var(--muted)"], ["46:12", "ARUN", "I'll prepare the schema before Friday.", "var(--violet)"]].map(([ts, sp, txt, col]) => (
          <div key={ts} className="flex gap-3.5 rounded-[12px] border border-[var(--border)] bg-[color-mix(in_srgb,var(--fg)_2%,transparent)] px-4 py-3">
            <span className="fragment shrink-0 text-[11.5px] tabular-nums text-[var(--subtle)]">{ts}</span>
            <div className="min-w-0"><div className="text-[9.5px] font-[700] uppercase tracking-[0.12em]" style={{ color: col as string }}>{sp}</div><p className="serif mt-1 text-[13.5px] leading-snug text-[var(--text)]">&ldquo;{txt}&rdquo;</p></div>
          </div>
        ))}
        <p className="flex items-center gap-2 px-1 text-[11px] text-[var(--subtle)]"><Mic className="h-3.5 w-3.5" /> 48 min · 3 speakers · 0 words lost</p>
      </div>
    ),
  },
  {
    id: "understand", n: "02", title: "Understand", tag: "EVIDENCE-LINKED", icon: Scan, accent: "var(--amber)",
    body: "Decisions, risks and open questions extracted — each one pinned to the exact moment it was spoken.",
    visual: (
      <div className="glass-accent rounded-[18px] p-5">
        <span className="inline-flex rounded-full border border-dashed border-[color-mix(in_srgb,var(--amber-2)_35%,transparent)] bg-[color-mix(in_srgb,var(--amber-2)_10%,transparent)] px-2.5 py-0.5 text-[9.5px] font-[700] uppercase tracking-[0.1em] text-[var(--amber)]">Detected · needs review</span>
        <p className="mt-3 text-[17px] font-[650] leading-snug tracking-[-0.01em] text-[var(--text)]">PostgreSQL selected for version one</p>
        <p className="fragment mt-2 text-[12px] text-[var(--muted)]">92% CONFIDENCE · EVIDENCE 42:17</p>
        <div className="mt-4 flex h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--fg)_7%,transparent)]"><div className="h-full w-[92%] rounded-full bg-gradient-to-r from-[var(--gold)] to-[var(--amber)]" /></div>
      </div>
    ),
  },
  {
    id: "decide", n: "03", title: "Decide", tag: "HUMAN-IN-THE-LOOP", icon: ShieldCheck, accent: "var(--violet)",
    body: "Detected is not true. You confirm, revise or reject — your judgment is the final gate.",
    visual: (
      <div className="space-y-3">
        <div className="flex items-center gap-3 rounded-[14px] border border-[color-mix(in_srgb,var(--emerald-2)_25%,transparent)] bg-[color-mix(in_srgb,var(--emerald-2)_8%,transparent)] px-4 py-3.5"><CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--emerald)]" /><div><p className="text-[13.5px] font-[650] text-[var(--text)]">Confirm</p><p className="text-[11.5px] text-[var(--muted)]">Becomes organizational memory</p></div></div>
        <div className="flex items-center gap-3 rounded-[14px] border border-[var(--border)] bg-[color-mix(in_srgb,var(--fg)_2%,transparent)] px-4 py-3.5"><UserCheck className="h-5 w-5 shrink-0 text-[var(--muted)]" /><div><p className="text-[13.5px] font-[650] text-[var(--text)]">Revise or reject</p><p className="text-[11.5px] text-[var(--muted)]">Nothing slips through unverified</p></div></div>
      </div>
    ),
  },
  {
    id: "execute", n: "04", title: "Execute", tag: "OWNER + DEADLINE", icon: Users, accent: "var(--emerald)",
    body: "Owners, deadlines and follow-ups that survive the meeting — tracked where work happens.",
    visual: (
      <div className="space-y-3">
        {[["Prepare database schema", "Arun · Due Friday", true], ["Publish API spec", "Priya · Due Monday", false]].map(([task, meta, done]) => (
          <div key={task as string} className="glass flex items-center gap-3.5 rounded-[14px] p-4">
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${done ? "border-[color-mix(in_srgb,var(--emerald-2)_40%,transparent)] bg-[color-mix(in_srgb,var(--emerald-2)_15%,transparent)] text-[var(--emerald)]" : "border-[var(--border-strong)] text-transparent"}`}>{done ? "✓" : ""}</span>
            <div className="min-w-0"><p className="truncate text-[13.5px] font-[600] text-[var(--text)]">{task}</p><p className="fragment text-[11px] text-[var(--subtle)]">{meta}</p></div>
          </div>
        ))}
      </div>
    ),
  },
];

type Step = (typeof STEPS)[number];

function StackCard({ s, i, total, progress }: { s: Step; i: number; total: number; progress: MotionValue<number> }) {
  const scale = useTransform(progress, [i / total, 1], [1, 1 - (total - 1 - i) * 0.045]);
  return (
    <div className="sticky pb-6" style={{ top: `${104 + i * 22}px` }}>
      <motion.div style={{ scale }} className="origin-top">
        <TiltCard max={3} glare={`${s.accent}14`}>
          <div
            className="glass-strong relative grid gap-6 overflow-hidden rounded-[24px] p-7 sm:p-9 lg:grid-cols-[0.9fr_1.1fr] lg:items-center"
            style={{ boxShadow: `0 30px 90px rgba(0,0,0,0.55), 0 0 60px ${s.accent}10` }}
          >
            <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full blur-3xl" style={{ background: `${s.accent}1c` }} aria-hidden="true" />
            <div className="relative">
              <div className="flex items-center gap-4">
                <span className="display-hero text-stroke text-[64px] leading-none sm:text-[84px]">{s.n}</span>
                <span className="flex h-12 w-12 items-center justify-center rounded-full border" style={{ color: s.accent, borderColor: `${s.accent}45`, background: `${s.accent}12` }}>
                  <s.icon className="h-5 w-5" />
                </span>
              </div>
              <h3 className="display-hero mt-4 text-[34px] sm:text-[44px]">{s.title}</h3>
              <p className="fragment mt-2 text-[10px] uppercase tracking-[0.2em]" style={{ color: s.accent }}>{s.tag}</p>
              <p className="mt-4 max-w-[400px] text-[15px] leading-relaxed text-[var(--muted)]">{s.body}</p>
            </div>
            <div className="relative">{s.visual}</div>
          </div>
        </TiltCard>
      </motion.div>
    </div>
  );
}

function StackSteps() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  return (
    <div ref={ref} className="relative">
      {STEPS.map((s, i) => (
        <StackCard key={s.id} s={s} i={i} total={STEPS.length} progress={scrollYProgress} />
      ))}
    </div>
  );
}

/* ── manifesto copy ─────────────────────────────────────── */
const MANIFESTO: ManifestoSeg[] = [
  { t: "Most meetings evaporate. " },
  { t: "Decisions blur, owners vanish, ", hot: true },
  { t: "and the why dies inside a transcript nobody reopens. " },
  { t: "Decentra keeps every commitment ", hot: true },
  { t: "pinned to the second it was spoken", gold: true },
  { t: " — so your team remembers ", hot: true },
  { t: "what was decided, and why.", gold: true },
];

/* ── numbers band ───────────────────────────────────────── */
const NUMBERS = [
  { value: 100, suffix: "%", label: "Traceable to source", icon: Fingerprint, tone: "sky" },
  { value: 92, suffix: "%", label: "Avg. decision confidence", icon: ShieldCheck, tone: "amber" },
  { value: 48, suffix: "min", label: "Captured per meeting", icon: Mic, tone: "violet" },
  { value: 0, suffix: "", label: "Decisions lost", icon: ListChecks, tone: "emerald" },
];

const sparkFor = (v: number) =>
  Array.from({ length: 14 }, (_, k) => ({ x: k, y: Math.round(v * (0.35 + (0.65 * k) / 13)) }));

/* ── bottom section bar (portaled) ────────────────────────── */
function BottomBar({ visible, workspaceHref }: { visible: boolean; workspaceHref: string }) {
  // Mount-gate: server renders null, so the first client render must also be
  // null — otherwise React throws a hydration mismatch. The portal only
  // attaches after hydration, which is also when scroll position exists.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || typeof document === "undefined") return null;
  return createPortal(
    <div
      aria-hidden={!visible}
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 16,
        zIndex: 30,
        display: "flex",
        justifyContent: "center",
        paddingLeft: 16,
        paddingRight: 16,
        pointerEvents: "none",
      }}
    >
      <AnimatePresence initial={false}>
        {visible && (
          <motion.nav
            initial={{ opacity: 0, y: 64 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 64 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            aria-label="Sections"
            className="glass-strong pointer-events-auto flex h-[48px] max-w-full items-center gap-1 rounded-full py-1.5 pl-2 pr-1.5 shadow-[0_16px_48px_rgba(0,0,0,0.5)]"
          >
            <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {[["Manifesto", "#manifesto"], ["Pipeline", "#pipeline"], ["Evidence", "#evidence"], ["Numbers", "#numbers"]].map(([label, href]) => (
                <a key={href} href={href} tabIndex={visible ? 0 : -1} className="inline-flex shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-[12.5px] font-[500] text-[var(--muted)] transition hover:bg-[color-mix(in_srgb,var(--fg)_6%,transparent)] hover:text-[var(--fg)] sm:px-4 sm:text-[13px]">{label}</a>
              ))}
            </div>
            <span className="hidden h-5 w-px shrink-0 bg-[color-mix(in_srgb,var(--fg)_8%,transparent)] md:block" aria-hidden="true" />
            <Link href={workspaceHref} tabIndex={visible ? 0 : -1} className="group inline-flex h-[36px] shrink-0 items-center gap-1.5 rounded-full bg-[var(--fg)] px-4 text-[12.5px] font-[650] text-[var(--bg)] transition hover:bg-[var(--text)]">
              <span className="hidden min-[420px]:inline">Open workspace</span>
              <span className="min-[420px]:hidden">Open</span>
              <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
            </Link>
          </motion.nav>
        )}
      </AnimatePresence>
    </div>,
    document.body
  );
}

/* ── page ───────────────────────────────────────────────── */
export default function Home() {
  const { user } = useAuth();
  const router = useRouter();
  const workspaceHref = user ? "/overview" : "/login";

  const cueRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: cueProgress } = useScroll({ target: cueRef, offset: ["start end", "end 0.4"] });
  const cueOpacity = useTransform(cueProgress, [0, 0.5], [1, 0]);

  // Bottom section nav appears only past the hero, for fast section jumps.
  // The top pill nav stays put the whole time.
  const [navOn, setNavOn] = useState(false);
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, "change", (v) => {
    setNavOn(v > (typeof window !== "undefined" ? window.innerHeight * 0.72 : 800));
  });

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springX = useSpring(mouseX, { stiffness: 110, damping: 22 });
  const springY = useSpring(mouseY, { stiffness: 110, damping: 22 });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      mouseX.set((e.clientX / window.innerWidth - 0.5) * 22);
      mouseY.set((e.clientY / window.innerHeight - 0.5) * 14);
    };
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, [mouseX, mouseY]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--bg)] text-[var(--text)]">
      <Preloader />
      <SmoothScroll />
      <div className="grain-fixed" aria-hidden="true" />
      {/* Ambient WebGL layers mount on idle so the hero paints first. */}
      <Deferred>
        <div className="pointer-events-none fixed inset-0" aria-hidden="true">
          <ShaderAurora className="opacity-[0.28]" speed={0.8} intensity={0.6} mouseInfluence={0.7} />
          <ParticleField3D count={110} className="opacity-[0.7]" />
        </div>
      </Deferred>

      {/* floating pill nav */}
      <header className="fixed inset-x-0 top-4 z-30 flex justify-center px-4">
        <motion.nav
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="glass-strong flex h-[52px] w-full max-w-[900px] items-center justify-between rounded-full py-1.5 pl-2 pr-1.5 shadow-[0_16px_48px_rgba(0,0,0,0.5)]"
          aria-label="Site"
        >
          <Link href="/" className="flex items-center gap-2.5 rounded-full py-1.5 pl-1.5 pr-4">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[var(--gold)] to-[var(--sky)] text-[13px] font-[800] text-[var(--bg)]">D</span>
            <span className="text-[14px] font-[700] tracking-[-0.02em]">DECENTRA</span>
          </Link>
          <div className="hidden items-center gap-1 lg:flex">
            {[["Manifesto", "#manifesto"], ["Pipeline", "#pipeline"], ["Evidence", "#evidence"], ["Numbers", "#numbers"]].map(([label, href]) => (
              <a key={href} href={href} className="rounded-full px-4 py-2 text-[13px] font-[500] text-[var(--muted)] transition hover:bg-[color-mix(in_srgb,var(--fg)_6%,transparent)] hover:text-[var(--fg)]">{label}</a>
            ))}
          </div>
          <Magnetic>
            <Link href={workspaceHref} className="group inline-flex h-[40px] items-center gap-1.5 rounded-full bg-[var(--fg)] px-5 text-[13px] font-[650] text-[var(--bg)] transition hover:bg-[var(--text)]">
              Open workspace <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
          </Magnetic>
        </motion.nav>
      </header>

      {/* bottom section nav — appears only past the hero, for fast jumps.
          Portaled to <body> with inline styles: immune to ancestor
          transforms/filters and to utility-generation gaps — fixed means
          fixed, glued to the viewport bottom on every scroll position. */}
      <BottomBar visible={navOn} workspaceHref={workspaceHref} />

      {/* ═══ HERO ═══ */}
      <section className="stage-3d-wide relative flex min-h-[100svh] flex-col justify-center overflow-hidden">
        <HeroScene />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_55%_at_50%_42%,color-mix(in_srgb,var(--bg)_55%,transparent)_0%,color-mix(in_srgb,var(--bg)_88%,transparent)_75%,var(--bg)_100%)]" aria-hidden="true" />
        {/* giant echo timestamp behind the type */}
        <span aria-hidden="true" className="display-hero text-stroke pointer-events-none absolute left-1/2 top-[16%] -translate-x-1/2 select-none whitespace-nowrap text-[clamp(5rem,17vw,15rem)] leading-none opacity-70">42:17</span>

        <motion.div style={{ x: springX }} className="relative mx-auto w-full max-w-[1100px] px-6 pt-36 text-center">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="flex items-center justify-between gap-4"
            >
              <span className="fragment text-[10.5px] uppercase tracking-[0.22em] text-[var(--subtle)]">Meeting intelligence</span>
              <span className="fragment hidden items-center gap-2.5 rounded-full border border-[var(--border)] bg-[color-mix(in_srgb,var(--fg)_3%,transparent)] px-4 py-1.5 text-[10.5px] uppercase tracking-[0.2em] text-[var(--muted)] backdrop-blur sm:inline-flex">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--sky-2)]" /> Est. 2026
              </span>
              <span className="fragment text-[10.5px] uppercase tracking-[0.22em] text-[var(--subtle)]">Evidence-first</span>
            </motion.div>

            <h1 className="display-hero text-3d mt-8 text-balance text-[clamp(3.4rem,11vw,10rem)]" style={{ lineHeight: 1.02 }}>
              <motion.span initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.85, delay: 0.3, ease: [0.16, 1, 0.3, 1] }} className="block bg-gradient-to-b from-[var(--fg)] via-[var(--text)] to-[var(--muted)] bg-clip-text text-transparent" style={{ lineHeight: 1.02 }}>Meetings end.</motion.span>
              <motion.span initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.85, delay: 0.42, ease: [0.16, 1, 0.3, 1] }} className="thin mt-2 block text-[clamp(2.6rem,8.5vw,7.5rem)] text-[var(--gold)]" style={{ lineHeight: 1.06 }}>Commitments shouldn&apos;t.</motion.span>
            </h1>

            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7, duration: 0.7 }} className="mx-auto mt-7 max-w-[600px] text-[17px] leading-[1.7] text-[var(--muted)] sm:text-[19px]">
              Decentra turns conversation into <span className="font-[600] text-[var(--text)]">decisions, owners and actions</span> — every one pinned to the second it was spoken.
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8, duration: 0.6 }} className="mt-9 flex flex-wrap items-center justify-center gap-4">
              <Magnetic>
                <Link href={user ? "/meetings?new=1" : "/login"} className="ring-conic group inline-flex h-[54px] items-center gap-3 rounded-full bg-[var(--fg)] px-8 text-[15px] font-[650] text-[var(--bg)] shadow-[0_12px_48px_rgba(255,255,255,0.2)] transition hover:bg-[var(--text)]">
                  {user ? "Start a meeting" : "Sign in to start"}
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--bg)] text-[var(--fg)] transition group-hover:translate-x-1"><ArrowRight className="h-4 w-4" /></span>
                </Link>
              </Magnetic>
              <a href="#pipeline" className="glass inline-flex h-[54px] items-center gap-2 rounded-full px-8 text-[14px] font-[550] text-[var(--text)] transition hover:bg-[color-mix(in_srgb,var(--fg)_8%,transparent)]"><Play className="h-4 w-4 fill-current" /> Watch it work</a>
            </motion.div>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.0, duration: 0.8 }}>
              <Ticker />
            </motion.div>
          </div>
        </motion.div>

        <motion.div style={{ y: springY }} className="relative">
          <div ref={cueRef} className="relative flex justify-center pb-8 pt-14">
            <motion.a href="#manifesto" style={{ opacity: cueOpacity }} className="flex flex-col items-center gap-2 text-[var(--subtle)] transition hover:text-[var(--fg)]" aria-label="Scroll to manifesto">
              <span className="fragment text-[10px] uppercase tracking-[0.24em]">Scroll</span>
              <motion.span animate={{ y: [0, 7, 0] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }} className="block h-10 w-[1px] bg-gradient-to-b from-[var(--gold)] to-transparent" />
            </motion.a>
          </div>
        </motion.div>
      </section>

      <Marquee items={["Record — speaker-aware transcript", "Understand — decisions with evidence 42:17", "Decide — confirm or revise", "Assign — owner + deadline", "Execute — never disappears", "Evidence-first · Human-in-the-loop"]} />

      {/* ═══ MANIFESTO — scroll-scrubbed reveal ═══ */}
      <section id="manifesto" className="relative mx-auto max-w-[1200px] scroll-mt-28 overflow-hidden px-6 py-28 lg:py-40">
        <Reveal><Kicker n="01" label="Manifesto" /></Reveal>
        <div className="relative mt-6 grid gap-10 lg:grid-cols-[200px_1fr] lg:gap-14">
          <div className="lg:sticky lg:top-32 lg:self-start">
            <p className="display-hero text-stroke text-[96px] leading-[0.9] lg:text-[120px]" aria-hidden="true">01</p>
            <p className="fragment mt-6 hidden text-[10.5px] uppercase leading-loose tracking-[0.2em] text-[var(--faint)] lg:block">
              — read it
              <br />
              at your pace
            </p>
          </div>
          <ManifestoScrub segments={MANIFESTO} className="lg:pt-10" />
        </div>
      </section>

      <Marquee
        reverse
        items={["◆ 42:17 — PostgreSQL selected", "◆ 92% confidence", "◆ Owner: Arun · Due Friday", "◆ Evidence-linked", "◆ Human-verified", "◆ 0 decisions lost"]}
      />

      {/* ═══ PIPELINE — sticky stack ═══ */}
      <section id="pipeline" className="relative mx-auto max-w-[1200px] scroll-mt-24 px-6 py-24 lg:py-32">
        <Reveal className="mx-auto max-w-[720px] text-center">
          <Kicker n="02" label="The pipeline" center />
          <h2 className="display-hero mt-5 text-[clamp(2.4rem,6vw,4.5rem)] leading-[1.0]">Four moves. <span className="thin text-[var(--subtle)]">Zero amnesia.</span></h2>
          <p className="mt-5 text-[15px] leading-relaxed text-[var(--muted)]">Scroll — each phase lands on top of the last, exactly how memory should layer.</p>
        </Reveal>
        <div className="mt-14"><StackSteps /></div>
      </section>

      {/* ═══ EVIDENCE BAND ═══ */}
      <div id="evidence" className="scroll-mt-24">
        <Scroll3DScene height={420}>
          <div className="relative z-10 mx-auto max-w-[900px] px-6 text-center">
            <Reveal>
              <p className="fragment text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">03 / Evidence-first</p>
              <p className="serif mx-auto mt-4 max-w-[720px] text-[24px] leading-[1.5] text-[var(--text)] sm:text-[30px]">
                &ldquo;Detected <span className="text-[var(--subtle)]">is not</span> true — <span className="text-[var(--gold)]">until you verify it.</span>&rdquo;
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                {["42:17 evidence", "92% confidence", "Human-in-the-loop"].map((c) => (
                  <span key={c} className="fragment rounded-full border border-[var(--border)] bg-[color-mix(in_srgb,var(--fg)_3%,transparent)] px-3.5 py-1.5 text-[10px] uppercase tracking-[0.16em] text-[var(--muted)] backdrop-blur">{c}</span>
                ))}
              </div>
            </Reveal>
          </div>
        </Scroll3DScene>
      </div>

      {/* ═══ NUMBERS — editorial hairlines ═══ */}
      <section id="numbers" className="relative mx-auto max-w-[1200px] scroll-mt-24 px-6 py-24 lg:py-32">
        <Reveal className="mx-auto max-w-[720px] text-center">
          <Kicker n="04" label="By the numbers" center />
          <h2 className="display-hero mt-5 text-[clamp(2.4rem,6vw,4.5rem)] leading-[1.0]">Memory, <span className="thin text-[var(--subtle)]">measured.</span></h2>
        </Reveal>
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {NUMBERS.map((s, i) => {
            const tone = TONE_COLORS[s.tone] || "var(--gold)";
            return (
              <Reveal key={s.label} delay={Math.min(i * 0.07, 0.21)}>
                <TiltCard max={7} glare={`${tone}22`} className="h-full">
                  <div className="glass-strong group relative flex h-full min-h-[250px] flex-col justify-between overflow-hidden rounded-[22px] p-7">
                    <div
                      className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full opacity-25 blur-3xl transition-opacity duration-500 group-hover:opacity-50"
                      style={{ background: tone }}
                      aria-hidden="true"
                    />
                    <div className="relative flex items-center justify-between">
                      <span className="fragment text-[11px] tabular-nums text-[var(--faint)]">0{i + 1}</span>
                      <s.icon className="h-5 w-5 transition-transform duration-300 group-hover:scale-110" style={{ color: tone }} />
                    </div>
                    <div className="relative">
                      <div className="flex items-baseline gap-1.5">
                        <AnimatedNumber value={s.value} delay={i * 0.12} className="!text-[clamp(3.2rem,5.5vw,4.6rem)]" />
                        <span className="text-[20px] font-[700] text-[var(--subtle)]">{s.suffix}</span>
                      </div>
                      <p className="mt-1.5 text-[13px] text-[var(--muted)]">{s.label}</p>
                      <div className="mt-3 opacity-80 transition-opacity duration-300 group-hover:opacity-100">
                        <AreaChart data={sparkFor(s.value)} color={tone} />
                      </div>
                    </div>
                  </div>
                </TiltCard>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* ═══ FINALE — pure editorial stage, no card ═══ */}
      <section id="begin" className="relative scroll-mt-24 overflow-hidden px-6 pb-28 pt-10">
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 h-[560px] w-[820px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.13] blur-[100px]"
          style={{ background: "radial-gradient(ellipse, var(--gold) 0%, var(--violet) 55%, transparent 75%)" }}
          aria-hidden="true"
        />
        {/* floating evidence chips — desktop depth dressing */}
        <div className="pointer-events-none absolute left-[6%] top-[30%] hidden animate-float xl:block" aria-hidden="true">
          <div className="glass rounded-[14px] px-4 py-3 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
            <p className="fragment text-[10px] uppercase tracking-[0.14em] text-[var(--amber)]">◆ Decision detected · 92%</p>
            <p className="serif mt-1 max-w-[210px] text-[13px] leading-snug text-[var(--text)]">&ldquo;PostgreSQL selected for version one.&rdquo;</p>
          </div>
        </div>
        <div className="pointer-events-none absolute right-[6%] top-[46%] hidden animate-float xl:block" style={{ animationDelay: "-2.5s" }} aria-hidden="true">
          <div className="glass rounded-[14px] px-4 py-3 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
            <p className="fragment text-[10px] uppercase tracking-[0.14em] text-[var(--emerald)]">● Arun · Due Friday</p>
            <p className="mt-1 text-[13px] font-[600] text-[var(--text)]">Prepare database schema</p>
          </div>
        </div>

        <div className="relative mx-auto max-w-[860px] text-center">
          <Reveal className="flex justify-center"><Kicker n="05" label="Begin" center /></Reveal>
          <Reveal>
            <h2 className="display-hero mt-8 text-[clamp(3rem,8vw,6.5rem)] leading-[0.98]">
              <span className="bg-gradient-to-b from-[var(--fg)] to-[var(--muted)] bg-clip-text text-transparent">Never lose a decision</span>
              <span className="thin block text-[var(--gold)]">again.</span>
            </h2>
            <p className="mx-auto mt-6 max-w-[520px] text-[16px] leading-relaxed text-[var(--muted)]">
              Bring the conversation. Leave with owners, deadlines, and proof — pinned to the second each was spoken.
            </p>
            <div className="mt-10 flex justify-center">
              <Magnetic3DButton variant="primary" size="lg" onClick={() => router.push(workspaceHref)}>
                {user ? "Open your workspace →" : "Enter Decentra →"}
              </Magnetic3DButton>
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
              {["42:17 evidence", "92% confidence", "Human-in-the-loop"].map((c) => (
                <span key={c} className="fragment rounded-full border border-[var(--border)] bg-[color-mix(in_srgb,var(--fg)_3%,transparent)] px-3.5 py-1.5 text-[10px] uppercase tracking-[0.16em] text-[var(--muted)] backdrop-blur">{c}</span>
              ))}
            </div>
            <a href="#pipeline" className="mt-6 inline-flex items-center gap-1.5 text-[12.5px] font-[550] text-[var(--subtle)] transition hover:text-[var(--fg)]">or replay how it works <ArrowUpRight className="h-3.5 w-3.5" /></a>
          </Reveal>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="relative overflow-hidden border-t border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-2)_90%,transparent)]">
        <div className="orb orb-violet pointer-events-none h-[420px] w-[560px] left-1/2 top-[-200px] -translate-x-1/2 opacity-[0.12]" aria-hidden="true" />
        <div className="relative mx-auto max-w-[1200px] px-6 pt-16">
          <Reveal>
            <p className="fragment text-[10px] uppercase tracking-[0.24em] text-[var(--subtle)]">Evidence-first · Human-in-the-loop</p>
            <Link href="/" className="display-hero text-stroke mt-4 block text-[clamp(3.5rem,13vw,11rem)] leading-[0.9] transition-opacity hover:opacity-80">DECENTRA</Link>
          </Reveal>
          <div className="grid gap-10 border-t border-[var(--border)] py-12 md:grid-cols-[1.2fr_1fr_1fr_1fr]">
            <p className="max-w-[300px] text-[13.5px] leading-relaxed text-[var(--subtle)]">Meeting intelligence with evidence. Every decision traces back to the second it was spoken.</p>
            <nav aria-label="Product">
              <p className="fragment text-[10px] uppercase tracking-[0.18em] text-[var(--subtle)]">Product</p>
              <ul className="mt-4 space-y-2.5 text-[13.5px]">
                {[["Overview", "/overview"], ["Meetings", "/meetings"], ["Decisions", "/decisions"], ["Review queue", "/review"]].map(([label, href]) => (
                  <li key={href}><Link href={href} className="text-[var(--muted)] transition hover:text-[var(--fg)]">{label}</Link></li>
                ))}
              </ul>
            </nav>
            <nav aria-label="Workspace">
              <p className="fragment text-[10px] uppercase tracking-[0.18em] text-[var(--subtle)]">Workspace</p>
              <ul className="mt-4 space-y-2.5 text-[13.5px]">
                {[["Sign in", "/login"], ["Create account", "/register"], ["New workspace", "/onboarding"]].map(([label, href]) => (
                  <li key={href}><Link href={href} className="text-[var(--muted)] transition hover:text-[var(--fg)]">{label}</Link></li>
                ))}
              </ul>
            </nav>
            <nav aria-label="Index">
              <p className="fragment text-[10px] uppercase tracking-[0.18em] text-[var(--subtle)]">Index</p>
              <ul className="mt-4 space-y-2.5 text-[13.5px]">
                {[["Manifesto", "#manifesto"], ["Pipeline", "#pipeline"], ["Evidence", "#evidence"], ["Numbers", "#numbers"]].map(([label, href]) => (
                  <li key={href}><a href={href} className="text-[var(--muted)] transition hover:text-[var(--fg)]">{label}</a></li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
        <div className="relative border-t border-[var(--border)]">
          <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-2 px-6 py-5 text-[12px] text-[var(--faint)]">
            <span>© 2026 Decentra — Meeting Intelligence</span>
            <span className="fragment">42:17 · pinned forever</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
