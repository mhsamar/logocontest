"use client";

import { useRef, useState } from "react";
import { cx } from "@/lib/cx";

/**
 * Tab and filter bars: a soft highlight glides to the item under the mouse (UI-JOURNEY §1.5).
 * Wraps the bar; items must be positioned (`relative`) so they paint above the highlight.
 */
export function GlideTrack({ className, children }: { className?: string; children: React.ReactNode }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const onOver = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    const item = (e.target as Element).closest<HTMLElement>("a, button");
    const root = wrap.current;
    if (!item || !root || !root.contains(item)) return;
    const r = item.getBoundingClientRect();
    const o = root.getBoundingClientRect();
    setBox({ x: r.left - o.left, y: r.top - o.top, w: r.width, h: r.height });
  };

  return (
    <div ref={wrap} data-no-fx className={cx("relative", className)} onPointerOver={onOver} onPointerLeave={() => setBox(null)}>
      <span
        aria-hidden
        className={cx(
          "pointer-events-none absolute left-0 top-0 z-0 rounded-full bg-canvas shadow-card ring-1 ring-line transition-[transform,width,height,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          box ? "opacity-100" : "opacity-0",
        )}
        style={box ? { width: box.w, height: box.h, transform: `translate(${box.x}px, ${box.y}px)` } : undefined}
      />
      {children}
    </div>
  );
}
