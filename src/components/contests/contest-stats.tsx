import { cx } from "@/lib/cx";
import type { ContestDetail } from "@/lib/contests/browse";
import { contestTimeline } from "@/lib/contests/browse-query";
import { formatDate } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import { formatNumber, formatTaka } from "@/lib/money";
import { TrophyIcon } from "@/components/ui/trophy";
import { PRIZE_TEXT } from "./contest-bits";
import { timeLeft } from "./countdown-pill";

/** P-03 stats card: designs, prize, time left, then the three-step timeline. */
export async function ContestStats({ contest, judgingDays, now, action }: { contest: ContestDetail; judgingDays: number; now: Date; action?: React.ReactNode }) {
  const { t, locale } = await getI18n();
  const phases = contestTimeline(contest, judgingDays, now);

  let left = "—";
  if (contest.status === "open" && contest.endsAt) {
    const ms = contest.endsAt.getTime() - now.getTime();
    const l = timeLeft(contest.endsAt, now);
    left = ms <= 0 ? t("home.card.ended") : ms < 86_400_000 ? t("contest.stats.hours", { hours: l.hours }) : t("contest.stats.days", { days: l.days });
  } else if (contest.status !== "open") {
    left = t("home.card.ended");
  }

  const stats = [
    { label: t("contest.stats.designs"), value: formatNumber(contest.entries, locale), prize: false },
    { label: t("contest.stats.prize"), value: formatTaka(contest.prize, locale), prize: true },
    { label: t("contest.stats.timeLeft"), value: left, prize: false },
  ];

  return (
    <div className="rounded-xl bg-frame p-5 ring-1 ring-line">
      <h2 className="text-sm font-semibold text-ink">{t("contest.stats.title")}</h2>
      <dl className="mt-3 grid grid-cols-2 items-center gap-3 sm:grid-cols-[1fr_1.35fr_1fr]">
        {stats.map((s) =>
          // Label after the value on screen, but first in the markup (dt before dd).
          s.prize ? (
            // The prize stands out in a soft gold panel (owner, 2026-10-08).
            <div key={s.label} className="relative order-first col-span-2 flex min-w-0 flex-col-reverse overflow-hidden rounded-xl sm:order-none sm:col-span-1 prize-glow bg-gradient-to-br from-[#fff9e8] via-[#fff0c7] to-[#ffe2a0] px-3 py-2.5 shadow-card ring-1 ring-[#f1c75c]/70">
              <dt className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-[#8a5105]">
                <TrophyIcon className="size-4" />
                {s.label}
              </dt>
              <dd className={cx("truncate text-2xl font-extrabold leading-tight tabular-nums sm:text-[1.65rem]", PRIZE_TEXT)}>{s.value}</dd>
            </div>
          ) : (
            <div key={s.label} className="flex min-w-0 flex-col-reverse">
              <dt className="mt-0.5 text-xs text-muted">{s.label}</dt>
              <dd className="text-lg font-bold leading-tight text-ink tabular-nums sm:text-2xl">{s.value}</dd>
            </div>
          ),
        )}
      </dl>

      <h3 className="mt-6 text-xs font-semibold uppercase tracking-wider text-muted">{t("contest.timeline.title")}</h3>
      {/* Stepper: every dot sits on one line, so labels of any length stay aligned (UI-JOURNEY P-03). */}
      <ol className="mt-4 grid grid-cols-3">
        {phases.map((p, i) => {
          const next = phases[i + 1];
          return (
            <li key={p.key} className="relative min-w-0 px-1 text-center">
              {next && (
                // Line from this dot's centre to the next one's; it fills while this step is running.
                <span className="absolute left-1/2 top-3 h-1 w-full overflow-hidden rounded-full bg-line" aria-hidden>
                  <span
                    className={cx("block h-full rounded-full", p.state === "done" ? "bg-success" : "bg-primary")}
                    style={{ width: `${Math.round(p.progress * 100)}%` }}
                  />
                </span>
              )}
              <span
                className={cx(
                  "relative z-10 mx-auto flex size-7 items-center justify-center rounded-full text-xs font-bold",
                  p.state === "done" && "bg-success text-white",
                  p.state === "active" && "bg-primary text-white ring-4 ring-primary/15",
                  p.state === "upcoming" && "bg-surface text-muted ring-2 ring-inset ring-line",
                )}
                aria-hidden
              >
                {p.state === "done" ? (
                  <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  formatNumber(i + 1, locale)
                )}
              </span>
              <p className={cx("mt-2.5 text-sm font-semibold leading-snug", p.state === "upcoming" ? "text-muted" : "text-ink")}>
                {t(`contest.timeline.${p.key}`)}
              </p>
              <p className="mt-0.5 text-xs leading-snug text-muted">
                {p.endsAt
                  ? t(p.state === "done" ? "contest.timeline.ended" : "contest.timeline.until", { date: formatDate(p.endsAt, locale, "short") })
                  : t("contest.timeline.afterWinner")}
              </p>
              <span className="sr-only">{t(`contest.timeline.state.${p.state}`)}</span>
            </li>
          );
        })}
      </ol>

      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
