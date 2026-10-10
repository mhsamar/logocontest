import type { Metadata } from "next";
import { BarBlock, BarRow, DayBarChart, SplitBar } from "@/components/admin/charts";
import { AdminIcon, type AdminIconName } from "@/components/admin/icons";
import { AdminHead } from "@/components/admin/page-head";
import { CustomRange, PeriodTabs } from "@/components/admin/period";
import { AdmCard, AdmEmpty, CardTitle } from "@/components/admin/ui";
import { traffic } from "@/lib/admin/analytics";
import { requirePermission } from "@/lib/admin/core";
import { brandsForPaths, pageName } from "@/lib/admin/page-names";
import { readPeriod, type PeriodKey } from "@/lib/admin/period";
import { cx } from "@/lib/cx";
import { getI18n } from "@/lib/i18n/server";
import { formatNumber } from "@/lib/money";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.analytics.title"), robots: { index: false } };
}

// Visits need a start date, so there is no "All time" here (design/admin/analytics.html).
const KEYS: readonly PeriodKey[] = ["today", "3", "7", "30", "custom"];

const host = (ref: string) => {
  try {
    return new URL(ref).host.replace(/^www\./, "");
  } catch {
    return ref;
  }
};

function Highlight({ icon, label, title, hint, tone = "brand" }: { icon: AdminIconName; label: string; title: string; hint?: string; tone?: "brand" | "sample" }) {
  return (
    <AdmCard as="div" className="flex gap-3.5 p-[18px]">
      <span className={cx("flex size-[42px] shrink-0 items-center justify-center rounded-[12px]", tone === "brand" ? "bg-tint text-primary" : "bg-adm-sample-bg text-adm-sample")}>
        <AdminIcon name={icon} />
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[13.5px] font-bold text-muted">{label}</span>
        <strong className="text-[16.5px]">{title}</strong>
        {hint && <span className="text-[14.5px] text-muted">{hint}</span>}
      </div>
    </AdmCard>
  );
}

