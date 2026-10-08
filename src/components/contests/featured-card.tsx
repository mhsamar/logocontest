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
    <div className="featured-frame group h-full rounded-[1.6rem] p-[2px] shadow-card transition-[box-shadow,translate] duration-300 hover:-translate-y-1 hover:shadow-raised">
      <article className="relative flex h-full flex-col overflow-clip rounded-[1.5rem] bg-surface">
        {/* The logo fills the top */}
        <div className="relative aspect-[4/3] overflow-clip bg-cream/40">
          <BrandTile
            name={contest.brandName}
            isPrivate={contest.isPrivate}
            cover={contest.cover}
            flat
            className="h-full w-full text-[2.4rem] transition-transform duration-700 ease-out group-hover:scale-[1.06]"
          />
          <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#f4bd2f] to-[#c9860a] px-3 py-1 text-xs font-bold uppercase tracking-wide text-white shadow-raised">
            <svg viewBox="0 0 24 24" className="size-3.5 animate-[wiggle_2.4s_ease-in-out_infinite]" fill="currentColor" aria-hidden>
              <path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7Z" />
            </svg>
            {t("contest.featured")}
          </span>
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

        <div className="flex flex-1 flex-col p-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <PackagePill pkg={contest.package} t={t} />
            <ContestNumber n={contest.number} t={t} locale={locale} />
            {contest.isBlind && <span className="rounded px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wider text-primary ring-1 ring-inset ring-primary/40">{t("home.card.blind")}</span>}
            {secret && <span className="rounded px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wider text-primary ring-1 ring-inset ring-primary/40">{secret}</span>}
          </div>

          <h3 className="mt-2 truncate text-2xl font-bold leading-tight tracking-tight text-ink transition-colors group-hover:text-primary">
            {/* Stretched link: the whole card opens the contest; the heart stays its own button. */}
            <Link href={`/contest/${contest.slug}`} className="after:absolute after:inset-0">
              {contestTitle(contest, t)}
            </Link>
          </h3>
          <p className="truncate text-sm text-muted">{t(`wizard.businessTypes.${contest.businessType}`)}</p>

          {/* Prize: shining gold on a dark band, with the way in */}
          <div className="relative mt-3 flex items-center justify-between gap-3 overflow-clip rounded-2xl bg-gradient-to-r from-[#1f0a05] via-[#3a1208] to-primary-dark px-4 py-3 shadow-card">
            <span className="pointer-events-none absolute -right-6 -top-8 size-24 rounded-full bg-[#f4bd2f]/20 blur-2xl" aria-hidden />
            <div className="relative min-w-0">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[#f6d98b]">{t("browse.featuredCard.prize")}</p>
              <p className={cx("truncate text-[1.75rem] font-extrabold leading-tight tabular-nums tracking-tight", PRIZE_TEXT)}>{formatTaka(contest.prize, locale)}</p>
            </div>
            <span className="relative inline-flex shrink-0 items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-white/20 transition-colors group-hover:bg-white group-hover:text-ink">
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
