import type { Metadata } from "next";
import Link from "next/link";
import { AdminHead } from "@/components/admin/page-head";
import { cx } from "@/lib/cx";
import { dashboardStats } from "@/lib/admin/dashboard";
import { getI18n } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { formatNumber, formatTaka } from "@/lib/money";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.title"), robots: { index: false } };
}

const RANGES = { "7": 7, "30": 30, all: null } as const;
type Range = keyof typeof RANGES;

// A-01 Dashboard (BLUEPRINT §13.1, owner 2026-10-09).
export default async function AdminDashboard({ searchParams }: PageProps<"/admin">) {
  const sp = await searchParams;
  const range: Range = typeof sp.range === "string" && sp.range in RANGES ? (sp.range as Range) : "30";
  const [{ t, locale }, s] = await Promise.all([getI18n(), dashboardStats(RANGES[range])]);
  const taka = (n: number) => formatTaka(n, locale);
  const num = (n: number) => formatNumber(n, locale);
  const when = (d: Date) => d.toLocaleString(locale === "bn" ? "bn-BD" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" });

  const rangeLinks = (
    <div className="flex rounded-full bg-surface p-1 ring-1 ring-line" role="group" aria-label={t("admin.dashboard.range")}>
      {(Object.keys(RANGES) as Range[]).map((r) => (
        <Link
          key={r}
          href={r === "30" ? "/admin" : `/admin?range=${r}`}
          aria-current={r === range ? "true" : undefined}
          className={cx("inline-flex min-h-9 items-center rounded-full px-4 text-sm font-semibold", r === range ? "bg-ink text-white" : "text-ink hover:bg-canvas")}
        >
          {t(`admin.dashboard.ranges.${r}`)}
        </Link>
      ))}
    </div>
  );

  if (!s) return <AdminHead title={t("admin.title")} lead={t("admin.dashboard.notConfigured")} />;

  const tiles: { label: string; value: string; hint?: string; href?: string; tone?: "alert" }[] = [
    { label: t("admin.dashboard.tiles.live"), value: num(s.contestsLive), href: "/admin/contests?status=open" },
    { label: t("admin.dashboard.tiles.posted"), value: num(s.contestsPosted) },
    { label: t("admin.dashboard.tiles.completed"), value: num(s.contestsCompleted) },
    { label: t("admin.dashboard.tiles.avgEntries"), value: s.avgEntries === null ? "—" : num(s.avgEntries) },
    { label: t("admin.dashboard.tiles.payments"), value: taka(s.clientPayments), hint: t("admin.dashboard.tiles.paymentsHint", { n: num(s.paymentsCount) }), href: "/admin/payments" },
    {
      label: t("admin.dashboard.tiles.revenue"),
      value: taka(s.revenue.total),
      hint: t("admin.dashboard.tiles.revenueHint", { fees: taka(s.revenue.serviceFees), addons: taka(s.revenue.addons), designer: taka(s.revenue.designerFees) }),
    },
    {
      label: t("admin.dashboard.tiles.withdrawals"),
      value: num(s.pendingWithdrawals.count),
      hint: taka(s.pendingWithdrawals.amount),
      href: "/admin/withdrawals",
      tone: s.pendingWithdrawals.count ? "alert" : undefined,
    },
    {
      label: t("admin.dashboard.tiles.reports"),
      value: num(s.openReports + s.openClaims),
      hint: t("admin.dashboard.tiles.reportsHint", { reports: num(s.openReports), claims: num(s.openClaims) }),
      href: "/admin/reports",
      tone: s.openReports + s.openClaims ? "alert" : undefined,
    },
  ];
  const top = Math.max(1, s.funnel[0]?.visits ?? 0);

  return (
    <div className="space-y-6">
      <AdminHead title={t("admin.dashboard.title")} lead={t("admin.dashboard.lead")} actions={rangeLinks} />

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((tile) => {
          const body = (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{tile.label}</p>
              <p className={cx("mt-1 text-3xl font-extrabold tabular-nums tracking-tight", tile.tone === "alert" ? "text-primary" : "text-ink")}>{tile.value}</p>
              {tile.hint && <p className="mt-1 text-xs text-muted">{tile.hint}</p>}
            </>
          );
          return (
            <li key={tile.label}>
              {tile.href ? (
                <Link href={tile.href} className="block h-full rounded-2xl bg-surface p-4 shadow-card ring-1 ring-line transition-shadow hover:shadow-raised">
                  {body}
                </Link>
              ) : (
                <div className="h-full rounded-2xl bg-surface p-4 shadow-card ring-1 ring-line">{body}</div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="rounded-2xl bg-surface p-5 shadow-card ring-1 ring-line">
          <h2 className="font-semibold text-ink">{t("admin.dashboard.funnel")}</h2>
          <p className="mt-1 text-xs text-muted">{t("admin.dashboard.funnelLead")}</p>
          {(s.funnel[0]?.visits ?? 0) === 0 ? (
            <p className="mt-6 text-sm text-muted">{t("admin.dashboard.funnelEmpty")}</p>
          ) : (
            <ol className="mt-4 space-y-1.5">
              {s.funnel.map((f) => {
                const pct = Math.round((f.visits / top) * 100);
                return (
                  <li key={f.step} className="grid grid-cols-[9.5rem_minmax(0,1fr)_5rem] items-center gap-3 text-sm">
                    <span className="truncate text-muted">{t(`admin.dashboard.steps.s${f.step}` as MessageKey)}</span>
                    <span className="h-5 overflow-clip rounded-md bg-canvas">
                      <span className={cx("block h-full rounded-md", f.step >= 12 ? "bg-success" : "bg-primary/80")} style={{ width: `${Math.max(pct, f.visits ? 2 : 0)}%` }} />
                    </span>
                    <span className="text-right tabular-nums text-ink">
                      {num(f.visits)} <span className="text-xs text-muted">{num(pct)}%</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <section className="rounded-2xl bg-surface p-5 shadow-card ring-1 ring-line">
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold text-ink">{t("admin.dashboard.recent")}</h2>
            <Link href="/admin/audit" className="text-sm font-semibold text-primary hover:underline">
              {t("admin.nav.audit")} →
            </Link>
          </div>
          {s.recent.length === 0 ? (
            <p className="mt-6 text-sm text-muted">{t("admin.audit.empty")}</p>
          ) : (
            <ul className="mt-3 divide-y divide-line text-sm">
              {s.recent.map((r, i) => (
                <li key={i} className="flex items-start justify-between gap-3 py-2">
                  <span className="text-ink">
                    {t(`admin.audit.actions.${r.action}` as MessageKey)}
                    {r.admin && <span className="text-muted"> · {r.admin}</span>}
                  </span>
                  <span className="shrink-0 text-xs text-muted">{when(r.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
