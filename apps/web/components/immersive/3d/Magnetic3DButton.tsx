"use client";
import { useMemo, useRef, useState, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { motion } from "framer-motion";
import { useNearViewport } from "./useNearViewport";

/** THREE.Color ignores alpha with a console warning — strip it, zero visual change. */
function toOpaque(c: string) {
  if (c.startsWith("rgba")) return `rgb(${c.slice(5, -1).split(",").slice(0, 3).join(",")})`;
  return c;
}

interface Magnetic3DButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  variant?: "primary" | "secondary" | "glass";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
}

const SIZE = {
  sm: { w: 1.7, h: 0.72, d: 0.12, pad: "10px 18px", fs: 13 },
  md: { w: 2.4, h: 0.92, d: 0.15, pad: "14px 28px", fs: 15 },
  lg: { w: 3.2, h: 1.15, d: 0.18, pad: "18px 36px", fs: 17 },
};

const VARIANTS = {
  primary: { bg: "#D4A574", glow: "#D4A574", border: "rgba(212,165,116,0.25)" },
  secondary: { bg: "rgba(56,189,248,0.06)", glow: "#38BDF8", border: "rgba(56,189,248,0.35)" },
  glass: { bg: "rgba(255,255,255,0.03)", glow: "#A78BFA", border: "rgba(255,255,255,0.12)" },
};

export function Magnetic3DButton({
  children,
  onClick,
  className = "",
  variant = "primary",
  size = "md",
  disabled = false,
}: Magnetic3DButtonProps) {
  const [mounted, setMounted] = useState(false);
  const [hover, setHover] = useState(false);
  const [pressed, setPressed] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  // Below-fold WebGL mounts only on approach (see useNearViewport).
  const { ref: nearRef, near } = useNearViewport<HTMLDivElement>();
  const { w, h, d, pad, fs } = SIZE[size];
  const v = VARIANTS[variant];

  useEffect(() => setMounted(true), []);

  const text = (
    <span style={{ fontSize: fs, letterSpacing: "-0.01em" }} className="relative z-10 font-[650]">
      {children}
    </span>
  );

  return (
    <div
      ref={(el) => {
        wrapRef.current = el;
        (nearRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
      }}
      className={`relative inline-block ${className}`}
      style={{ perspective: "1000px" }}
    >
      {/* Fallback for SSR / before canvas mount */}
      {!mounted ? (
        <motion.button
          onClick={onClick}
          disabled={disabled}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className="relative inline-flex items-center justify-center rounded-[16px]"
          style={{ padding: pad, background: v.bg, border: `1px solid ${v.border}`, color: variant === "primary" ? "#08090B" : "#F5F7FA" }}
        >
          {text}
        </motion.button>
      ) : (
        <>
          {/* Plain-div layer (see ThreeCard note): the Canvas wrapper is
              inline `position: relative`, so it must never carry layout.
              Mounts only on approach to bound live WebGL contexts. */}
          {near && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.9, ease: "easeOut" }}
              className="pointer-events-none absolute inset-0"
              aria-hidden="true"
            >
              <Canvas
                camera={{ position: [0, 0, 3], fov: 30 }}
                gl={{ antialias: true, alpha: true }}
                style={{ width: "100%", height: "100%" }}
                onCreated={({ gl }) => gl.setClearColor(0x08090b, 0)}
              >
                <ambientLight intensity={0.7} />
                <directionalLight position={[2, 3, 4]} intensity={1.1} />
                <pointLight position={[0, 0, 4]} intensity={2.5} color={v.glow} />
                <ButtonMesh
                  w={w}
                  h={h}
                  d={d}
                  glowColor={v.glow}
                  borderColor={v.border}
                  variant={variant}
                  hover={hover}
                  pressed={pressed}
                />
              </Canvas>
            </motion.div>
          )}
          <motion.button
            onClick={onClick}
            disabled={disabled}
            onMouseEnter={() => !disabled && setHover(true)}
            onMouseLeave={() => {
              setHover(false);
              setPressed(false);
            }}
            onMouseDown={() => !disabled && setPressed(true)}
            onMouseUp={() => setPressed(false)}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            className="relative inline-flex w-full items-center justify-center rounded-[16px]"
            style={{
              padding: pad,
              color: variant === "primary" ? "#08090B" : "#F5F7FA",
              textShadow: variant !== "primary" ? "0 1px 12px rgba(0,0,0,0.6)" : "none",
            }}
          >
            {text}
          </motion.button>
        </>
      )}
    </div>
  );
}

