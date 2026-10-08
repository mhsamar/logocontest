import { cx } from "@/lib/cx";
import type { ContestRow } from "@/lib/contests/browse";
import type { PackageKey } from "@/lib/contests/brief";
import { WinnerTrophy } from "@/components/ui/trophy";
import type { ContestCover } from "@/lib/entries/queries";
import { formatDate } from "@/lib/dates";
import type { Locale } from "@/lib/i18n/config";
import type { Translate } from "@/lib/i18n/translate";
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
        {/* Watermarked preview from storage */}
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
        !flat && "rounded-lg ring-1 ring-inset",
        isPrivate ? "bg-ink text-cream ring-ink" : "bg-cream/60 text-primary-dark ring-cream",
        className,
      )}
      aria-hidden
    >
      {isPrivate ? <LockIcon className="size-1/3" /> : <span className="font-serif text-[2.4em] font-bold leading-none">{letter}</span>}
    </div>
  );
}

/** Prize amount in metallic gold (owner, 2026-10-08: the flat amber wasn't eye-catching). */
/** Gold prize amount with a shine that sweeps across (globals.css, UI-JOURNEY §1.5). */
export const PRIZE_TEXT = "prize-text";

/** Contest name for public lists: private contests never show theirs. */
export function contestTitle(c: Pick<ContestRow, "brandName" | "isPrivate">, t: Translate) {
  return c.isPrivate ? t("home.card.privateTitle") : c.brandName;
}

const PACKAGE_PILL: Record<PackageKey, string> = {
  economy: "bg-muted text-white",
  standard: "bg-ink text-cream",
  premium: "bg-primary text-white",
  custom: "bg-accent text-white",
};

/** Filled package pill (UI-JOURNEY P-02): Economy grey, Standard ink, Premium red, Custom gold. */
export function PackagePill({ pkg, t }: { pkg: PackageKey; t: Translate }) {
  return (
    <span className={cx("rounded px-2 py-0.5 text-[0.6875rem] font-bold uppercase tracking-wider", PACKAGE_PILL[pkg])}>
      {t(`wizard.packages.${pkg}.name`)}
    </span>
  );
}

/** Outline pills for the upgrades. */
export function UpgradePills({ contest, t }: { contest: Pick<ContestRow, "isPromoted" | "isBlind" | "isPrivate">; t: Translate }) {
  const pills = [
    contest.isPromoted && t("contest.featured"),
    contest.isBlind && t("home.card.blind"),
    contest.isPrivate && t("home.card.private"),
  ].filter(Boolean) as string[];
  return pills.map((p) => (
    <span key={p} className="rounded px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-primary ring-1 ring-inset ring-primary/40">
      {p}
    </span>
  ));
}

export function ContestBadges({ contest, t, className }: { contest: Pick<ContestRow, "isPromoted" | "isBlind" | "isPrivate">; t: Translate; className?: string }) {
  const badges = [
    contest.isPromoted && t("contest.featured"),
    contest.isBlind && t("home.card.blind"),
    contest.isPrivate && t("home.card.private"),
  ].filter(Boolean) as string[];
  if (badges.length === 0) return null;
  return (
    <span className={cx("flex flex-wrap gap-1.5", className)}>
      {badges.map((b) => (
        <span key={b} className="rounded-full bg-cream px-2.5 py-0.5 text-xs font-semibold text-primary-dark">
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
