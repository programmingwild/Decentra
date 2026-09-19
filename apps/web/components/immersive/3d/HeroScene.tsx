"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, MeshDistortMaterial } from "@react-three/drei";
import * as THREE from "three";

const GOLD = "#D4A574";
const SKY = "#38BDF8";
const VIOLET = "#A78BFA";

function isReducedMotion() {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
function isMobileDevice() {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|Android/i.test(navigator.userAgent) || window.innerWidth < 768;
}

/** Camera rig: mouse parallax + scroll-driven cinematic journey. */
function Rig({ children }: { children: React.ReactNode }) {
  const { camera, mouse } = useThree();
  const group = useRef<THREE.Group>(null);
  useFrame((state, delta) => {
    const t = Math.min(delta, 0.05);
    const sy = typeof window !== "undefined" ? window.scrollY : 0;
    const vh = typeof window !== "undefined" ? window.innerHeight || 1 : 1;
    // 0 → 1 across the hero exit: the scroll is the dolly track
    const p = Math.min(sy / (vh * 1.1), 1);
    const tx = mouse.x * 0.7 + p * 1.4;
    const ty = mouse.y * 0.45 + 0.15 + p * 0.5;
    const tz = 7 - p * 1.6;
    camera.position.x += (tx - camera.position.x) * 0.05;
    camera.position.y += (ty - camera.position.y) * 0.05;
    camera.position.z += (tz - camera.position.z) * 0.05;
    camera.lookAt(p * 0.6, 0, 0);
    if (group.current) {
      group.current.position.y = sy * 0.0016;
      const targetRY = sy * 0.00035 + p * 0.9;
      group.current.rotation.y += (targetRY - group.current.rotation.y) * t * 2;
    }
  });
  return <group ref={group}>{children}</group>;
}

/** The "decision core" — a breathing gold icosahedron. */
function Core() {
  const mesh = useRef<THREE.Mesh>(null);
  const glow = useRef<THREE.Mesh>(null);
  const { mouse } = useThree();
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (mesh.current) {
      mesh.current.rotation.y = t * 0.16;
      mesh.current.rotation.x = Math.sin(t * 0.22) * 0.25 + mouse.y * 0.25;
      mesh.current.rotation.z = mouse.x * 0.2;
    }
    if (glow.current) {
      const s = 1.55 + Math.sin(t * 1.1) * 0.07;
      glow.current.scale.setScalar(s);
    }
  });
  return (
    <Float speed={1.6} rotationIntensity={0.12} floatIntensity={0.7}>
      <mesh ref={glow}>
        <sphereGeometry args={[1.28, 32, 32]} />
        <meshBasicMaterial color={GOLD} transparent opacity={0.07} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh ref={mesh}>
        <icosahedronGeometry args={[1.12, 24]} />
        <MeshDistortMaterial
          color={GOLD}
          emissive={GOLD}
          emissiveIntensity={0.14}
          roughness={0.28}
          metalness={0.62}
          distort={0.34}
          speed={1.5}
          transparent
          opacity={0.94}
        />
      </mesh>
      {/* wireframe shell for that "intelligence lattice" read */}
      <mesh scale={1.16}>
        <icosahedronGeometry args={[1.12, 2]} />
        <meshBasicMaterial color={SKY} wireframe transparent opacity={0.10} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </Float>
  );
}