function ButtonMesh({
  w,
  h,
  d,
  glowColor,
  borderColor,
  variant,
  hover,
  pressed,
}: {
  w: number;
  h: number;
  d: number;
  glowColor: string;
  borderColor: string;
  variant: string;
  hover: boolean;
  pressed: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef(0);
  const { size } = useThree();

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const t = state.clock.elapsedTime;

    // Fit the slab to the live button box: the HTML label sizes the canvas,
    // so derive scale from the camera frustum — never a hardcoded guess.
    // (A fixed-size slab drifts out of sync with the text and looks broken.)
    const visH = 2 * 3 * Math.tan((30 * Math.PI) / 360);
    const visW = visH * (size.width / Math.max(size.height, 1));
    mesh.scale.set((visW * 0.94) / w, (visH * 0.9) / h, 1);

    // Settle into a confident stance — tilt toward hover, never spin.
    // A button body doing 360s reads as broken, not thrilling.
    const targetZ = pressed ? -0.06 : hover ? 0.22 : 0;
    mesh.position.z += (targetZ - mesh.position.z) * 0.12;
    const targetRY = hover ? 0.32 : 0;
    mesh.rotation.y += (targetRY - mesh.rotation.y) * 0.08;
    mesh.rotation.x += ((hover ? -0.1 : 0) - mesh.rotation.x) * 0.08;
    mesh.position.x = Math.sin(t * 0.8) * 0.03;
    mesh.position.y = Math.cos(t * 0.6) * 0.025;

    glowRef.current += ((hover ? 1 : 0) - glowRef.current) * 0.08;
  });

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uGlow: { value: 0 },
      uHover: { value: 0 },
      uGlowColor: { value: new THREE.Color(glowColor) },
      uBorderColor: { value: new THREE.Color(toOpaque(borderColor)) },
      uVariant: { value: variant === "primary" ? 0 : variant === "secondary" ? 1 : 2 },
    }),
    [glowColor, borderColor, variant]
  );

  useFrame((state) => {
    uniforms.uTime.value = state.clock.elapsedTime;
    uniforms.uGlow.value = glowRef.current;
    uniforms.uHover.value = hover ? 1 : 0;
  });

  return (
    <mesh ref={meshRef}>
      <RoundedBox args={[w, h, d]} radius={0.07} />
      <ButtonMaterial uniforms={uniforms} />
    </mesh>
  );
}

function ButtonMaterial({ uniforms }: { uniforms: any }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: BTN_VERTEX,
        fragmentShader: BTN_FRAGMENT,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    [uniforms]
  );
  useEffect(() => () => material.dispose(), [material]);
  return <primitive object={material} attach="material" />;
}

const BTN_VERTEX = `
  varying vec2 vUv;
  varying vec3 vNormal;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const BTN_FRAGMENT = `
  uniform float uTime;
  uniform float uGlow;
  uniform float uHover;
  uniform vec3 uGlowColor;
  uniform vec3 uBorderColor;
  uniform float uVariant;
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

  void main() {
    float edge = 1.0 - smoothstep(0.0, 0.02, length(vUv - 0.5) * 2.0);
    float fresnel = pow(1.0 - abs(vNormal.z), 2.0);

    vec3 base;
    if (uVariant < 0.5) {
      base = mix(vec3(0.35, 0.25, 0.14), vec3(0.85, 0.65, 0.4), 0.6 + 0.1 * sin(uTime));
    } else if (uVariant < 1.5) {
      base = vec3(0.03, 0.05, 0.06);
    } else {
      base = vec3(0.05, 0.055, 0.07);
    }

    vec3 color = base;
    color += uBorderColor * edge * (1.0 - uVariant) * 0.6;
    color += uGlowColor * uGlow * (1.0 - edge) * 0.7;
    color += uGlowColor * fresnel * uHover * 0.5;
    color += vec3(1.0, 0.95, 0.85) * fresnel * uGlow * 0.35;

    float scanline = sin(vUv.y * 200.0 + uTime * 4.0) * 0.012;
    color += scanline;

    float vignette = 1.0 - length(vUv - 0.5) * 1.2;
    color *= vignette;

    float alpha = uVariant < 0.5 ? 0.96 : 0.92;
    alpha *= 0.5 + 0.5 * vignette;

    gl_FragColor = vec4(color, alpha);
  }
`;