// A-20 Analytics (BLUEPRINT §13.2 item 3; design/admin/analytics.html, owner 2026-10-10).
export default async function AdminAnalyticsPage({ searchParams }: PageProps<"/admin/analytics">) {
  await requirePermission("dashboard.view");
  const { range, from, to, period, effective } = readPeriod(await searchParams, KEYS, "7");
  const now = new Date();
  const [{ t, locale }, s] = await Promise.all([getI18n(), traffic({ since: effective.since ?? now, until: effective.until }, now)]);
  const brands = await brandsForPaths([...s.pages.map((p) => p.key), ...s.contests.map((c) => `/contest/${c.slug}`)]);
  const num = (n: number) => formatNumber(n, locale);
  const pct = (n: number, of: number) => (of > 0 ? Math.round((n / of) * 100) : 0);
  const dateOf = (day: string) => new Date(`${day}T12:00:00+06:00`).toLocaleDateString(locale === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short", timeZone: "Asia/Dhaka" });
  const todayKey = s.days[s.days.length - 1]?.day;
  const isToday = (day: string) => !effective.until && day === todayKey;
  const dayName = (day: string) => (isToday(day) ? t("admin.analytics.today") : dateOf(day));

  // Highlights
  const busiest = s.days.reduce<(typeof s.days)[number] | null>((best, d) => (!best || d.visitors > best.visitors ? d : best), null);
  const busiestIndex = busiest ? s.days.indexOf(busiest) : -1;
  const before = busiestIndex > 0 ? s.days[busiestIndex - 1].visitors : null;
  const busiestHint =
    before === null || !busiest ? undefined : busiest.visitors > before ? t("admin.analytics.upFrom", { n: num(before) }) : busiest.visitors < before ? t("admin.analytics.downFrom", { n: num(before) }) : t("admin.analytics.sameAs");
  const topContest = s.contests[0];
  const phones = s.devices.filter((d) => d.key !== "desktop").reduce((a, d) => a + d.n, 0);
  const groupsTotal = s.groups.reduce((a, g) => a + g.n, 0);
  const groupsMax = Math.max(0, ...s.groups.map((g) => g.n));
  const pagesTop = s.pages.reduce((a, p) => a + p.n, 0);
  const pagesMax = Math.max(0, ...s.pages.map((p) => p.n));
  const countriesMax = Math.max(0, ...s.countries.map((c) => c.n));
  const sourcesMax = Math.max(0, ...s.sources.map((c) => c.n));
  const onlyDirect = s.sources.every((x) => !x.key);
  const regions = new Intl.DisplayNames([locale === "bn" ? "bn" : "en"], { type: "region" });
  const country = (c: string | null) => {
    if (!c) return t("admin.analytics.unknownCountry");
    try {
      return regions.of(c) ?? c;
    } catch {
      return c;
    }
  };
  const lead = t("admin.analytics.leadPeriod", { from: dateOf(s.days[0]?.day ?? ""), to: dateOf(todayKey ?? "") });

  return (
    <div className="flex flex-col gap-5">
      <AdminHead title={t("admin.analytics.title")} lead={s.days.length ? lead : t("admin.analytics.lead")} actions={<PeriodTabs base="/admin/analytics" keys={KEYS} current={range} fallback="7" />} />
      {range === "custom" && <CustomRange base="/admin/analytics" from={from} to={to} valid={Boolean(period)} />}

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(auto-fit,minmax(min(100%,190px),1fr))] sm:gap-4">
        {[
          { label: t("admin.analytics.visitors"), value: s.visitors, hint: effective.until ? undefined : t("admin.analytics.visitorsHint", { n: num(s.todayVisitors) }) },
          { label: t("admin.analytics.views"), value: s.views, hint: s.visitors ? t("admin.analytics.viewsHint", { n: num(Math.round(s.views / s.visitors)) }) : undefined },
          { label: t("admin.analytics.members"), value: s.members, hint: s.visitors ? t("admin.analytics.membersHint", { n: num(pct(s.members, s.visitors)) }) : undefined },
          { label: t("admin.analytics.signups"), value: s.signups, hint: t("admin.analytics.signupsHint") },
          { label: t("admin.analytics.paid"), value: s.paidContests, hint: t("admin.analytics.paidHint") },
        ].map((k) => (
          <AdmCard key={k.label} as="div" className="flex flex-col gap-1.5 p-4 sm:p-5">
            <span className="text-[14.5px] font-semibold text-muted">{k.label}</span>
            <span className="lc-d text-[30px] font-semibold leading-none tracking-[-0.03em] tabular-nums sm:text-[38px]">{num(k.value)}</span>
            {k.hint && <span className="text-sm text-muted">{k.hint}</span>}
          </AdmCard>
        ))}
      </div>
      {s.capped && <p className="m-0 text-sm text-muted">{t("admin.analytics.capped")}</p>}

      {s.views === 0 ? (
        <AdmCard className="p-5">
          <AdmEmpty>{t("admin.analytics.none")}</AdmEmpty>
        </AdmCard>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))]">
            {busiest && busiest.visitors > 0 && (
              <Highlight icon="analytics" label={t("admin.analytics.busiest")} title={t("admin.analytics.busiestTitle", { day: dayName(busiest.day), n: num(busiest.visitors) })} hint={busiestHint} />
            )}
            {topContest && (
              <Highlight
                icon="contests"
                label={t("admin.analytics.topContest")}
                title={t("admin.analytics.topContestTitle", { brand: brands.get(topContest.slug) ?? topContest.slug, n: num(topContest.page + topContest.submit) })}
                hint={t("admin.analytics.topContestHint", { page: num(topContest.page), submit: num(topContest.submit) })}
              />
            )}
            {s.visitors > 0 && (
              <Highlight
                icon="live"
                tone="sample"
                label={t("admin.analytics.worthALook")}
                title={phones * 2 < s.visitors ? t("admin.analytics.fewPhones", { n: num(phones), of: num(s.visitors) }) : t("admin.analytics.manyPhones", { n: num(phones), of: num(s.visitors) })}
                hint={t("admin.analytics.phonesHint")}
              />
            )}
          </div>

          <div className="flex flex-wrap items-stretch gap-4">
            <AdmCard className="flex min-w-0 flex-[3_1_520px] flex-col gap-[18px] p-5 sm:p-6">
              <CardTitle
                title={t("admin.analytics.daily")}
                sub={t("admin.analytics.dailyLead")}
                action={
                  <div className="flex flex-col items-end">
                    <span className="lc-d text-[26px] font-semibold tracking-[-0.03em] tabular-nums">{num(s.days.reduce((a, d) => a + d.visitors, 0))}</span>
                    <span className="text-sm text-muted">{t("admin.analytics.dailyTotal")}</span>
                  </div>
                }
              />
              <DayBarChart
                label={t("admin.analytics.chartLabel")}
                num={num}
                days={s.days.map((d) => ({ key: d.day, label: dayName(d.day), n: d.visitors, strong: isToday(d.day) }))}
              />
            </AdmCard>

            <AdmCard className="flex min-w-0 flex-[2_1_340px] flex-col gap-[22px] p-5 sm:p-6">
              <h2 className="m-0 text-[21px] font-semibold tracking-[-0.025em]">{t("admin.analytics.who")}</h2>
              <SplitBar left={{ label: t("admin.analytics.membersShort"), n: s.members }} right={{ label: t("admin.live.guests"), n: Math.max(0, s.visitors - s.members) }} num={num} />
              <SplitBar left={{ label: t("admin.live.devices.desktop"), n: s.visitors - phones }} right={{ label: t("admin.live.phoneTablet"), n: phones }} num={num} />
              <div className="flex flex-col gap-2.5">
                <span className="text-sm font-bold text-muted">{t("admin.analytics.countries")}</span>
                {s.countries.map((c) => (
                  <BarRow key={c.key ?? "unknown"} label={country(c.key)} n={c.n} of={s.visitors} max={countriesMax} num={num} />
                ))}
              </div>
              <div className="flex flex-col gap-2.5">
                <span className="text-sm font-bold text-muted">{t("admin.analytics.sources")}</span>
                {s.sources.map((x) => (
                  <BarRow key={x.key ?? "direct"} label={x.key ? host(x.key) : t("admin.analytics.direct")} title={x.key ?? undefined} n={x.n} of={s.visitors} max={sourcesMax} num={num} labelWidth="w-[150px]" />
                ))}
                {onlyDirect && <p className="m-0 text-sm text-muted">{t("admin.analytics.onlyDirect")}</p>}
              </div>
            </AdmCard>
          </div>

          <div className="flex flex-wrap items-start gap-4">
            <AdmCard className="flex min-w-0 flex-[2_1_340px] flex-col gap-4 p-5 sm:p-6">
              <CardTitle title={t("admin.analytics.groups")} sub={t("admin.analytics.groupsLead", { n: num(groupsTotal) })} />
              <div className="flex flex-col gap-3">
                {s.groups
                  .slice()
                  .sort((a, b) => (a.key === "other" ? 1 : b.key === "other" ? -1 : b.n - a.n))
                  .map((g) => (
                    <BarBlock key={g.key} label={t(`admin.analytics.groupNames.${g.key}`)} n={g.n} of={groupsTotal} max={groupsMax} num={num} />
                  ))}
              </div>
            </AdmCard>

            <AdmCard className="min-w-0 flex-[3_1_520px] overflow-hidden">
              <div className="px-5 pb-3.5 pt-[22px] sm:px-6">
                <CardTitle title={t("admin.analytics.pages")} sub={t("admin.analytics.pagesLead", { n: num(s.pages.length), top: num(pagesTop), all: num(s.views) })} />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse text-[15.5px]">
                  <thead>
                    <tr className="text-left text-[13px] uppercase tracking-[0.06em] text-muted">
                      <th scope="col" className="w-9 py-2.5 pl-6 pr-2 font-bold">
                        #
                      </th>
                      <th scope="col" className="px-2 py-2.5 font-bold">
                        {t("admin.analytics.page")}
                      </th>
                      <th scope="col" className="w-[34%] px-2 py-2.5 font-bold">
                        {t("admin.analytics.share")}
                      </th>
                      <th scope="col" className="py-2.5 pl-2 pr-6 text-right font-bold">
                        {t("admin.analytics.viewsCol")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.pages.map((p, i) => (
                      <tr key={p.key} className="border-t border-adm-line-soft">
                        <td className="py-3 pl-6 pr-2 font-bold text-muted">{num(i + 1)}</td>
                        <td className="px-2 py-3">
                          <div className="flex min-w-0 flex-col">
                            <strong className="truncate">{pageName(p.key, brands, t)}</strong>
                            <span className="max-w-[18rem] truncate font-mono text-[13px] font-medium text-muted">{p.key}</span>
                          </div>
                        </td>
                        <td className="px-2 py-3">
                          <div className="flex items-center gap-2.5">
                            <span className="h-3 flex-1 overflow-hidden rounded-full bg-[#f0f1f4]">
                              <span className="block h-full rounded-full bg-primary" style={{ width: `${pagesMax ? (p.n / pagesMax) * 100 : 0}%` }} />
                            </span>
                            <span className="w-12 text-right tabular-nums text-muted">{s.views ? `${num(Math.round((p.n / s.views) * 1000) / 10)}%` : "—"}</span>
                          </div>
                        </td>
                        <td className="py-3 pl-2 pr-6 text-right">
                          <strong className="tabular-nums">{num(p.n)}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </AdmCard>
          </div>
        </>
      )}
    </div>
  );
}
