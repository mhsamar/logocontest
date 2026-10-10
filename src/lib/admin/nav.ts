/** The admin sidebar (A-18): groups, items and the permission each item needs. Pure. */
import type { AdminIconName } from "@/components/admin/icons";
import type { MessageKey } from "@/lib/i18n/translate";
import { ADMIN_AREAS, hasPermission, type AdminArea, type AdminIdentity, type Permission } from "./permissions";

export type AdminBadge = "reports" | "claims" | "withdrawals" | "support";
export type AdminNavItem = { href: string; icon: AdminIconName; label: MessageKey; perm: Permission | "super"; badge?: AdminBadge };
export type AdminNavGroup = { label: MessageKey; items: AdminNavItem[] };

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    label: "admin.groups.overview",
    items: [
      { href: "/admin", icon: "dashboard", label: "admin.nav.dashboard", perm: "dashboard.view" },
      { href: "/admin/live", icon: "live", label: "admin.nav.live", perm: "live.view" },
      { href: "/admin/analytics", icon: "analytics", label: "admin.nav.analytics", perm: "dashboard.view" },
      { href: "/admin/activity", icon: "activity", label: "admin.nav.activity", perm: "dashboard.view" },
    ],
  },
  {
    label: "admin.groups.work",
    items: [
      { href: "/admin/contests", icon: "contests", label: "admin.nav.contests", perm: "contests.view" },
      { href: "/admin/entries", icon: "designs", label: "admin.nav.entries", perm: "designs.view" },
      { href: "/admin/reports", icon: "reports", label: "admin.nav.reports", perm: "reports.view", badge: "reports" },
      { href: "/admin/claims", icon: "claims", label: "admin.nav.claims", perm: "claims.view", badge: "claims" },
      { href: "/admin/copyright", icon: "checker", label: "admin.nav.copyright", perm: "copyright.view" },
      { href: "/admin/unpaid", icon: "unpaid", label: "admin.nav.unpaid", perm: "unpaid.view" },
      { href: "/admin/monthly", icon: "monthly", label: "admin.nav.monthly", perm: "monthly.view" },
    ],
  },
  {
    label: "admin.groups.people",
    items: [
      { href: "/admin/users", icon: "users", label: "admin.nav.users", perm: "users.view" },
      { href: "/admin/agreements", icon: "agreements", label: "admin.nav.agreements", perm: "agreements.view" },
      { href: "/admin/team", icon: "team", label: "admin.nav.team", perm: "super" },
    ],
  },
  {
    label: "admin.groups.money",
    items: [
      { href: "/admin/payments", icon: "payments", label: "admin.nav.payments", perm: "payments.view" },
      { href: "/admin/withdrawals", icon: "withdrawals", label: "admin.nav.withdrawals", perm: "withdrawals.view", badge: "withdrawals" },
    ],
  },
  {
    label: "admin.groups.messages",
    items: [
      { href: "/admin/support", icon: "support", label: "admin.nav.support", perm: "support.view", badge: "support" },
      { href: "/admin/messages", icon: "send", label: "admin.nav.messages", perm: "messages.view" },
    ],
  },
  {
    label: "admin.groups.content",
    items: [
      { href: "/admin/texts", icon: "texts", label: "admin.nav.texts", perm: "content.view" },
      { href: "/admin/lists", icon: "lists", label: "admin.nav.lists", perm: "content.view" },
      { href: "/admin/legal", icon: "legal", label: "admin.nav.legal", perm: "content.view" },
      { href: "/admin/brand", icon: "brand", label: "admin.nav.brand", perm: "content.view" },
      { href: "/admin/homepage", icon: "homepage", label: "admin.nav.homepage", perm: "content.view" },
      { href: "/admin/blocked-terms", icon: "blocked", label: "admin.nav.blockedTerms", perm: "content.view" },
    ],
  },
  {
    label: "admin.groups.system",
    items: [
      { href: "/admin/settings", icon: "settings", label: "admin.nav.settings", perm: "settings.view" },
      { href: "/admin/audit", icon: "audit", label: "admin.nav.audit", perm: "audit.view" },
    ],
  },
];

const allowed = (u: AdminIdentity, item: AdminNavItem) => (item.perm === "super" ? u.isSuperAdmin : hasPermission(u, item.perm));

/** The menu this admin may see: empty groups are left out. */
export function navFor(u: AdminIdentity): AdminNavGroup[] {
  return ADMIN_NAV.map((g) => ({ ...g, items: g.items.filter((i) => allowed(u, i)) })).filter((g) => g.items.length > 0);
}

/** The admin area a page belongs to, from the menu (the longest matching link wins). */
export function areaOfPath(path: string): AdminArea | null {
  let best: AdminNavItem | null = null;
  for (const item of ADMIN_NAV.flatMap((g) => g.items)) {
    const hit = item.href === "/admin" ? path === "/admin" : path === item.href || path.startsWith(`${item.href}/`);
    if (hit && (!best || item.href.length > best.href.length)) best = item;
  }
  return best && best.perm !== "super" ? (best.perm.split(".")[0] as AdminArea) : null;
}

/** True when this admin may only look at the page, not change anything on it. */
export function isReadOnlyPage(u: AdminIdentity, path: string): boolean {
  const area = areaOfPath(path);
  return !!area && ADMIN_AREAS[area].manage && !hasPermission(u, `${area}.manage`);
}

/** Where a staff member without the Dashboard lands: their first allowed page. */
export function firstAdminPage(u: AdminIdentity): string | null {
  return navFor(u)[0]?.items[0]?.href ?? null;
}
