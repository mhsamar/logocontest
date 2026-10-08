import Link from "next/link";
import type { ContestRow } from "@/lib/contests/browse";
import { getI18n } from "@/lib/i18n/server";
import { formatNumber, formatTaka } from "@/lib/money";
import { cx } from "@/lib/cx";
import { BrandTile, PRIZE_TEXT, StatusLine, contestTitle } from "./contest-bits";
import { SaveButton } from "./save-button";

/** P-02 "Featured contests" card (Promoted upgrade). */
export async function FeaturedCard({ contest, now, saved }: { contest: ContestRow; now: Date; saved?: boolean }) {
  const { t, locale } = await getI18n();
  return (
    <article className="group relative flex h-full flex-col items-center rounded-2xl bg-surface p-5 text-center shadow-card ring-1 ring-cream transition-shadow hover:shadow-raised">
      {saved !== undefined && <SaveButton contestId={contest.id} saved={saved} className="absolute right-3 top-3 z-10" />}
      <span className="absolute left-4 top-4 inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-white">
        <svg viewBox="0 0 24 24" className="size-3" fill="currentColor" aria-hidden>
          <path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7Z" />
        </svg>
        {t("contest.featured")}
      </span>
      <BrandTile name={contest.brandName} isPrivate={contest.isPrivate} cover={contest.cover} className="mt-6 size-28 text-[1.5rem]" />
      <h3 className="mt-4 w-full truncate text-lg font-semibold text-ink group-hover:text-primary">
        {/* Stretched link: the whole card opens the contest; the heart stays its own button. */}
        <Link href={`/contest/${contest.slug}`} className="after:absolute after:inset-0">
          {contestTitle(contest, t)}
        </Link>
      </h3>
      <p className="text-sm text-muted">{t(`wizard.businessTypes.${contest.businessType}`)}</p>
      <div className="mt-4 flex w-full items-end justify-between gap-3 border-t border-line pt-4 text-left">
        <div>
          <p className={cx("text-2xl font-extrabold leading-tight tabular-nums", PRIZE_TEXT)}>{formatTaka(contest.prize, locale)}</p>
          <p className="text-xs text-muted">{t("browse.packageName", { name: t(`wizard.packages.${contest.package}.name`) })}</p>
        </div>
        <p className="text-sm text-muted">{contest.entries === 1 ? t("browse.oneDesign") : t("browse.designs", { count: formatNumber(contest.entries, locale) })}</p>
      </div>
      <div className="mt-3 w-full text-left">
        <StatusLine contest={contest} now={now} t={t} locale={locale} />
      </div>
    </article>
  );
}
