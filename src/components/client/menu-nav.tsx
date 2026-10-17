"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { menuKeyForPath, type ClientMenuKey } from "@/lib/client/rules";
import { CwIcon, type CwIconName } from "./icons";

export type MenuNavItem = { key: ClientMenuKey; href: string; text: string; icon: CwIconName; badge: { text: string; tone: "n" | "r" } | null };

/**
 * The workspace menu (owner, 2026-10-17: it stays on screen while pages change). The open page is marked from the
 * address; on phones, where the menu is one sliding row, the open page's item is brought into view.
 */
export function ClientMenuNav({ items, label, active }: { items: MenuNavItem[]; label: string; active?: ClientMenuKey | null }) {
  const path = usePathname();
  const on = active ?? menuKeyForPath(path);
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = nav.current;
    const item = el?.querySelector<HTMLElement>("[aria-current=page]");
    if (!el || !item || el.scrollWidth <= el.clientWidth) return;
    el.scrollLeft = Math.max(0, item.offsetLeft - (el.clientWidth - item.offsetWidth) / 2);
  }, [path]);
  return (
    <nav ref={nav} aria-label={label} data-client-menu>
      {items.map((i) => (
        <Link key={i.key} href={i.href} className={i.key === on ? "on" : undefined} aria-current={i.key === on ? "page" : undefined} title={i.text} data-menu={i.key}>
          <CwIcon name={i.icon} size={19} />
          <span>{i.text}</span>
          {i.badge && <em className={i.badge.tone === "r" ? "cr" : "cn"}>{i.badge.text}</em>}
        </Link>
      ))}
    </nav>
  );
}
