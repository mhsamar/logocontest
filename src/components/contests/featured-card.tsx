import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import type { ContestRow } from "@/lib/contests/browse";
import { cx } from "@/lib/cx";
import { getI18n } from "@/lib/i18n/server";
import { formatNumber, formatTaka } from "@/lib/money";
import { BrandTile, ContestNumber, PackagePill, PRIZE_TEXT, UrgentBadge, contestTitle } from "./contest-bits";
import { timeLeft } from "./countdown-pill";
import { SaveButton } from "./save-button";

/**
 * P-02 "Featured contests" card (Promoted upgrade). Owner, 2026-10-08: it stands out from the other
 * cards — a moving gold frame, the logo filling the top, a big name, the prize in shining gold on a
 * dark band, and one short line with designs, designers and time left. Kept short.
 */
export async function FeaturedCard({ contest, now, saved }: { contest: ContestRow; now: Date; saved?: boolean }) {
  const { t, locale } = await getI18n();
  const fmt = (n: number) => formatNumber(n, locale);
  const open = contest.status === "open" && contest.endsAt !== null && contest.endsAt > now;
  const left = open ? timeLeft(contest.endsAt!, now) : null;
  const soon = open && contest.endsAt!.getTime() - now.getTime() < 86_400_000;
  const total = contest.startsAt && contest.endsAt ? contest.endsAt.getTime() - contest.startsAt.getTime() : 0;
  const done = total > 0 ? Math.min(1, Math.max(0, (now.getTime() - contest.startsAt!.getTime()) / total)) : 0;
  const secret = contest.isNda ? t("home.card.nda") : contest.isPrivate ? t("home.card.private") : null;

  return (
    // Gold frame that slowly flows around the card
    <div className="lc-card group h-full p-2.5 transition-[box-shadow,translate] duration-300 hover:-translate-y-1 hover:shadow-card">
      <article className="relative flex h-full flex-col">
        {/* The logo fills the top */}
        <div className="relative aspect-[16/10] overflow-clip rounded-[20px] bg-tile">
          <BrandTile
            name={contest.brandName}
            isPrivate={contest.isPrivate}
            cover={contest.cover}
            flat
            className="h-full w-full text-[2.4rem] transition-transform duration-700 ease-out group-hover:scale-[1.06]"
          />
          <span className="absolute left-3 top-3 rounded-full border border-line bg-surface px-2.5 py-1 text-[13px] font-bold text-ink">{t("contest.featured")}</span>
          {contest.isUrgent && (
            <span className="absolute bottom-4 left-3">
              <UrgentBadge label={t("home.card.urgent")} />
            </span>
          )}
          {saved !== undefined && <SaveButton contestId={contest.id} saved={saved} className="absolute right-3 top-3 z-10" />}
          {/* Time used, as a thin bar along the bottom of the picture */}
          {open && (
            <span className="absolute inset-x-0 bottom-0 h-1 bg-white/60" aria-hidden>
              <span className={cx("bar-fill block h-full", soon ? "bg-warning" : "bg-primary")} style={{ width: `${Math.round(done * 100)}%` }} />
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col px-3.5 pb-3.5 pt-5">
          <div className="flex flex-wrap items-center gap-1.5">
            <PackagePill pkg={contest.package} t={t} />
            <ContestNumber n={contest.number} t={t} locale={locale} />
            {contest.isBlind && <span className="rounded-full bg-chip px-2.5 py-0.5 text-[13px] font-bold text-ink">{t("home.card.blind")}</span>}
            {secret && <span className="rounded-full bg-chip px-2.5 py-0.5 text-[13px] font-bold text-ink">{secret}</span>}
          </div>

          <h3 className="m-0 mt-2.5 truncate text-[23px] font-semibold leading-tight tracking-[-0.03em] text-ink transition-colors group-hover:text-primary">
            {/* Stretched link: the whole card opens the contest; the heart stays its own button. */}
            <Link href={`/contest/${contest.slug}`} className="after:absolute after:inset-0">
              {contestTitle(contest, t)}
            </Link>
          </h3>
          <p className="m-0 truncate text-base text-muted">{t(`wizard.businessTypes.${contest.businessType}`)}</p>

          {/* Prize: shining gold on a dark band, with the way in */}
          <div className="mt-4 flex items-end justify-between gap-3 border-t border-line-soft pt-4">
            <div className="min-w-0">
              <p className="m-0 text-xs font-semibold text-muted">{t("browse.featuredCard.prize")}</p>
              <p className={cx("m-0 truncate text-[36px] font-semibold leading-none tabular-nums", PRIZE_TEXT)}>{formatTaka(contest.prize, locale)}</p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-tint px-3 py-1.5 text-[13px] font-bold text-primary transition-colors group-hover:bg-primary group-hover:text-white">
              {open ? (contest.entries === 0 ? t("browse.featuredCard.beFirst") : t("browse.featuredCard.cta")) : t("browse.featuredCard.ctaClosed")}
              <svg viewBox="0 0 24 24" className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </span>
          </div>

          {/* One short line: designs · designers · time left */}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-ink">
            <span className="inline-flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" className="size-4 text-primary" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="3" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="3" width="7" height="7" rx="1.5" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" />
              </svg>
              <b className="tabular-nums">{fmt(contest.entries)}</b>
              <span className="text-muted">{contest.entries === 1 ? t("browse.featuredCard.designOne") : t("browse.featuredCard.designs")}</span>
            </span>
            {contest.faces.total > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <span className="flex">
                  {contest.faces.list.map((d, i) => (
                    <Avatar key={`${d.username ?? d.name}-${i}`} name={d.name} url={d.avatarUrl} tone="cream" className={cx("size-6 text-[0.5625rem] ring-2 ring-white", i > 0 && "-ml-1.5")} />
                  ))}
                </span>
                <b className="tabular-nums">{fmt(contest.faces.total)}</b>
                <span className="text-muted">{contest.faces.total === 1 ? t("browse.featuredCard.designerOne") : t("browse.featuredCard.designers")}</span>
              </span>
            )}
            {left && (
              <span className={cx("inline-flex items-center gap-1.5", soon && "text-warning")}>
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <path d="M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <b className="tabular-nums">{soon ? t("home.card.hoursLeft", { hours: fmt(left.hours) }) : t("home.card.daysLeft", { days: fmt(left.days) })}</b>
              </span>
            )}
          </div>
        </div>
      </article>
    </div>
  );
}
