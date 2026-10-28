"use client";

import Link from "@/components/ui/link";
import type { AdminCounts } from "@/lib/admin/badges";
import type { AdminNavItem } from "@/lib/admin/nav";
import { useI18n } from "@/lib/i18n/client";
import { formatNumber } from "@/lib/money";
import { useAdminCounts } from "./admin-nav";
import { AdminIcon } from "./icons";
import { AdmCard, CardTitle, Pill } from "./ui";

/**
 * A-01 What's new (owner, 2026-10-23): every menu section with work waiting (red) or something new since this admin
 * last looked at it (gold), with a link to it. Starts from the server's counts, then follows the menu's live ones.
 */
export function WhatsNew({ items, counts }: { items: AdminNavItem[]; counts: AdminCounts }) {
  const { t, locale } = useI18n();
  const c = useAdminCounts() ?? counts;
  const rows = items
    .map((i) => ({ item: i, todo: i.badge ? c.todo[i.badge] : 0, fresh: i.fresh ? c.fresh[i.fresh] : 0 }))
    .filter((r) => r.todo > 0 || r.fresh > 0);
  const num = (n: number) => formatNumber(n, locale);
  return (
    <AdmCard className="p-5 sm:p-6">
      <CardTitle title={t("admin.whatsNew.title")} sub={t("admin.whatsNew.lead")} />
      {rows.length === 0 ? (
        <p className="m-0 mt-4 text-[15px] text-muted">{t("admin.whatsNew.none")}</p>
      ) : (
        <ul className="m-0 mt-4 grid list-none gap-2.5 p-0 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ item, todo, fresh }) => (
            <li key={item.href}>
              <Link href={item.href} className="flex min-h-[52px] items-center gap-3 rounded-[12px] border border-adm-line px-3.5 py-2.5 hover:bg-adm-bg">
                <AdminIcon name={item.icon} className="shrink-0 text-adm-soft" />
                <span className="min-w-0 flex-1 truncate text-[15.5px] font-semibold text-ink">{t(item.label)}</span>
                <span className="flex shrink-0 flex-wrap justify-end gap-1.5">
                  {todo > 0 && <Pill tone="red">{t("admin.shell.todoCount", { n: num(todo) })}</Pill>}
                  {fresh > 0 && <Pill tone="gold">{t("admin.shell.newCount", { n: num(fresh) })}</Pill>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AdmCard>
  );
}
