import type { Metadata } from "next";
import Link from "next/link";
import { AdminAction } from "@/components/admin/admin-action";
import { EntryThumb } from "@/components/admin/entry-thumb";
import { AdminIcon } from "@/components/admin/icons";
import { AdminHead } from "@/components/admin/page-head";
import { str } from "@/components/admin/table-bits";
import { AdmCard, ADM_INPUT, IdChip, KpiGrid, KpiTile, Pill } from "@/components/admin/ui";
import { requirePermission } from "@/lib/admin/core";
import { duplicatePairs, recentEntries, type AdminEntry } from "@/lib/admin/moderation";
import { clearDuplicate, removeEntry } from "@/lib/admin/moderation-actions";
import { cx } from "@/lib/cx";
import { formatDate } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { formatNumber } from "@/lib/money";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.entries.title"), robots: { index: false } };
}

const TABS = ["recent", "duplicates", "winners"] as const;
type Tab = (typeof TABS)[number];
const SORTS = ["newest", "oldest", "comments"] as const;
/** How many of the newest designs the page reads. */
const READ = 200;
const DAYS = 3;
const dhakaDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(d);

// A-03 Designs (BLUEPRINT §13.4; design/admin/designs.html, owner 2026-10-10): the latest designs, flagged
// near-duplicates side by side, and winners.
export default async function AdminEntriesPage({ searchParams }: PageProps<"/admin/entries">) {
  await requirePermission("designs.view");
  const sp = await searchParams;
  const tab: Tab = TABS.find((x) => x === sp.tab) ?? "recent";
  const sort = SORTS.find((x) => x === sp.sort) ?? "newest";
  const contest = str(sp.contest);
  const q = str(sp.q).trim().toLowerCase().replace(/^lc-?0*/, "");
  const [{ t, locale }, all, pairs] = await Promise.all([getI18n(), recentEntries(READ), duplicatePairs()]);
  const num = (n: number) => formatNumber(n, locale);
  const now = new Date();
  const when = (d: Date) => d.toLocaleString(locale === "bn" ? "bn-BD" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" });
  const today = dhakaDay(now);
  const yesterday = dhakaDay(new Date(now.getTime() - 86_400_000));

  // KPIs: the last three days.
  const since = new Date(now.getTime() - DAYS * 86_400_000);
  const recent = all.filter((e) => e.createdAt >= since);
  const perDay = new Map<string, { n: number; d: Date }>();
  for (const e of recent) perDay.set(dhakaDay(e.createdAt), { n: (perDay.get(dhakaDay(e.createdAt))?.n ?? 0) + 1, d: e.createdAt });
  const dayHint = [...perDay.entries()]
    .map(([k, v]) => (k === today ? t("admin.activity.onToday", { n: num(v.n) }) : k === yesterday ? t("admin.activity.onYesterday", { n: num(v.n) }) : t("admin.activity.onDay", { n: num(v.n), day: formatDate(v.d, locale, "short") })))
    .join(" · ");
  const byDesigner = new Map<string, { name: string; n: number }>();
  for (const e of recent) byDesigner.set(e.designer.id, { name: e.designer.name, n: (byDesigner.get(e.designer.id)?.n ?? 0) + 1 });
  const topDesigner = [...byDesigner.values()].sort((a, b) => b.n - a.n)[0];
  const byContest = new Map<string, { brand: string; n: number }>();
  for (const e of recent) byContest.set(e.contest.slug, { brand: e.contest.brand, n: (byContest.get(e.contest.slug)?.n ?? 0) + 1 });
  const topContest = [...byContest.values()].sort((a, b) => b.n - a.n)[0];
  const winners = all.filter((e) => e.status === "winner");

  // The list: filters and sort.
  const contests = [...new Map(all.map((e) => [e.contest.slug, e.contest.brand])).entries()];
  const filtered = (tab === "winners" ? winners : all)
    .filter((e) => !contest || e.contest.slug === contest)
    .filter((e) => !q || e.designer.name.toLowerCase().includes(q) || (e.designer.username ?? "").toLowerCase().includes(q) || e.contest.brand.toLowerCase().includes(q) || String(e.contest.number ?? "") === q)
    .sort((a, b) => (sort === "oldest" ? a.createdAt.getTime() - b.createdAt.getTime() : sort === "comments" ? b.comments - a.comments : b.createdAt.getTime() - a.createdAt.getTime()));

  const card = (e: AdminEntry) => (
    <AdmCard key={e.id} as="li" className="flex flex-col overflow-hidden">
      <Link href={`/contest/${e.contest.slug}?tab=entries&entry=${e.number}`} className="relative flex aspect-[4/3] items-center justify-center bg-[#eeeff2]">
        {e.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={e.coverUrl} alt="" loading="lazy" className="h-full w-full object-contain" />
        ) : (
          <span className="text-[13.5px] font-semibold text-muted">{t("admin.entries.noImage")}</span>
        )}
        <Pill tone="dark" className="absolute left-3 top-3">
          {t("admin.entries.designNo", { n: num(e.number) })}
        </Pill>
        {e.status === "winner" ? (
          <Pill tone="gold" className="absolute right-3 top-3">
            {t("admin.entries.statuses.winner" as MessageKey)}
          </Pill>
        ) : e.status === "removed" ? (
          <Pill tone="bad" className="absolute right-3 top-3">
            {t("admin.entries.statuses.removed" as MessageKey)}
          </Pill>
        ) : dhakaDay(e.createdAt) === today ? (
          <Pill tone="red" className="absolute right-3 top-3">
            {t("admin.entries.newToday")}
          </Pill>
        ) : null}
      </Link>
      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/admin/contests/${e.contest.slug}`} className="text-[17px] font-bold hover:text-primary">
            {e.contest.brand}
          </Link>
          <IdChip prefix="LC" n={e.contest.number} />
        </div>
        <Link href={`/admin/users/${e.designer.id}`} className="flex items-center gap-2.5">
          <span className="lc-d flex size-[34px] shrink-0 items-center justify-center rounded-[10px] bg-tint text-sm font-semibold text-primary">{e.designer.name.trim().slice(0, 1).toUpperCase()}</span>
          <span className="flex min-w-0 flex-col leading-tight">
            <strong className="truncate text-[15px] hover:text-primary">{e.designer.name}</strong>
            <span className="text-[13.5px] text-muted">{when(e.createdAt)}</span>
          </span>
        </Link>
        <div className="flex flex-wrap items-center gap-1.5">
          {e.flagged ? <Pill tone="warn">{t("admin.entries.flagged")}</Pill> : <Pill tone="good">{t("admin.entries.noDuplicate")}</Pill>}
          {e.comments > 0 && <Pill>{t("admin.entries.comments", { n: num(e.comments) })}</Pill>}
          {e.status !== "removed" && e.status !== "winner" && (
            <span className="ml-auto">
              <AdminAction label={t("admin.entries.remove")} body={t("admin.entries.removeBody")} tone="ghost" run={removeEntry.bind(null, e.id)} />
            </span>
          )}
        </div>
      </div>
    </AdmCard>
  );

  return (
    <div className="flex flex-col gap-5">
      <AdminHead title={t("admin.entries.title")} lead={t("admin.entries.leadNew")} />

      <KpiGrid>
        <KpiTile label={t("admin.entries.kpi.recent", { n: num(DAYS) })} value={num(recent.length)} hint={dayHint || undefined} icon="designs" />
        <KpiTile label={t("admin.entries.duplicates")} value={num(pairs.length)} hint={pairs.length ? t("admin.entries.kpi.toCheck") : t("admin.entries.kpi.nothing")} icon="claims" href="/admin/entries?tab=duplicates" accent={pairs.length > 0} />
        <KpiTile label={t("admin.entries.kpi.designers")} value={num(byDesigner.size)} hint={topDesigner ? t("admin.entries.kpi.most", { name: topDesigner.name, n: num(topDesigner.n) }) : undefined} icon="users" />
        <KpiTile label={t("admin.entries.kpi.contest")} value={topContest ? topContest.brand : "—"} hint={topContest ? t("admin.entries.kpi.contestHint", { n: num(topContest.n) }) : undefined} icon="contests" />
      </KpiGrid>

      <AdmCard className="flex flex-col gap-3 p-3 sm:p-4">
        <nav aria-label={t("admin.entries.title")} className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none]">
          <ul className="m-0 flex w-max list-none gap-1.5 p-0">
            {TABS.map((x) => (
              <li key={x}>
                <Link
                  href={x === "recent" ? "/admin/entries" : `/admin/entries?tab=${x}`}
                  aria-current={x === tab ? "page" : undefined}
                  className={cx("flex h-10 items-center gap-2 whitespace-nowrap rounded-[10px] px-3 text-[15px] font-semibold", x === tab ? "bg-tint text-primary" : "text-adm-strong hover:bg-adm-bg")}
                >
                  {t(`admin.entries.tabs.${x}`)}
                  <span className={cx("min-w-6 rounded-[7px] px-1.5 text-center text-[12.5px] font-bold tabular-nums", x === tab ? "bg-surface" : "bg-[#f0f1f4]")}>
                    {num(x === "recent" ? all.length : x === "duplicates" ? pairs.length : winners.length)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        {tab !== "duplicates" && (
          <form action="/admin/entries" className="flex flex-wrap gap-2">
            {tab !== "recent" && <input type="hidden" name="tab" value={tab} />}
            <label className="relative min-w-0 flex-[1_1_260px]">
              <span className="sr-only">{t("admin.entries.search")}</span>
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-adm-soft">
                <AdminIcon name="search" />
              </span>
              <input type="search" name="q" defaultValue={str(sp.q)} placeholder={t("admin.entries.searchHint")} className={cx(ADM_INPUT, "h-11 pl-10")} />
            </label>
            <label className="flex-[0_1_200px]">
              <span className="sr-only">{t("admin.contests.contest")}</span>
              <select name="contest" defaultValue={contest} className={cx(ADM_INPUT, "h-11")}>
                <option value="">{t("admin.entries.allContests")}</option>
                {contests.map(([slug, brand]) => (
                  <option key={slug} value={slug}>
                    {brand}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex-[0_1_180px]">
              <span className="sr-only">{t("admin.contests.sort")}</span>
              <select name="sort" defaultValue={sort} className={cx(ADM_INPUT, "h-11")}>
                {SORTS.map((x) => (
                  <option key={x} value={x}>
                    {t(`admin.entries.sorts.${x}`)}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="h-11 rounded-[12px] bg-primary px-5 text-[15px] font-bold text-white hover:bg-adm-deep">
              {t("admin.filter")}
            </button>
          </form>
        )}
      </AdmCard>

      {tab === "duplicates" ? (
        pairs.length === 0 ? null : (
          <ul className="m-0 flex list-none flex-col gap-4 p-0">
            {pairs.map(({ entry, original }) => (
              <AdmCard key={entry.id} as="li" className="grid gap-4 p-4 sm:p-5 md:grid-cols-[1fr_1fr_14rem]">
                <div>
                  <p className="m-0 mb-2 text-xs font-bold uppercase tracking-[0.08em] text-primary">{t("admin.entries.newDesign")}</p>
                  <EntryThumb entry={entry} />
                </div>
                <div>
                  <p className="m-0 mb-2 text-xs font-bold uppercase tracking-[0.08em] text-muted">{t("admin.entries.looksLike")}</p>
                  <EntryThumb entry={original} />
                </div>
                <div className="flex flex-col gap-2">
                  <AdminAction label={t("admin.entries.remove")} body={t("admin.entries.removeBody")} tone="danger" run={removeEntry.bind(null, entry.id)} />
                  <AdminAction label={t("admin.entries.notCopy")} body={t("admin.entries.notCopyBody")} fields={[]} run={clearDuplicate.bind(null, entry.id)} />
                </div>
              </AdmCard>
            ))}
          </ul>
        )
      ) : filtered.length === 0 ? (
        <AdmCard className="p-5">
          <p className="m-0 rounded-[12px] bg-adm-bg px-4 py-8 text-center text-[15px] text-muted">{t("admin.entries.none")}</p>
        </AdmCard>
      ) : (
        <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-[repeat(auto-fill,minmax(min(100%,270px),1fr))]">{filtered.map(card)}</ul>
      )}

      {(tab === "duplicates" || pairs.length === 0) && (
        <AdmCard className="flex flex-wrap items-center gap-[18px] px-5 py-[22px] sm:px-6">
          <span className="flex size-[52px] shrink-0 items-center justify-center rounded-[14px] bg-adm-good-bg text-adm-good">
            <AdminIcon name="checker" size={22} />
          </span>
          <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-1">
            <h2 className="m-0 text-[19px] font-semibold tracking-[-0.02em]">{pairs.length ? t("admin.entries.howTitle") : t("admin.entries.noDuplicates")}</h2>
            <p className="m-0 text-[15px] text-muted">{t("admin.entries.howBody")}</p>
          </div>
          <Link href="/admin/claims" className="inline-flex h-[46px] items-center rounded-[12px] border border-adm-line px-[18px] text-[15px] font-bold text-adm-strong hover:border-primary hover:text-primary">
            {t("admin.entries.openClaims")}
          </Link>
        </AdmCard>
      )}
    </div>
  );
}
