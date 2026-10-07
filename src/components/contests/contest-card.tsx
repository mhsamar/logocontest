import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { formatTaka } from "@/lib/money";
import type { BusinessType } from "@/lib/contests/brief";
import { CountdownPill, timeLeft } from "./countdown-pill";

export type ContestCardData = {
  slug: string;
  brandName: string;
  businessType: BusinessType;
  prize: number;
  endsAt: Date;
  isBlind: boolean;
  isPrivate: boolean;
  isPromoted: boolean;
};

/**
 * Contest card (UI-JOURNEY §1.3). Private contests show "Private contest" with a
 * lock and no brand name. Entry and designer counts arrive with milestone 4.
 */
export async function ContestCard({ contest, now }: { contest: ContestCardData; now: Date }) {
  const { t, locale } = await getI18n();
  const left = timeLeft(contest.endsAt, now);
  const badges = [
    contest.isPromoted && t("home.card.promoted"),
    contest.isBlind && t("home.card.blind"),
    contest.isPrivate && t("home.card.private"),
  ].filter(Boolean) as string[];

  return (
    <Link
      href={`/contest/${contest.slug}`}
      className="group flex h-full flex-col rounded-lg bg-surface p-4 shadow-card ring-1 ring-line transition-shadow hover:shadow-raised"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate font-semibold text-ink group-hover:text-primary">
          {contest.isPrivate ? (
            <span className="inline-flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" />
              </svg>
              {t("home.card.privateTitle")}
            </span>
          ) : (
            contest.brandName
          )}
        </p>
      </div>
      <p className="mt-0.5 text-sm text-muted">{t(`wizard.businessTypes.${contest.businessType}`)}</p>
      <p className="mt-4 text-2xl font-bold text-accent tabular-nums">{formatTaka(contest.prize, locale)}</p>
      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-4">
        <CountdownPill
          endsAt={contest.endsAt}
          now={now}
          labels={{
            days: t("home.card.daysLeft", { days: left.days }),
            hours: t("home.card.hoursLeft", { hours: left.hours }),
            ended: t("home.card.ended"),
          }}
        />
        {badges.map((b) => (
          <span key={b} className="rounded-full bg-cream px-2.5 py-1 text-xs font-semibold text-primary-dark">
            {b}
          </span>
        ))}
      </div>
    </Link>
  );
}
