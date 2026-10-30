import type { useRouter } from "next/navigation";

export type Channel = "call" | "whatsapp" | "sms" | "email";
/** A Call, WhatsApp, SMS or Email tap (owner, 2026-10-30): the lead's "Log a follow-up" opens ready for what happened. */
export const REACHED_EVENT = "lc-unpaid-reached";

/**
 * After a Call or WhatsApp tap: a tap alone doesn't move the lead; their "Log a follow-up" opens set to it, to save what
 * happened. Someone not open in the address is opened, so the refresh on coming back from the call keeps them: on the
 * Unpaid page in the view the admin has (tab, search, filters, order), from elsewhere at `href`. The one already open
 * is told directly. Small on its own: the alert pop-ups use it on every page.
 */
export function showLogAfterReach(router: ReturnType<typeof useRouter>, key: string, how: Channel, href?: string) {
  const onPage = window.location.pathname === "/admin/unpaid";
  const here = onPage && new URLSearchParams(window.location.search).get("sel") === key;
  if (href && !here) router.push(`${onPage ? sameView(key) : href.replace(/#.*$/, "")}#log-${how}`, { scroll: false });
  window.setTimeout(() => window.dispatchEvent(new CustomEvent(REACHED_EVENT, { detail: { key, how } })), 150);
}

/** This person in the Unpaid page's current view, its tab kept (the list says which it shows) so a save doesn't move it. */
function sameView(key: string): string {
  const u = new URL(window.location.href);
  u.searchParams.set("sel", key);
  const tab = document.querySelector("[data-unpaid-list]")?.getAttribute("data-tab");
  if (tab) u.searchParams.set("tab", tab);
  return u.pathname + u.search;
}
