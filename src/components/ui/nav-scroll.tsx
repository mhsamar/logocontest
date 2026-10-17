"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * On phones a menu is one sliding row (owner, 2026-10-17): this brings the open page's item into view, centred,
 * whenever the page changes. `selector` names the row; its open item has aria-current="page" or the class "on".
 */
export function NavScroll({ selector }: { selector: string }) {
  const path = usePathname();
  useEffect(() => {
    const row = document.querySelector<HTMLElement>(selector);
    const item = row?.querySelector<HTMLElement>("[aria-current=page], a.on");
    if (!row || !item || row.scrollWidth <= row.clientWidth) return;
    row.scrollLeft = Math.max(0, item.offsetLeft - (row.clientWidth - item.offsetWidth) / 2);
  }, [path, selector]);
  return null;
}
