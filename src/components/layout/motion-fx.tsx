"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Premium motion, the JavaScript half (owner, 2026-10-12; the CSS half is at the end of globals.css):
 * - big numbers (display font or tabular figures, 18px and up) count up from zero when they come into view;
 * - images still loading fade in from a light blur;
 * - the main buttons (.lc-ripple) ripple from where they were tapped.
 * Never for reduced motion. It only touches text it wrote itself, so React's own updates always win.
 */
const BN = "০১২৩৪৫৬৭৮৯";
// A plain whole number with only a symbol around it: "৳15,000", "42", "+13", "80%". Times (13:39), dates, decimals
// and padded IDs (#00004) are left alone.
const NUMBER = /^([^\p{L}\p{N}:/.]{0,3}?)([\d০-৯](?:[\d০-৯,]*[\d০-৯])?)([^\p{L}\p{N}:/.]{0,3})$/u;
const toAscii = (s: string) => s.replace(/[০-৯]/g, (d) => String(BN.indexOf(d)));

/** Writes n with the same digits and grouping (1,234 or Indian 1,23,456) as the original text. */
function formatLike(n: number, sample: string): string {
  const groups = sample.split(",");
  const indian = groups.length > 2 && groups.slice(1, -1).every((g) => g.length === 2);
  let s = String(n);
  if (groups.length > 1) {
    const last = s.slice(-3);
    let rest = s.slice(0, -3);
    const parts: string[] = [];
    const size = indian ? 2 : 3;
    while (rest.length > size) {
      parts.unshift(rest.slice(-size));
      rest = rest.slice(0, -size);
    }
    if (rest) parts.unshift(rest);
    s = [...parts, last].filter(Boolean).join(",");
  }
  return /[০-৯]/.test(sample) ? s.replace(/\d/g, (d) => BN[Number(d)]) : s;
}

function countUp(el: HTMLElement) {
  const node = el.firstChild;
  if (!node || node.nodeType !== Node.TEXT_NODE || el.childNodes.length !== 1) return;
  const original = node.nodeValue ?? "";
  const m = original.trim().match(NUMBER);
  if (!m) return;
  if (/^[0০]./.test(m[2])) return;
  const target = Number(toAscii(m[2]).replace(/,/g, ""));
  if (!Number.isFinite(target) || target < 2 || target > 1e9) return;
  const lead = original.slice(0, original.indexOf(original.trim())) + m[1];
  const tail = m[3] + original.slice(original.indexOf(original.trim()) + original.trim().length);
  const began = performance.now();
  const duration = Math.min(1400, 700 + String(target).length * 90);
  let written = original;
  const tick = (now: number) => {
    // Someone else (React) changed the text: stop and leave theirs.
    if (node.nodeValue !== written) return;
    const p = Math.min(1, (now - began) / duration);
    written = p >= 1 ? original : lead + formatLike(Math.round(target * (1 - Math.pow(1 - p, 4))), m[2]) + tail;
    node.nodeValue = written;
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

export function MotionFx() {
  const path = usePathname();

  // Count-up numbers and image fade-in: every page, and new content as it appears.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    const seen = new WeakSet<Element>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          io.unobserve(e.target);
          countUp(e.target as HTMLElement);
        }
      },
      { threshold: 0.6 },
    );
    const show = (img: HTMLImageElement) => img.setAttribute("data-lc-img", "in");
    const scan = (root: ParentNode) => {
      root.querySelectorAll<HTMLElement>(".page-in :is(.lc-d, .tabular-nums)").forEach((el) => {
        if (seen.has(el) || el.closest("input, textarea, [contenteditable], [data-no-fx]")) return;
        seen.add(el);
        if (el.childNodes.length === 1 && el.firstChild?.nodeType === Node.TEXT_NODE && parseFloat(getComputedStyle(el).fontSize) >= 18) io.observe(el);
      });
      // Not in the design grid (owner, 2026-10-27): its pictures show as soon as they arrive.
      root.querySelectorAll<HTMLImageElement>(".page-in img:not([data-lc-img])").forEach((img) => {
        if (img.closest("[data-still]")) return img.setAttribute("data-lc-img", "in");
        if (img.complete && img.naturalWidth > 0) return img.setAttribute("data-lc-img", "in");
        img.setAttribute("data-lc-img", "wait");
        img.addEventListener("load", () => show(img), { once: true });
        img.addEventListener("error", () => show(img), { once: true });
        // Never leave an image hidden.
        window.setTimeout(() => show(img), 4000);
      });
    };
    scan(document);
    let queued = 0;
    const mo = new MutationObserver(() => {
      if (queued) return;
      queued = requestAnimationFrame(() => {
        queued = 0;
        scan(document);
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
      cancelAnimationFrame(queued);
    };
  }, [path]);

  // The ripple on the main buttons.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const onDown = (e: PointerEvent) => {
      const el = e.target instanceof Element ? e.target.closest<HTMLElement>(".lc-ripple") : null;
      if (!el || (el as HTMLButtonElement).disabled) return;
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      el.style.setProperty("--rx", `${x}px`);
      el.style.setProperty("--ry", `${y}px`);
      el.style.setProperty("--rd", `${2 * Math.hypot(Math.max(x, r.width - x), Math.max(y, r.height - y))}px`);
      el.removeAttribute("data-rp");
      void el.offsetWidth; // restart the animation
      el.setAttribute("data-rp", "");
      window.setTimeout(() => el.removeAttribute("data-rp"), 700);
    };
    document.addEventListener("pointerdown", onDown, { passive: true });
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  return null;
}
