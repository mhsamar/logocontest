import type { Metadata } from "next";
import Link from "next/link";
import { AdminAction } from "@/components/admin/admin-action";
import { AdminHead } from "@/components/admin/page-head";
import { StatusPill } from "@/components/admin/table-bits";
import { cx } from "@/lib/cx";
import { getI18n } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { monthLabel } from "@/lib/notifications/render";
import { formatBdMobile } from "@/lib/phone";
import { markGiftSent, pickMonthlyDesign } from "@/lib/rewards/actions";
import { monthRecord, thisMonth, winningDesigns } from "@/lib/rewards/queries";
import { isMonthKey, previousMonth, recentMonths } from "@/lib/rewards/rules";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.monthly.title"), robots: { index: false } };
}

// A-08 Monthly winner (owner, 2026-10-09): the month's winning designs by likes; pick one; then send the gift box.
export default async function AdminMonthlyPage({ searchParams }: PageProps<"/admin/monthly">) {
  const sp = await searchParams;
  const current = thisMonth();
  const month = typeof sp.month === "string" && isMonthKey(sp.month) && sp.month <= current ? sp.month : previousMonth(current);
  const [{ t, locale }, designs, record] = await Promise.all([getI18n(), winningDesigns({ month, limit: 100 }), monthRecord(month)]);
  const over = month < current;
  const confirmed = record?.status === "confirmed";
  const when = (d: Date) => d.toLocaleString(locale === "bn" ? "bn-BD" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" });

  return (
    <div className="space-y-4">
      <AdminHead title={t("admin.monthly.title")} lead={t("admin.monthly.lead")} />
      <div className="flex gap-1 overflow-x-auto rounded-full bg-surface p-1 ring-1 ring-line">
        {recentMonths(current, 7).map((m) => (
          <Link key={m} href={`/admin/monthly?month=${m}`} className={cx("inline-flex min-h-9 shrink-0 items-center rounded-full px-4 text-sm font-semibold", m === month ? "bg-ink text-white" : "text-ink hover:bg-canvas")}>
            {monthLabel(m, locale)}
          </Link>
        ))}
      </div>

      <div className="rounded-2xl bg-surface p-4 text-sm shadow-card ring-1 ring-line">
        {!over ? (
          <p className="text-muted">{t("admin.monthly.running")}</p>
        ) : confirmed ? (
          <div className="space-y-2">
            <p className="font-semibold text-success">{t("admin.monthly.confirmedOn", { date: when(record!.confirmedAt!) })}</p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted">{t("admin.monthly.gift")}:</span>
              <StatusPill tone={record!.giftStatus === "sent" ? "ok" : record!.giftStatus === "address_given" ? "warn" : "muted"}>
                {t(`admin.monthly.giftStatus.${record!.giftStatus ?? "awaiting_address"}` as MessageKey)}
              </StatusPill>
            </div>
            {record!.ship.address && (
              <p className="rounded-xl bg-canvas p-3 text-ink">
                <b>{record!.ship.name}</b> · {record!.ship.phone ? formatBdMobile(record!.ship.phone) : ""}
                <br />
                {record!.ship.address}
              </p>
            )}
            {record!.sentAt && <p className="text-muted">{t("admin.monthly.sentOn", { date: when(record!.sentAt), note: record!.sentNote ?? "" })}</p>}
            {record!.giftStatus === "address_given" && (
              <AdminAction
                label={t("admin.monthly.markSent")}
                tone="primary"
                body={t("admin.monthly.markSentBody")}
                fields={[{ name: "reason", kind: "reason", label: t("admin.monthly.courierNote") }]}
                run={markGiftSent.bind(null, month)}
              />
            )}
          </div>
        ) : record ? (
          <p className="text-ink">{t("admin.monthly.proposed")}</p>
        ) : (
          <p className="text-muted">{designs.length ? t("admin.monthly.notProposed") : t("admin.monthly.noWins")}</p>
        )}
      </div>

      {designs.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-surface px-4 py-10 text-center text-muted">{t("admin.monthly.empty")}</p>
      ) : (
        <ol className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
          {designs.map((d, i) => {
            const isPick = record?.entryId === d.entryId;
            return (
              <li key={d.entryId} className={cx("rounded-2xl bg-surface p-3 shadow-card ring-1", isPick ? "ring-2 ring-[#e0a614]" : "ring-line")}>
                <Link href={`/contest/${d.contestSlug}?tab=entries&entry=${d.number}`} className="relative block overflow-clip rounded-xl bg-canvas">
                  {d.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.coverUrl} alt="" className="aspect-square w-full object-cover" />
                  ) : (
                    <span className="flex aspect-square items-center justify-center text-sm text-muted">{d.brandName}</span>
                  )}
                  <span className="absolute left-2 top-2 flex size-7 items-center justify-center rounded-full bg-white text-xs font-extrabold shadow-card">{i + 1}</span>
                </Link>
                <p className="mt-2 truncate text-sm font-semibold text-ink">{d.brandName}</p>
                <p className="truncate text-xs text-muted">
                  <Link href={`/admin/users/${d.designerId}`} className="hover:text-primary">
                    {d.designer ? (d.designer.username ? `@${d.designer.username}` : d.designer.name) : t("admin.monthly.blindDesigner")}
                  </Link>
                </p>
                <p className="mt-1 flex items-center gap-2 text-sm">
                  <span className="font-bold text-primary">♥ {d.likes}</span>
                  {d.rating && <span className="text-xs text-[#c99512]">{"★".repeat(d.rating)}</span>}
                </p>
                {isPick && (
                  <div className="mt-1">
                    <StatusPill tone={confirmed ? "ok" : "warn"}>{t(confirmed ? "admin.monthly.champion" : "admin.monthly.proposedTag")}</StatusPill>
                  </div>
                )}
                {over && !confirmed && (
                  <div className="mt-2">
                    <AdminAction
                      label={t("admin.monthly.confirm")}
                      tone={isPick || (!record && i === 0) ? "primary" : "ghost"}
                      body={t("admin.monthly.confirmBody", { brand: d.brandName, month: monthLabel(month, locale) })}
                      run={pickMonthlyDesign.bind(null, month, d.entryId)}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
