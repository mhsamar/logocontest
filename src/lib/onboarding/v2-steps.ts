/**
 * Onboarding v2's steps (owner, 2026-10-28; client-onboarding-v2-spec.md): 1 account, 2 logo name and business type,
 * 3 prize, 4 bKash payment, then the thank-you screen (5). Pure: shared by the page, the wizard and the tests.
 */

export const V2 = { account: 1, basics: 2, prize: 3, pay: 4, done: 5 } as const;
export const V2_TOTAL = 4;

/** Whether /start-v2 is switched on (ONBOARDING_V2=true; owner, 2026-10-28: the old /start stays until approved). */
export const onboardingV2On = () => process.env.ONBOARDING_V2 === "true";

/**
 * Where /start-v2 opens: a visitor at the account step; a signed-in client without a contest at the logo name; a saved
 * contest at its last unfinished step (the prizes until the payment step was opened); a contest whose bKash payment
 * is waiting at the thank-you screen.
 */
export function v2StartStep(s: { signedIn: boolean; contest: { lastStep: number | null; waiting: boolean } | null }): number {
  if (!s.signedIn) return V2.account;
  if (!s.contest) return V2.basics;
  if (s.contest.waiting) return V2.done;
  return (s.contest.lastStep ?? V2.basics) >= V2.pay ? V2.pay : V2.prize;
}

/** A step a client may go to now: never past the first one they haven't done, never back once the payment is sent. */
export function v2CanGo(to: number, s: { signedIn: boolean; contestId: string | null; sent: boolean }): boolean {
  if (s.sent) return to === V2.done;
  if (to === V2.account) return !s.signedIn;
  if (to === V2.basics) return s.signedIn;
  if (to === V2.prize || to === V2.pay) return s.signedIn && s.contestId !== null;
  return false;
}

/** The step on the team's shared 1..10 scale (Admin › Unpaid contests "creating now"; 9 = went to payment). */
export const V2_STAGE: Record<number, number> = { 1: 1, 2: 2, 3: 7, 4: 8, 5: 9 };
