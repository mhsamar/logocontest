import Link from "next/link";
import type { ContestRow } from "@/lib/contests/browse";
import { getI18n } from "@/lib/i18n/server";
import { formatTaka } from "@/lib/money";
import { BrandTile, PackagePill, StatusLine, contestTitle } from "./contest-bits";

/**
 * Contest card (UI-JOURNEY §1.3), used in grids such as the home page. Private
 * contests show "Private contest" with a lock and no brand name.
 */
export async function ContestCard({ contest, now }: { contest: ContestRow; now: Date }) {
  const { t, locale } = await getI18n();
  const outline = [contest.isBlind && t("home.card.blind"), contest.isPrivate && t("home.card.private")].filter(Boolean) as string[];

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-line transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-raised">
      <div className="relative aspect-[4/3]">
        <BrandTile name={contest.brandName} isPrivate={contest.isPrivate} flat className="h-full w-full text-[1.05rem] sm:text-[1.6rem]" />
        {contest.isPromoted && (
          <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[0.6875rem] font-semibold text-white sm:left-3 sm:top-3">
            <svg viewBox="0 0 24 24" className="size-3" fill="currentColor" aria-hidden>
              <path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7Z" />
            </svg>
            {t("contest.featured")}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col border-t border-line p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <PackagePill pkg={contest.package} t={t} />
          {outline.map((o) => (
            <span key={o} className="rounded px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wider text-primary ring-1 ring-inset ring-primary/40">
              {o}
            </span>
          ))}
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
            <p className="text-lg font-bold leading-none text-accent tabular-nums sm:text-2xl">{formatTaka(contest.prize, locale)}</p>
            <p className="shrink-0 text-xs text-muted">{t("browse.designs", { count: contest.entries })}</p>
          </div>
          <div className="mt-3 text-xs sm:text-sm">
            <StatusLine contest={contest} now={now} t={t} locale={locale} />
          </div>
        </div>
      </div>
    </article>
  );
}
