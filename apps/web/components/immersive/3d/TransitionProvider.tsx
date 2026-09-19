"use client";
import { usePathname } from "next/navigation";
import { PageTransition } from "@/components/immersive/3d/PageTransition";

export function TransitionProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <PageTransition key={pathname} pathname={pathname}>
      {children}
    </PageTransition>
  );
}
