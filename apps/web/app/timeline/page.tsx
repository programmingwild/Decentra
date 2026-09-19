"use client";
import { useEffect, useState, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Html, OrbitControls } from "@react-three/drei";
import { api } from "@/lib/api";
import { Nav } from "@/components/nav";
import { fmtDateLong } from "@/lib/format";
import { DecisionPill } from "@/components/ui/primitives";
import { SkeletonRow } from "@/components/ui/states";
import * as THREE from "three";
import Link from "next/link";

function Helix({ count, scroll }: { count: number; scroll: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (ref.current) ref.current.rotation.y = scroll * 1.2;
  });
  const radius = 2.2;
  const height = Math.max(4, count * 0.9);
  return (
    <group ref={ref}>
      {Array.from({ length: count }).map((_, i) => {
        const t = count === 1 ? 0 : i / (count - 1);
        const angle = t * Math.PI * 2.8;
        const y = (t - 0.5) * height;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const hue = i % 3 === 0 ? "#0EA5E9" : i % 3 === 1 ? "#A78BFA" : "#10B981";
        return (
          <Float key={i} speed={1.2 + i * 0.05} rotationIntensity={0.12} floatIntensity={0.5}>
            <mesh position={[x, y, z]}>
              <sphereGeometry args={[0.16, 20, 20]} />
              <meshStandardMaterial color={hue} emissive={hue} emissiveIntensity={0.35} roughness={0.35} metalness={0.2} />
            </mesh>
          </Float>
        );
      })}
      {/* helix curve */}
      <mesh>
        <tubeGeometry args={[new THREE.CatmullRomCurve3(Array.from({ length: Math.max(count, 12) }, (_, i) => {
          const t = i / 11;
          const angle = t * Math.PI * 2.8;
          const y = (t - 0.5) * height;
          return new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
        })), 72, 0.015, 8, false]} />
        <meshStandardMaterial color="#1E293B" transparent opacity={0.45} />
      </mesh>
    </group>
  );
}

