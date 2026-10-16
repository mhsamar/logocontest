"use client";

import { useEffect } from "react";

/** On phones the menu is one sliding row: bring the open page's item into view (CLIENT-HANDOFF §2, phone layout). */
export function MenuScroll() {
  useEffect(() => {
    const nav = document.querySelector<HTMLElement>("[data-client-menu]");
    const on = nav?.querySelector<HTMLElement>("[aria-current=page]");
    if (!nav || !on || nav.scrollWidth <= nav.clientWidth) return;
    nav.scrollLeft = Math.max(0, on.offsetLeft - (nav.clientWidth - on.offsetWidth) / 2);
  }, []);
  return null;
}
