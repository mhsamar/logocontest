import { cx } from "@/lib/cx";
import type { ContestRow } from "@/lib/contests/browse";
import type { PackageKey } from "@/lib/contests/brief";
import { WinnerTrophy } from "@/components/ui/trophy";
import type { ContestCover } from "@/lib/entries/queries";
import { formatDate } from "@/lib/dates";
import type { Locale } from "@/lib/i18n/config";
import type { Translate } from "@/lib/i18n/translate";
import { formatContestNumber } from "@/lib/contests/number";
import { timeLeft } from "./countdown-pill";

export function LockIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

/**
 * The contest's picture (owner, 2026-10-08): its leading design (the winner gets a
 * small trophy), else the brand's first letter, or a lock for private contests.
 */
export function BrandTile({
  name,
  isPrivate,
  cover,
  flat,
  className,
}: {
  name: string;
  isPrivate: boolean;
  cover?: ContestCover | null;
  flat?: boolean;
  className?: string;
}) {
  const letter = name.trim().charAt(0).toUpperCase() || "•";
  if (cover && !isPrivate) {
    return (
      <div className={cx("relative shrink-0 overflow-hidden bg-white", !flat && "rounded-lg ring-1 ring-inset ring-line", className)} aria-hidden>
        {/* Preview from storage */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cover.url} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
        {cover.isWinner && <WinnerTrophy size="sm" className="absolute right-2 top-2" />}
      </div>
    );
  }
  return (
    <div
      className={cx(
        "flex shrink-0 items-center justify-center overflow-hidden",
        // flat: fills a panel edge to edge (list rows), so no corners or ring of its own.
        !flat && "rounded-[18px]",
        isPrivate ? "bg-[image:var(--gradient-red-dark)] text-white" : "bg-[#F4EFE4] text-[#7A1E12]",
        className,
      )}
      aria-hidden
    >
      {isPrivate ? <LockIcon className="size-1/3" /> : <span className="text-[2.4em] font-medium leading-none" style={{ fontFamily: "Georgia, serif" }}>{letter}</span>}
    </div>
  );
}

/** Prize amount: brand red in the heading font (site design, owner 2026-10-10). */
export const PRIZE_TEXT = "lc-d text-primary tracking-[-0.03em]";

/** Contest name for public lists: private contests never show theirs. */
export function contestTitle(c: Pick<ContestRow, "brandName" | "isPrivate">, t: Translate) {
  return c.isPrivate ? t("home.card.privateTitle") : c.brandName;
}

const PACKAGE_PILL: Record<PackageKey, string> = {
  economy: "bg-chip text-ink",
  standard: "bg-ink text-white",
  pro: "bg-ink text-white",
  premium: "bg-tint text-primary",
  elite: "bg-tint text-primary",
  custom: "bg-tint text-primary",
};

/** Package chip (site design, owner 2026-10-10): Starter grey, Growth and Pro dark, Premium, Elite and Custom red tint. */
export function PackagePill({ pkg, t }: { pkg: PackageKey; t: Translate }) {
  return (
    <span className={cx("rounded-lg px-2.5 py-1 text-[13px] font-bold", PACKAGE_PILL[pkg])}>
      {t(`wizard.packages.${pkg}.name`)}
    </span>
  );
}

type BadgeFlags = Pick<ContestRow, "isPromoted" | "isBlind" | "isPrivate"> & Partial<Pick<ContestRow, "isHighlighted" | "isUrgent" | "isNda">>;

/** Labels for the add-ons a contest has, in display order (NDA stands in for Private). */
function addonLabels(contest: BadgeFlags, t: Translate): string[] {
  return [
    contest.isUrgent && t("home.card.urgent"),
    contest.isPromoted && t("contest.featured"),
    contest.isHighlighted && t("home.card.highlighted"),
    contest.isBlind && t("home.card.blind"),
    contest.isNda ? t("home.card.nda") : contest.isPrivate && t("home.card.private"),
  ].filter(Boolean) as string[];
}

/** Outline pills for the upgrades. */
export function UpgradePills({ contest, t }: { contest: BadgeFlags; t: Translate }) {
  const pills = addonLabels(contest, t);
  return pills.map((p) => (
    <span key={p} className="rounded-full bg-chip px-2.5 py-0.5 text-[13px] font-bold text-ink">
      {p}
    </span>
  ));
}

