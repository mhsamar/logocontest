"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/lib/cx";

export const PILL_LINK =
  "inline-flex min-h-11 items-center rounded-full px-4 text-[0.9375rem] font-medium transition-colors";

/** Desktop links in the floating header; the current page sits in a soft pill. */
export function NavLinks({ links }: { links: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return links.map((link) => {
    const active = pathname === link.href || (link.href !== "/" && pathname.startsWith(`${link.href}/`));
    return (
      <Link
        key={link.href}
        href={link.href}
        aria-current={active ? "page" : undefined}
        className={cx(PILL_LINK, active ? "bg-white/12 text-white" : "text-white/70 hover:text-white")}
      >
        {link.label}
      </Link>
    );
  });
}
