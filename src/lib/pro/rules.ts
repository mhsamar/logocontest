/**
 * Designer Pro plan rules (owner, 2026-10-13; Design/pro/PRO-HANDOFF.md). Pure: shared by the server, the pages and
 * the tests. Every number comes from pro_settings (Admin › Pro plan); nothing here is hard-coded for production.
 */

export type ProSettings = {
  isForSale: boolean;
  priceBdt: number;
  offerEnabled: boolean;
  offerPriceBdt: number | null;
  offerAudience: "new" | "all";
  offerStartsAt: Date | null;
  offerEndsAt: Date | null;
  trialDays: number;
  promoCode: string | null;
  promoPriceBdt: number | null;
  proLogoChecks: number;
  basicLogoChecks: number;
  /** Logo check inside contests (owner, 2026-10-14): Low match is 0–checkLowMax %, Medium up to checkMediumMax %, High above. */
  checkLowMax: number;
  checkMediumMax: number;
  /** 3-day free Pro Trial (owner, 2026-10-14): off until the owner turns it on; its two limits are for the whole trial. */
  freeTrialEnabled: boolean;
  freeTrialDays: number;
  trialLogoChecks: number;
  trialPortfolioLimit: number;
  proPortfolioLimit: number;
  /** null = unlimited. */
  proEntriesPerContest: number | null;
  basicEntriesPerContest: number;
  invitesPerContest: number;
  earlyAccessMinutes: number;
  features: Record<ProFeature, boolean>;
  autoRemind: boolean;
};

export const PRO_FEATURES = ["early_access", "highlighted_entries", "client_chat", "invitations", "insights", "priority_support", "floating_card", "show_contact_on_profile"] as const;
export type ProFeature = (typeof PRO_FEATURES)[number];

/** The seed row (migration 0046). Before that migration runs the plan is simply not there (see settings.ts). */
export const DEFAULT_PRO_SETTINGS: ProSettings = {
  isForSale: false,
  priceBdt: 500,
  offerEnabled: false,
  offerPriceBdt: null,
  offerAudience: "new",
  offerStartsAt: null,
  offerEndsAt: null,
  trialDays: 0,
  promoCode: null,
  promoPriceBdt: null,
  proLogoChecks: 100,
  basicLogoChecks: 2,
  checkLowMax: 20,
  checkMediumMax: 60,
  freeTrialEnabled: false,
  freeTrialDays: 3,
  trialLogoChecks: 10,
  trialPortfolioLimit: 10,
  proPortfolioLimit: 50,
  proEntriesPerContest: null,
  basicEntriesPerContest: 5,
  invitesPerContest: 10,
  earlyAccessMinutes: 60,
  features: { early_access: true, highlighted_entries: true, client_chat: true, invitations: true, insights: true, priority_support: true, floating_card: true, show_contact_on_profile: false },
  autoRemind: true,
};

// ---------------------------------------------------------------------------------------------------------------
// Subscription
// ---------------------------------------------------------------------------------------------------------------

export const SUB_STATUSES = ["active", "expiring", "payment_failed", "cancelled", "expired"] as const;
export type SubStatus = (typeof SUB_STATUSES)[number];
export type SubLike = { status: SubStatus; currentPeriodEnd: Date };

/** Pro = a subscription that is not expired and whose paid period has not ended. Cancelled keeps Pro until then. */
export const isProActive = (sub: SubLike | null | undefined, now: Date = new Date()): boolean => !!sub && sub.status !== "expired" && sub.currentPeriodEnd.getTime() > now.getTime();

/** The expiry job: a plan whose period ended is expired (Pro features go away). */
export const shouldExpire = (sub: SubLike, now: Date = new Date()): boolean => sub.status !== "expired" && sub.currentPeriodEnd.getTime() <= now.getTime();

const DAY = 86_400_000;

