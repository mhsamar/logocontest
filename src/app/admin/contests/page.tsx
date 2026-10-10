import type { Metadata } from "next";
import Link from "next/link";
import { AdminIcon } from "@/components/admin/icons";
import { AdminHead } from "@/components/admin/page-head";
import { pageNum, Pager, qs, str } from "@/components/admin/table-bits";
import { AdmCard, AdmEmpty, ADM_INPUT, IdChip, KpiGrid, KpiTile, Pill, StageSteps, TimeLeft } from "@/components/admin/ui";
import { contestStage, LIVE_STATUSES, OLD_STATUSES } from "@/lib/admin/contest-stage";
import { adminContestOverview, type AdminContestOverviewRow } from "@/lib/admin/contests";
import { requirePermission } from "@/lib/admin/core";
import { cx } from "@/lib/cx";
import { formatDate, timeAgo } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { formatNumber, formatTaka } from "@/lib/money";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.contests.title"), robots: { index: false } };
}

const TABS = ["all", "live", "featured", "old"] as const;
type Tab = (typeof TABS)[number];
const STAGES = ["open", "choosing", "files", "completed", "no_result"] as const;
const SORTS = ["ending", "newest", "prize", "designs"] as const;
type Sort = (typeof SORTS)[number];
const PAGE = 30;
/** On the All tab each section shows this many; its own tab shows the rest. */
const SECTION = 12;

