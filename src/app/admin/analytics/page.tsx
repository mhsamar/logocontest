import type { Metadata } from "next";
import Link from "next/link";
import { AdminHead } from "@/components/admin/page-head";
import { traffic } from "@/lib/admin/analytics";
import { requirePermission } from "@/lib/admin/core";
import { cx } from "@/lib/cx";
import { getI18n } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { formatNumber } from "@/lib/money";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.analytics.title"), robots: { index: false } };
}

const PERIODS = ["1", "7", "30"] as const;
type Period = (typeof PERIODS)[number];

function Bars({ rows, num }: { rows: { key: string; n: number }[]; num: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <ul className="mt-3 space-y-2">
      {rows.map((r) => (
        <li key={r.key} className="text-sm">
          <div className="flex justify-between gap-3">
            <span className="truncate text-ink">{r.key}</span>
            <span className="shrink-0 tabular-nums text-muted">{num(r.n)}</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-canvas">
            <div className="h-1.5 rounded-full bg-primary" style={{ width: `${Math.max(3, (r.n / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

// A-20 Analytics (BLUEPRINT §13.2 item 3).
export default async function AdminAnalyticsPage({ searchParams }: PageProps<"/admin/analytics">) {
  await requirePermission("dashboard.view");
  const sp = await searchParams;
  const period: Period = PERIODS.find((p) => p === sp.period) ?? "7";
  const [{ t, locale }, s] = await Promise.all([getI18n(), traffic(Number(period))]);
  const num = (n: number) => formatNumber(n, locale);
  const tiles = [
    [t("admin.analytics.visitors"), s.visitors],
    [t("admin.analytics.views"), s.views],
    [t("admin.analytics.members"), s.members],
    [t("admin.analytics.signups"), s.signups],
    [t("admin.analytics.paid"), s.paidContests],
  ] as const;
  const maxDay = Math.max(1, ...s.days.map((d) => d.visitors));
  const dayLabel = (day: string) => new Date(`${day}T12:00:00+06:00`).toLocaleDateString(locale === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short", timeZone: "Asia/Dhaka" });
  const card = "rounded-2xl bg-surface p-5 shadow-card ring-1 ring-line";

  return (
    <div className="space-y-4">
      <AdminHead
        title={t("admin.analytics.title")}
        lead={t("admin.analytics.lead")}
        actions={
          <div className="flex rounded-full bg-surface p-1 ring-1 ring-line">
            {PERIODS.map((p) => (
              <Link key={p} href={`/admin/analytics?period=${p}`} aria-current={p === period ? "page" : undefined} className={cx("inline-flex min-h-9 items-center rounded-full px-4 text-sm font-semibold", p === period ? "bg-ink text-white" : "text-ink")}>
                {t(`admin.analytics.periods.${p}`)}
              </Link>
            ))}
          </div>
        }
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {tiles.map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-surface p-4 shadow-card ring-1 ring-line">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-ink">{num(value)}</p>
          </div>
        ))}
      </div>
      {s.capped && <p className="text-xs text-muted">{t("admin.analytics.capped")}</p>}

      {s.views === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-surface px-4 py-10 text-center text-muted">{t("admin.analytics.none")}</p>
      ) : (
        <>
          {s.days.length > 1 && (
            <section className={card}>
              <h2 className="font-semibold text-ink">{t("admin.analytics.daily")}</h2>
              <div className="mt-4 flex h-40 items-end gap-1 overflow-x-auto">
                {s.days.map((d) => (
                  <div key={d.day} className="flex min-w-6 flex-1 flex-col items-center gap-1" title={`${dayLabel(d.day)}: ${num(d.visitors)}`}>
                    <span className="text-[0.625rem] tabular-nums text-muted">{d.visitors ? num(d.visitors) : ""}</span>
                    <div className="w-full rounded-t-md bg-primary/80" style={{ height: `${(d.visitors / maxDay) * 100}%`, minHeight: d.visitors ? 4 : 0 }} />
                    <span className="whitespace-nowrap text-[0.625rem] text-muted">{dayLabel(d.day)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            <section className={card}>
              <h2 className="font-semibold text-ink">{t("admin.analytics.pages")}</h2>
              <Bars rows={s.pages} num={num} />
            </section>
            <section className={card}>
              <h2 className="font-semibold text-ink">{t("admin.analytics.sources")}</h2>
              <Bars rows={s.sources.map((x) => ({ key: x.key ?? t("admin.analytics.direct"), n: x.n }))} num={num} />
            </section>
            <section className={card}>
              <h2 className="font-semibold text-ink">{t("admin.analytics.devices")}</h2>
              <Bars rows={s.devices.map((x) => ({ key: t(`admin.live.devices.${x.key}` as MessageKey), n: x.n }))} num={num} />
            </section>
            <section className={card}>
              <h2 className="font-semibold text-ink">{t("admin.analytics.countries")}</h2>
              <Bars rows={s.countries.map((x) => ({ key: x.key ?? t("admin.analytics.unknownCountry"), n: x.n }))} num={num} />
            </section>
          </div>
        </>
      )}
    </div>
  );
}
