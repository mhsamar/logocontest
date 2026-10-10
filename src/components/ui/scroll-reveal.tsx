"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const SELECTOR = ".lc-rv, .lc-rv-soft";

/**
 * Site-wide motion helper (owner, 2026-10-10; UI-JOURNEY §1): reveals .lc-rv / .lc-rv-soft elements as
 * they scroll into view, and feeds the scroll position and the height of the top bars (notice, email
 * banner) to CSS so the floating nav sits below them. Mounted once in the root layout.
 */
export function ScrollReveal() {
  const path = usePathname();

  // Scroll position and top-bar height, as CSS variables on <html>.
  useEffect(() => {
    const root = document.documentElement;
    const bars = () => document.querySelector<HTMLElement>("[data-top-bars]");
    const setBars = () => root.style.setProperty("--lc-notice-h", `${bars()?.offsetHeight ?? 0}px`);
    const onScroll = () => root.style.setProperty("--lc-sy", String(window.scrollY || 0));
    setBars();
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", setBars);
    const el = bars();
    const watch = el && "ResizeObserver" in window ? new ResizeObserver(setBars) : null;
    if (el) watch?.observe(el);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", setBars);
      watch?.disconnect();
    };
  }, []);

  // Reveal: watch every element on the page, and new ones as the page changes.
  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const root = document.documentElement;
    root.classList.add("lc-mo");
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add("lc-in");
          io.unobserve(e.target);
        }
      },
      { threshold: 0.12 },
    );
    const scan = (node: ParentNode) => node.querySelectorAll(SELECTOR).forEach((el) => !el.classList.contains("lc-in") && io.observe(el));
    scan(document);
    const mo = new MutationObserver((records) => {
      for (const r of records) r.addedNodes.forEach((n) => n instanceof Element && (n.matches(SELECTOR) ? io.observe(n) : scan(n)));
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, [path]);

  return null;
}
