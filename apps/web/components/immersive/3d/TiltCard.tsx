"use client";
import { useRef, useState, useCallback } from "react";

interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
  /** max tilt in degrees */
  max?: number;
  /** glare highlight color */
  glare?: string;
  /** scale on hover */
  scale?: number;
  disabled?: boolean;
}

/**
 * GPU-cheap 3D tilt: pointer-driven rotateX/rotateY + specular glare.
 * No WebGL context per card — use this for lists/grids, reserve real
 * canvases for hero moments.
 */
export function TiltCard({ children, className = "", max = 7, glare = "rgba(255,255,255,0.09)", scale = 1.015, disabled = false }: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<{ rx: number; ry: number; gx: number; gy: number; active: boolean }>({ rx: 0, ry: 0, gx: 50, gy: 50, active: false });

  const onMove = useCallback((e: React.MouseEvent) => {
    const el = ref.current;
    if (!el || disabled) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    setStyle({ rx: (0.5 - py) * max * 2, ry: (px - 0.5) * max * 2, gx: px * 100, gy: py * 100, active: true });
  }, [disabled, max]);

  const onLeave = useCallback(() => {
    setStyle((s) => ({ ...s, rx: 0, ry: 0, active: false }));
  }, []);

  return (
    <div style={{ perspective: "1100px" }} className={className}>
      <div
        ref={ref}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        className="relative h-full w-full"
        style={{
          transformStyle: "preserve-3d",
          transform: `rotateX(${style.rx}deg) rotateY(${style.ry}deg) scale(${style.active ? scale : 1})`,
          transition: style.active ? "transform 0.08s linear" : "transform 0.55s cubic-bezier(0.16,1,0.3,1)",
          willChange: "transform",
        }}
      >
        {children}
        {/* specular glare */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[inherit]"
          style={{
            opacity: style.active ? 1 : 0,
            transition: "opacity 0.35s",
            background: `radial-gradient(560px circle at ${style.gx}% ${style.gy}%, ${glare}, transparent 60%)`,
          }}
        />
      </div>
    </div>
  );
}
