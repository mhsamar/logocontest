"use client";

import { useEffect, useState } from "react";
import { cx } from "@/lib/cx";

/** Sticky header that is transparent at the top of the page and gets a background once scrolled. */
export function HeaderShell({ children }: { children: React.ReactNode }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header
      className={cx(
        "sticky top-0 z-40 border-b transition-[background-color,border-color] duration-200",
        scrolled ? "border-line bg-canvas/85 backdrop-blur supports-[backdrop-filter]:bg-canvas/70" : "border-transparent bg-transparent",
      )}
    >
      {children}
    </header>
  );
}
