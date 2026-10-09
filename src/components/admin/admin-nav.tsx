"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/translate";

// A-sidebar (UI-JOURNEY §7, owner 2026-10-09).
const ITEMS: { href: string; label: MessageKey; badge?: "reports" | "claims" | "withdrawals" }[] = [
  { href: "/admin", label: "admin.nav.dashboard" },
  { href: "/admin/contests", label: "admin.nav.contests" },
  { href: "/admin/entries", label: "admin.nav.entries" },
  { href: "/admin/reports", label: "admin.nav.reports", badge: "reports" },
  { href: "/admin/claims", label: "admin.nav.claims", badge: "claims" },
  { href: "/admin/users", label: "admin.nav.users" },
  { href: "/admin/payments", label: "admin.nav.payments" },
  { href: "/admin/withdrawals", label: "admin.nav.withdrawals", badge: "withdrawals" },
  { href: "/admin/agreements", label: "admin.nav.agreements" },
  { href: "/admin/monthly", label: "admin.nav.monthly" },
  { href: "/admin/homepage", label: "admin.nav.homepage" },
  { href: "/admin/blocked-terms", label: "admin.nav.blockedTerms" },
  { href: "/admin/settings", label: "admin.nav.settings" },
  { href: "/admin/audit", label: "admin.nav.audit" },
];

export function AdminNav({ counts }: { counts: Record<"reports" | "claims" | "withdrawals", number> }) {
  const { t } = useI18n();
  const path = usePathname();
  const active = (href: string) => (href === "/admin" ? path === "/admin" : path === href || path.startsWith(`${href}/`));
  return (
    <nav aria-label={t("admin.title")} className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0">
      <ul className="flex gap-1 lg:flex-col">
        {ITEMS.map((item) => {
          const n = item.badge ? counts[item.badge] : 0;
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active(item.href) ? "page" : undefined}
                className={cx(
                  "flex min-h-10 items-center justify-between gap-3 whitespace-nowrap rounded-xl px-3 text-sm font-medium transition-colors",
                  active(item.href) ? "bg-ink text-white" : "text-ink hover:bg-surface",
                )}
              >
                {t(item.label)}
                {n > 0 && <span className={cx("rounded-full px-2 text-xs font-bold tabular-nums", active(item.href) ? "bg-white/20" : "bg-primary text-white")}>{n}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
