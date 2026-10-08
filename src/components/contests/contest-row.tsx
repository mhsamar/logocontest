import Link from "next/link";
import type { ContestRow as Row } from "@/lib/contests/browse";
import { timeAgo } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import { formatNumber, formatTaka } from "@/lib/money";
import { cx } from "@/lib/cx";
import { BrandTile, PackagePill, PRIZE_TEXT, StatusLine, UpgradePills, contestTitle } from "./contest-bits";
import { SaveButton } from "./save-button";

/**
 * P-02 list row (UI-JOURNEY, second reference): big tile, name with package
 * pill, meta and description, then prize and entries boxes with the status line.
 * `saved` is set only for designers, who get the heart.
 */
export async function ContestRow({ contest, now, saved }: { contest: Row; now: Date; saved?: boolean }) {
  const { t, locale } = await getI18n();
  const title = contestTitle(contest, t);
  const meta = [t(`wizard.businessTypes.${contest.businessType}`), contest.startsAt && t("browse.started", { ago: timeAgo(contest.startsAt, now, locale) })]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-lg bg-surface shadow-card ring-1 ring-line transition-shadow hover:shadow-raised sm:flex-row">
      <div className="hidden w-40 shrink-0 sm:flex lg:w-48">
        <BrandTile name={contest.brandName} isPrivate={contest.isPrivate} cover={contest.cover} flat className="h-full w-full text-[1.6rem]" />
      </div>

      <div className="min-w-0 flex-1 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <BrandTile name={contest.brandName} isPrivate={contest.isPrivate} cover={contest.cover} className="size-16 text-[0.9rem] sm:hidden" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
              <h3 className="min-w-0 text-base font-semibold text-ink group-hover:text-primary sm:text-lg">
                {/* Stretched link: the whole row opens the contest; the heart stays its own button. */}
                <Link href={`/contest/${contest.slug}`} className="after:absolute after:inset-0">
                  {title}
                </Link>
              </h3>
              <PackagePill pkg={contest.package} t={t} />
              <UpgradePills contest={contest} t={t} />
            </div>
            <p className="mt-1 text-sm text-muted">{meta}</p>
          </div>
          {saved !== undefined && <SaveButton contestId={contest.id} saved={saved} className="relative z-10 -mr-1 -mt-1 shrink-0" />}
        </div>
        {contest.description && <p className="mt-3 line-clamp-2 text-[0.9375rem] leading-relaxed text-ink/80">{contest.description}</p>}
      </div>

      <div className="flex shrink-0 flex-col justify-center gap-3 border-t border-line p-4 sm:w-64 sm:border-l sm:border-t-0 sm:p-5">
        <dl className="grid grid-cols-2 gap-2">
          <div className="flex flex-col-reverse rounded-md bg-canvas px-3 py-2.5 text-center">
            <dt className="mt-0.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted">{t(`wizard.packages.${contest.package}.name`)}</dt>
            <dd className={cx("text-xl font-extrabold leading-tight tabular-nums", PRIZE_TEXT)}>{formatTaka(contest.prize, locale)}</dd>
          </div>
          <div className="flex flex-col-reverse rounded-md bg-canvas px-3 py-2.5 text-center">
            <dt className="mt-0.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted">{t("contest.stats.designs")}</dt>
            <dd className="text-xl font-bold leading-tight text-ink tabular-nums">{formatNumber(contest.entries, locale)}</dd>
          </div>
        </dl>
        <StatusLine contest={contest} now={now} t={t} locale={locale} />
      </div>
    </article>
  );
}
