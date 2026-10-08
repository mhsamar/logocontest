"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { cx } from "@/lib/cx";

export const PILL_LINK = "inline-flex min-h-11 items-center rounded-full px-4 text-[0.9375rem] font-medium transition-colors";

/**
 * Desktop links in the floating header. A soft pill glides under the link you point at
 * and settles back on the current page (UI-JOURNEY §1.5).
 */
export function NavLinks({ links }: { links: { href: string; label: string }[] }) {
  const pathname = usePathname();
  const wrap = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null);

  const activeHref = links.find((link) => pathname === link.href || (link.href !== "/" && pathname.startsWith(`${link.href}/`)))?.href ?? null;
  const target = hovered ?? activeHref;

  const measure = useCallback(() => {
    const el = target ? wrap.current?.querySelector<HTMLElement>(`[data-href="${target}"]`) : null;
    setPill(el ? { x: el.offsetLeft, w: el.offsetWidth } : null);
  }, [target]);

  useLayoutEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  return (
    <div ref={wrap} className="relative flex items-center gap-1" onMouseLeave={() => setHovered(null)}>
      <span
        aria-hidden
        className={cx(
          "pointer-events-none absolute inset-y-0 left-0 rounded-full transition-[transform,width,opacity,background-color,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          pill ? "opacity-100" : "opacity-0",
          target && target === activeHref ? "bg-primary/10" : "bg-white/85 shadow-card",
        )}
        style={pill ? { width: pill.w, transform: `translateX(${pill.x}px)` } : undefined}
      />
      {links.map((link) => {
        const active = link.href === activeHref;
        return (
          <Link
            key={link.href}
            href={link.href}
            data-href={link.href}
            onMouseEnter={() => setHovered(link.href)}
            onFocus={() => setHovered(link.href)}
            onBlur={() => setHovered(null)}
            aria-current={active ? "page" : undefined}
            className={cx(PILL_LINK, "relative", active ? "text-primary-dark" : "text-ink/85 hover:text-ink")}
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}
