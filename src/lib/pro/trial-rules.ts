/**
 * 3-day free Pro Trial (owner, 2026-10-14). Pure: used by the server, the pages and the tests.
 * One trial per designer for life. While it runs the designer has Pro, with 10 logo checks and 10 portfolio images
 * for the whole trial (Admin › Pro plan). On the last day they are reminded; then it ends and they are Basic again.
 */

export const TRIAL_STATUSES = ["active", "expired", "upgraded", "cancelled"] as const;
export type TrialStatus = (typeof TRIAL_STATUSES)[number];
export type TrialLike = { status: TrialStatus; startedAt: Date; endsAt: Date; remindedAt: Date | null };

const DAY = 86_400_000;

/** The trial gives Pro now: it is active and has not reached its end. */
export const isTrialActive = (t: TrialLike | null | undefined, now: Date = new Date()): boolean => !!t && t.status === "active" && t.endsAt.getTime() > now.getTime();

/** The job ends a trial whose time is up. */
export const trialShouldExpire = (t: TrialLike, now: Date = new Date()): boolean => t.status === "active" && t.endsAt.getTime() <= now.getTime();

/** The reminder goes once, on the last day (the last 24 hours) of a running trial. */
export const trialReminderDue = (t: TrialLike, now: Date = new Date()): boolean => isTrialActive(t, now) && !t.remindedAt && t.endsAt.getTime() - now.getTime() <= DAY;

/** A designer may start a trial once: never had a trial and never had Pro, and the owner has turned trials on. */
export function trialEligibility(i: { enabled: boolean; isDesigner: boolean; hadTrial: boolean; hadPro: boolean }): "ok" | "off" | "used" | "had_pro" | "not_designer" {
  if (!i.isDesigner) return "not_designer";
  if (i.hadTrial) return "used";
  if (i.hadPro) return "had_pro";
  return i.enabled ? "ok" : "off";
}

export const trialEnd = (start: Date, days: number) => new Date(start.getTime() + Math.max(1, days) * DAY);

/** Extending adds days to the end; an ended trial starts again from now. */
export const extendedEnd = (t: TrialLike, days: number, now: Date = new Date()) => new Date(Math.max(t.endsAt.getTime(), now.getTime()) + days * DAY);

/** Whole days left, rounded up (shown as "2 days left"). */
export const trialDaysLeft = (t: TrialLike, now: Date = new Date()) => Math.max(0, Math.ceil((t.endsAt.getTime() - now.getTime()) / DAY));

export type CheckWindow = { kind: "trial" | "pro" | "basic"; from: Date; to: Date; limit: number };

/**
 * Logo checks the designer may use now, and the time they count in: the whole trial (trial limit), or the
 * Bangladesh month (Pro or Basic). After a trial, Basic counts only checks made after the trial ended.
 */
export function checkWindow(i: { trial: TrialLike | null; paidPro: boolean; month: { from: Date; to: Date }; limits: { pro: number; basic: number; trial: number } }, now: Date = new Date()): CheckWindow {
  if (i.paidPro) return { kind: "pro", from: i.month.from, to: i.month.to, limit: i.limits.pro };
  if (i.trial && isTrialActive(i.trial, now)) return { kind: "trial", from: i.trial.startedAt, to: i.trial.endsAt, limit: i.limits.trial };
  const after = i.trial && i.trial.endsAt > i.month.from && i.trial.endsAt <= now ? i.trial.endsAt : i.month.from;
  return { kind: "basic", from: after, to: i.month.to, limit: i.limits.basic };
}

/** Portfolio images a designer may have: Pro's number, or the trial's. */
export const portfolioLimit = (kind: "pro" | "trial", s: { proPortfolioLimit: number; trialPortfolioLimit: number }) => (kind === "trial" ? s.trialPortfolioLimit : s.proPortfolioLimit);
