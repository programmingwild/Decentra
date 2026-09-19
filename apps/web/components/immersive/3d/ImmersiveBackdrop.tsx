"use client";

/**
 * ImmersiveBackdrop — ambient 3D depth on EVERY page, zero WebGL.
 *
 * Fixed CSS orb field + film grain + vignette. Dashboard pages keep their
 * own single aurora canvas; the landing keeps hero scene + particles.
 * This layer is pure compositor work (transforms/opacity/filters on
 * oversized blurred divs) — no canvas contexts, no JS frame loop.
 * It sits above opaque page backgrounds (so it shows everywhere) at
 * single-digit opacity, like the film grain: ambient light, not content.
 */
export function ImmersiveBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 z-[1] overflow-hidden" aria-hidden="true">
      {/* deep-space base gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_60%_at_50%_-10%,rgba(56,189,248,0.055)_0%,transparent_60%),radial-gradient(ellipse_70%_50%_at_85%_110%,rgba(167,139,250,0.05)_0%,transparent_60%),radial-gradient(ellipse_60%_45%_at_8%_100%,rgba(212,165,116,0.045)_0%,transparent_60%)]" />
      {/* slow-drifting depth orbs */}
      <div className="orb orb-sky float-3d-slow left-[-140px] top-[8%] h-[420px] w-[420px] opacity-[0.10]" />
      <div className="orb orb-violet float-3d-slow float-3d-delay right-[-120px] top-[38%] h-[380px] w-[380px] opacity-[0.09]" />
      <div className="orb orb-amber float-3d left-[30%] top-[72%] h-[300px] w-[340px] opacity-[0.07]" />
      {/* vignette pulls focus to content */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(4,5,6,0.5)_100%)]" />
    </div>
  );
}
