"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import { useRef } from "react";
import * as THREE from "three";

function Nodes({ count = 5 }: { count: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, d) => { if (ref.current) ref.current.rotation.y += d * 0.12; });
  return (
    <group ref={ref}>
      {Array.from({ length: Math.min(count, 7) }).map((_, i) => {
        const angle = (i / 7) * Math.PI * 2;
        const r = 1.8;
        const x = Math.cos(angle) * r;
        const z = Math.sin(angle) * r;
        const y = (Math.sin(i) * 0.4);
        const col = i % 2 === 0 ? "#0EA5E9" : "#A78BFA";
        return (
          <Float key={i} speed={1.1 + i * 0.1} rotationIntensity={0.15} floatIntensity={0.6}>
            <mesh position={[x, y, z]}>
              <sphereGeometry args={[0.13, 16, 16]} />
              <meshStandardMaterial color={col} emissive={col} emissiveIntensity={0.4} />
            </mesh>
          </Float>
        );
      })}
      <mesh>
        <sphereGeometry args={[0.28, 20, 20]} />
        <meshStandardMaterial color="#F5F7FA" emissive="#F5F7FA" emissiveIntensity={0.12} />
      </mesh>
    </group>
  );
}

export default function GraphCanvas({ count = 5 }: { count: number }) {
  return (
    <Canvas camera={{ position: [0, 0, 5.5], fov: 45 }} dpr={[1, 1.5]} gl={{ antialias: true, alpha: true }} style={{ background: "transparent" }}>
      <ambientLight intensity={0.9} />
      <directionalLight position={[4, 6, 4]} intensity={0.7} />
      <Nodes count={count} />
    </Canvas>
  );
}