// A-02 Contests (BLUEPRINT §13.3; design/admin/contests.html, owner 2026-10-10): live, featured and old contests apart,
// each with its stage and time left.
export default async function AdminContestsPage({ searchParams }: PageProps<"/admin/contests">) {
  await requirePermission("contests.view");
  const sp = await searchParams;
  // ?status=open (from the Dashboard tile) still works: it opens the Live tab at "Open for designs".
  const legacy = str(sp.status);
  const tab: Tab = TABS.find((x) => x === sp.tab) ?? (legacy === "open" ? "live" : "all");
  const stage = STAGES.find((x) => x === sp.stage) ?? (legacy === "open" ? "open" : "");
  const sort: Sort = SORTS.find((x) => x === sp.sort) ?? (tab === "old" ? "newest" : "ending");
  const q = str(sp.q).trim().replace(/^lc-?/i, "").replace(/^0+(?=\d)/, "").toLowerCase();
  const page = pageNum(sp.page);
  const [{ t, locale }, { rows, unpaid }] = await Promise.all([getI18n(), adminContestOverview()]);
  const now = new Date();
  const num = (n: number) => formatNumber(n, locale);
  const taka = (n: number) => formatTaka(n, locale);
  const day = (d: Date) => formatDate(d, locale, "short");

  const isLive = (c: AdminContestOverviewRow) => LIVE_STATUSES.includes(c.status);
  const isOld = (c: AdminContestOverviewRow) => OLD_STATUSES.includes(c.status);
  const live = rows.filter(isLive);
  const old = rows.filter(isOld);
  const featured = live.filter((c) => c.featured);
  const soon = live.filter((c) => c.status === "open" && c.endsAt && c.endsAt > now && c.endsAt.getTime() - now.getTime() <= 7 * 86_400_000).sort((a, b) => a.endsAt!.getTime() - b.endsAt!.getTime());
  const counts: Record<Tab, number> = { all: rows.length, live: live.length, featured: featured.length, old: old.length };

  // Search, stage and sort apply to every tab.
  const matches = (c: AdminContestOverviewRow) =>
    (!q || c.brand.toLowerCase().includes(q) || c.slug.includes(q) || (/^\d+$/.test(q) && c.number === Number(q))) && (!stage || contestStage(c.status).key === stage);
  const daysLeft = (c: AdminContestOverviewRow) => (c.endsAt ? c.endsAt.getTime() - now.getTime() : Number.POSITIVE_INFINITY);
  const sorted = (list: AdminContestOverviewRow[]) =>
    list.filter(matches).sort((a, b) =>
      sort === "prize" ? b.prize - a.prize : sort === "designs" ? b.entries - a.entries : sort === "newest" ? b.createdAt.getTime() - a.createdAt.getTime() : daysLeft(a) - daysLeft(b),
    );

  const link = (over: Record<string, string | number | undefined>) =>
    `/admin/contests${qs({ tab: tab === "all" ? undefined : tab, q: str(sp.q) || undefined, stage: stage || undefined, sort: sp.sort ? sort : undefined, ...over })}`;

  const stageCell = (c: AdminContestOverviewRow, withStep = false) => {
    const s = contestStage(c.status);
    const done = s.key === "completed";
    return (
      <div className="flex flex-col gap-1.5">
        {s.step > 0 && <StageSteps step={s.step} done={done} />}
        <span className={cx("text-[14.5px] font-bold", done && "text-adm-good", (s.key === "no_result" || s.key === "cancelled") && "text-muted")}>
          {t(`admin.contests.stages.${s.key}` as MessageKey)}
          {withStep && s.step > 0 && <span className="font-medium text-muted"> · {t("admin.contests.stageOf", { n: num(s.step) })}</span>}
        </span>
      </div>
    );
  };
  const timeCell = (c: AdminContestOverviewRow) => {
    if (isOld(c)) {
      const ended = c.completedAt ?? c.endsAt;
      return ended ? (
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold">{t("admin.contests.endedOn", { date: day(ended) })}</span>
          <span className="text-sm text-muted">{timeAgo(ended, now, locale)}</span>
        </div>
      ) : (
        "—"
      );
    }
    if (c.status === "open" && c.endsAt && c.endsAt > now) {
      const left = Math.ceil((c.endsAt.getTime() - now.getTime()) / 86_400_000);
      return (
        <div className="flex flex-col items-start gap-1">
          <TimeLeft urgent={left <= 1}>{t("admin.activity.daysLeft", { n: num(left) })}</TimeLeft>
          <span className="text-sm text-muted">{t("admin.activity.ends", { date: day(c.endsAt) })}</span>
        </div>
      );
    }
    return c.endsAt ? <span className="text-sm text-muted">{t("admin.contests.endedOn", { date: day(c.endsAt) })}</span> : "—";
  };
  const avatar = (c: AdminContestOverviewRow, big = false) => (
    <span className={cx("lc-d flex shrink-0 items-center justify-center font-semibold", big ? "size-14 rounded-[14px] text-[21px]" : "size-11 rounded-[12px] text-[17px]", c.featured ? "bg-primary text-white" : "bg-tint text-primary")}>
      {c.brand.trim().slice(0, 1).toUpperCase()}
    </span>
  );

  const table = (list: AdminContestOverviewRow[], oldOnes: boolean) => (
    <AdmCard className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-[15.5px]">
          <thead>
            <tr className="text-left text-[13px] uppercase tracking-[0.06em] text-muted">
              <th scope="col" className="px-5 py-3.5 font-bold">
                {t("admin.contests.contest")}
              </th>
              <th scope="col" className="px-3 py-3.5 font-bold">
                {t("admin.contests.client")}
              </th>
              <th scope="col" className="px-3 py-3.5 font-bold">
                {oldOnes ? t("admin.contests.result") : t("admin.contests.stage")}
              </th>
              <th scope="col" className="px-3 py-3.5 text-right font-bold">
                {t("admin.contests.prize")}
              </th>
              <th scope="col" className="px-3 py-3.5 text-right font-bold">
                {t("admin.contests.designs")}
              </th>
              <th scope="col" className="py-3.5 pl-3 pr-5 font-bold">
                {t("admin.contests.time")}
              </th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id} className="border-t border-adm-line-soft hover:bg-[#fafafb]">
                <td className="px-5 py-4">
                  <Link href={`/admin/contests/${c.slug}`} className="flex items-center gap-3">
                    {avatar(c)}
                    <span className="flex min-w-0 flex-col gap-[3px]">
                      <strong className="truncate text-[16.5px] hover:text-primary">{c.brand}</strong>
                      <IdChip prefix="LC" n={c.number} />
                    </span>
                  </Link>
                </td>
                <td className="px-3 py-4">
                  <Link href={`/admin/users/${c.client.id}`} className="hover:text-primary">
                    {c.client.name}
                  </Link>
                </td>
                <td className="px-3 py-4">{stageCell(c)}</td>
                <td className="px-3 py-4 text-right">
                  <strong className={cx("lc-d text-lg font-semibold tabular-nums", !oldOnes && "text-primary")}>{taka(c.prize)}</strong>
                </td>
                <td className="px-3 py-4 text-right">
                  <strong className="tabular-nums">{num(c.entries)}</strong>
                </td>
                <td className="py-4 pl-3 pr-5">{timeCell(c)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdmCard>
  );

  const cards = (list: AdminContestOverviewRow[]) => (
    <div className="grid gap-4 sm:grid-cols-[repeat(auto-fit,minmax(min(100%,380px),1fr))]">
      {list.map((c) => (
        <Link key={c.id} href={`/admin/contests/${c.slug}`} className="flex flex-col gap-[18px] rounded-[16px] border border-adm-line bg-surface p-5 shadow-[0_1px_2px_rgb(17_18_22/0.03)] hover:border-[#d6d8de] sm:p-[22px]">
          <div className="flex items-start gap-3.5">
            {avatar(c, true)}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <strong className="lc-d text-xl font-semibold tracking-[-0.02em]">{c.brand}</strong>
                <IdChip prefix="LC" n={c.number} />
              </div>
              <span className="text-[15px] text-muted">{t("admin.contests.clientIs", { name: c.client.name })}</span>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {c.featured && <Pill tone="dark">{t("admin.contests.badges.featured")}</Pill>}
                {c.urgent && <Pill tone="red">{t("admin.contests.badges.urgent")}</Pill>}
                {c.highlighted && <Pill tone="gold">{t("admin.contests.badges.highlighted")}</Pill>}
                {c.isPrivate && <Pill>{t("admin.contests.badges.private")}</Pill>}
                <Pill tone="brand">{t(`wizard.packages.${c.package}.name` as MessageKey)}</Pill>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2.5 rounded-[12px] bg-adm-bg p-3.5">
            {[
              { label: t("admin.contests.prize"), value: taka(c.prize), red: true },
              { label: t("admin.contests.designs"), value: num(c.entries) },
              { label: t("admin.contests.ends"), value: c.endsAt ? day(c.endsAt) : "—" },
            ].map((x) => (
              <div key={x.label} className="flex min-w-0 flex-col">
                <span className="text-[13.5px] text-muted">{x.label}</span>
                <strong className={cx("lc-d truncate text-lg font-semibold tracking-[-0.02em] sm:text-[22px]", x.red && "text-primary")}>{x.value}</strong>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            {stageCell(c, true)}
            {timeCell(c)}
          </div>
        </Link>
      ))}
    </div>
  );

  const section = (icon: "contests" | "live" | "unpaid", title: string, count: number, body: React.ReactNode, more?: string) => (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <AdminIcon name={icon} className="text-primary" />
        <h2 className="m-0 text-[21px] font-semibold tracking-[-0.025em]">{title}</h2>
        <span className="min-w-6 rounded-[7px] border border-adm-line bg-surface px-1.5 text-center text-[12.5px] font-bold tabular-nums">{num(count)}</span>
        {more && (
          <Link href={more} className="ml-auto inline-flex min-h-11 items-center gap-1.5 text-[15px] font-bold text-primary">
            {t("admin.search.seeAll", { n: num(count) })}
            <AdminIcon name="arrow" size={16} />
          </Link>
        )}
      </div>
      {body}
    </section>
  );

  // The list for a single tab, paged.
  const tabList = tab === "live" ? sorted(live) : tab === "featured" ? sorted(featured) : tab === "old" ? sorted(old) : [];
  const pages = Math.max(1, Math.ceil(tabList.length / PAGE));
  const pageRows = tabList.slice((page - 1) * PAGE, page * PAGE);
  const allSections = { featured: sorted(featured), live: sorted(live.filter((c) => !c.featured)), old: sorted(old) };
  const nothing = tab === "all" ? allSections.featured.length + allSections.live.length + allSections.old.length === 0 : pageRows.length === 0;

  return (
    <div className="flex flex-col gap-5">
      <AdminHead
        title={t("admin.contests.title")}
        lead={t("admin.contests.leadNew", { n: num(rows.length), live: num(live.length), old: num(old.length) })}
        actions={
          <span className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-[12px] border border-adm-line bg-surface px-3.5 text-[14.5px] font-bold text-adm-strong">
            <AdminIcon name="calendar" size={16} />
            {t("admin.contests.today", { date: formatDate(now, locale, "long") })}
          </span>
        }
      />

      <KpiGrid>
        <KpiTile label={t("admin.contests.kpi.live")} value={num(live.length)} hint={t("admin.contests.kpi.liveHint", { amount: taka(live.reduce((a, c) => a + c.prize, 0)) })} icon="live" accent />
        <KpiTile label={t("admin.contests.badges.featured")} value={num(featured.length)} hint={t("admin.contests.kpi.featuredHint")} icon="monthly" />
        <KpiTile label={t("admin.contests.kpi.soon")} value={num(soon.length)} hint={soon[0]?.endsAt ? `${soon[0].brand}, ${day(soon[0].endsAt)}` : undefined} icon="unpaid" />
        <KpiTile
          label={t("admin.contests.kpi.ended")}
          value={num(old.length)}
          hint={t("admin.contests.kpi.endedHint", { done: num(old.filter((c) => c.status === "completed").length), none: num(old.filter((c) => c.status !== "completed").length) })}
          icon="check"
        />
      </KpiGrid>

      <AdmCard className="flex flex-col gap-3 p-3 sm:p-4">
        <nav aria-label={t("admin.contests.tabs")} className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none]">
          <ul className="m-0 flex w-max list-none gap-1.5 p-0">
            {TABS.map((x) => (
              <li key={x}>
                <Link
                  href={`/admin/contests${qs({ tab: x === "all" ? undefined : x, q: str(sp.q) || undefined, stage: stage || undefined })}`}
                  aria-current={x === tab ? "page" : undefined}
                  className={cx("flex h-10 items-center gap-2 whitespace-nowrap rounded-[10px] px-3 text-[15px] font-semibold", x === tab ? "bg-tint text-primary" : "text-adm-strong hover:bg-adm-bg")}
                >
                  {t(`admin.contests.tabNames.${x}`)}
                  <span className={cx("min-w-6 rounded-[7px] px-1.5 text-center text-[12.5px] font-bold tabular-nums", x === tab ? "bg-surface" : "bg-[#f0f1f4]")}>{num(counts[x])}</span>
                </Link>
              </li>
            ))}
            <li>
              <Link href="/admin/unpaid" className="flex h-10 items-center gap-2 whitespace-nowrap rounded-[10px] px-3 text-[15px] font-semibold text-adm-strong hover:bg-adm-bg">
                {t("admin.contests.tabNames.unpaid")}
                <span className="min-w-6 rounded-[7px] bg-[#f0f1f4] px-1.5 text-center text-[12.5px] font-bold tabular-nums">{num(unpaid)}</span>
                <AdminIcon name="arrow" size={14} />
              </Link>
            </li>
          </ul>
        </nav>
        <form action="/admin/contests" className="flex flex-wrap gap-2">
          {tab !== "all" && <input type="hidden" name="tab" value={tab} />}
          <label className="relative min-w-0 flex-[1_1_220px]">
            <span className="sr-only">{t("admin.contests.search")}</span>
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-adm-soft">
              <AdminIcon name="search" />
            </span>
            <input type="search" name="q" defaultValue={str(sp.q)} placeholder={t("admin.contests.search")} className={cx(ADM_INPUT, "h-11 pl-10")} />
          </label>
          <label className="flex items-center gap-2 text-[15px] font-semibold text-adm-strong">
            <span className="max-sm:sr-only">{t("admin.contests.stage")}</span>
            <select name="stage" defaultValue={stage} className={cx(ADM_INPUT, "h-11 w-auto")}>
              <option value="">{t("admin.contests.anyStage")}</option>
              {STAGES.map((x) => (
                <option key={x} value={x}>
                  {t(`admin.contests.stages.${x}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-[15px] font-semibold text-adm-strong">
            <span className="max-sm:sr-only">{t("admin.contests.sort")}</span>
            <select name="sort" defaultValue={sort} className={cx(ADM_INPUT, "h-11 w-auto")}>
              {SORTS.map((x) => (
                <option key={x} value={x}>
                  {t(`admin.contests.sorts.${x}`)}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="h-11 rounded-[12px] bg-primary px-5 text-[15px] font-bold text-white hover:bg-adm-deep">
            {t("admin.filter")}
          </button>
        </form>
      </AdmCard>

      {nothing ? (
        <AdmCard className="p-5">
          <AdmEmpty>{t("admin.contests.empty")}</AdmEmpty>
        </AdmCard>
      ) : tab === "all" ? (
        <>
          {allSections.featured.length > 0 && section("contests", t("admin.contests.sections.featured"), allSections.featured.length, cards(allSections.featured.slice(0, SECTION)), allSections.featured.length > SECTION ? link({ tab: "featured" }) : undefined)}
          {allSections.live.length > 0 &&
            section("live", t("admin.contests.sections.live"), allSections.live.length, table(allSections.live.slice(0, SECTION), false), allSections.live.length > SECTION ? link({ tab: "live" }) : undefined)}
          {allSections.old.length > 0 && section("unpaid", t("admin.contests.sections.old"), allSections.old.length, table(allSections.old.slice(0, SECTION), true), allSections.old.length > SECTION ? link({ tab: "old" }) : undefined)}
        </>
      ) : tab === "featured" ? (
        cards(pageRows)
      ) : (
        table(pageRows, tab === "old")
      )}

      {tab !== "all" && <Pager page={page} pages={pages} href={(p) => link({ page: p })} prev={t("admin.prev")} next={t("admin.next")} label={t("admin.pages")} />}
    </div>
  );
}
