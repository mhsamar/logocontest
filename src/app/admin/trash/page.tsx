import type { Metadata } from "next";
import Link from "next/link";
import { AdminAction } from "@/components/admin/admin-action";
import { AdminHead } from "@/components/admin/page-head";
import { AdmCard, AdmEmpty, Pill } from "@/components/admin/ui";
import { requirePermission } from "@/lib/admin/core";
import { hasPermission } from "@/lib/admin/permissions";
import { trashList, type TrashRow } from "@/lib/admin/trash";
import { eraseContestNow, eraseUserNow, restoreContestFromTrash, restoreUserFromTrash } from "@/lib/admin/trash-actions";
import { formatDate } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { formatNumber } from "@/lib/money";
import { getSettings } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.trash.title"), robots: { index: false } };
}

// Admin › Trash (owner, 2026-10-14): deleted contests and users, Restore within 90 days, then erased for good.
export default async function AdminTrashPage() {
  const me = await requirePermission("contests.view");
  const [{ t, locale }, s] = await Promise.all([getI18n(), getSettings(["trash.keep_days", "trash.unpaid_hours"])]);
  const days = s["trash.keep_days"];
  const hours = s["trash.unpaid_hours"];
  const list = await trashList(days);
  const canUsers = hasPermission(me, "users.view");
  const date = (d: Date) => formatDate(d, locale, "long");

  const section = (rows: TrashRow[], title: string, can: { restore: boolean; erase: boolean }, restore: (id: string) => () => Promise<{ ok: true } | { ok: false; error: MessageKey }>, erase: (id: string) => () => Promise<{ ok: true } | { ok: false; error: MessageKey }>) => (
    <AdmCard className="p-4 sm:p-5">
      <h2 className="m-0 flex items-center gap-2 text-[17px] font-semibold">
        {title} <Pill tone="neutral">{formatNumber(rows.length, locale)}</Pill>
      </h2>
      {rows.length === 0 ? (
        <div className="mt-3">
          <AdmEmpty>{t("admin.trash.empty")}</AdmEmpty>
        </div>
      ) : (
        <ul className="m-0 mt-2 list-none divide-y divide-adm-line-soft p-0">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
              <div className="min-w-0 flex-[1_1_260px]">
                <Link href={r.link} className="font-semibold text-ink hover:text-primary">
                  {r.title}
                </Link>
                {r.sub && <span className="block text-sm text-muted">{r.sub}</span>}
                <span className="mt-1 block text-sm text-ink">
                  {t("admin.trash.deleted", { date: date(r.deletedAt) })}
                  {r.auto ? ` · ${t("admin.trash.auto", { hours: formatNumber(hours, locale) })}` : r.by ? ` · ${t("admin.trash.by", { name: r.by })}` : ""}
                </span>
                {r.reason && <span className="block text-sm text-muted">{t("admin.trash.reason", { reason: r.reason })}</span>}
                <span className="mt-0.5 block text-[13px] font-semibold text-adm-warn">{t("admin.trash.eraseOn", { date: date(r.eraseAt) })}</span>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {can.restore && <AdminAction label={t("admin.trash.restore")} body={t("admin.trash.restoreBody")} tone="primary" fields={[]} run={restore(r.id)} done={t("admin.trash.restored")} />}
                {can.erase && <AdminAction label={t("admin.trash.eraseNow")} body={t("admin.trash.eraseBody")} tone="danger" fields={[]} run={erase(r.id)} done={t("admin.trash.erased")} />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </AdmCard>
  );

  return (
    <div className="flex flex-col gap-5">
      <AdminHead title={t("admin.trash.title")} lead={t("admin.trash.lead", { days: formatNumber(days, locale), hours: formatNumber(hours, locale) })} />
      {section(list.contests, t("admin.trash.contests"), { restore: hasPermission(me, "contests.manage"), erase: me.isSuperAdmin }, (id) => restoreContestFromTrash.bind(null, id), (id) => eraseContestNow.bind(null, id))}
      {canUsers && section(list.users, t("admin.trash.users"), { restore: hasPermission(me, "users.manage"), erase: me.isSuperAdmin }, (id) => restoreUserFromTrash.bind(null, id), (id) => eraseUserNow.bind(null, id))}
    </div>
  );
}