/** Two tilted orbit rings with travelling satellites. */
function Rings() {
  const r1 = useRef<THREE.Mesh>(null);
  const r2 = useRef<THREE.Mesh>(null);
  const sats = useRef<THREE.Group>(null);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (r1.current) { r1.current.rotation.z = t * 0.12; r1.current.rotation.x = Math.PI / 2.35 + Math.sin(t * 0.18) * 0.06; }
    if (r2.current) { r2.current.rotation.z = -t * 0.09; r2.current.rotation.x = Math.PI / 1.85 + Math.cos(t * 0.15) * 0.06; }
    if (sats.current) {
      const kids = sats.current.children;
      for (let i = 0; i < kids.length; i++) {
        const a = t * (0.35 + i * 0.12) + (i * Math.PI * 2) / 3;
        const ringR = i === 2 ? 2.75 : 2.15;
        kids[i].position.set(Math.cos(a) * ringR, 0, Math.sin(a) * ringR);
      }
      sats.current.rotation.x = Math.PI / 2.35;
    }
  });
  return (
    <group>
      <mesh ref={r1} rotation={[Math.PI / 2.35, 0, 0]}>
        <torusGeometry args={[2.15, 0.014, 12, 220]} />
        <meshBasicMaterial color={SKY} transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh ref={r2} rotation={[Math.PI / 1.85, 0.3, 0]}>
        <torusGeometry args={[2.75, 0.011, 12, 240]} />
        <meshBasicMaterial color={VIOLET} transparent opacity={0.38} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <group ref={sats}>
        {[SKY, GOLD, VIOLET].map((c, i) => (
          <mesh key={c}>
            <sphereGeometry args={[i === 1 ? 0.075 : 0.05, 16, 16]} />
            <meshBasicMaterial color={c} blending={THREE.AdditiveBlending} transparent opacity={0.95} depthWrite={false} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** One-draw-call starfield. */
function Starfield({ count, color, spread, size }: { count: number; color: string; spread: [number, number, number]; size: number }) {
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * spread[0];
      arr[i * 3 + 1] = (Math.random() - 0.5) * spread[1];
      arr[i * 3 + 2] = (Math.random() - 0.5) * spread[2] - 2;
    }
    return arr;
  }, [count, spread]);
  const ref = useRef<THREE.Points>(null);
  useFrame((state) => {
    if (ref.current) ref.current.rotation.y = state.clock.elapsedTime * 0.012;
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color={color} size={size} transparent opacity={0.75} sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

function Scene({ tier }: { tier: "high" | "low" }) {
  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 6, 5]} intensity={0.9} color="#FFF3E0" />
      <pointLight position={[-5, -3, 4]} intensity={12} color={SKY} />
      <pointLight position={[5, 4, 2]} intensity={8} color={VIOLET} />
      <Rig>
        <group position={[1.6, 0.1, 0]}>
          <Core />
          <Rings />
        </group>
        <Starfield count={tier === "high" ? 420 : 160} color={SKY} spread={[22, 14, 14]} size={0.035} />
        <Starfield count={tier === "high" ? 160 : 60} color={GOLD} spread={[18, 12, 12]} size={0.05} />
      </Rig>
    </>
  );
}

export function HeroScene({ className = "" }: { className?: string }) {
  const [state, setState] = useState<"checking" | "webgl" | "fallback">("checking");
  const [tier, setTier] = useState<"high" | "low">("high");

  useEffect(() => {
    if (isReducedMotion()) { setState("fallback"); return; }
    try {
      const canvas = document.createElement("canvas");
      const gl = (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
      if (!gl) { setState("fallback"); return; }
    } catch { setState("fallback"); return; }
    setTier(isMobileDevice() ? "low" : "high");
    setState("webgl");
  }, []);

  if (state === "checking") return null;

  if (state === "fallback") {
    return (
      <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
        <div className="orb orb-sky h-[560px] w-[640px] right-[6%] top-[8%]" />
        <div className="orb orb-violet h-[440px] w-[480px] right-[22%] top-[44%] opacity-[0.2]" />
        <div className="orb orb-amber h-[380px] w-[420px] right-[10%] top-[30%] opacity-[0.16]" />
      </div>
    );
  }

  return (
    <div className={`pointer-events-none absolute inset-0 ${className}`} aria-hidden="true">
      <Canvas
        dpr={tier === "low" ? 1 : [1, 1.75]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        camera={{ position: [0, 0.15, 7], fov: 50 }}
        onCreated={({ gl }) => { gl.setClearColor("#08090B", 0); }}
        style={{ background: "transparent" }}
        performance={{ min: 0.5 }}
      >
        <Scene tier={tier} />
      </Canvas>
      {/* cinematic vignette + bottom fade into page */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(8,9,11,0.55)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#08090B] to-transparent" />
    </div>
  );
}
