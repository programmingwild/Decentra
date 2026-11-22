"use client";
import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface PageTransitionProps {
  children: React.ReactNode;
  pathname: string;
  className?: string;
}

/**
 * Smoothly animates page content in when the route changes (keyed on pathname).
 * Next.js <Link> performs the actual navigation; this provides a film-grade
 * cross-fade + slide. Relies on AnimatePresence so exiting pages fade out.
 *
 * CRITICAL: this wrapper must NEVER create a containing block (no filter,
 * no transform/perspective in will-change, no backdrop-filter). A containing
 * block re-anchors every `position: fixed` element on the page (background
 * layers, nav, cursor, progress) to the page wrapper instead of the viewport,
 * stretching inset-0 layers to full page height and blowing out scroll.
 */
export function PageTransition({ children, pathname, className = "" }: PageTransitionProps) {
  useEffect(() => {
    const html = document.documentElement;
    html.style.overflowX = "hidden";
    return () => {};
  }, []);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        // Opacity only — NEVER animate x/y here. Any transform (even a
        // "finished" one left behind by a stalled animation) creates a
        // containing block, re-anchoring the fixed sidebar/overlay to this
        // wrapper (full-page height, off-screen, unclickable). Cross-fade is
        // enough for the effect; the slide is not worth breaking navigation.
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className={`${className} page-safe`}
        style={{ willChange: "opacity" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
