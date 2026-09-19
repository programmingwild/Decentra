"use client";
import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, MeshDistortMaterial } from "@react-three/drei";
import * as THREE from "three";

function isReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
function isMobileDevice() {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|Android/i.test(navigator.userAgent) || window.innerWidth < 768;
}

function Orb({ position, color, scale, speed, distort, opacity = 0.42 }: { position: [number, number, number]; color: string; scale: number; speed: number; distort: number; opacity?: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const { mouse } = useThree();
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    // mouse parallax — restrained (2026 winners: subtle, not seasick)
    ref.current.position.x = position[0] + mouse.x * 0.45;
    ref.current.position.y = position[1] + mouse.y * 0.35;
    ref.current.rotation.y = t * 0.07 * speed;
  });
  return (
    <Float speed={speed} rotationIntensity={0.14} floatIntensity={0.9}>
      <mesh ref={ref} position={position} scale={scale}>
        <sphereGeometry args={[1, 48, 48]} />
        <MeshDistortMaterial color={color} transparent opacity={opacity} distort={distort} speed={1.15} roughness={0.14} metalness={0.05} />
      </mesh>
    </Float>
  );
}

function Helix({ color, position, scale, speed, opacity = 0.18 }: { color: string; position: [number, number, number]; scale: number; speed: number; opacity?: number }) {
  const ref = useRef<THREE.Group>(null);
  const { mouse } = useThree();
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.position.x = position[0] + mouse.x * 0.25;
    ref.current.position.y = position[1] + mouse.y * 0.2;
    ref.current.rotation.y = t * 0.035 * speed;
  });
  return (
    <group ref={ref} position={position} scale={scale}>
      <ambientLight intensity={0.3} />
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0, i * 1.6 - 1.6, 0]} rotation={[0, i * 0.55, 0]}>
          <torusGeometry args={[0.85, 0.06, 16, 64]} />
          <meshPhysicalMaterial color={color} transparent opacity={opacity} roughness={0.08} metalness={0.92} clearcoat={1} clearcoatRoughness={0.08} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <mesh position={[0, 1.6, 0]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshPhysicalMaterial color={color} transparent opacity={opacity * 2} emissive={color} emissiveIntensity={0.8} roughness={0} metalness={1} />
      </mesh>
    </group>
  );
}

function Scene({ tier }: { tier: "high" | "low" }) {
  if (tier === "low") {
    return (
      <>
        <ambientLight intensity={0.9} />
        <directionalLight position={[4, 6, 4]} intensity={0.7} />
        <Orb position={[0.6, 0.35, -2]} color="#0EA5E9" scale={1.55} speed={0.9} distort={0.32} opacity={0.34} />
        <Helix color="#0EA5E9" position={[0.6, 0.35, -2]} scale={0.6} speed={0.6} opacity={0.12} />
      </>
    );
  }
  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 8, 5]} intensity={0.65} />
      <Orb position={[-1.9, 0.9, -2.2]} color="#0EA5E9" scale={1.9} speed={0.85} distort={0.36} opacity={0.38} />
      <Orb position={[1.7, -0.7, -1.8]} color="#A78BFA" scale={1.55} speed={1.05} distort={0.30} opacity={0.34} />
      <Orb position={[0.15, 0.55, -3.2]} color="#F59E0B" scale={1.15} speed={0.75} distort={0.26} opacity={0.12} />
      <Helix color="#0EA5E9" position={[-1.9, 0.9, -2.2]} scale={0.55} speed={0.55} opacity={0.14} />
      <Helix color="#A78BFA" position={[1.7, -0.7, -1.8]} scale={0.45} speed={0.7} opacity={0.1} />
    </>
  );
}

export default function FluidBackground({ className = "" }: { className?: string }) {
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
    // CSS fallback that preserves visual language — per 3d skill + 2026 research
    return (
      <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
        <div className="orb orb-sky h-[640px] w-[720px] -left-[160px] -top-[180px]" />
        <div className="orb orb-violet h-[560px] w-[600px] -right-[140px] top-[120px]" />
        <div className="orb orb-amber h-[420px] w-[480px] left-[42%] top-[640px] opacity-[0.12]" />
      </div>
    );
  }

  return (
    <div className={`pointer-events-none absolute inset-0 ${className}`} aria-hidden="true">
      <Canvas
        dpr={tier === "low" ? 1 : [1, 1.7]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        camera={{ position: [0, 0, 5], fov: 52 }}
        onCreated={({ gl }) => { gl.setClearColor("#08090B", 0); }}
        style={{ background: "transparent" }}
        performance={{ min: 0.5 }}
      >
        <Scene tier={tier} />
      </Canvas>
    </div>
  );
}
