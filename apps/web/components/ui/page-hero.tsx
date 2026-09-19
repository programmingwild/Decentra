"use client";
import { motion } from "framer-motion";
import { useFailsafeVisible } from "@/components/immersive/3d/useFailsafeVisible";

/**
 * Shared dashboard hero — the landing's editorial voice, sized for app UI.
 * Kicker with gold dash, display title (supports <span className="thin">),
 * live subline. Entrance-choreographed on mount. `echo` renders a giant
 * outline ghost word behind the title for the immersive depth stage.
 */
export function PageHero({
  kicker,
  title,
  sub,
  echo,
  className = "",
}: {
  kicker: string;
  title: React.ReactNode;
  sub?: React.ReactNode;
  echo?: string;
  className?: string;
}) {
  const safe = useFailsafeVisible();

  const inner = (
    <>
      {echo && (
        <span
          aria-hidden="true"
          className="display-hero text-stroke pointer-events-none absolute -top-[0.55em] left-0 select-none whitespace-nowrap text-[clamp(3rem,9vw,6rem)] leading-none opacity-50"
        >
          {echo}
        </span>
      )}
      <p className="fragment relative flex items-center gap-2.5 text-[10.5px] uppercase tracking-[0.2em] text-[#656B75]">
        <span className="h-px w-8 shrink-0 bg-gradient-to-r from-[#D4A574] to-transparent shadow-[0_0_8px_rgba(212,165,116,0.6)]" aria-hidden="true" />
        {kicker}
      </p>
      <h1 className="display-hero text-3d relative mt-2 text-[36px] text-[#F5F7FA] lg:text-[48px]">{title}</h1>
      {sub && <div className="relative mt-3 max-w-xl text-[15px] leading-relaxed text-[#9AA1AC]">{sub}</div>}
    </>
  );

  if (safe) {
    return <div className={`relative min-w-0 ${className}`}>{inner}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      className={`relative min-w-0 ${className}`}
    >
      {inner}
    </motion.div>
  );
}
