import Link from "next/link";
import { AdminIcon } from "@/components/admin/icons";
import { AdmCard, CardTitle } from "@/components/admin/ui";
import { moneyNow, paidOutIn } from "@/lib/admin/payouts";
import { cx } from "@/lib/cx";
import { getI18n } from "@/lib/i18n/server";
import { formatNumber, formatTaka } from "@/lib/money";

/**
 * Designers' money (owner, 2026-10-16): what designers earned and were paid in the chosen period, and what is waiting
 * right now, with a link to every payout. On the Dashboard and in Analytics.
 */
export async function DesignerMoneyCard({ period, className }: { period: { since: Date | null; until: Date | null }; className?: string }) {
  const [{ t, locale }, paid, now] = await Promise.all([getI18n(), paidOutIn(period), moneyNow()]);
  const taka = (n: number) => formatTaka(n, locale);
  const num = (n: number) => formatNumber(n, locale);
  const rows = [
    { k: t("admin.money.earned"), v: taka(paid.earned), sub: t("admin.money.inPeriod"), color: "bg-adm-chart-prize" },
    { k: t("admin.money.paid"), v: taka(paid.total), sub: t("admin.money.paidHint", { n: num(paid.count), d: num(paid.designers) }), color: "bg-adm-good", strong: true },
    { k: t("admin.money.waiting"), v: taka(now.waiting.total), sub: t("admin.money.waitingHint", { n: num(now.waiting.count) }), color: "bg-adm-sample", href: "/admin/withdrawals" },
    { k: t("admin.money.wallets"), v: taka(now.inWallets), sub: t("admin.money.now"), color: "bg-primary" },
    { k: t("admin.money.notReleased"), v: taka(now.notReleased.total), sub: t("admin.money.notReleasedHint", { n: num(now.notReleased.count) }), color: "bg-adm-strong" },
  ];
  return (
    <AdmCard className={cx("flex flex-col gap-3 p-5 sm:p-6", className)} data-designer-money>
      <CardTitle
        title={t("admin.money.title")}
        sub={t("admin.money.lead")}
        action={
          <Link href="/admin/withdrawals?tab=paid" className="inline-flex min-h-11 items-center gap-1.5 text-[15px] font-bold text-primary">
            {t("admin.money.all")}
            <AdminIcon name="arrow" size={16} />
          </Link>
        }
      />
      <dl className="m-0 flex flex-col text-[15.5px]">
        {rows.map((r, i) => (
          <div key={r.k} className={cx("flex items-center gap-2.5 py-2.5", i < rows.length - 1 && "border-b border-adm-line-soft")}>
            <span className={cx("size-2.5 shrink-0 rounded-[3px]", r.color)} />
            <dt className="flex min-w-0 flex-1 flex-col">
              {r.href ? (
                <Link href={r.href} className="font-semibold hover:text-primary">
                  {r.k}
                </Link>
              ) : (
                <span className="font-semibold">{r.k}</span>
              )}
              <span className="text-sm text-muted">{r.sub}</span>
            </dt>
            <dd className={cx("m-0 font-bold tabular-nums", r.strong && "text-[18px] text-adm-good")}>{r.v}</dd>
          </div>
        ))}
      </dl>
    </AdmCard>
  );
}
