"use client";

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import Link from "@/components/ui/link";
import { cx } from "@/lib/cx";

/*
 * The "Contests live right now" carousel (owner, 2026-10-29; Design/logocontest-site/index.html). The server renders
 * every card; this component only moves the row. The list is drawn twice so it loops without a gap: after the last
 * card it slides on to the copy of the first, then jumps back to the real one with no animation (the copy sits exactly
 * where it would). The copy is hidden from screen readers and the Tab key. Card 1 is active in the server HTML.
 * It moves by itself every few seconds, pausing while the mouse is over it, while something in it has keyboard focus,
 * while the tab is hidden and with "reduce motion" on (the buttons and a swipe still work), and for good once the
 * visitor moves it themselves. When every contest fits in the row (2 or 3 on a laptop), nothing moves: they are drawn
 * once, with no arrows, so no contest shows twice and no gap opens.
 */

const AUTOPLAY_MS = 3200;
/** A little after the slide's 0.75s, so the jump back to the real card is never seen. */
const RESET_MS = 800;
/** A finger has to move this far sideways to count as a swipe. */
const SWIPE_PX = 40;

const subscribeMotion = (onChange: () => void) => {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
};
const subscribeVisibility = (onChange: () => void) => {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
};
/** Focus from the keyboard (not a click). Browsers too old for :focus-visible count every focus. */
const byKeyboard = (el: Element) => {
  try {
    return el.matches(":focus-visible");
  } catch {
    return true;
  }
};

export type CarouselSlide = {
  href: string;
  /** The card's inside (letter tile, name, prize…), rendered on the server; drawn again for the copy. */
  body: React.ReactNode;
};

/** Whole cards the row shows before it is measured: about 3 on a laptop, as in the design. */
const FIT_GUESS = 3;

