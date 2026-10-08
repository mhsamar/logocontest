"use client";

import { useEffect, useState } from "react";
import { cx } from "@/lib/cx";

/** Floating frosted-glass header (softly rounded corners, owner 2026-10-08) (UI-JOURNEY §1.1): fixed at the top, a small gap from the edges, a deeper shadow once scrolled. */
export function HeaderShell({ children }: { children: React.ReactNode }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header className="sticky top-0 z-40 px-2 pb-2 pt-2 sm:px-4 sm:pb-3 sm:pt-3">
      <div
        className={cx(
          "relative mx-auto max-w-page rounded-2xl ring-1 ring-white backdrop-blur-xl backdrop-saturate-150 transition-[background-color,box-shadow] duration-200",
          scrolled ? "bg-white/80 shadow-panel" : "bg-white/65 shadow-raised",
        )}
      >
        {children}
      </div>
    </header>
  );
}
