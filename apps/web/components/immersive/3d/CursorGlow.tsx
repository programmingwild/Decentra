"use client";
import { useEffect } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

/** Global cursor glow: a gold dot + trailing aura. Fine-pointer devices only. */
export function CursorGlow() {
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const sx = useSpring(x, { stiffness: 260, damping: 28, mass: 0.5 });
  const sy = useSpring(y, { stiffness: 260, damping: 28, mass: 0.5 });

  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const move = (e: MouseEvent) => { x.set(e.clientX); y.set(e.clientY); };
    window.addEventListener("mousemove", move, { passive: true });
    return () => window.removeEventListener("mousemove", move);
  }, [x, y]);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[200] hidden [@media(pointer:fine)]:block">
      {/* trailing aura */}
      <motion.div
        className="absolute h-[420px] w-[420px] rounded-full"
        style={{
          x: sx, y: sy, translateX: "-50%", translateY: "-50%",
          background: "radial-gradient(circle, rgba(212,165,116,0.07) 0%, rgba(56,189,248,0.05) 40%, transparent 70%)",
        }}
      />
      {/* dot */}
      <motion.div
        className="absolute h-[7px] w-[7px] rounded-full bg-[#D4A574] shadow-[0_0_12px_rgba(212,165,116,0.9)]"
        style={{ x, y, translateX: "-50%", translateY: "-50%" }}
      />
    </div>
  );
}
