"use client";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/** Intro ritual: counter 0→100, curtain lift. Once per session. Skipped for reduced motion. */
export function Preloader() {
  const [count, setCount] = useState(0);
  const [gone, setGone] = useState(false);
  const doneRef = useRef(false);

  useEffect(() => {
    const finish = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      try { sessionStorage.setItem("dec:preload", "1"); } catch {}
      setGone(true);
    };
    try {
      if (sessionStorage.getItem("dec:preload") === "1") { doneRef.current = true; setGone(true); return; }
    } catch { /* private mode — play it anyway */ }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finish();
      return;
    }
    let v = 0;
    const id = setInterval(() => {
      v += Math.floor(Math.random() * 11) + 5;
      if (v >= 100) {
        v = 100;
        clearInterval(id);
        setTimeout(finish, 380);
      }
      setCount(v);
    }, 90);
    // Wall-clock cap: the intro can never trap anyone, no matter what stalls.
    const cap = setTimeout(finish, 3500);
    return () => { clearInterval(id); clearTimeout(cap); };
  }, []);

  return (
    <AnimatePresence>
      {!gone && (
        <motion.div
          className="fixed inset-0 z-[300] flex flex-col justify-between bg-[#08090B] px-6 py-6 sm:px-10"
          exit={{ y: "-100%" }}
          transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
          aria-hidden="true"
        >
          <div className="flex items-center justify-between">
            <span className="fragment text-[10.5px] uppercase tracking-[0.24em] text-[#656B75]">Decentra</span>
            <span className="fragment text-[10.5px] uppercase tracking-[0.24em] text-[#656B75]">Meeting intelligence</span>
          </div>
          <div className="flex items-end justify-between gap-6">
            <p className="fragment max-w-[220px] text-[10.5px] uppercase leading-relaxed tracking-[0.2em] text-[#454B54]">
              Pinning every decision to the second it was spoken
            </p>
            <span className="display-hero text-[72px] leading-none text-[#F5F7FA] tabular-nums sm:text-[120px]">
              {count}
            </span>
          </div>
          <div className="h-px w-full bg-white/[0.08]">
            <div className="h-full bg-gradient-to-r from-[#D4A574] to-[#38BDF8] transition-[width] duration-150" style={{ width: `${count}%` }} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
