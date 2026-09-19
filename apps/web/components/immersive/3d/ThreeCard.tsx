"use client";
import { useRef, useEffect, useState, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { motion } from "framer-motion";
import * as THREE from "three";
import { useNearViewport } from "./useNearViewport";

interface ThreeCardProps {
  children: React.ReactNode;
  className?: string;
  depth?: number;
  hoverDepth?: number;
  onClick?: () => void;
  disabled?: boolean;
  accent?: string;
}

export function ThreeCard({
  children,
  className = "",
  depth = 0.12,
  hoverDepth = 0.25,
  onClick,
  disabled = false,
  accent = "#D4A574",
}: ThreeCardProps) {
  const [mounted, setMounted] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  // Below-fold WebGL mounts only on approach (see useNearViewport).
  const { ref: nearRef, near } = useNearViewport<HTMLDivElement>();
  const ready = mounted && near;

  useEffect(() => {
    setMounted(true);
  }, []);

  // SSR-safe fallback to avoid layout shift while canvas mounts
  if (!mounted) {
    return (
      <div className={`relative overflow-hidden rounded-[24px] ${className}`} style={{ minHeight: 220 }}>
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent" />
        <div className="relative z-10 h-full">{children}</div>
      </div>
    );
  }

  return (
    <div
      ref={nearRef}
      className={`relative ${className}`}
      onMouseEnter={() => !disabled && setIsHovered(true)}
      onMouseLeave={() => { setIsHovered(false); setIsPressed(false); }}
      onMouseDown={() => !disabled && setIsPressed(true)}
      onMouseUp={() => { setIsPressed(false); if (!disabled && onClick) onClick(); }}
      style={{
        perspective: "1000px",
        transformStyle: "preserve-3d",
      }}
    >
      {ready && (
        <CardCanvas
          depth={isPressed ? depth * 0.5 : isHovered ? hoverDepth : depth}
          isHovered={isHovered}
          isPressed={isPressed}
          accent={accent}
        />
      )}
      {/* HTML content floats above the WebGLAura card */}
      <div className="relative z-10 h-full">{children}</div>
      <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-[24px]">
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] via-transparent to-white/[0.01]" />
      </div>
    </div>
  );
}

function CardCanvas({
  depth,
  isHovered,
  isPressed,
  accent,
}: {
  depth: number;
  isHovered: boolean;
  isPressed: boolean;
  accent: string;
}) {
  // Plain-div layer: R3F's wrapper carries inline `position: relative`,
  // so the Canvas itself is never positioned — it just fills this layer.
  // Blooms in on mount (canvas warms up a few frames behind HTML).
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.9, ease: "easeOut" }}
      className="pointer-events-none absolute inset-0"
      aria-hidden="true"
    >
      <Canvas
        camera={{ position: [0, 0, 2.6], fov: 34 }}
        gl={{ antialias: true, alpha: true }}
        style={{ width: "100%", height: "100%" }}
        onCreated={({ gl }) => gl.setClearColor(0x08090b, 0)}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[1, 2, 3]} intensity={0.8} />
        <directionalLight position={[-1, -1, 2]} intensity={0.4} />
        <ThreeCardMesh
          depth={depth}
          isHovered={isHovered}
          isPressed={isPressed}
          accent={accent}
        />
      </Canvas>
    </motion.div>
  );
}

function ThreeCardMesh({
  depth,
  isHovered,
  isPressed,
  accent,
}: {
  depth: number;
  isHovered: boolean;
  isPressed: boolean;
  accent: string;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef(0);
  const uniformRef = useRef<any>(null);

  if (!uniformRef.current) {
    uniformRef.current = {
      uTime: { value: 0 },
      uHover: { value: 0 },
      uGlow: { value: 0 },
      uAccent: { value: new THREE.Color(accent) },
      uResolution: { value: new THREE.Vector2(1, 1) },
    };
  }

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const t = state.clock.elapsedTime;

    // Settle into a confident stance — lean toward hover, never spin.
    // A card body doing endless 360s reads as broken, not thrilling.
    const targetRY = isHovered ? 0.28 : 0;
    mesh.rotation.y += (targetRY - mesh.rotation.y) * 0.07;
    mesh.rotation.x += ((isHovered ? -0.08 : 0) + Math.sin(t * 0.6) * 0.03 - mesh.rotation.x) * 0.07;

    const targetZ = isHovered ? 0.3 : isPressed ? -0.1 : 0;
    mesh.position.z += (targetZ - mesh.position.z) * 0.12;

    glowRef.current += ((isHovered ? 1 : 0) - glowRef.current) * 0.08;
    uniformRef.current.uTime.value = t;
    uniformRef.current.uHover.value = isHovered ? 1 : 0;
    uniformRef.current.uGlow.value = glowRef.current;
  });

  return (
    <mesh ref={meshRef} position={[0, 0, 0]}>
      <RoundedBox args={[2.3, 1.5, depth]} radius={0.09} />
      <CardMaterial uniforms={uniformRef.current} />
    </mesh>
  );
}

function CardMaterial({ uniforms }: { uniforms: any }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    [uniforms]
  );

  useEffect(() => () => material.dispose(), [material]);

  return <primitive object={material} attach="material" />;
}

const VERTEX = `
  varying vec2 vUv;
  varying vec3 vNormal;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT = `
  uniform float uTime;
  uniform float uHover;
  uniform float uGlow;
  uniform vec3 uAccent;
  uniform vec2 uResolution;
  varying vec2 vUv;
  varying vec3 vNormal;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p *= 2.02;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    vec2 cuv = (vUv - 0.5) * vec2(aspect, 1.0);

    // edge detection for rounded card
    float edge = 1.0 - smoothstep(0.0, 0.06, abs(abs(cuv.x) - 1.0) + abs(abs(cuv.y) - 0.5));
    float border = smoothstep(0.04, 0.0, abs(abs(cuv.x) - 1.0 * (1.0 - 0.03)) + abs(abs(cuv.y) - 0.5 * (1.0 - 0.06)));

    float n = fbm(cuv * 3.0 + uTime * 0.12);
    float fresnel = pow(1.0 - abs(vNormal.z), 3.0);

    vec3 base = vec3(0.04, 0.045, 0.055);
    // animated aurora tint
    vec3 tint = uAccent * (0.25 + 0.2 * sin(uTime * 0.8));
    vec3 color = base + tint * n * 0.5;

    // border glow
    color += uAccent * border * (0.5 + uHover * 0.6);

    // hover lift glow
    color += uGlow * uAccent * fresnel * 0.8;
    color += uGlow * vec3(1.0, 0.95, 0.85) * fresnel * 0.4;

    float vignette = 1.0 - smoothstep(0.3, 1.1, length(cuv));
    color *= (0.75 + 0.25 * vignette);

    gl_FragColor = vec4(color, 0.94);
  }
`;
