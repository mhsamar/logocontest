"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/** A label that rolls up on hover, a fresh copy rolling in from below (CSS: .lc-roll in globals.css). */
export function Roll({ children }: { children: string }) {
  return (
    <span className="lc-roll" data-text={children}>
      <span>{children}</span>
    </span>
  );
}

/**
 * The menu bar's links (owner, 2026-10-12: "make the home menu more premium, more advanced"). The bar itself never
 * moves (owner, 2026-10-10). Inside it, with a mouse:
 * - an elastic red pill slides under the link you point at: the leading edge moves first and the trailing edge
 *   catches up, so it stretches like liquid; the link turns white on it. On the current page it rests as a soft tint;
 * - a gold spotlight follows the pointer across the glass, and a red-gold light runs round the edge.
 * Labels roll on hover (Roll). The current page is marked for everyone.
 */
export function NavLinks({ links }: { links: { href: string; label: string; badge?: string }[] }) {
  const path = usePathname();
  const pill = useRef<HTMLSpanElement>(null);
  const isCurrent = (href: string) => href !== "/" && (path === href || path.startsWith(`${href}/`));

  useEffect(() => {
    const el = pill.current;
    const nav = el?.parentElement;
    if (!el || !nav) return;
    const items = () => [...nav.querySelectorAll<HTMLElement>(".lc-nv-link")].filter((x) => x.offsetWidth > 0);
    const current = () => items().find((x) => x.hasAttribute("aria-current") || x.querySelector("[aria-current]")) ?? null;
    let shown = false;
    let lastLeft = 0;
    let hot: HTMLElement | null = null;

    const moveTo = (target: HTMLElement | null, mode: "hot" | "rest") => {
      if (hot && (hot !== target || mode === "rest")) hot.removeAttribute("data-hot");
      hot = mode === "hot" ? target : null;
      hot?.setAttribute("data-hot", "");
      if (!target) {
        el.style.opacity = "0";
        el.style.scale = "0.92";
        shown = false;
        return;
      }
      const n = nav.getBoundingClientRect();
      const r = target.getBoundingClientRect();
      const left = r.left - n.left - 14;
      const right = n.right - r.right - 14;
      // Elastic stretch: the edge in front moves fast, the one behind follows more slowly.
      const goingRight = left > lastLeft;
      const fast = "300ms cubic-bezier(0.22, 1, 0.36, 1)";
      const slow = "560ms cubic-bezier(0.34, 1.3, 0.64, 1)";
      el.style.transition = shown
        ? `left ${goingRight ? slow : fast}, right ${goingRight ? fast : slow}, top 300ms, opacity 260ms, scale 420ms cubic-bezier(0.34, 1.56, 0.64, 1)`
        : "opacity 260ms, scale 420ms cubic-bezier(0.34, 1.56, 0.64, 1)";
      el.style.left = `${left}px`;
      el.style.right = `${right}px`;
      el.style.top = `${r.top - n.top + r.height / 2 - 20}px`;
      el.style.opacity = "1";
      el.style.scale = "1";
      el.dataset.mode = mode;
      lastLeft = left;
      shown = true;
    };
    moveTo(current(), "rest");

    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const onOver = (e: PointerEvent) => {
      const hit = e.target instanceof Element ? e.target.closest<HTMLElement>(".lc-nv-link") : null;
      if (hit && nav.contains(hit)) moveTo(hit, "hot");
    };
    // The spotlight follows the pointer across the glass.
    const onMove = (e: PointerEvent) => {
      const n = nav.getBoundingClientRect();
      nav.style.setProperty("--mx", `${e.clientX - n.left}px`);
      nav.style.setProperty("--my", `${e.clientY - n.top}px`);
    };
    const onLeave = () => moveTo(current(), "rest");
    const onResize = () => moveTo(current(), "rest");
    if (fine) {
      nav.addEventListener("pointerover", onOver);
      nav.addEventListener("pointermove", onMove, { passive: true });
      nav.addEventListener("pointerleave", onLeave);
    }
    window.addEventListener("resize", onResize);
    return () => {
      nav.removeEventListener("pointerover", onOver);
      nav.removeEventListener("pointermove", onMove);
      nav.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("resize", onResize);
      hot?.removeAttribute("data-hot");
    };
  }, [path]);

  return (
    <>
      <span ref={pill} aria-hidden className="lc-nv-pill" />
      {links.map((l) => (
        <Link key={l.href} href={l.href} aria-current={isCurrent(l.href) ? "page" : undefined} className="lc-nv-link py-[11px]">
          <Roll>{l.label}</Roll>
          {l.badge && <span className="lc-new">{l.badge}</span>}
        </Link>
      ))}
    </>
  );
}
