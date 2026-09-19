"use client";
import { motion, useScroll, useSpring } from "framer-motion";

/** Cinematic top scroll-progress bar, gold → sky. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 26, mass: 0.4 });
  return (
    <motion.div
      aria-hidden="true"
      className="fixed inset-x-0 top-0 z-[210] h-[2px] origin-left bg-gradient-to-r from-[#D4A574] via-[#F5F7FA] to-[#38BDF8]"
      style={{ scaleX }}
    />
  );
}