export function ContestCarousel({ slides, prevLabel, nextLabel }: { slides: CarouselSlide[]; prevLabel: string; nextLabel: string }) {
  const n = slides.length;
  const [fit, setFit] = useState(FIT_GUESS);
  const loops = n > fit;
  const trackId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const ciRef = useRef(0);
  const resetRef = useRef<number | undefined>(undefined);
  const touchRef = useRef<{ x: number; y: number } | null>(null);

  const [ci, setCi] = useState(0);
  const [snap, setSnap] = useState(false);
  const [hover, setHover] = useState(false);
  const [focused, setFocused] = useState(false);
  const [moved, setMoved] = useState(false);
  const reduced = useSyncExternalStore(subscribeMotion, () => window.matchMedia("(prefers-reduced-motion: reduce)").matches, () => false);
  const hidden = useSyncExternalStore(subscribeVisibility, () => document.hidden, () => false);
  const paused = !loops || reduced || hidden || hover || focused || moved;
  const at = loops ? ci : 0;

  // How many whole cards fit in the row, again whenever it changes size (a phone shows one).
  useEffect(() => {
    const track = trackRef.current;
    const wrap = track?.parentElement;
    if (!track || !wrap) return;
    let was = n > FIT_GUESS;
    const measure = () => {
      const card = track.firstElementChild as HTMLElement | null;
      if (!card) return;
      const ws = getComputedStyle(wrap);
      const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      const row = wrap.clientWidth - parseFloat(ws.paddingLeft) - parseFloat(ws.paddingRight);
      const next = Math.max(1, Math.floor((row + gap) / (card.offsetWidth + gap)));
      // Moving starts or stops (a phone turned, a window resized): it starts again from card 1, not a card left over.
      if (n > next !== was) {
        was = n > next;
        window.clearTimeout(resetRef.current);
        ciRef.current = 0;
        setCi(0);
      }
      setFit(next);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [n]);

  /** Slides to card i (0 … 2n-1); from a copy, a moment later back to its real card with no animation. */
  const go = useCallback(
    (i: number, instantFirst: number | null = null) => {
      window.clearTimeout(resetRef.current);
      const place = (to: number) => {
        ciRef.current = to;
        setCi(to);
      };
      // Drawn at once without the slide, read back by the browser, then the slide is switched on again.
      const jump = (to: number) => {
        flushSync(() => {
          setSnap(true);
          place(to);
        });
        void trackRef.current?.offsetWidth;
        setSnap(false);
      };
      if (instantFirst !== null) jump(instantFirst);
      place(i);
      if (i >= n) resetRef.current = window.setTimeout(() => ciRef.current >= n && jump(ciRef.current - n), RESET_MS);
    },
    [n],
  );

  const step = useCallback(
    (dir: 1 | -1) => {
      if (!loops) return;
      const from = ciRef.current;
      // Back from card 1: first to its copy, then one back. On from a copy: first to its real card, then one on.
      if (dir < 0 && from === 0) go(n - 1, n);
      else if (dir > 0 && from >= n) go(from - n + 1, from - n);
      else go(from + dir);
    },
    [go, loops, n],
  );

  // Each move (by itself or from a button) starts a new wait, so every card gets its full time.
  useEffect(() => {
    if (paused) return;
    const id = window.setTimeout(() => step(1), AUTOPLAY_MS);
    return () => window.clearTimeout(id);
  }, [paused, ci, step]);

  useEffect(() => () => window.clearTimeout(resetRef.current), []);

  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchRef.current;
    const end = e.changedTouches[0];
    touchRef.current = null;
    if (!start || !end) return;
    const [dx, dy] = [end.clientX - start.x, end.clientY - start.y];
    if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(dy)) {
      setMoved(true);
      step(dx < 0 ? 1 : -1);
    }
  };

  // A card reached with the Tab key slides into view. While the row rests on a copy (just before the jump back), it
  // first stands on the real card at the same place, so the row never sweeps back across every card.
  const onCardFocus = (e: React.FocusEvent<HTMLElement>, i: number) => {
    const cur = ciRef.current;
    if (!byKeyboard(e.currentTarget) || cur === i || cur - n === i) return;
    go(i, cur >= n ? cur - n : null);
  };

  const list = loops ? [...slides, ...slides] : slides;
  return (
    <div
      ref={rootRef}
      className="lcc-carousel"
      // A mouse only: a tap on a phone would otherwise leave it paused.
      onPointerEnter={(e) => e.pointerType === "mouse" && setHover(true)}
      onPointerLeave={() => setHover(false)}
      // Keyboard focus only: a click on an arrow shouldn't stop it for good.
      onFocus={(e) => byKeyboard(e.target) && setFocused(true)}
      onBlur={(e) => !rootRef.current?.contains(e.relatedTarget as Node | null) && setFocused(false)}
    >
      <div
        className="lcc-wrap"
        onTouchStart={(e) => {
          const t = e.touches[0];
          touchRef.current = t ? { x: t.clientX, y: t.clientY } : null;
        }}
        onTouchEnd={onTouchEnd}
      >
        <div ref={trackRef} id={trackId} className={cx("lcc-track", snap && "lcc-snap")} style={{ "--lcc-ci": at } as React.CSSProperties}>
          {list.map((s, i) => {
            const copy = i >= n;
            return (
              <Link
                key={i}
                href={s.href}
                className={cx("lcc-card", i === at && "lcc-act")}
                aria-hidden={copy || undefined}
                tabIndex={copy ? -1 : undefined}
                // A card reached with the Tab key slides into view (not on a click, which would move it from under the mouse).
                onFocus={copy || !loops ? undefined : (e) => onCardFocus(e, i)}
              >
                {s.body}
              </Link>
            );
          })}
        </div>
      </div>
      {/* With more than one contest the controls row is always drawn, hidden while nothing moves: on a phone (one card
          fits) it shows once measured, without pushing the page down. */}
      {n > 1 && (
        <div className={cx("lcc-controls", !loops && "lcc-still")}>
          <div className="lcc-pips" aria-hidden>
            {slides.map((_, i) => (
              <span key={i} className={cx("lcc-pip", i === at % n && "lcc-on")} />
            ))}
          </div>
          <div className="lcc-nav">
            <button type="button" className="lcc-arrow" aria-label={prevLabel} aria-controls={trackId} onClick={() => (setMoved(true), step(-1))}>
              <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </button>
            <button type="button" className="lcc-arrow" aria-label={nextLabel} aria-controls={trackId} onClick={() => (setMoved(true), step(1))}>
              <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
