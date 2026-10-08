"use client";

import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n/config";
import { formatNumber, formatTaka } from "@/lib/money";

/**
 * A number that counts to its value (UI-JOURNEY §1.5): from zero when the page opens (unless
 * fromZero is false), and from the old value to the new one when it changes, like a total that
 * follows the client's choices. The server renders the final value.
 */
export function CountUp({
  value,
  locale,
  taka = false,
  duration = 1100,
  fromZero = true,
}: {
  value: number;
  locale: Locale;
  taka?: boolean;
  duration?: number;
  fromZero?: boolean;
}) {
  const [shown, setShown] = useState(value);
  const current = useRef(value);
  const first = useRef(true);

  useEffect(() => {
    const start = first.current ? (fromZero ? 0 : value) : current.current;
    first.current = false;
    const still = start === value || document.visibilityState === "hidden" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    const began = performance.now();
    const tick = (now: number) => {
      const p = still ? 1 : Math.min(1, (now - began) / duration);
      const next = Math.round(start + (value - start) * (1 - Math.pow(1 - p, 3)));
      current.current = next;
      setShown(next);
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration, fromZero]);

  return <>{taka ? formatTaka(shown, locale) : formatNumber(shown, locale)}</>;
}
