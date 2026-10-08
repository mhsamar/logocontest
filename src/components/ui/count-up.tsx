"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n/config";
import { formatNumber, formatTaka } from "@/lib/money";

/** A stat number that counts up from zero when the page opens (UI-JOURNEY §1.5). The server renders the final value. */
export function CountUp({ value, locale, taka = false, duration = 1100 }: { value: number; locale: Locale; taka?: boolean; duration?: number }) {
  const [shown, setShown] = useState(value);

  useEffect(() => {
    if (value <= 0 || document.visibilityState === "hidden" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      setShown(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return <>{taka ? formatTaka(shown, locale) : formatNumber(shown, locale)}</>;
}
