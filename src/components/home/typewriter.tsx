"use client";

import { useEffect, useRef, useState } from "react";
import { cx } from "@/lib/cx";

/** Splits into visible characters, so Bangla conjuncts and vowel signs are never cut in half. */
function graphemes(text: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    return [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)].map((s) => s.segment);
  }
  return Array.from(text);
}

const TYPE_MS = 70;
const ERASE_MS = 35;
const HOLD_MS = 2400;

/**
 * Writing animation (UI-JOURNEY P-01). Types the first phrase; with `loop` it
 * then erases and types the next one, round and round. With `onView` it waits
 * until it scrolls into sight. The longest phrase is laid out invisibly
 * underneath so nothing jumps. aria-hidden: the heading carries the real text.
 */
export function Typewriter({
  phrases,
  className,
  delay = 450,
  loop = false,
  onView = false,
}: {
  phrases: string[];
  className?: string;
  delay?: number;
  loop?: boolean;
  onView?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  // null = not started (shows the first phrase whole, as on the server and without JavaScript).
  const [state, setState] = useState<{ phrase: number; count: number; done: boolean } | null>(null);
  const key = phrases.join("\u0000");

  useEffect(() => {
    const list = key.split("\u0000").map(graphemes);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- show the text at once when motion is reduced
      setState({ phrase: 0, count: list[0].length, done: true });
      return;
    }
    let timer = 0;
    let phrase = 0;
    let count = 0;
    let erasing = false;

    const step = () => {
      const len = list[phrase].length;
      if (!erasing) {
        count += 1;
        setState({ phrase, count, done: count >= len && !loop });
        if (count < len) timer = window.setTimeout(step, TYPE_MS);
        else if (loop && list.length > 1) {
          erasing = true;
          timer = window.setTimeout(step, HOLD_MS);
        }
      } else {
        count -= 1;
        setState({ phrase, count, done: false });
        if (count > 0) timer = window.setTimeout(step, ERASE_MS);
        else {
          erasing = false;
          phrase = (phrase + 1) % list.length;
          timer = window.setTimeout(step, 300);
        }
      }
    };

    const start = () => {
      setState({ phrase: 0, count: 0, done: false });
      timer = window.setTimeout(step, delay);
    };

    if (!onView || !("IntersectionObserver" in window)) {
      start();
      return () => window.clearTimeout(timer);
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          start();
        }
      },
      { threshold: 0.6 },
    );
    if (ref.current) io.observe(ref.current);
    return () => {
      io.disconnect();
      window.clearTimeout(timer);
    };
  }, [key, delay, loop, onView]);

  const longest = phrases.reduce((a, b) => (graphemes(b).length > graphemes(a).length ? b : a), phrases[0]);
  const text = state === null ? phrases[0] : graphemes(phrases[state.phrase]).slice(0, state.count).join("");
  // Caret: solid while typing or erasing, blinking while a phrase is held, fading out when a one-off is done.
  const held = state !== null && !state.done && state.count >= graphemes(phrases[state.phrase]).length;

  return (
    <span ref={ref} className="relative inline-grid" aria-hidden>
      <span className={cx("invisible col-start-1 row-start-1", className)}>{longest}</span>
      <span className={cx("col-start-1 row-start-1", className)}>
        {text}
        <span
          className={cx(
            "ml-[0.08em] inline-block h-[0.85em] w-[0.06em] translate-y-[0.08em] rounded-full bg-primary align-baseline",
            state?.done ? "opacity-0 transition-opacity delay-[1.5s] duration-700" : held || state === null ? "animate-caret" : "opacity-100",
          )}
        />
      </span>
    </span>
  );
}
