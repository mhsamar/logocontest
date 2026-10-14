import { describe, expect, it } from "vitest";
import { DEFAULT_PRO_SETTINGS, dhakaMonth } from "@/lib/pro/rules";
import { checkWindow, extendedEnd, isTrialActive, portfolioLimit, trialDaysLeft, trialEligibility, trialEnd, trialReminderDue, trialShouldExpire, type TrialLike } from "@/lib/pro/trial-rules";

const H = 3_600_000;
const start = new Date("2026-10-14T06:00:00Z");
const trial = (over: Partial<TrialLike> = {}): TrialLike => ({ status: "active", startedAt: start, endsAt: trialEnd(start, 3), remindedAt: null, ...over });
const limits = { pro: 100, basic: 2, trial: 10 };

describe("3-day free Pro Trial (owner, 2026-10-14)", () => {
  it("lasts 3 days and gives Pro until then", () => {
    expect(trialEnd(start, 3).toISOString()).toBe("2026-10-17T06:00:00.000Z");
    expect(isTrialActive(trial(), new Date(start.getTime() + 71 * H))).toBe(true);
    expect(isTrialActive(trial(), new Date(start.getTime() + 72 * H))).toBe(false);
    expect(isTrialActive(trial({ status: "cancelled" }), start)).toBe(false);
    expect(trialDaysLeft(trial(), new Date(start.getTime() + 30 * H))).toBe(2);
  });

  it("one trial per account for life, only for designers who never had Pro, and only while trials are on", () => {
    const base = { enabled: true, isDesigner: true, hadTrial: false, hadPro: false };
    expect(trialEligibility(base)).toBe("ok");
    expect(trialEligibility({ ...base, hadTrial: true })).toBe("used");
    expect(trialEligibility({ ...base, hadPro: true })).toBe("had_pro");
    expect(trialEligibility({ ...base, enabled: false })).toBe("off");
    expect(trialEligibility({ ...base, isDesigner: false })).toBe("not_designer");
    // A used trial stays used even when trials are off.
    expect(trialEligibility({ ...base, enabled: false, hadTrial: true })).toBe("used");
  });

  it("the reminder goes once, on the last day; then the trial ends", () => {
    expect(trialReminderDue(trial(), new Date(start.getTime() + 47 * H))).toBe(false);
    expect(trialReminderDue(trial(), new Date(start.getTime() + 49 * H))).toBe(true);
    expect(trialReminderDue(trial({ remindedAt: new Date() }), new Date(start.getTime() + 49 * H))).toBe(false);
    expect(trialShouldExpire(trial(), new Date(start.getTime() + 72 * H))).toBe(true);
    expect(trialShouldExpire(trial({ status: "upgraded" }), new Date(start.getTime() + 80 * H))).toBe(false);
  });

  it("extending adds days to the end, or starts again from now after it ended", () => {
    const now = new Date(start.getTime() + 24 * H);
    expect(extendedEnd(trial(), 1, now).toISOString()).toBe("2026-10-18T06:00:00.000Z");
    const later = new Date("2026-10-20T00:00:00Z");
    expect(extendedEnd(trial({ status: "expired" }), 3, later).toISOString()).toBe("2026-10-23T00:00:00.000Z");
  });

  it("10 logo checks for the whole trial; Pro and Basic per month; after the trial Basic counts afresh", () => {
    const now = new Date(start.getTime() + 5 * H);
    const month = dhakaMonth(now);
    expect(checkWindow({ trial: trial(), paidPro: false, month, limits }, now)).toEqual({ kind: "trial", from: start, to: trialEnd(start, 3), limit: 10 });
    expect(checkWindow({ trial: trial(), paidPro: true, month, limits }, now)).toMatchObject({ kind: "pro", limit: 100 });
    const after = new Date(start.getTime() + 100 * H);
    expect(checkWindow({ trial: trial({ status: "expired" }), paidPro: false, month: dhakaMonth(after), limits }, after)).toEqual({ kind: "basic", from: trialEnd(start, 3), to: dhakaMonth(after).to, limit: 2 });
    expect(checkWindow({ trial: null, paidPro: false, month, limits }, now)).toEqual({ kind: "basic", from: month.from, to: month.to, limit: 2 });
  });

  it("10 portfolio images on the trial, the Pro number otherwise (both from Admin › Pro plan)", () => {
    expect(portfolioLimit("trial", DEFAULT_PRO_SETTINGS)).toBe(10);
    expect(portfolioLimit("pro", DEFAULT_PRO_SETTINGS)).toBe(50);
    expect(DEFAULT_PRO_SETTINGS.freeTrialEnabled).toBe(false);
    expect(DEFAULT_PRO_SETTINGS.freeTrialDays).toBe(3);
    expect(DEFAULT_PRO_SETTINGS.trialLogoChecks).toBe(10);
  });
});
