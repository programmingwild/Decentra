import { ReactNode } from "react";
import { TiltCard } from "@/components/immersive/3d/TiltCard";

/**
 * Depth card — the dashboard's base surface in the immersive redesign.
 * Glass-depth gradient, top light edge, hover lift. `tilt` adds pointer
 * 3D (GPU-cheap, no WebGL); `glow` tints the hover aura.
 */
export function Card({
  children,
  className = "",
  tilt = false,
  glow = "rgba(56,189,248,0.07)",
  max = 5,
}: {
  children: ReactNode;
  className?: string;
  tilt?: boolean;
  glow?: string;
  max?: number;
}) {
  const inner = (
    <div className={`glass-depth depth-lift relative overflow-hidden rounded-[16px] ${className}`}>
      {/* top light edge */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.22] to-transparent"
      />
      {/* hover aura */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-0 blur-3xl transition-opacity duration-500 [group-hover:opacity-100]"
        style={{ background: glow }}
      />
      {children}
    </div>
  );
  if (tilt) {
    return (
      <TiltCard max={max} glare={glow} className="group h-full">
        {inner}
      </TiltCard>
    );
  }
  return <div className="group">{inner}</div>;
}

export function CardHeader({
  title,
  subtitle,
  action,
  icon,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 p-5 pb-0">
      <div className="flex gap-3">
        {icon && <div className="h-8 w-8 rounded-[10px] border border-white/[0.1] bg-gradient-to-b from-white/[0.09] to-white/[0.03] text-[#9AA1AC] flex items-center justify-center shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">{icon}</div>}
        <div>
          <div className="font-[650] text-[13px] tracking-[-0.01em] text-[#F5F7FA] leading-none">{title}</div>
          {subtitle && <div className="text-[12px] leading-relaxed text-[#9AA1AC] mt-1">{subtitle}</div>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`p-5 ${className}`}>{children}</div>;
}
