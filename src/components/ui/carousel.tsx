"use client";

import { Children, useCallback, useEffect, useRef, useState } from "react";
import { cx } from "@/lib/cx";

/**
 * Card carousel (UI-JOURNEY §1.1, ofsp_ce reference): swipe or use the round
 * arrows; dots show the page. When everything fits, the cards sit centred and
 * the arrows and dots hide.
 */
export function Carousel({ children, prevLabel, nextLabel, itemClassName }: { children: React.ReactNode; prevLabel: string; nextLabel: string; itemClassName?: string }) {
  const track = useRef<HTMLUListElement>(null);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(0);
  const items = Children.toArray(children);

  const measure = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const count = Math.max(1, Math.round(el.scrollWidth / el.clientWidth));
    setPages(el.scrollWidth - el.clientWidth > 4 ? count : 1);
    setPage(Math.round(el.scrollLeft / el.clientWidth));
  }, []);

  useEffect(() => {
    measure();
    const el = track.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    el.addEventListener("scroll", measure, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", measure);
    };
  }, [measure]);

  const go = (to: number) => {
    const el = track.current;
    if (!el) return;
    el.scrollTo({ left: Math.max(0, Math.min(pages - 1, to)) * el.clientWidth, behavior: "smooth" });
  };

  const arrow = "absolute top-1/2 z-10 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-surface text-ink shadow-raised ring-1 ring-line transition-opacity hover:text-primary disabled:opacity-0 sm:flex";

  return (
    <div className="relative">
      {pages > 1 && (
        <>
          <button type="button" aria-label={prevLabel} onClick={() => go(page - 1)} disabled={page === 0} className={cx(arrow, "-left-3 lg:-left-6")}>
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
              <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button type="button" aria-label={nextLabel} onClick={() => go(page + 1)} disabled={page >= pages - 1} className={cx(arrow, "-right-3 lg:-right-6")}>
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
              <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </>
      )}
      <ul
        ref={track}
        className={cx(
          "-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4 pb-4 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          pages === 1 && "justify-center",
        )}
      >
        {items.map((child, i) => (
          <li key={i} className={cx("shrink-0 snap-start", itemClassName)}>
            {child}
          </li>
        ))}
      </ul>
      {pages > 1 && (
        <div className="mt-2 flex justify-center gap-1.5" aria-hidden>
          {Array.from({ length: pages }, (_, i) => (
            <span key={i} className={cx("h-2 rounded-full transition-all", i === page ? "w-6 bg-ink/70" : "w-2 bg-ink/20")} />
          ))}
        </div>
      )}
    </div>
  );
}
