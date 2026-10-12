"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * The menu bar's links with a gliding pill (owner, 2026-10-12: "home menu also be interactive, feel motion").
 * The bar itself never moves (owner, 2026-10-10); inside it a soft pill slides under the link you point at and
 * settles back on the current page. Mouse only for the glide; the current page is marked for everyone.
 */
export function NavLinks({ links }: { links: { href: string; label: string }[] }) {
  const path = usePathname();
  const pill = useRef<HTMLSpanElement>(null);
  const isCurrent = (href: string) => href !== "/" && (path === href || path.startsWith(`${href}/`));

  useEffect(() => {
    const el = pill.current;
    const nav = el?.parentElement;
    if (!el || !nav) return;
    const items = () => [...nav.querySelectorAll<HTMLElement>(".lc-nv-link")].filter((x) => x.offsetWidth > 0);
    let shown = false;
    const moveTo = (target: HTMLElement | null) => {
      if (!target) {
        el.style.opacity = "0";
        shown = false;
        return;
      }
      const n = nav.getBoundingClientRect();
      const r = target.getBoundingClientRect();
      // The first placement jumps there; after that it glides.
      el.style.transitionProperty = shown ? "opacity, translate, width, height" : "opacity";
      el.style.translate = `${r.left - n.left - 14}px ${r.top - n.top + r.height / 2 - 20}px`;
      el.style.width = `${r.width + 28}px`;
      el.style.height = "40px";
      el.style.opacity = "1";
      shown = true;
    };
    const current = () => items().find((x) => x.querySelector("[aria-current]") || x.hasAttribute("aria-current")) ?? null;
    moveTo(current());

    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const onOver = (e: PointerEvent) => {
      const hit = e.target instanceof Element ? e.target.closest<HTMLElement>(".lc-nv-link") : null;
      if (hit && nav.contains(hit)) moveTo(hit);
    };
    const onLeave = () => moveTo(current());
    const onResize = () => moveTo(current());
    if (fine) {
      nav.addEventListener("pointerover", onOver);
      nav.addEventListener("pointerleave", onLeave);
    }
    window.addEventListener("resize", onResize);
    return () => {
      nav.removeEventListener("pointerover", onOver);
      nav.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("resize", onResize);
    };
  }, [path]);

  return (
    <>
      <span ref={pill} aria-hidden className="lc-nv-pill" />
      {links.map((l) => (
        <Link key={l.href} href={l.href} aria-current={isCurrent(l.href) ? "page" : undefined} className="lc-nv-link py-[11px]">
          {l.label}
        </Link>
      ))}
    </>
  );
}
