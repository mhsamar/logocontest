import type { Metadata } from "next";
import Link from "next/link";
import { AutoRefresh } from "@/components/admin/auto-refresh";
import { SplitBar } from "@/components/admin/charts";
import { AdminIcon } from "@/components/admin/icons";
import { AdminHead } from "@/components/admin/page-head";
import { AdmCard, AdmEmpty, Pill } from "@/components/admin/ui";
import { liveVisitors } from "@/lib/admin/analytics";
import { requirePermission } from "@/lib/admin/core";
import { brandsForPaths, isImportant, pageName } from "@/lib/admin/page-names";
import { cx } from "@/lib/cx";
import { getI18n } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { formatNumber } from "@/lib/money";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.live.title"), robots: { index: false } };
}

const SHOWS = ["all", "members", "guests"] as const;
type Show = (typeof SHOWS)[number];

// A-19 Live now (BLUEPRINT §13.2 item 3; design/admin/live-now.html, owner 2026-10-10): who is on the site in the
// last 2 minutes.
export default async function AdminLivePage({ searchParams }: PageProps<"/admin/live">) {
  await requirePermission("live.view");
  const sp = await searchParams;
  const show: Show = SHOWS.find((s) => s === sp.show) ?? "all";
  const now = new Date();
  const [{ t, locale }, list] = await Promise.all([getI18n(), liveVisitors(now)]);
  const brands = await brandsForPaths(list.map((v) => v.path));
  const num = (n: number) => formatNumber(n, locale);
  const regions = new Intl.DisplayNames([locale === "bn" ? "bn" : "en"], { type: "region" });
  const country = (c: string | null) => {
    if (!c) return t("admin.live.unknownCountry");
    try {
      return regions.of(c) ?? c;
    } catch {
      return c;
    }
  };

  const members = list.filter((v) => v.person);
  const clients = members.filter((v) => v.person?.role === "client").length;
  const designers = members.filter((v) => v.person?.role === "designer").length;
  const important = list.filter((v) => isImportant(v.path)).length;
  const shown = show === "members" ? members : show === "guests" ? list.filter((v) => !v.person) : list;

  // "Pages open right now", busiest first.
  const pages = new Map<string, number>();
  for (const v of list) {
    const name = pageName(v.path, brands, t);
    pages.set(name, (pages.get(name) ?? 0) + 1);
  }
  const pageRows = [...pages.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const topPage = Math.max(1, ...pageRows.map((p) => p[1]));
  const computers = list.filter((v) => v.device === "desktop").length;
  const bd = list.filter((v) => v.country === "BD").length;

  const seen = (d: Date) => {
    const s = Math.max(0, Math.round((now.getTime() - d.getTime()) / 1000));
    return s < 15 ? t("admin.live.justNow") : s < 60 ? t("admin.live.ago", { n: num(s) }) : t("admin.live.minAgo", { n: num(Math.round(s / 60)) });
  };
  return (
    <div className="flex flex-col gap-5">
      <AutoRefresh seconds={10} />
      <AdminHead
        title={t("admin.live.title")}
        lead={t("admin.live.leadShort")}
        actions={
          <span className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-[12px] bg-adm-good-bg px-3.5 text-[14.5px] font-bold text-adm-good">
            <span className="size-[9px] rounded-full bg-adm-pay" aria-hidden />
            {t("admin.live.badge")}
          </span>
        }
      />

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] sm:gap-4">
        <div className="flex flex-col gap-1.5 rounded-[16px] border border-adm-good bg-adm-good p-4 text-white sm:p-5">
          <span className="text-[14.5px] font-semibold text-[#cfebdb]">{t("admin.live.online")}</span>
          <span className="lc-d text-[30px] font-semibold leading-none tracking-[-0.03em] sm:text-[38px]">{num(list.length)}</span>
          <span className="text-sm text-[#cfebdb]">{t("admin.live.onlineHint")}</span>
        </div>
        {[
          { label: t("admin.live.members"), value: members.length, hint: t("admin.live.membersHint", { clients: num(clients), designers: num(designers) }) },
          { label: t("admin.live.guests"), value: list.length - members.length, hint: t("admin.live.guestsHint") },
          { label: t("admin.live.important"), value: important, hint: t("admin.live.importantHint") },
        ].map((k) => (
          <AdmCard key={k.label} as="div" className="flex flex-col gap-1.5 p-4 sm:p-5">
            <span className="text-[14.5px] font-semibold text-muted">{k.label}</span>
            <span className="lc-d text-[30px] font-semibold leading-none tracking-[-0.03em] sm:text-[38px]">{num(k.value)}</span>
            <span className="text-sm text-muted">{k.hint}</span>
          </AdmCard>
        ))}
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <AdmCard className="min-w-0 flex-[3_1_560px] overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-3.5 pt-5 sm:px-6">
            <h2 className="m-0 text-[21px] font-semibold tracking-[-0.025em]">{t("admin.live.people")}</h2>
            <nav aria-label={t("admin.live.show")} className="flex gap-1 rounded-[12px] bg-adm-bg p-1">
              {SHOWS.map((s) => (
                <Link
                  key={s}
                  href={s === "all" ? "/admin/live" : `/admin/live?show=${s}`}
                  aria-current={s === show ? "page" : undefined}
                  className={cx("flex h-9 items-center rounded-[9px] px-3.5 text-[14.5px] font-bold", s === show ? "bg-surface text-ink shadow-[0_1px_2px_rgb(17_18_22/0.06)]" : "text-adm-strong")}
                >
                  {t(`admin.live.shows.${s}`)}
                </Link>
              ))}
            </nav>
          </div>
          {shown.length === 0 ? (
            <div className="px-5 pb-5 sm:px-6">
              <AdmEmpty>{t("admin.live.none")}</AdmEmpty>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] border-collapse text-[15.5px]">
                <thead>
                  <tr className="text-left text-[13px] uppercase tracking-[0.06em] text-muted">
                    <th scope="col" className="py-2.5 pl-6 pr-3 font-bold">
                      {t("admin.live.who")}
                    </th>
                    <th scope="col" className="px-3 py-2.5 font-bold">
                      {t("admin.live.looking")}
                    </th>
                    <th scope="col" className="px-3 py-2.5 font-bold">
                      {t("admin.live.deviceCountry")}
                    </th>
                    <th scope="col" className="px-3 py-2.5 font-bold">
                      {t("admin.live.onFor")}
                    </th>
                    <th scope="col" className="py-2.5 pl-3 pr-6 font-bold">
                      {t("admin.live.seen")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((v) => (
                    <tr key={v.visitorId} className={cx("border-t border-adm-line-soft", isImportant(v.path) && "bg-[#f6fbf8]")}>
                      <td className="py-3.5 pl-6 pr-3">
                        <div className="flex items-center gap-3">
                          <span className={cx("lc-d flex size-11 shrink-0 items-center justify-center rounded-[12px] text-[17px] font-semibold", v.person ? "bg-tint text-primary" : "bg-[#f0f1f4] text-muted")}>
                            {v.person ? v.person.name.trim().slice(0, 1).toUpperCase() : <AdminIcon name="users" />}
                          </span>
                          <div className="flex min-w-0 flex-col">
                            {v.person ? (
                              <>
                                <Link href={`/admin/users/${v.person.id}`} className="truncate font-bold hover:text-primary">
                                  {v.person.name}
                                </Link>
                                <Pill className="self-start">{t(`admin.live.roles.${v.person.role}` as MessageKey)}</Pill>
                              </>
                            ) : (
                              <>
                                <strong>{t("admin.live.guest")}</strong>
                                <span className="text-sm text-muted">{t("admin.live.guestsHint")}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="flex min-w-0 flex-col">
                          <strong>{pageName(v.path, brands, t)}</strong>
                          <a href={v.path} target="_blank" rel="noopener" className="max-w-[16rem] truncate font-mono text-[13px] font-medium text-muted hover:text-primary">
                            {v.path}
                          </a>
                        </div>
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="flex flex-col">
                          <span className="font-semibold">{t(`admin.live.devices.${v.device}` as MessageKey)}</span>
                          <span className="text-sm text-muted">{country(v.country)}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3.5">
                        <strong className="tabular-nums">{t("admin.live.minutes", { n: num(Math.max(1, Math.round((now.getTime() - v.startedAt.getTime()) / 60000))) })}</strong>
                      </td>
                      <td className="py-3.5 pl-3 pr-6">
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-bold text-adm-good">
                          <span className="size-2 rounded-full bg-adm-pay" aria-hidden />
                          {seen(v.lastSeen)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AdmCard>

        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-4">
          <AdmCard className="flex flex-col gap-3.5 p-5 sm:p-6">
            <h2 className="m-0 text-[19px] font-semibold tracking-[-0.02em]">{t("admin.live.pagesOpen")}</h2>
            {pageRows.length === 0 ? (
              <p className="m-0 text-[15px] text-muted">{t("admin.live.none")}</p>
            ) : (
              pageRows.map(([name, n]) => (
                <div key={name} className="flex items-center gap-3 text-[15px]">
                  <span className="w-[132px] shrink-0 truncate font-semibold" title={name}>
                    {name}
                  </span>
                  <span className="h-3 flex-1 overflow-hidden rounded-full bg-[#f0f1f4]">
                    <span className="block h-full rounded-full bg-primary" style={{ width: `${(n / topPage) * 100}%` }} />
                  </span>
                  <strong className="w-6 text-right tabular-nums">{num(n)}</strong>
                </div>
              ))
            )}
          </AdmCard>
          <AdmCard className="flex flex-col gap-[18px] p-5 sm:p-6">
            <h2 className="m-0 text-[19px] font-semibold tracking-[-0.02em]">{t("admin.live.byType")}</h2>
            <SplitBar left={{ label: t("admin.live.devices.desktop"), n: computers }} right={{ label: t("admin.live.phoneTablet"), n: list.length - computers }} num={num} showPct={false} />
            <SplitBar left={{ label: country("BD"), n: bd }} right={{ label: t("admin.live.otherCountries"), n: list.length - bd }} num={num} showPct={false} />
          </AdmCard>
        </div>
      </div>
    </div>
  );
}
