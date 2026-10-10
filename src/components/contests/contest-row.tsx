import Link from "next/link";
import type { ContestRow as Row } from "@/lib/contests/browse";
import { timeAgo } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import { formatNumber, formatTaka } from "@/lib/money";
import { cx } from "@/lib/cx";
import { BrandTile, ContestNumber, PackagePill, PRIZE_TEXT, StatusLine, UpgradePills, contestTitle } from "./contest-bits";
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
    <article
      className={cx(
        "lc-card group relative flex flex-col gap-2.5 overflow-hidden p-2.5 transition-shadow hover:shadow-card sm:flex-row",
        contest.isHighlighted && "!border-2 !border-[#f1c75c]",
      )}
    >
      <div className="hidden w-40 shrink-0 overflow-hidden rounded-[20px] sm:flex lg:w-48">
        <BrandTile name={contest.brandName} isPrivate={contest.isPrivate} cover={contest.cover} flat className="h-full w-full text-[1.6rem]" />
      </div>

      <div className="min-w-0 flex-1 p-2.5 sm:p-3">
        <div className="flex items-start gap-3">
          <BrandTile name={contest.brandName} isPrivate={contest.isPrivate} cover={contest.cover} className="size-16 text-[0.9rem] sm:hidden" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
              <h3 className="m-0 min-w-0 text-lg font-semibold tracking-[-0.02em] text-ink group-hover:text-primary sm:text-xl">
                {/* Stretched link: the whole row opens the contest; the heart stays its own button. */}
                <Link href={`/contest/${contest.slug}`} className="after:absolute after:inset-0">
                  {title}
                </Link>
              </h3>
              <PackagePill pkg={contest.package} t={t} />
              <ContestNumber n={contest.number} t={t} locale={locale} />
              <UpgradePills contest={contest} t={t} />
            </div>
            <p className="m-0 mt-1 text-[15px] text-muted">{meta}</p>
          </div>
          {saved !== undefined && <SaveButton contestId={contest.id} saved={saved} className="relative z-10 -mr-1 -mt-1 shrink-0" />}
        </div>
        {contest.description && <p className="m-0 mt-3 line-clamp-2 text-[15px] leading-relaxed text-muted">{contest.description}</p>}
      </div>

      <div className="flex shrink-0 flex-col justify-center gap-3 rounded-[20px] bg-frame p-3.5 sm:w-64">
        <dl className="grid grid-cols-2 gap-2">
          <div className="flex flex-col-reverse rounded-[14px] bg-surface px-3 py-2.5 text-center">
            <dt className="mt-0.5 text-xs font-semibold text-muted">{t(`wizard.packages.${contest.package}.name`)}</dt>
            <dd className={cx("m-0 text-2xl font-semibold leading-tight tabular-nums", PRIZE_TEXT)}>{formatTaka(contest.prize, locale)}</dd>
          </div>
          <div className="flex flex-col-reverse rounded-[14px] bg-surface px-3 py-2.5 text-center">
            <dt className="mt-0.5 text-xs font-semibold text-muted">{t("contest.stats.designs")}</dt>
            <dd className="lc-d m-0 text-2xl font-semibold leading-tight text-ink tabular-nums">{formatNumber(contest.entries, locale)}</dd>
          </div>
        </dl>
        <StatusLine contest={contest} now={now} t={t} locale={locale} />
      </div>
    </article>
  );
}
