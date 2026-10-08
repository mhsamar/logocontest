"use client";

import { useEffect } from "react";

/**
 * Motion that follows the mouse (owner, 2026-10-08; UI-JOURNEY §1.5): buttons and pill links lean
 * toward the pointer, cards and tiles tilt toward it with a soft gold light under it. Mouse only,
 * never for reduced motion. Opt an element in with data-tilt, out with data-no-fx.
 */
const MAGNET = 'button, a[class*="rounded"], [role="menuitem"]';
const TILT = '[data-tilt], [class*="shadow-card"], [class*="shadow-raised"], [class*="shadow-frame"]';

type Fx = {
  el: HTMLElement;
  kind: "magnet" | "tilt";
  x: number;
  y: number;
  tx: number;
  ty: number;
  glow: number;
  tglow: number;
  mx: number;
  my: number;
  spot: boolean;
};

const fits = (el: HTMLElement, maxW: number, maxH: number) => el.offsetWidth > 0 && el.offsetWidth <= maxW && el.offsetHeight <= maxH;

function magnetFor(target: Element): HTMLElement | null {
  const el = target.closest<HTMLElement>(MAGNET);
  if (!el || el.closest("[data-no-fx]") || (el as HTMLButtonElement).disabled) return null;
  return fits(el, 320, 90) ? el : null;
}

function tiltFor(target: Element): HTMLElement | null {
  let el = target.closest<HTMLElement>(TILT);
  while (el) {
    const ok =
      !el.closest("[data-no-fx], dialog, header") &&
      el.offsetWidth >= 120 &&
      el.offsetHeight >= 80 &&
      fits(el, 640, 560) &&
      !el.querySelector("input, textarea, select") &&
      // Small buttons lean instead of tilting; large link tiles tilt.
      !(el.matches(MAGNET) && fits(el, 320, 90));
    if (ok) return el;
    el = el.parentElement?.closest<HTMLElement>(TILT) ?? null;
  }
  return null;
}

export function PointerFx() {
  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    if (!mq.matches) return;

    const live = new Map<HTMLElement, Fx>();
    let frame = 0;

    const entry = (el: HTMLElement, kind: Fx["kind"]) => {
      let fx = live.get(el);
      if (!fx) {
        fx = { el, kind, x: 0, y: 0, tx: 0, ty: 0, glow: 0, tglow: 0, mx: 50, my: 50, spot: kind === "tilt" && getComputedStyle(el).backgroundImage === "none" };
        live.set(el, fx);
      }
      return fx;
    };

    const loop = () => {
      frame = 0;
      for (const fx of live.values()) {
        fx.x += (fx.tx - fx.x) * 0.16;
        fx.y += (fx.ty - fx.y) * 0.16;
        fx.glow += (fx.tglow - fx.glow) * 0.14;
        const resting = Math.abs(fx.x) < 0.01 && Math.abs(fx.y) < 0.01 && fx.glow < 0.01 && fx.tx === 0 && fx.ty === 0 && fx.tglow === 0;
        if (resting) {
          fx.el.style.transform = "";
          if (fx.spot) fx.el.style.backgroundImage = "";
          live.delete(fx.el);
          continue;
        }
        if (fx.kind === "magnet") {
          fx.el.style.transform = `translate3d(${fx.x.toFixed(2)}px, ${fx.y.toFixed(2)}px, 0)`;
        } else {
          fx.el.style.transform = `perspective(900px) rotateX(${fx.y.toFixed(3)}deg) rotateY(${fx.x.toFixed(3)}deg)`;
          if (fx.spot)
            fx.el.style.backgroundImage = `radial-gradient(420px circle at ${fx.mx}% ${fx.my}%, rgb(244 189 47 / ${(0.16 * fx.glow).toFixed(3)}), transparent 65%)`;
        }
      }
      if (live.size) frame = requestAnimationFrame(loop);
    };
    const kick = () => {
      if (!frame) frame = requestAnimationFrame(loop);
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const target = e.target instanceof Element ? e.target : null;
      const magnet = target ? magnetFor(target) : null;
      const tilt = target ? tiltFor(target) : null;

      for (const fx of live.values()) {
        if (fx.el !== magnet && fx.el !== tilt) {
          fx.tx = 0;
          fx.ty = 0;
          fx.tglow = 0;
        }
      }
      if (magnet) {
        const r = magnet.getBoundingClientRect();
        const fx = entry(magnet, "magnet");
        fx.tx = Math.max(-6, Math.min(6, (e.clientX - (r.left + r.width / 2)) * 0.22));
        fx.ty = Math.max(-4, Math.min(4, (e.clientY - (r.top + r.height / 2)) * 0.3));
      }
      if (tilt) {
        const r = tilt.getBoundingClientRect();
        const nx = (e.clientX - r.left) / r.width;
        const ny = (e.clientY - r.top) / r.height;
        const fx = entry(tilt, "tilt");
        const max = r.width > 420 ? 2 : 4;
        fx.tx = (nx - 0.5) * 2 * max;
        fx.ty = -(ny - 0.5) * 2 * max;
        fx.mx = Math.round(nx * 100);
        fx.my = Math.round(ny * 100);
        fx.tglow = 1;
      }
      kick();
    };

    const onLeave = () => {
      for (const fx of live.values()) {
        fx.tx = 0;
        fx.ty = 0;
        fx.tglow = 0;
      }
      kick();
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(frame);
      for (const fx of live.values()) {
        fx.el.style.transform = "";
        if (fx.spot) fx.el.style.backgroundImage = "";
      }
    };
  }, []);

  return null;
}
