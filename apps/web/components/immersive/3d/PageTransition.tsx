"use client";
import { useEffect } from "react";
import { motion } from "framer-motion";

interface PageTransitionProps {
  children: React.ReactNode;
  pathname: string;
  className?: string;
}

/**
 * Cross-fades page content in on route change (keyed on pathname).
 *
 * CRITICAL: opacity only, and NO AnimatePresence. An exiting page kept mounted
 * by AnimatePresence leaves a duplicate tree behind when its animation stalls
 * — including a second copy of the fixed sidebar/overlay, which then sits
 * invisible on top and swallows clicks. No exit animation means the old tree
 * unmounts immediately: one sidebar, one overlay, always current.
 *
 * No transform/filter/backdrop-filter here either: any of those creates a
 * containing block and re-anchors position:fixed elements to this wrapper
 * instead of the viewport.
 */
export function PageTransition({ children, pathname, className = "" }: PageTransitionProps) {
  useEffect(() => {
    document.documentElement.style.overflowX = "hidden";
  }, []);

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className={`${className} page-safe`}
      style={{ willChange: "opacity" }}
    >
      {children}
    </motion.div>
  );
}