/** One month later on the same date (31 Jan → 28/29 Feb). */
export function addMonths(from: Date, months = 1): Date {
  const d = new Date(from.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}

/** A paid month starts from now, or from the current end when the plan is still running (renewing early). */
export const periodEndAfterPayment = (currentEnd: Date | null, now: Date, months = 1): Date => addMonths(currentEnd && currentEnd > now ? currentEnd : now, months);

/** Which renewal reminder is due: 7 days before the end, then 1 day before. Each is sent once. */
export function renewalReminderDue(sub: SubLike & { autoRenew: boolean; reminded7dAt: Date | null; reminded1dAt: Date | null }, now: Date = new Date()): "7d" | "1d" | null {
  if (!isProActive(sub, now) || sub.status === "cancelled" || !sub.autoRenew) return null;
  const left = sub.currentPeriodEnd.getTime() - now.getTime();
  if (left <= DAY && !sub.reminded1dAt) return "1d";
  if (left <= 7 * DAY && left > DAY && !sub.reminded7dAt) return "7d";
  return null;
}

// ---------------------------------------------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------------------------------------------

/**
 * Designs one designer may send to one contest: the plan's number, and never more than the site-wide limit
 * (Settings, 0 = unlimited). Returns 0 for unlimited.
 */
export function entryLimit(pro: boolean, s: Pick<ProSettings, "proEntriesPerContest" | "basicEntriesPerContest">, siteMax = 0): number {
  const plan = pro ? (s.proEntriesPerContest ?? 0) : s.basicEntriesPerContest;
  const limits = [plan, siteMax].filter((n) => n > 0);
  return limits.length ? Math.min(...limits) : 0;
}

export const canSendAnother = (sent: number, limit: number): boolean => limit <= 0 || sent < limit;

export const logoCheckLimit = (pro: boolean, s: Pick<ProSettings, "proLogoChecks" | "basicLogoChecks">): number => (pro ? s.proLogoChecks : s.basicLogoChecks);

export const portfolioSlotsLeft = (used: number, s: Pick<ProSettings, "proPortfolioLimit">): number => Math.max(0, s.proPortfolioLimit - used);

export const invitesLeft = (sent: number, s: Pick<ProSettings, "invitesPerContest">): number => Math.max(0, s.invitesPerContest - sent);

/** Bangladesh time is UTC+6 all year. */
const DHAKA_MS = 6 * 3_600_000;

/** This month in Bangladesh: the usage key (YYYY-MM-01), when it started and when checks start again. */
export function dhakaMonth(now: Date = new Date()): { key: string; from: Date; to: Date } {
  const local = new Date(now.getTime() + DHAKA_MS);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  return {
    key: `${y}-${String(m + 1).padStart(2, "0")}-01`,
    from: new Date(Date.UTC(y, m, 1) - DHAKA_MS),
    to: new Date(Date.UTC(y, m + 1, 1) - DHAKA_MS),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Early access
// ---------------------------------------------------------------------------------------------------------------

type EarlyLike = Pick<ProSettings, "earlyAccessMinutes" | "features">;

/** When everyone (not only Pro) may see a contest that opened at startsAt. */
export function opensToAllAt(startsAt: Date, s: EarlyLike): Date {
  const minutes = s.features.early_access ? s.earlyAccessMinutes : 0;
  return new Date(startsAt.getTime() + minutes * 60_000);
}

/** Pro designers see a new contest right away; everyone else after the early-access window. */
export const canSeeNewContest = (startsAt: Date | null, viewerIsPro: boolean, s: EarlyLike, now: Date = new Date()): boolean =>
  !startsAt || viewerIsPro || opensToAllAt(startsAt, s).getTime() <= now.getTime();

/** Minutes until everyone sees it (0 when it is already open to all). */
export const headStartLeft = (startsAt: Date, s: EarlyLike, now: Date = new Date()): number => Math.max(0, Math.ceil((opensToAllAt(startsAt, s).getTime() - now.getTime()) / 60_000));

// ---------------------------------------------------------------------------------------------------------------
// Contest chat
// ---------------------------------------------------------------------------------------------------------------

export type ChatCheck = {
  viewerId: string;
  contestClientId: string;
  entryDesignerId: string;
  entryContestId: string;
  contestId: string;
  designerIsPro: boolean;
  designerAllowsMessages: boolean;
  featureOn: boolean;
};

/**
 * Who may read and write a contest chat: only that contest's client and the designer who sent that entry, and only
 * while the designer is Pro with messages on and the feature is on. No hiring: there is no chat outside a contest.
 */
export function canUseContestChat(c: ChatCheck): boolean {
  if (c.entryContestId !== c.contestId) return false;
  if (c.viewerId !== c.contestClientId && c.viewerId !== c.entryDesignerId) return false;
  return c.featureOn && c.designerIsPro && c.designerAllowsMessages;
}

const PAYMENT_WORDS = /\b(bkash|b-kash|nagad|rocket|upay|bank\s*account|account\s*number|send\s*money|pay\s*me|payment|advance|taka|tk\.?|৳)\b|বিকাশ|নগদ|রকেট|টাকা|পেমেন্ট|অ্যাকাউন্ট/i;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const LINK = /\b(https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(com|net|org|io|bd|me|co|info|xyz|link|ly)\b(\/\S*)?/i;
const PHONE = /(\+?88)?0?1[3-9][\s-]?\d{2}[\s-]?\d{3}[\s-]?\d{3}\b|[০-৯]{11}|\b\d{3}[\s-]?\d{3,4}[\s-]?\d{4}\b/;

/** What a chat message is warned about (and logged): a phone number, an email, a link or payment words. */
export function messageFlags(text: string): ("phone" | "email" | "link" | "payment")[] {
  const flags: ("phone" | "email" | "link" | "payment")[] = [];
  if (PHONE.test(text)) flags.push("phone");
  if (EMAIL.test(text)) flags.push("email");
  if (LINK.test(text.replace(EMAIL, ""))) flags.push("link");
  if (PAYMENT_WORDS.test(text)) flags.push("payment");
  return flags;
}

// ---------------------------------------------------------------------------------------------------------------
// Price
// ---------------------------------------------------------------------------------------------------------------

export type PriceQuote = { amount: number; list: number; reason: "list" | "offer" | "promo" | "trial"; trialDays: number };

const offerRunning = (s: ProSettings, now: Date) =>
  s.offerEnabled && s.offerPriceBdt !== null && (!s.offerStartsAt || s.offerStartsAt <= now) && (!s.offerEndsAt || s.offerEndsAt > now);

/**
 * What a designer pays today. A free trial (first time only) costs nothing; otherwise the lowest of the list price,
 * a running offer (for new members only, unless the admin opened it to all) and a valid promo code.
 */
export function priceQuote(s: ProSettings, opts: { firstTime: boolean; promo?: string | null; now?: Date }): PriceQuote {
  const now = opts.now ?? new Date();
  const list = s.priceBdt;
  if (opts.firstTime && s.trialDays > 0) return { amount: 0, list, reason: "trial", trialDays: s.trialDays };
  let best: PriceQuote = { amount: list, list, reason: "list", trialDays: 0 };
  if (offerRunning(s, now) && (s.offerAudience === "all" || opts.firstTime) && s.offerPriceBdt! < best.amount) best = { amount: s.offerPriceBdt!, list, reason: "offer", trialDays: 0 };
  const code = (opts.promo ?? "").trim().toUpperCase();
  if (code && s.promoCode && code === s.promoCode && s.promoPriceBdt !== null && s.promoPriceBdt < best.amount) best = { amount: s.promoPriceBdt, list, reason: "promo", trialDays: 0 };
  return best;
}

export const receiptCode = (n: number) => `PRO-${String(n).padStart(6, "0")}`;

/** A gateway callback is only applied to a pending payment of the same amount (the signature is checked first). */
export function callbackMatches(payment: { status: string; amount: number }, verified: { amount: number }): "ok" | "already" | "amount" {
  if (payment.status !== "pending") return "already";
  return payment.amount === verified.amount ? "ok" : "amount";
}

// ---------------------------------------------------------------------------------------------------------------
// Funnel (Admin › Pro plan)
// ---------------------------------------------------------------------------------------------------------------

export const FUNNEL_EVENTS = ["card_seen", "upgrade_clicked", "checkout_opened", "payment_started", "paid", "payment_failed", "checkout_closed", "renewed", "cancelled", "reminded"] as const;
export type FunnelEvent = (typeof FUNNEL_EVENTS)[number];

/** Drop-off from one step to the next, in whole percent (0 when the step before had nobody). */
export const dropPercent = (before: number, after: number): number => (before > 0 ? Math.max(0, Math.round(((before - after) / before) * 100)) : 0);

export const percentOf = (part: number, whole: number): number => (whole > 0 ? Math.round((part / whole) * 100) : 0);

// ---------------------------------------------------------------------------------------------------------------
// Ranking (invites, designer search)
// ---------------------------------------------------------------------------------------------------------------

export type MatchInput = {
  rating: number | null;
  winRate: number;
  winsInType: number;
  skills: string[];
  replyMinutes: number | null;
  activeThisWeek: boolean;
};

/**
 * "Best match" for a client's contest (0–100): client rating 30%, win ratio 25%, wins in this design type 20%,
 * matching skills 15%, reply time and activity 10%. The weights can be tuned (open point C).
 */
export function matchScore(d: MatchInput, wantedSkills: string[]): number {
  const rating = d.rating ? (d.rating - 1) / 4 : 0.5;
  const win = Math.min(1, d.winRate / 50);
  const wins = Math.min(1, d.winsInType / 10);
  const wanted = new Set(wantedSkills);
  const skills = wanted.size ? d.skills.filter((s) => wanted.has(s)).length / wanted.size : d.skills.length ? 0.5 : 0;
  const reply = d.replyMinutes === null ? 0.3 : d.replyMinutes <= 60 ? 1 : d.replyMinutes <= 360 ? 0.7 : d.replyMinutes <= 1440 ? 0.4 : 0.1;
  const active = d.activeThisWeek ? 1 : 0;
  return Math.round(100 * (0.3 * rating + 0.25 * win + 0.2 * wins + 0.15 * skills + 0.1 * (0.6 * reply + 0.4 * active)));
}

/** Quality score (0–100) for the designer search order: rating, win rate, experience and activity. */
export function qualityScore(q: { rating: number | null; winRate: number; contests: number; activeDays: number; replyMinutes: number | null }): number {
  const rating = q.rating ? (q.rating - 1) / 4 : 0.4;
  const win = Math.min(1, q.winRate / 40);
  const exp = Math.min(1, q.contests / 20);
  const active = Math.min(1, q.activeDays / 20);
  const reply = q.replyMinutes === null ? 0.4 : q.replyMinutes <= 120 ? 1 : q.replyMinutes <= 1440 ? 0.6 : 0.2;
  return Math.round(100 * (0.35 * rating + 0.3 * win + 0.15 * exp + 0.1 * active + 0.1 * reply));
}

export const winRate = (wins: number, contests: number): number => (contests > 0 ? Math.round((wins / contests) * 1000) / 10 : 0);
