"use client";
import { motion } from "framer-motion";
import { useFailsafeVisible } from "@/components/immersive/3d/useFailsafeVisible";

/**
 * Standardized scroll reveal — one strong motion, restrained.
 * Failsafe: content can NEVER be trapped invisible (see useFailsafeVisible).
 */
export function Reveal({
  children,
  delay = 0,
  y = 26,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const safe = useFailsafeVisible();

  if (safe) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.65, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
