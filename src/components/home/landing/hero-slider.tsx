"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cx } from "@/lib/cx";

/*
 * The home hero slider (owner, 2026-10-11; Design/home-hero/HERO-HANDOFF.md). The server renders every slide, with
 * slide 1 marked active, so the first paint shows slide 1 before this script runs and nothing moves. This
 * component only switches which slide is active: every `intervalMs` by itself, or from the dots. It pauses
 * while the mouse is over the showcase, while the business-name field is focused and while the tab is hidden.
 * With "reduce motion" on it never plays by itself (the dots still work).
 */

const subscribeMotion = (onChange: () => void) => {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
};
const subscribeVisibility = (onChange: () => void) => {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
};

export function HeroSlider({
  showcases,
  texts,
  labels,
  dotLabel,
  sampleLabel,
  aside,
  intervalMs,
}: {
  /** One showcase picture per slide, rendered on the server. */
  showcases: React.ReactNode[];
  /** One headline + text per slide, rendered on the server. */
  texts: React.ReactNode[];
  /** "Example brand: Jubilix" for each showcase. */
  labels: string[];
  /** "Show slide {n}" for each dot. */
  dotLabel: string[];
  /** "Sample artwork", or null once the slides are real winners. */
  sampleLabel: string | null;
  /** The text column's top and bottom: the eyebrow pill and the form + chips, which never change. */
  aside: { top: React.ReactNode; bottom: React.ReactNode };
  intervalMs: number;
}) {
  const count = showcases.length;
  const [active, setActive] = useState(0);
  const [leaving, setLeaving] = useState<number | null>(null);
  const [hover, setHover] = useState(false);
  const [typing, setTyping] = useState(false);
  const reduced = useSyncExternalStore(subscribeMotion, () => window.matchMedia("(prefers-reduced-motion: reduce)").matches, () => false);
  const hidden = useSyncExternalStore(subscribeVisibility, () => document.hidden, () => false);
  const paused = reduced || hidden || hover || typing || count < 2;
  const activeRef = useRef(0);

  const go = (next: number) => {
    const prev = activeRef.current;
    if (next === prev) return;
    activeRef.current = next;
    setLeaving(prev);
    setActive(next);
  };

  // Each change of slide (by itself or from a dot) starts a new wait, so every slide gets its full time.
  useEffect(() => {
    if (paused) return;
    const id = window.setTimeout(() => {
      const prev = activeRef.current;
      activeRef.current = (prev + 1) % count;
      setLeaving(prev);
      setActive(activeRef.current);
    }, intervalMs);
    return () => window.clearTimeout(id);
  }, [paused, active, count, intervalMs]);

  return (
    <div className="lc-hero-grid">
      <div className="flex flex-col items-center gap-3.5">
        <div className="lc-show" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
          {showcases.map((node, i) => (
            <div
              key={i}
              className="lc-show-slide"
              data-on={i === active ? "" : undefined}
              data-was={i === leaving && i !== active ? "" : undefined}
              role="img"
              aria-label={labels[i]}
              aria-hidden={i === active ? undefined : true}
            >
              {node}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3.5">
          <div className="flex items-center">
            {showcases.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => go(i)}
                aria-label={dotLabel[i]}
                aria-current={i === active ? "true" : undefined}
                className="group flex h-11 items-center px-1"
              >
                <span className={cx("lc-dot block h-[11px] rounded-full", i === active ? "w-[26px] bg-[var(--lc-red)]" : "w-[11px] bg-[#C9CCD3] group-hover:bg-[#9A9DA6]")} />
              </button>
            ))}
          </div>
          {sampleLabel && <span className="rounded-full bg-[#FFF4D1] px-2.5 py-0.5 text-[13px] font-bold text-[#6B4E00]">{sampleLabel}</span>}
        </div>
      </div>

      <div
        className="lc-hero-txt flex flex-col items-start"
        onFocus={(e) => e.target instanceof HTMLInputElement && setTyping(true)}
        onBlur={(e) => e.target instanceof HTMLInputElement && setTyping(false)}
      >
        {aside.top}
        <div className="mt-5 grid w-full">
          {texts.map((node, i) => (
            <div
              key={i}
              className="lc-hero-copy flex flex-col gap-5"
              data-on={i === active ? "" : undefined}
              data-was={i === leaving && i !== active ? "" : undefined}
              // Only slide 1 is read out (its headline is the page's h1); the others repeat the idea.
              aria-hidden={i === 0 ? undefined : true}
            >
              {node}
            </div>
          ))}
        </div>
        {aside.bottom}
      </div>
    </div>
  );
}
