"use client";

interface PageTransitionProps {
  children: React.ReactNode;
  pathname: string;
  className?: string;
}

/**
 * Route container — deliberately plain markup, no framer-motion.
 *
 * A JS-driven `opacity: 0 → 1` enter animation left its inline opacity stuck
 * at 0 after client-side navigation whenever the animation frame loop was
 * throttled (background tab, heavy WebGL, mobile). The whole page — including
 * the sidebar — became invisible, which users reported as "clicks don't work".
 * No inline opacity, no transform, no animation: the page is always visible
 * and position:fixed descendants always anchor to the viewport.
 */
export function PageTransition({ children, pathname, className = "" }: PageTransitionProps) {
  return (
    <div key={pathname} className={`${className} page-safe`}>
      {children}
    </div>
  );
}