export function ContestBadges({ contest, t, className }: { contest: BadgeFlags; t: Translate; className?: string }) {
  const badges = addonLabels(contest, t);
  if (badges.length === 0) return null;
  return (
    <span className={cx("flex flex-wrap gap-1.5", className)}>
      {badges.map((b) => (
        <span key={b} className="rounded-full bg-tint px-2.5 py-1 text-[13px] font-bold text-primary">
          {b}
        </span>
      ))}
    </span>
  );
}

/**
 * The line under the prize (UI-JOURNEY P-02): time left with a thin progress bar
 * while open, otherwise where the contest is.
 */
export function StatusLine({
  contest,
  now,
  t,
  locale,
}: {
  contest: { status: string; startsAt: Date | null; endsAt: Date | null; judgingEndsAt: Date | null };
  now: Date;
  t: Translate;
  locale: Locale;
}) {
  if (contest.status === "open" && contest.endsAt) {
    const left = timeLeft(contest.endsAt, now);
    const ms = contest.endsAt.getTime() - now.getTime();
    const soon = ms > 0 && ms < 86_400_000;
    const total = contest.startsAt ? contest.endsAt.getTime() - contest.startsAt.getTime() : 0;
    const done = total > 0 ? Math.min(1, Math.max(0, 1 - ms / total)) : 0;
    return (
      <div className="w-full">
        <p className={cx("text-sm font-semibold", soon ? "text-warning" : "text-ink")}>
          {ms <= 0 ? t("home.card.ended") : soon ? t("home.card.hoursLeft", { hours: left.hours }) : t("home.card.daysLeft", { days: left.days })}
        </p>
        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-line" aria-hidden>
          <div className={cx("bar-fill h-full rounded-full", soon ? "bg-warning" : "bg-primary")} style={{ width: `${Math.round(done * 100)}%` }} />
        </div>
      </div>
    );
  }
  if (contest.status === "judging") {
    const by = contest.judgingEndsAt ?? contest.endsAt;
    return <p className="text-sm font-semibold text-warning">{t("browse.line.judging", { date: by ? formatDate(by, locale, "short") : "—" })}</p>;
  }
  const tone =
    contest.status === "completed" ? "text-success" : contest.status === "cancelled" ? "text-danger" : contest.status === "no_result" ? "text-muted" : "text-info";
  return (
    <p className={cx("flex items-center gap-1.5 text-sm font-semibold", tone)}>
      {contest.status === "completed" && (
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M8 12.5l2.5 2.5L16 9.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {t(`browse.line.${contest.status as "winner_selected" | "handover" | "completed" | "no_result" | "cancelled"}`)}
    </p>
  );
}

/** Urgent add-on: a red badge with a pulsing dot (owner, 2026-10-08). */
export function UrgentBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-1 text-[13px] font-bold text-white">
      <span className="relative flex size-1.5" aria-hidden>
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-white/80" />
        <span className="relative inline-flex size-1.5 rounded-full bg-white" />
      </span>
      {label}
    </span>
  );
}

/** Highlight add-on: a gold badge (owner, 2026-10-08). */
export function HighlightBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gold px-2.5 py-1 text-[13px] font-bold text-gold-ink">
      <svg viewBox="0 0 24 24" className="size-3" fill="currentColor" aria-hidden>
        <path d="M12 2l2.2 6.8H21l-5.5 4 2.1 6.7L12 15.4l-5.6 4.1 2.1-6.7L3 8.8h6.8Z" />
      </svg>
      {label}
    </span>
  );
}

/** "Contest #00001" (owner, 2026-10-08): nothing until the contest is published and numbered. */
export function ContestNumber({ n, t, locale, className }: { n: number | null; t: Translate; locale: Locale; className?: string }) {
  if (n == null) return null;
  return (
    <span className={cx("inline-flex items-center rounded-md bg-ink/[0.06] px-1.5 py-0.5 font-mono text-[0.6875rem] font-semibold tracking-wide text-ink/75 ring-1 ring-inset ring-ink/10", className)}>
      {t("contest.number", { n: formatContestNumber(n, locale) })}
    </span>
  );
}
