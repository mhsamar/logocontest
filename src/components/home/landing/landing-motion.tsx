"use client";

import { useEffect } from "react";

/**
 * Home page motion (design file): reveals .lc-rv elements as they scroll into view, feeds the scroll
 * position to the hero parallax and the floating nav, and keeps the nav below the notice bar.
 * The page is complete without it; reduced-motion users get everything at once (see landing.css).
 */
export function LandingMotion() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-lc-landing]");
    if (!root) return;

    const notice = document.querySelector<HTMLElement>("[data-notice-bar]");
    const setNotice = () => root.style.setProperty("--lc-notice-h", `${notice?.offsetHeight ?? 0}px`);
    setNotice();
    const onScroll = () => root.style.setProperty("--lc-sy", String(window.scrollY || 0));
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", setNotice);
    const noticeWatch = notice ? new MutationObserver(setNotice) : null;
    noticeWatch?.observe(document.body, { childList: true, subtree: true });

    if (!("IntersectionObserver" in window)) return;
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
    root.querySelectorAll(".lc-rv").forEach((el) => io.observe(el));
    return () => {
      io.disconnect();
      noticeWatch?.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", setNotice);
    };
  }, []);
  return null;
}
