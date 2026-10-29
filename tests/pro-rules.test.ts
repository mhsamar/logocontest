import { describe, expect, it } from "vitest";
import {
  addMonths,
  callbackMatches,
  canSeeNewContest,
  canSendAnother,
  canUseContestChat,
  DEFAULT_PRO_SETTINGS as S,
  dhakaMonth,
  dropPercent,
  entryLimit,
  headStartLeft,
  invitesLeft,
  isProActive,
  logoCheckLimit,
  matchScore,
  messageFlags,
  periodEndAfterPayment,
  portfolioSlotsLeft,
  priceQuote,
  receiptCode,
  renewalReminderDue,
  shouldExpire,
  type ChatCheck,
} from "@/lib/pro/rules";

const now = new Date("2026-10-13T12:00:00Z");
const hours = (h: number) => new Date(now.getTime() + h * 3_600_000);

describe("Pro limits", () => {
  it("Basic designers send up to 5 designs per contest, Pro unlimited", () => {
    expect(entryLimit(false, S)).toBe(5);
    expect(canSendAnother(4, entryLimit(false, S))).toBe(true);
    expect(canSendAnother(5, entryLimit(false, S))).toBe(false);
    expect(entryLimit(true, S)).toBe(0);
    expect(canSendAnother(500, entryLimit(true, S))).toBe(true);
  });

  it("never goes over the site-wide limit (0 = unlimited)", () => {
    expect(entryLimit(false, S, 3)).toBe(3);
    expect(entryLimit(true, S, 8)).toBe(8);
    expect(entryLimit(false, S, 0)).toBe(5);
    expect(entryLimit(true, { ...S, proEntriesPerContest: 20 })).toBe(20);
  });

  it("Basic gets 2 logo checks a month, Pro 20 (owner, 2026-10-29)", () => {
    expect(logoCheckLimit(false, S)).toBe(2);
    expect(logoCheckLimit(true, S)).toBe(20);
  });

  it("Pro portfolio holds 50 uploads", () => {
    expect(portfolioSlotsLeft(0, S)).toBe(50);
    expect(portfolioSlotsLeft(49, S)).toBe(1);
    expect(portfolioSlotsLeft(50, S)).toBe(0);
    expect(portfolioSlotsLeft(60, S)).toBe(0);
  });

  it("a contest can invite 10 designers; the 11th is refused", () => {
    expect(invitesLeft(0, S)).toBe(10);
    expect(invitesLeft(9, S)).toBe(1);
    expect(invitesLeft(10, S)).toBe(0);
  });

  it("logo checks start again on the 1st, Bangladesh time", () => {
    // 30 Oct 19:00 UTC is 31 Oct 01:00 in Dhaka; 31 Oct 18:30 UTC is already 1 Nov in Dhaka.
    expect(dhakaMonth(new Date("2026-10-30T19:00:00Z")).key).toBe("2026-10-01");
    expect(dhakaMonth(new Date("2026-10-31T18:30:00Z")).key).toBe("2026-11-01");
    const m = dhakaMonth(now);
    expect(m.from.toISOString()).toBe("2026-09-30T18:00:00.000Z");
    expect(m.to.toISOString()).toBe("2026-10-31T18:00:00.000Z");
  });
});

describe("early access", () => {
  const opened = hours(-0.5); // opened 30 minutes ago, window 60 minutes
  it("Pro sees a new contest at once, others after the window", () => {
    expect(canSeeNewContest(opened, true, S, now)).toBe(true);
    expect(canSeeNewContest(opened, false, S, now)).toBe(false);
    expect(canSeeNewContest(hours(-1.01), false, S, now)).toBe(true);
    expect(headStartLeft(opened, S, now)).toBe(30);
  });
  it("is off when the feature is off or the window is 0", () => {
    expect(canSeeNewContest(opened, false, { ...S, features: { ...S.features, early_access: false } }, now)).toBe(true);
    expect(canSeeNewContest(opened, false, { ...S, earlyAccessMinutes: 0 }, now)).toBe(true);
    expect(canSeeNewContest(null, false, S, now)).toBe(true);
  });
});

describe("contest chat", () => {
  const base: ChatCheck = { viewerId: "client", contestClientId: "client", entryDesignerId: "designer", entryContestId: "c1", contestId: "c1", designerIsPro: true, designerAllowsMessages: true, featureOn: true };
  it("only the contest's client and the entry's designer", () => {
    expect(canUseContestChat(base)).toBe(true);
    expect(canUseContestChat({ ...base, viewerId: "designer" })).toBe(true);
    expect(canUseContestChat({ ...base, viewerId: "someone" })).toBe(false);
  });
  it("only about an entry in that contest", () => {
    expect(canUseContestChat({ ...base, entryContestId: "c2" })).toBe(false);
  });
  it("only while the designer is Pro, messages are on and the feature is on", () => {
    expect(canUseContestChat({ ...base, designerIsPro: false })).toBe(false);
    expect(canUseContestChat({ ...base, designerAllowsMessages: false })).toBe(false);
    expect(canUseContestChat({ ...base, featureOn: false })).toBe(false);
  });
  it("warns about phone numbers, emails, links and payment words", () => {
    expect(messageFlags("Can you make the text bigger?")).toEqual([]);
    expect(messageFlags("call me 01712028511")).toContain("phone");
    expect(messageFlags("mail me at a.b@gmail.com")).toEqual(["email"]);
    expect(messageFlags("see www.example.com")).toContain("link");
    expect(messageFlags("send the money by bkash")).toContain("payment");
    expect(messageFlags("বিকাশে টাকা দিন")).toContain("payment");
  });
});

