import Link from "next/link";

/** Branded 404 — unknown routes land here instead of a blank page. */
export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
      <p className="fragment text-[10.5px] uppercase tracking-[0.22em] text-[#D4A574]">404</p>
      <h1 className="display-hero mt-3 text-[36px] sm:text-[48px]">
        Nothing pinned <span className="thin text-[#9AA1AC]">here.</span>
      </h1>
      <p className="mt-4 max-w-[420px] text-[14px] leading-relaxed text-[#9AA1AC]">
        This page doesn&apos;t exist or moved. Your workspace is intact.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/overview"
          className="inline-flex h-[44px] items-center rounded-full bg-white px-7 text-[14px] font-[650] text-[#08090B] transition hover:bg-[#F5F7FA]"
        >
          Open workspace
        </Link>
        <Link
          href="/"
          className="glass inline-flex h-[44px] items-center rounded-full px-7 text-[14px] font-[550] text-[#E9EDF2] transition hover:bg-white/[0.08]"
        >
          Home
        </Link>
      </div>
    </main>
  );
}
