"use client";
import { useMemo, useEffect, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

interface ShaderAuroraProps {
  className?: string;
  intensity?: number;
  colors?: string[];
  speed?: number;
  mouseInfluence?: number;
}

export function ShaderAurora({ 
  className = "", 
  intensity = 1, 
  colors = ["#38BDF8", "#A78BFA", "#F59E0B", "#D4A574", "#10B981"],
  speed = 1,
  mouseInfluence = 0.5
}: ShaderAuroraProps) {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className={`absolute inset-0 ${className}`} />;
  }

  // NOTE: the positioning layer must be a plain div. R3F renders its own
  // wrapper div with inline `position: relative`, which would defeat an
  // `absolute` class placed directly on <Canvas> and blow out page scroll.
  return (
    <div className={`absolute inset-0 pointer-events-none ${className}`}>
      <Canvas
        camera={{ position: [0, 0, 1], fov: 80 }}
        gl={{ antialias: true, alpha: true }}
        style={{ width: "100%", height: "100%" }}
        onCreated={({ gl }) => { gl.setClearColor(0x08090b, 0); }}
      >
        <AuroraShader
          intensity={intensity}
          colors={colors}
          speed={speed}
          mouseInfluence={mouseInfluence}
        />
      </Canvas>
    </div>
  );
}

function AuroraShader({
  intensity,
  colors,
  speed,
  mouseInfluence,
}: {
  intensity: number;
  colors: string[];
  speed: number;
  mouseInfluence: number;
}) {
  const { mouse, size } = useThree();

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: intensity },
        uColors: { value: colors.map((c) => new THREE.Color(c)) },
        uColorCount: { value: colors.length },
        uMouse: { value: new THREE.Vector2(0, 0) },
        uMouseInfluence: { value: mouseInfluence },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uSpeed: { value: speed },
      },
      vertexShader: AURORA_VERTEX,
      fragmentShader: AURORA_FRAGMENT,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }, [colors, intensity, speed, mouseInfluence]);

  useEffect(() => () => material.dispose(), [material]);

  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uMouse.value.set(mouse.x, mouse.y);
    material.uniforms.uResolution.value.set(size.width, size.height);
  });

  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

const AURORA_VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const AURORA_FRAGMENT = `
  uniform float uTime;
  uniform float uIntensity;
  uniform vec3 uColors[5];
  uniform int uColorCount;
  uniform vec2 uMouse;
  uniform float uMouseInfluence;
  uniform vec2 uResolution;
  uniform float uSpeed;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i + vec2(0,0)), hash(i + vec2(1,0)), f.x),
      mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x),
      f.y
    );
  }

  float fbm(vec2 p, int octaves) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    for (int i = 0; i < 6; i++) {
      if (i >= octaves) break;
      value += amplitude * noise(p * frequency);
      frequency *= 2.02;
      amplitude *= 0.5;
    }
    return value;
  }

  vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }

  void main() {
    vec2 uv = vUv;
    vec2 centeredUv = uv - 0.5;
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    centeredUv.x *= aspect;

    vec2 mouseUv = uMouse * 0.5 + 0.5;
    float mouseDist = length(centeredUv - (mouseUv - 0.5) * vec2(aspect, 1.0)) * uMouseInfluence;
    float mouseInfluence = 1.0 / (1.0 + mouseDist * 3.0);

    float t = uTime * uSpeed * 0.3;

    float layer1 = fbm(centeredUv * 2.0 + vec2(t * 0.1, -t * 0.08), 5);
    float layer2 = fbm(centeredUv * 4.0 + vec2(-t * 0.07, t * 0.12), 4);
    float layer3 = fbm(centeredUv * 8.0 + vec2(t * 0.05, -t * 0.03), 3);

    float n = (layer1 + layer2 * 0.5 + layer3 * 0.25) / 1.75;
    n = pow(n, 1.5);
    n = smoothstep(0.2, 0.8, n);

    float wave1 = sin(centeredUv.y * 10.0 + t * 2.0) * 0.5;
    float wave2 = sin(centeredUv.x * 8.0 - t * 1.5) * 0.3;
    float wave3 = sin(length(centeredUv) * 15.0 - t * 3.0) * 0.2;

    float combined = n + (wave1 + wave2 + wave3) * 0.3 * uIntensity;
    combined *= 0.5 + 0.5 * mouseInfluence;

    float hue = (combined + t * 0.05) * 0.3;
    float sat = 0.6 + combined * 0.3;
    float val = combined * uIntensity * (0.5 + mouseInfluence * 0.5);

    vec3 color = hsv2rgb(vec3(hue, sat, val));

    float idx = fract(hue * float(uColorCount));
    int i0 = int(floor(idx));
    int i1 = int(ceil(idx)) % uColorCount;
    float f = fract(idx);
    vec3 paletteColor = mix(uColors[i0], uColors[i1], f);

    color = mix(color, paletteColor, 0.4);

    float vignette = 1.0 - length(centeredUv) * 0.8;
    color *= vignette * vignette;

    float glow = pow(combined, 2.0) * uIntensity;
    color += vec3(1.0, 0.95, 0.8) * glow * 0.3;

    float scanline = sin(uv.y * uResolution.y * 0.01 + uTime * 2.0) * 0.005;
    color += scanline;

    gl_FragColor = vec4(color, combined * 0.4 * vignette);
  }
`;