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
        "group relative flex h-full flex-col overflow-hidden rounded-2xl bg-surface transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-raised",
        // Highlight add-on (owner, 2026-10-08): gold border with a soft glow.
        contest.isHighlighted ? "prize-glow ring-2 ring-[#f1c75c]" : "shadow-card ring-1 ring-line",
      )}
    >
      <div className="relative aspect-[4/3]">
        <BrandTile name={contest.brandName} isPrivate={contest.isPrivate} cover={contest.cover} flat className="h-full w-full text-[1.05rem] sm:text-[1.6rem]" />
        {contest.isPromoted && (
          <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[0.6875rem] font-semibold text-white sm:left-3 sm:top-3">
            <svg viewBox="0 0 24 24" className="size-3" fill="currentColor" aria-hidden>
              <path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7Z" />
            </svg>
            {t("contest.featured")}
          </span>
        )}
        <div className="absolute right-2.5 top-2.5 flex flex-col items-end gap-1 sm:right-3 sm:top-3">
          {contest.isUrgent && <UrgentBadge label={t("home.card.urgent")} />}
          {contest.isHighlighted && <HighlightBadge label={t("home.card.highlighted")} />}
        </div>
      </div>

      <div className="flex flex-1 flex-col border-t border-line p-3 sm:p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <PackagePill pkg={contest.package} t={t} />
            <ContestNumber n={contest.number} t={t} locale={locale} />
            {outline.map((o) => (
              <span key={o} className="rounded px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wider text-primary ring-1 ring-inset ring-primary/40">
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
        <h3 className="mt-2 truncate font-semibold text-ink group-hover:text-primary sm:text-lg">
          {/* Stretched link: the whole card opens the contest. */}
          <Link href={`/contest/${contest.slug}`} className="after:absolute after:inset-0">
            {contestTitle(contest, t)}
          </Link>
        </h3>
        <p className="truncate text-xs text-muted sm:text-sm">{t(`wizard.businessTypes.${contest.businessType}`)}</p>

        <div className="mt-auto pt-3">
          <div className="flex items-end justify-between gap-2">
            <p className={cx("text-lg font-extrabold leading-none tabular-nums sm:text-2xl", PRIZE_TEXT)}>{formatTaka(contest.prize, locale)}</p>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-canvas px-2 py-1 text-xs font-semibold text-ink ring-1 ring-line">
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
