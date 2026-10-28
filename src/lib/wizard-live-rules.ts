/**
 * "Creating a contest right now" (owner, 2026-10-25; Design/unpaid-contests, phase 2): what Start a contest tells the
 * team while someone fills it in, and the rules of the one help message. Pure: shared by the wizard, the live route,
 * the admin page and the tests.
 *
 * Only a fixed list of form answers is ever sent, and the server keeps only that list again (anyone can post). Never
 * the name, mobile, email or password (those come from the server's own copy once step 1 is checked), never the
 * payment method, promo code or terms, never file names or anything typed outside the form.
 */
import { BUSINESS_TYPES, LOGO_STYLES, PACKAGES, UPGRADES, type Brief, type Order, type UpgradeKey } from "@/lib/contests/brief";

/** A visit shows on the admin page while it pinged within this time ("this minute"). */
export const LIVE_FRESH_MS = 60_000;
/**
 * The wizard pings this often while the page is visible (owner, 2026-10-28: 20 s, was 10 s; every ping is a billed
 * server run, and 20 s stays inside OFFER_FRESH_MS); every few seconds while a help chat is open.
 */
export const LIVE_BEAT_MS = 20_000;
export const HELP_POLL_MS = 3_000;
/** Answer changes are sent at most this often. */
export const LIVE_THROTTLE_MS = 4_000;
/** What they changed last stays "what they are doing" this long. */
export const DOING_MS = 12_000;
/** A help message is only sent to someone who pinged this recently (they are on the page now). */
export const OFFER_FRESH_MS = 30_000;
/** The visitor sees "Online now" while the admin's panel looked within this time; "is typing" likewise. */
export const ADMIN_ONLINE_MS = 30_000;
export const TYPING_MS = 8_000;
/** Messages per help chat, each side; and their length. */
export const HELP_MAX_MESSAGES = 20;
export const HELP_BODY_MAX = 500;
export const OFFER_BODY_MAX = 1000;
/** The last stage a help message may be sent on: Review (8). Never "went to payment" (9) or later. */
export const LAST_HELP_STAGE = 8;

export type LiveAnswers = {
  /** Logo name, or a service contest's title. */
  brand?: string;
  business?: string;
  businessOther?: string;
  styles?: string[];
  colours?: number;
  designersChoose?: boolean;
  links?: number;
  requirements?: number;
  deliverables?: number;
  files?: number;
  package?: string;
  prize?: number;
  days?: number;
  upgrades?: string[];
};

/** The answer keys, in the order the admin's Watch panel shows them. Also the allowed values of "doing". */
export const ANSWER_KEYS = ["brand", "business", "businessOther", "links", "styles", "colours", "designersChoose", "requirements", "deliverables", "files", "package", "prize", "days", "upgrades"] as const;
export type AnswerKey = (typeof ANSWER_KEYS)[number];
const TEXT_KEYS: readonly AnswerKey[] = ["brand", "businessOther"];
export const isAnswerKey = (v: unknown): v is AnswerKey => typeof v === "string" && (ANSWER_KEYS as readonly string[]).includes(v);

const text = (v: unknown, max: number) => (typeof v === "string" ? v.normalize("NFC").replace(/\s+/g, " ").trim().slice(0, max) : "");
const count = (v: unknown, max = 50) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.floor(v))) : undefined);
const pick = (v: unknown, from: readonly string[], max: number) => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && from.includes(x)))].slice(0, max) : undefined);

/** The logo wizard's answers, as sent. */
export function logoLiveAnswers(brief: Brief, order: Order, files: number): LiveAnswers {
  return {
    brand: brief.brandName,
    business: brief.businessType || undefined,
    businessOther: brief.businessType === "other" ? brief.businessTypeOther : undefined,
    links: brief.noLinks ? 0 : (brief.links ?? []).filter((l) => l.url.trim()).length,
    styles: brief.styles,
    colours: brief.colors.length,
    designersChoose: brief.letDesignersChoose,
    requirements: brief.requirements.length,
    deliverables: brief.deliverables.length,
    files,
    package: order.package,
    prize: order.package === "custom" ? (order.customPrize ?? undefined) : undefined,
    days: order.durationDays,
    upgrades: UPGRADES.filter((k) => order.upgrades[k]),
  };
}

/** A service contest's answers, as sent: its title, prize, days, add-ons and how many reference files. */
export function serviceLiveAnswers(d: { title: string; prize: number; days: number; upgrades: Record<UpgradeKey, boolean> }, files: number): LiveAnswers {
  return { brand: d.title, package: "custom", prize: d.prize, days: d.days, files, upgrades: UPGRADES.filter((k) => d.upgrades[k]) };
}

