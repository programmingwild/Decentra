"use client";
import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { useSceneVisibility } from "./useSceneVisibility";

function Helix({ count, scroll }: { count: number; scroll: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (ref.current) ref.current.rotation.y = scroll * 1.2;
  });
  const radius = 2.2;
  const height = Math.max(4, count * 0.9);
  const curve = new THREE.CatmullRomCurve3(
    Array.from({ length: Math.max(count, 12) }, (_, i) => {
      const t = i / 11;
      const angle = t * Math.PI * 2.8;
      const y = (t - 0.5) * height;
      return new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
    }),
  );
  return (
    <group ref={ref}>
      {Array.from({ length: count }).map((_, i) => {
        const t = count === 1 ? 0 : i / (count - 1);
        const angle = t * Math.PI * 2.8;
        const y = (t - 0.5) * height;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const hue = i % 3 === 0 ? "var(--sky-2)" : i % 3 === 1 ? "var(--violet)" : "var(--emerald-2)";
        return (
          <Float key={i} speed={1.2 + i * 0.05} rotationIntensity={0.12} floatIntensity={0.5}>
            <mesh position={[x, y, z]}>
              <sphereGeometry args={[0.16, 16, 16]} />
              <meshStandardMaterial color={hue} emissive={hue} emissiveIntensity={0.35} roughness={0.35} metalness={0.2} />
            </mesh>
          </Float>
        );
      })}
      <mesh>
        <tubeGeometry args={[curve, 48, 0.015, 6, false]} />
        <meshStandardMaterial color="#1E293B" transparent opacity={0.45} />
      </mesh>
    </group>
  );
}

export function HelixScene({ count, scroll }: { count: number; scroll: number }) {
  const { ref: viewRef, visible } = useSceneVisibility<HTMLDivElement>();
  return (
    <div ref={viewRef} className="absolute inset-0">
      <Canvas
        camera={{ position: [0, 0, 6.5], fov: 42 }}
        dpr={[1, 1.4]}
        gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
        frameloop={visible ? "always" : "never"}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.9} />
        <directionalLight position={[4, 6, 4]} intensity={0.8} />
        <pointLight position={[-4, -2, 4]} intensity={0.6} color="var(--sky)" />
        <Helix count={count} scroll={scroll} />
        <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.25} />
      </Canvas>
    </div>
  );
}
