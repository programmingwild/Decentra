"use client";
import { useRef, useEffect, useState, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { motion } from "framer-motion";
import * as THREE from "three";
import { useNearViewport } from "./useNearViewport";

interface Scroll3DSceneProps {
  children: React.ReactNode;
  className?: string;
  height?: number;
}

export function Scroll3DScene({ children, className = "", height = 800 }: Scroll3DSceneProps) {
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(0);
  // Below-fold WebGL mounts only on approach (see useNearViewport).
  const { ref: nearRef, near } = useNearViewport<HTMLDivElement>();

  useEffect(() => {
    setMounted(true);
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            progressRef.current = entry.intersectionRatio;
          }
        });
      },
      { threshold: Array.from({ length: 101 }, (_, i) => i / 100) }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  if (!mounted) {
    return (
      <div ref={containerRef} className={`relative overflow-hidden ${className}`} style={{ height }}>
        <div className="absolute inset-0 flex items-center justify-center">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={(el) => {
        containerRef.current = el;
        (nearRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
      }}
      className={`relative overflow-hidden ${className}`}
      style={{ height }}
    >
      {/* Explicit plain-div layer: R3F's own wrapper carries inline
          `position: relative`, so Canvas must never be positioned directly.
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
            camera={{ position: [0, 0, 5], fov: 50 }}
            gl={{ antialias: true, alpha: true }}
            style={{ width: "100%", height: "100%" }}
            onCreated={({ gl }) => { gl.setClearColor(0x08090b, 0); }}
          >
            <ambientLight intensity={0.5} />
            <directionalLight position={[5, 10, 5]} intensity={0.8} />
            <directionalLight position={[-5, -5, 3]} intensity={0.3} color="#38BDF8" />
            <directionalLight position={[5, -5, 3]} intensity={0.3} color="#A78BFA" />
            <FitCamera />
            <ScrollAwareOrbs progress={progressRef.current} />
          </Canvas>
        </motion.div>
      )}
      {/* HTML content floats above the WebGL orbs — never inside the canvas */}
      <div className="absolute inset-0 z-10 flex items-center justify-center px-6">
        {children}
      </div>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/[0.01] to-transparent" />
      </div>
    </div>
  );
}

/** Responsive fit: pull the camera back on narrow screens so the orbs
    compose inside the band instead of crowding/cropping the quote. */
function FitCamera() {
  const { camera, size } = useThree();
  useFrame(() => {
    const aspect = size.width / Math.max(size.height, 1);
    const target = aspect < 0.8 ? 8 : aspect < 1.2 ? 6.2 : 5;
    camera.position.z += (target - camera.position.z) * 0.06;
  });
  return null;
}

function ScrollAwareOrbs({ progress }: { progress: number }) {  const { mouse } = useThree();
  const timeRef = useRef(0);

  useFrame((state) => {
    timeRef.current = state.clock.elapsedTime;
  });

  return (
    <>
      <ScrollOrb 
        position={[-2.5, 1.5 * progress - 1, -3]} 
        color="#38BDF8" 
        scale={1.8 + progress * 0.5}
        speed={0.8}
        time={timeRef.current}
        mouse={mouse}
      />
      <ScrollOrb 
        position={[2, -1 * progress + 0.5, -2.5]} 
        color="#A78BFA" 
        scale={1.4 + progress * 0.3}
        speed={1.1}
        time={timeRef.current}
        mouse={mouse}
      />
      <ScrollOrb 
        position={[0, 0.5 * progress, -4]} 
        color="#F59E0B" 
        scale={1 + progress * 0.2}
        speed={0.6}
        time={timeRef.current}
        mouse={mouse}
      />
      <ScrollOrb 
        position={[-1.5, -2 * progress, -2]} 
        color="#D4A574" 
        scale={0.8 + progress * 0.15}
        speed={0.9}
        time={timeRef.current}
        mouse={mouse}
      />
    </>
  );
}

function ScrollOrb({ 
  position, 
  color, 
  scale, 
  speed, 
  time, 
  mouse 
}: { 
  position: [number, number, number]; 
  color: string; 
  scale: number; 
  speed: number;
  time: number;
  mouse: THREE.Vector2;
}) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (!ref.current) return;
    
    const t = time;
    ref.current.position.x = position[0] + mouse.x * 0.8;
    ref.current.position.y = position[1] + mouse.y * 0.6 + Math.sin(t * speed) * 0.3;
    ref.current.position.z = position[2];
    ref.current.rotation.y = t * 0.05 * speed;
    ref.current.rotation.x = Math.sin(t * speed * 0.7) * 0.1;
  });

  return (
    <mesh ref={ref} position={position} scale={scale}>
      <sphereGeometry args={[1, 64, 64]} />
      <OrbMaterial color={color} time={time} />
    </mesh>
  );
}

function OrbMaterial({ color, time }: { color: string; time: number }) {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: time },
          uColor: { value: new THREE.Color(color) },
        },
        vertexShader: ORB_VERTEX,
        fragmentShader: ORB_FRAGMENT,
        transparent: true,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [color]
  );

  useEffect(() => () => material.dispose(), [material]);

  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return <primitive object={material} attach="material" />;
}

const ORB_VERTEX = `
  varying vec2 vUv;
  varying vec3 vNormal;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const ORB_FRAGMENT = `
  uniform float uTime;
  uniform vec3 uColor;
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
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 6; i++) {
      value += amplitude * noise(p);
      p *= 2.02;
      amplitude *= 0.5;
    }
    return value;
  }

  void main() {
    vec2 centeredUv = vUv - 0.5;
    float n = fbm(centeredUv * 8.0 + uTime * 0.15);
    float n2 = fbm(centeredUv * 16.0 - uTime * 0.1);

    float fresnel = pow(1.0 - abs(vNormal.z), 2.5);

    vec3 base = uColor * 0.15;
    vec3 core = uColor * 0.8;
    vec3 edge = uColor * 0.3;

    vec3 color = mix(base, core, n);
    color += edge * fresnel * 2.0;
    color += vec3(1.0, 0.9, 0.7) * fresnel * 0.4;

    float pulse = sin(uTime * 2.0) * 0.05 + 0.95;
    color *= pulse;

    float vignette = 1.0 - length(vUv - 0.5) * 1.5;
    color *= vignette;

    gl_FragColor = vec4(color, 0.7 * vignette);
  }
`;