export default function TimelinePage() {
  const [timeline, setTimeline] = useState<any[]>([]);
  const [ledger, setLedger] = useState<any[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [scroll, setScroll] = useState(0);
  const [sel, setSel] = useState<any | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const orgs = await api("/api/v1/organizations");
        if (!orgs?.[0]) return;
        const oid = orgs[0].id;
        const [mem, led, h] = await Promise.all([
          api(`/api/v1/memory?org_id=${oid}&limit=18`).catch(() => ({ timeline: [] })),
          api(`/api/v1/ledger?org_id=${oid}`).catch(() => ({ ledger: [] })),
          api(`/api/v1/health/score?org_id=${oid}`).catch(() => null),
        ]);
        setTimeline(mem.timeline || []);
        setLedger(led.ledger || []);
        setHealth(h);
      } catch {}
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    const onScroll = () => setScroll(window.scrollY / 1200);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-[#08090B] lg:flex-row">
      <Nav />
      <main className="min-w-0 flex-1">
        <div className="relative h-[42vh] overflow-hidden border-b border-white/[0.06]">
          <Canvas camera={{ position: [0, 0, 6.5], fov: 42 }} dpr={[1, 1.6]} gl={{ antialias: true, alpha: true }} style={{ background: "transparent" }}>
            <ambientLight intensity={0.9} />
            <directionalLight position={[4, 6, 4]} intensity={0.8} />
            <pointLight position={[-4, -2, 4]} intensity={0.6} color="#38BDF8" />
            <Helix count={Math.max(timeline.length, 7)} scroll={scroll} />
            <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.25} />
          </Canvas>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#08090B] via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-5 lg:p-8">
            <p className="fragment text-[10px] uppercase tracking-[0.18em] text-white/50">Immersive · Commitment Graph</p>
            <h1 className="display-hero mt-1 text-[30px] text-white lg:text-[40px]">Timeline <span className="thin text-white/60">of commitments</span></h1>
            <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-white/60">Every confirmed decision is an immutable obligation. Scroll to orbit the helix — each node is a decision, color is strength.</p>
          </div>
        </div>

        <div className="mx-auto max-w-[980px] px-5 py-8 lg:px-8">
          {health && (
            <div className="glass flex flex-wrap items-center gap-4 rounded-[16px] p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border-2" style={{ borderColor: health.level === "high" ? "#10B981" : health.level === "medium" ? "#F59E0B" : "#EF4444", color: health.level === "high" ? "#10B981" : health.level === "medium" ? "#F59E0B" : "#EF4444" }}>
                <span className="text-[16px] font-[800]">{health.health}</span>
              </div>
              <div>
                <div className="text-[13px] font-[600] text-[#F5F7FA]">Org health {health.level}</div>
                <div className="text-[11px] text-[#9AA1AC]">{health.metrics.confirmed_rate}% decisions confirmed · {health.metrics.completed_rate}% actions done · {health.metrics.overdue} overdue</div>
              </div>
              <div className="ml-auto hidden gap-2 sm:flex">
                <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] text-[#9AA1AC]">{health.metrics.total_decisions} decisions</span>
                <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] text-[#9AA1AC]">{health.metrics.total_actions} actions</span>
              </div>
            </div>
          )}

          <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <section>
              <h2 className="fragment text-[11px] uppercase tracking-[0.14em] text-[#656B75]">Memory — cross-meeting decisions</h2>
              {loading ? <div className="mt-3 space-y-2">{[0,1,2].map(i=> <SkeletonRow key={i} />)}</div> : timeline.length===0 ? <p className="mt-3 text-[13px] text-[#656B75]">No decisions yet.</p> : (
                <div className="mt-3 space-y-2">
                  {timeline.map((d) => (
                    <button key={d.id} onClick={()=> setSel(d)} className={`w-full text-left rounded-[14px] border p-4 text-left transition ${sel?.id===d.id ? "glass-strong border-white/15" : "glass-subtle hover:bg-white/[0.04]"}`}>
                      <div className="flex items-center gap-2"><DecisionPill status={d.status} /><span className={`h-1.5 w-1.5 rounded-full ${d.strength?.level==="high"?"bg-[#10B981]":d.strength?.level==="medium"?"bg-[#F59E0B]":"bg-[#656B75]"}`} /><span className="text-[11px] text-[#9AA1AC]">{d.strength?.score} · {d.strength?.level}</span></div>
                      <p className="mt-2 text-[13.5px] font-[600] leading-snug text-[#E9EDF2]">{d.title}</p>
                      <p className="mt-1 text-[11px] text-[#656B75]">{d.meeting_title} · {fmtDateLong(d.meeting_date)} · {d.evidence_segment_ids?.length || 0} moments</p>
                    </button>
                  ))}
                </div>
              )}
            </section>
            <section>
              <h2 className="fragment text-[11px] uppercase tracking-[0.14em] text-[#656B75]">Ledger — immutable obligations</h2>
              {ledger.length===0 ? <p className="mt-3 text-[13px] text-[#656B75]">No confirmed decisions yet.</p> : (
                <div className="mt-3 space-y-2">
                  {ledger.slice(0,8).map((l) => (
                    <Link key={l.id} href={`/meetings/${l.meeting_id}`} className="block rounded-[14px] border border-[#10B981]/15 bg-[#10B981]/[0.06] p-4 hover:bg-[#10B981]/[0.09] transition">
                      <p className="text-[13px] font-[600] text-[#E9EDF2]">{l.title}</p>
                      <p className="mt-1 text-[11px] text-[#9AA1AC]">{l.meeting_title} · confirmed {fmtDateLong(l.confirmed_at)} {l.confirmed_by ? `by ${l.confirmed_by.split("@")[0]}` : ""}</p>
                    </Link>
                  ))}
                </div>
              )}
              {sel && (
                <div className="glass-strong mt-6 rounded-[16px] p-4">
                  <p className="fragment text-[10px] uppercase tracking-[0.14em] text-[#656B75]">Selected · Evidence strength</p>
                  <p className="mt-1 text-[14px] font-[600] text-[#F5F7FA]">{sel.title}</p>
                  <div className="mt-2 flex items-center gap-2 text-[11px]"><span className={`rounded-full px-2 py-0.5 font-[700] ${sel.strength?.level==="high"?"bg-[#10B981]/15 text-[#10B981]":sel.strength?.level==="medium"?"bg-[#F59E0B]/15 text-[#F59E0B]":"bg-white/10 text-[#9AA1AC]"}`}>{sel.strength?.score} {sel.strength?.level}</span><span className="text-[#656B75]">{sel.strength?.factors?.join(" · ")}</span></div>
                  <Link href={`/meetings/${sel.meeting_id}`} className="mt-3 inline-flex text-[11px] font-[600] text-[#38BDF8] hover:text-white">Open meeting →</Link>
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