describe("Pro expiry", () => {
  it("Pro until the end date, also after cancelling", () => {
    expect(isProActive({ status: "active", currentPeriodEnd: hours(1) }, now)).toBe(true);
    expect(isProActive({ status: "cancelled", currentPeriodEnd: hours(48) }, now)).toBe(true);
    expect(isProActive({ status: "active", currentPeriodEnd: hours(-1) }, now)).toBe(false);
    expect(isProActive({ status: "expired", currentPeriodEnd: hours(48) }, now)).toBe(false);
    expect(isProActive(null, now)).toBe(false);
  });
  it("the job expires plans whose period ended", () => {
    expect(shouldExpire({ status: "cancelled", currentPeriodEnd: hours(-1) }, now)).toBe(true);
    expect(shouldExpire({ status: "active", currentPeriodEnd: hours(1) }, now)).toBe(false);
    expect(shouldExpire({ status: "expired", currentPeriodEnd: hours(-1) }, now)).toBe(false);
  });
  it("a payment adds a month from the end (or from now when it already ended)", () => {
    expect(periodEndAfterPayment(new Date("2026-10-20T00:00:00Z"), now).toISOString()).toBe("2026-11-20T00:00:00.000Z");
    expect(periodEndAfterPayment(new Date("2026-10-01T00:00:00Z"), now).toISOString()).toBe("2026-11-13T12:00:00.000Z");
    expect(addMonths(new Date("2026-01-31T00:00:00Z")).toISOString()).toBe("2026-02-28T00:00:00.000Z");
  });
  it("reminds 7 days and 1 day before the end, once each, not after cancelling", () => {
    const sub = { status: "active" as const, currentPeriodEnd: hours(24 * 6), autoRenew: true, reminded7dAt: null, reminded1dAt: null };
    expect(renewalReminderDue(sub, now)).toBe("7d");
    expect(renewalReminderDue({ ...sub, reminded7dAt: now }, now)).toBe(null);
    expect(renewalReminderDue({ ...sub, currentPeriodEnd: hours(20) }, now)).toBe("1d");
    expect(renewalReminderDue({ ...sub, status: "cancelled" }, now)).toBe(null);
    expect(renewalReminderDue({ ...sub, currentPeriodEnd: hours(24 * 10) }, now)).toBe(null);
  });
});

describe("price and payments", () => {
  const sale = { ...S, isForSale: true };
  it("uses the list price, an offer, a promo code or a free trial", () => {
    expect(priceQuote(sale, { firstTime: true, now })).toEqual({ amount: 500, list: 500, reason: "list", trialDays: 0 });
    const offer = { ...sale, offerEnabled: true, offerPriceBdt: 350 };
    expect(priceQuote(offer, { firstTime: true, now }).amount).toBe(350);
    expect(priceQuote(offer, { firstTime: false, now }).amount).toBe(500);
    expect(priceQuote({ ...offer, offerEndsAt: hours(-1) }, { firstTime: true, now }).amount).toBe(500);
    const promo = { ...sale, promoCode: "EID26", promoPriceBdt: 300 };
    expect(priceQuote(promo, { firstTime: false, promo: "eid26", now })).toMatchObject({ amount: 300, reason: "promo" });
    expect(priceQuote(promo, { firstTime: false, promo: "WRONG", now }).amount).toBe(500);
    expect(priceQuote({ ...sale, trialDays: 7 }, { firstTime: true, now })).toMatchObject({ amount: 0, reason: "trial", trialDays: 7 });
    expect(priceQuote({ ...sale, trialDays: 7 }, { firstTime: false, now }).reason).toBe("list");
  });
  it("a verified callback only applies to a pending payment of the same amount", () => {
    expect(callbackMatches({ status: "pending", amount: 500 }, { amount: 500 })).toBe("ok");
    expect(callbackMatches({ status: "pending", amount: 500 }, { amount: 5 })).toBe("amount");
    expect(callbackMatches({ status: "paid", amount: 500 }, { amount: 500 })).toBe("already");
  });
  it("receipt numbers and drop-off", () => {
    expect(receiptCode(42)).toBe("PRO-000042");
    expect(dropPercent(4820, 612)).toBe(87);
    expect(dropPercent(0, 0)).toBe(0);
  });
});

describe("invite ranking", () => {
  it("a well-rated, winning, matching, active designer ranks higher", () => {
    const strong = matchScore({ rating: 4.9, winRate: 38, winsInType: 9, skills: ["logo", "lettermark"], replyMinutes: 30, activeThisWeek: true }, ["logo", "lettermark"]);
    const weak = matchScore({ rating: 3.5, winRate: 5, winsInType: 0, skills: ["mascot"], replyMinutes: null, activeThisWeek: false }, ["logo", "lettermark"]);
    expect(strong).toBeGreaterThan(weak);
    expect(strong).toBeLessThanOrEqual(100);
    expect(weak).toBeGreaterThanOrEqual(0);
  });
});