/** What the server keeps of a posted snapshot: the known keys with checked values, nothing else. */
export function cleanLiveAnswers(raw: unknown): LiveAnswers {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const r = raw as Record<string, unknown>;
  const out: LiveAnswers = {};
  const brand = text(r.brand, 80);
  if (brand) out.brand = brand;
  if (typeof r.business === "string" && (BUSINESS_TYPES as readonly string[]).includes(r.business)) out.business = r.business;
  const other = out.business === "other" ? text(r.businessOther, 60) : "";
  if (other) out.businessOther = other;
  const styles = pick(r.styles, LOGO_STYLES, LOGO_STYLES.length);
  if (styles?.length) out.styles = styles;
  for (const k of ["colours", "links", "requirements", "deliverables", "files"] as const) {
    const n = count(r[k]);
    if (n !== undefined) out[k] = n;
  }
  if (typeof r.designersChoose === "boolean") out.designersChoose = r.designersChoose;
  if (typeof r.package === "string" && (PACKAGES as readonly string[]).includes(r.package)) out.package = r.package;
  const prize = count(r.prize, 100_000_000);
  if (prize) out.prize = prize;
  const days = count(r.days, 365);
  if (days) out.days = days;
  const upgrades = pick(r.upgrades, UPGRADES, UPGRADES.length);
  if (upgrades?.length) out.upgrades = upgrades;
  return out;
}

/** The answer that changed between two snapshots (the first, in Watch order), or null. */
export function changedKey(before: LiveAnswers | null, after: LiveAnswers): AnswerKey | null {
  if (!before) return null;
  for (const k of ANSWER_KEYS) if (JSON.stringify(before[k] ?? null) !== JSON.stringify(after[k] ?? null)) return k;
  return null;
}

/** The order the server prices (Total), from the answers. Null without a package. */
export function orderFrom(a: LiveAnswers): Order | null {
  if (!a.package || !a.days) return null;
  const upgrades = Object.fromEntries(UPGRADES.map((k) => [k, Boolean(a.upgrades?.includes(k))])) as Record<UpgradeKey, boolean>;
  return { package: a.package as Order["package"], customPrize: a.package === "custom" ? (a.prize ?? null) : null, durationDays: a.days, upgrades };
}

/** A service wizard's step on the shared 1..10 scale (admin.dashboard.steps.s1..s10). */
export const SERVICE_STAGE = { you: 1, brief: 2, order: 7, pay: 8 } as const;

// ---- What the admin page shows ---------------------------------------------------------------------------------------

export type LiveRow = { stage: number; doing: string | null; away: boolean; updatedAt: Date; endedAt: Date | null };

/** On the page now: pinged this minute, hasn't left or gone to payment. */
export const isLive = (r: Pick<LiveRow, "stage" | "updatedAt" | "endedAt">, now: Date) => !r.endedAt && r.stage <= LAST_HELP_STAGE && now.getTime() - r.updatedAt.getTime() < LIVE_FRESH_MS;

/** "Hot": on Review, about to pay. */
export const isHot = (r: Pick<LiveRow, "stage">) => r.stage === LAST_HELP_STAGE;

/** Whether a help message may be sent now (also checked by the server when it is sent). */
export function offerBlock(r: Pick<LiveRow, "stage" | "updatedAt" | "endedAt" | "away"> | null, now: Date, alreadyOffered: boolean): null | "already" | "atPayment" | "gone" {
  if (alreadyOffered) return "already";
  if (!r) return "gone";
  if (r.stage > LAST_HELP_STAGE) return "atPayment";
  if (r.endedAt || r.away || now.getTime() - r.updatedAt.getTime() > OFFER_FRESH_MS) return "gone";
  return null;
}

export type Activity = { kind: "details" | "review" | "typing" | "picked" | "changing" | "idle" | "away"; field?: AnswerKey };

/** What they are doing: filling in their details, checking the total, typing in a field, picked a choice, or nothing. */
export function activityOf(r: Pick<LiveRow, "stage" | "doing" | "away">): Activity {
  if (r.away) return { kind: "away" };
  if (isAnswerKey(r.doing)) return { kind: TEXT_KEYS.includes(r.doing) ? "typing" : r.doing === "business" || r.doing === "package" ? "picked" : "changing", field: r.doing };
  if (r.stage === 1) return { kind: "details" };
  if (r.stage === LAST_HELP_STAGE) return { kind: "review" };
  return { kind: "idle" };
}

/** Time on page: "40 sec", "9 min", "1 h 5 min". */
export function onPage(ms: number): { n: number; unit: "sec" | "min" } | { h: number; m: number } {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return { n: s, unit: "sec" };
  const m = Math.floor(s / 60);
  return m < 60 ? { n: m, unit: "min" } : { h: Math.floor(m / 60), m: m % 60 };
}

/** The admin's first name for the visitor's card ("Sam · logocontest.bd"). */
export const firstName = (name: string | null | undefined) => (name ?? "").trim().split(/\s+/)[0]?.slice(0, 30) || "";

/** A help message as typed: control characters removed, at most 3 blank lines, trimmed; null when empty or too long. */
export function cleanHelpText(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.replace(/\r\n/g, "\n").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/\n{4,}/g, "\n\n\n").trim();
  return s.length >= 1 && s.length <= max ? s : null;
}
