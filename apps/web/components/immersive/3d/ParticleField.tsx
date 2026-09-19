"use client";
import { useMemo, useRef, useEffect, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

interface ParticleFieldProps {
  count?: number;
  colors?: string[];
  className?: string;
  interactWithMouse?: boolean;
  physics?: boolean;
}

export function ParticleField({
  count = 200,
  colors = ["#38BDF8", "#A78BFA", "#F59E0B", "#D4A574", "#10B981"],
  className = "",
  interactWithMouse = true,
  physics = true,
}: ParticleFieldProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className={`absolute inset-0 ${className}`} />;
  }

  // NOTE: same as ShaderAurora — positioning lives on a plain div because
  // R3F's own wrapper div carries inline `position: relative`.
  return (
    <div className={`absolute inset-0 pointer-events-none ${className}`}>
      <Canvas
        camera={{ position: [0, 0, 50], fov: 60 }}
        gl={{ antialias: true, alpha: true }}
        style={{ width: "100%", height: "100%" }}
        onCreated={({ gl }) => gl.setClearColor(0x08090b, 0)}
      >
        <ParticleSystem
          count={count}
          colors={colors}
          interactWithMouse={interactWithMouse}
          physics={physics}
        />
      </Canvas>
    </div>
  );
}

function ParticleSystem({
  count,
  colors,
  interactWithMouse,
  physics,
}: {
  count: number;
  colors: string[];
  interactWithMouse: boolean;
  physics: boolean;
}) {
  const { mouse, size } = useThree();
  const groupRef = useRef<THREE.Points>(null);

  const points = useMemo(() => {
    const uniforms = {
      uTime: { value: 0 },
      uColors: { value: colors.map((c) => new THREE.Color(c)) },
      uColorCount: { value: colors.length },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uInteract: { value: interactWithMouse ? 1 : 0 },
      uPhysics: { value: physics ? 1 : 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
    };
    return buildParticlesWithUniforms(count, colors, uniforms);
  }, [count, colors, interactWithMouse, physics]);

  useFrame((state) => {
    const mat = points.material as THREE.ShaderMaterial;
    mat.uniforms.uTime.value = state.clock.elapsedTime;
    mat.uniforms.uMouse.value.set(mouse.x, mouse.y);
    mat.uniforms.uResolution.value.set(size.width, size.height);
    points.rotation.y =
      state.clock.elapsedTime * 0.005 +
      (interactWithMouse ? mouse.x * 0.4 : 0);
  });

  return <primitive object={points} />;
}

function buildParticlesWithUniforms(count: number, colors: string[], uniforms: Record<string, any>) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const colorIndices = new Float32Array(count);
  const life = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    positions[i3] = (Math.random() - 0.5) * 100;
    positions[i3 + 1] = (Math.random() - 0.5) * 60;
    positions[i3 + 2] = (Math.random() - 0.5) * 80 - 20;
    velocities[i3] = (Math.random() - 0.5) * 0.02;
    velocities[i3 + 1] = (Math.random() - 0.5) * 0.02;
    velocities[i3 + 2] = (Math.random() - 0.5) * 0.02;
    sizes[i] = Math.random() * 3 + 0.5;
    colorIndices[i] = Math.floor(Math.random() * colors.length);
    life[i] = Math.random();
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("velocity", new THREE.BufferAttribute(velocities, 3));
  geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("colorIndex", new THREE.BufferAttribute(colorIndices, 1));
  geometry.setAttribute("life", new THREE.BufferAttribute(life, 1));

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  return new THREE.Points(geometry, material);
}

const VERTEX = `
  attribute float size;
  attribute float colorIndex;
  attribute float life;
  attribute vec3 velocity;

  uniform float uTime;
  uniform vec3 uColors[5];
  uniform vec2 uMouse;
  uniform float uInteract;
  uniform float uPhysics;

  varying float vLife;
  varying vec3 vColor;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i+vec3(0,0,0)), hash(i+vec3(1,0,0)), f.x),
          mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x),
          mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y),
      f.z
    );
  }

  void main() {
    vLife = life;
    vColor = uColors[int(colorIndex)];

    vec3 pos = position;
    if (uPhysics > 0.5) {
      float t = uTime * 0.5;
      float n = noise(pos * 0.02 + t);
      pos.x += sin(t + pos.y * 0.1) * 2.0 * n;
      pos.y += cos(t + pos.x * 0.1) * 1.5 * n;
      pos.z += sin(t * 0.7 + pos.x * 0.05) * 1.0 * n;
      pos += velocity * 10.0;

      if (uInteract > 0.5) {
        vec2 mp = uMouse * 50.0;
        vec2 delta = vec2(pos.x, pos.y) - mp;
        float dist = length(delta);
        float force = 5.0 / (dist * dist + 1.0);
        pos.x += (delta.x / max(dist, 0.0001)) * force;
        pos.y += (delta.y / max(dist, 0.0001)) * force;
      }

      if (pos.x > 50.0) pos.x = -50.0;
      if (pos.x < -50.0) pos.x = 50.0;
      if (pos.y > 30.0) pos.y = -30.0;
      if (pos.y < -30.0) pos.y = 30.0;
      if (pos.z > 30.0) pos.z = -40.0;
      if (pos.z < -40.0) pos.z = 30.0;
    }

    float vSize = size * (0.5 + 0.5 * sin(uTime * 3.0 + life * 6.28));
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = vSize * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const FRAGMENT = `
  varying float vLife;
  varying vec3 vColor;

  void main() {
    float dist = length(gl_PointCoord - 0.5);
    float alpha = smoothstep(0.5, 0.0, dist);
    float pulse = sin(vLife * 20.0) * 0.15 + 0.85;
    alpha *= pulse;
    vec3 color = mix(vColor, vec3(1.0), 0.3 * (1.0 - dist));
    gl_FragColor = vec4(color, alpha * 0.8);
  }
`;
