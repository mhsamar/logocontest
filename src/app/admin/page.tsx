import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AdminIcon } from "@/components/admin/icons";
import { AdminHead } from "@/components/admin/page-head";
import { CustomRange, PeriodTabs } from "@/components/admin/period";
import { AdmCard, AdmEmpty, CardTitle, KpiGrid, KpiTile } from "@/components/admin/ui";
import { adminUser } from "@/lib/admin/core";
import { dashboardStats } from "@/lib/admin/dashboard";
import { firstAdminPage } from "@/lib/admin/nav";
import { PERIODS, readPeriod } from "@/lib/admin/period";
import { hasPermission } from "@/lib/admin/permissions";
import { cx } from "@/lib/cx";
import { getI18n } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { formatNumber, formatTaka } from "@/lib/money";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.title"), robots: { index: false } };
}

// A-01 Dashboard (BLUEPRINT §13.1, owner 2026-10-09; design/admin/dashboard.html, owner 2026-10-10).
export default async function AdminDashboard({ searchParams }: PageProps<"/admin">) {
  // Staff without the Dashboard go to the first page they may see (BLUEPRINT §13.2).
  const me = await adminUser();
  if (!me) notFound();
  if (!hasPermission(me, "dashboard.view")) redirect(firstAdminPage(me) ?? "/");
  const { range, from, to, period, effective } = readPeriod(await searchParams);
  const [{ t, locale }, s] = await Promise.all([getI18n(), dashboardStats(effective)]);
  const taka = (n: number) => formatTaka(n, locale);
  const num = (n: number) => formatNumber(n, locale);
  const when = (d: Date) => d.toLocaleString(locale === "bn" ? "bn-BD" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" });

  const switcher = <PeriodTabs base="/admin" keys={PERIODS} current={range} />;

  if (!s) return <AdminHead title={t("admin.dashboard.title")} lead={t("admin.dashboard.notConfigured")} />;

  const top = Math.max(1, s.funnel[0]?.visits ?? 0);
  const rev = s.revenue;
  const parts = [
    { key: "serviceFees", value: rev.serviceFees, color: "bg-primary" },
    { key: "addons", value: rev.addons, color: "bg-adm-addon" },
    { key: "designerFees", value: rev.designerFees, color: "bg-adm-strong" },
  ] as const;

  return (
    <div className="flex flex-col gap-5">
      <AdminHead title={t("admin.dashboard.title")} lead={t("admin.dashboard.lead")} actions={switcher} />

      {range === "custom" && <CustomRange base="/admin" from={from} to={to} valid={Boolean(period)} />}

      <KpiGrid>
        <KpiTile label={t("admin.dashboard.tiles.live")} value={num(s.contestsLive)} icon="live" href="/admin/contests?status=open" />
        <KpiTile label={t("admin.dashboard.tiles.posted")} value={num(s.contestsPosted)} icon="contests" />
        <KpiTile label={t("admin.dashboard.tiles.completed")} value={num(s.contestsCompleted)} icon="check" />
        <KpiTile label={t("admin.dashboard.tiles.avgEntries")} value={s.avgEntries === null ? "—" : num(s.avgEntries)} icon="designs" />
        <KpiTile label={t("admin.dashboard.tiles.payments")} value={taka(s.clientPayments)} hint={t("admin.dashboard.tiles.paymentsHint", { n: num(s.paymentsCount) })} icon="payments" href="/admin/payments" />
        <KpiTile label={t("admin.dashboard.tiles.revenue")} value={taka(rev.total)} hint={t("admin.dashboard.tiles.revenueSub")} icon="revenue" accent />
        <KpiTile label={t("admin.dashboard.tiles.withdrawals")} value={num(s.pendingWithdrawals.count)} hint={taka(s.pendingWithdrawals.amount)} icon="withdrawals" href="/admin/withdrawals" />
        <KpiTile
          label={t("admin.dashboard.tiles.reports")}
          value={num(s.openReports + s.openClaims)}
          hint={t("admin.dashboard.tiles.reportsHint", { reports: num(s.openReports), claims: num(s.openClaims) })}
          icon="reports"
          href="/admin/reports"
        />
      </KpiGrid>

      <div className="flex flex-wrap items-start gap-4">
        {/* Wizard drop-off */}
        <AdmCard className="flex min-w-0 flex-[3_1_520px] flex-col gap-[18px] p-5 sm:p-6">
          <CardTitle
            title={t("admin.dashboard.funnel")}
            sub={t("admin.dashboard.funnelLead")}
            action={
              <div className="flex gap-3.5 text-[13.5px] font-semibold text-adm-strong">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-[3px] bg-primary" />
                  {t("admin.dashboard.legendStep")}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-[3px] bg-adm-pay" />
                  {t("admin.dashboard.legendPayment")}
                </span>
              </div>
            }
          />
          {(s.funnel[0]?.visits ?? 0) === 0 ? (
            <AdmEmpty>{t("admin.dashboard.funnelEmpty")}</AdmEmpty>
          ) : (
            <ol className="m-0 flex list-none flex-col gap-[11px] p-0 text-[14.5px]">
              {s.funnel.map((f) => {
                const pct = Math.round((f.visits / top) * 100);
                return (
                  <li key={f.step} className="flex items-center gap-3.5">
                    <span className="w-[92px] shrink-0 truncate text-[13px] font-semibold text-adm-strong sm:w-32 sm:text-[14.5px]">{t(`admin.dashboard.steps.s${f.step}` as MessageKey)}</span>
                    <span className="h-3 flex-1 overflow-hidden rounded-full bg-[#f0f1f4]">
                      <span className={cx("block h-full rounded-full", f.step >= 12 ? "bg-adm-pay" : "bg-primary")} style={{ width: `${Math.max(pct, f.visits ? 2 : 0)}%` }} />
                    </span>
                    <span className="w-[72px] shrink-0 text-right tabular-nums">
                      <strong>{num(f.visits)}</strong> <span className="text-muted">{num(pct)}%</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </AdmCard>

        <div className="flex min-w-0 flex-[2_1_340px] flex-col gap-4">
          {/* Revenue breakdown */}
          <AdmCard className="flex flex-col gap-4 p-5 sm:p-6">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="m-0 text-[21px] font-semibold tracking-[-0.025em]">{t("admin.dashboard.breakdown")}</h2>
              <span className="lc-d text-[21px] font-semibold tracking-[-0.02em] tabular-nums">{taka(rev.total)}</span>
            </div>
            {rev.total > 0 ? (
              <div aria-hidden className="flex h-3.5 gap-[3px] overflow-hidden rounded-full">
                {parts
                  .filter((p) => p.value > 0)
                  .map((p) => (
                    <span key={p.key} className={cx("rounded-[4px] first:rounded-l-full last:rounded-r-full", p.color)} style={{ flex: p.value }} />
                  ))}
              </div>
            ) : (
              <div aria-hidden className="h-3.5 rounded-full bg-[#f0f1f4]" />
            )}
            <dl className="m-0 flex flex-col text-[15.5px]">
              {parts.map((p, i) => (
                <div key={p.key} className={cx("flex items-center gap-2.5 py-2.5", i < parts.length - 1 && "border-b border-adm-line-soft", i === parts.length - 1 && "pb-0")}>
                  <span className={cx("size-2.5 shrink-0 rounded-[3px]", p.color)} />
                  <dt className="flex-1 font-semibold">{t(`admin.dashboard.parts.${p.key}`)}</dt>
                  <dd className="m-0 font-bold tabular-nums">{taka(p.value)}</dd>
                </div>
              ))}
            </dl>
          </AdmCard>

          {/* Latest admin actions */}
          <AdmCard className="flex flex-col gap-3.5 p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="m-0 text-[21px] font-semibold tracking-[-0.025em]">{t("admin.dashboard.recent")}</h2>
              {hasPermission(me, "audit.view") && (
                <Link href="/admin/audit" className="inline-flex min-h-11 items-center gap-1.5 text-[15px] font-bold text-primary">
                  {t("admin.nav.audit")}
                  <AdminIcon name="arrow" size={16} />
                </Link>
              )}
            </div>
            {s.recent.length === 0 ? (
              <AdmEmpty>{t("admin.audit.empty")}</AdmEmpty>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {s.recent.map((r, i) => (
                  <li key={i} className="flex items-center gap-3 rounded-[12px] bg-adm-bg p-3">
                    <span className="flex size-[38px] shrink-0 items-center justify-center rounded-[10px] bg-surface text-primary">
                      <AdminIcon name="audit" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col leading-tight">
                      <strong className="truncate text-[15.5px] font-bold">{t(`admin.audit.actions.${r.action}` as MessageKey)}</strong>
                      <span className="truncate text-sm text-muted">{r.admin ?? "—"}</span>
                    </span>
                    <span className="shrink-0 whitespace-nowrap text-sm text-muted max-sm:hidden">{when(r.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </AdmCard>
        </div>
      </div>
    </div>
  );
}
