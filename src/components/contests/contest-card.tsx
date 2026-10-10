import Link from "next/link";
import type { ContestRow } from "@/lib/contests/browse";
import { Avatar } from "@/components/ui/avatar";
import { getI18n } from "@/lib/i18n/server";
import { formatNumber, formatTaka } from "@/lib/money";
import { cx } from "@/lib/cx";
import { BrandTile, ContestNumber, HighlightBadge, PackagePill, PRIZE_TEXT, StatusLine, UrgentBadge, contestTitle } from "./contest-bits";

/**
 * Contest card (UI-JOURNEY §1.3), used in grids such as the home page. Private
 * contests show "Private contest" with a lock and no brand name.
 */
export async function ContestCard({ contest, now }: { contest: ContestRow; now: Date }) {
  const { t, locale } = await getI18n();
  const outline = [contest.isBlind && t("home.card.blind"), contest.isNda ? t("home.card.nda") : contest.isPrivate && t("home.card.private")].filter(Boolean) as string[];

  return (
    <article
      className={cx(
        "lc-card group relative flex h-full flex-col p-2.5 transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-card",
        // Highlight add-on (owner, 2026-10-08): gold border.
        contest.isHighlighted && "!border-2 !border-[#f1c75c]",
      )}
    >
      <div className="relative aspect-[16/10] overflow-hidden rounded-[20px]">
        <BrandTile name={contest.brandName} isPrivate={contest.isPrivate} cover={contest.cover} flat className="h-full w-full text-[1.05rem] sm:text-[1.6rem]" />
        {contest.isPromoted && (
          <span className="absolute left-3 top-3 rounded-full border border-line bg-surface px-2.5 py-1 text-[13px] font-bold text-ink">{t("contest.featured")}</span>
        )}
        <div className="absolute right-2.5 top-2.5 flex flex-col items-end gap-1 sm:right-3 sm:top-3">
          {contest.isUrgent && <UrgentBadge label={t("home.card.urgent")} />}
          {contest.isHighlighted && <HighlightBadge label={t("home.card.highlighted")} />}
        </div>
      </div>

      <div className="flex flex-1 flex-col px-3 pb-3 pt-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <PackagePill pkg={contest.package} t={t} />
            <ContestNumber n={contest.number} t={t} locale={locale} />
            {outline.map((o) => (
              <span key={o} className="rounded-full bg-chip px-2.5 py-0.5 text-[13px] font-bold text-ink">
                {o}
              </span>
            ))}
          </div>
          {/* Who took part (owner, 2026-10-08): faces of real designers, never for blind or private contests */}
          {contest.faces.list.length > 0 && (
            <div className="flex shrink-0" aria-label={t("contest.glance.designers", { n: formatNumber(contest.faces.total, locale) })}>
              {contest.faces.list.map((d, i) => (
                <Avatar key={`${d.username ?? d.name}-${i}`} name={d.name} url={d.avatarUrl} tone="cream" className={cx("size-7 text-[0.625rem] ring-2 ring-white", i > 0 && "-ml-2")} />
              ))}
              {contest.faces.total > contest.faces.list.length && (
                <span className="-ml-2 flex size-7 items-center justify-center rounded-full bg-primary text-[0.625rem] font-bold text-white ring-2 ring-white">
                  +{formatNumber(contest.faces.total - contest.faces.list.length, locale)}
                </span>
              )}
            </div>
          )}
        </div>
        <h3 className="m-0 mt-2.5 truncate text-xl font-semibold tracking-[-0.03em] text-ink group-hover:text-primary">
          {/* Stretched link: the whole card opens the contest. */}
          <Link href={`/contest/${contest.slug}`} className="after:absolute after:inset-0">
            {contestTitle(contest, t)}
          </Link>
        </h3>
        <p className="m-0 truncate text-[15px] text-muted">{t(`wizard.businessTypes.${contest.businessType}`)}</p>

        <div className="mt-auto border-t border-line-soft pt-3.5">
          <div className="flex items-end justify-between gap-2">
            <p className={cx("m-0 text-[28px] font-semibold leading-none tabular-nums sm:text-[32px]", PRIZE_TEXT)}>{formatTaka(contest.prize, locale)}</p>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-chip px-2.5 py-1 text-[13px] font-bold text-ink">
              <svg viewBox="0 0 24 24" className="size-3.5 text-primary" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="3" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="3" width="7" height="7" rx="1.5" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" />
              </svg>
              {contest.entries === 1 ? t("browse.oneDesign") : t("browse.designs", { count: formatNumber(contest.entries, locale) })}
            </span>
          </div>
          <div className="mt-3 text-xs sm:text-sm">
            <StatusLine contest={contest} now={now} t={t} locale={locale} />
          </div>
        </div>
      </div>
    </article>
  );
}
