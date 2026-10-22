/**
 * Contest cards (owner, 2026-10-19; Design/contest-cards): a photo card for every new live contest, posted to the
 * logocontest.bd Facebook page. The rules, pure so they are easy to test.
 */

export const CARD_SIZES = [
  { key: "1080x1350", width: 1080, height: 1350, ratio: "r45" },
  { key: "1080x1080", width: 1080, height: 1080, ratio: "r11" },
  { key: "1200x630", width: 1200, height: 630, ratio: "r191" },
  { key: "1080x1920", width: 1080, height: 1920, ratio: "r916" },
] as const;
export type CardSizeKey = (typeof CARD_SIZES)[number]["key"];
/** The Facebook post uses the 4:5 card: it takes the most room in the feed. */
export const MAIN_SIZE: CardSizeKey = "1080x1350";
export const isCardSize = (v: string): v is CardSizeKey => CARD_SIZES.some((s) => s.key === v);

export const CARD_STYLES = ["maroon", "light", "big"] as const;
export type CardStyle = (typeof CARD_STYLES)[number];
export const isCardStyle = (v: string): v is CardStyle => (CARD_STYLES as readonly string[]).includes(v);
export const CARD_STATUSES = ["waiting", "scheduled", "posted", "failed", "skipped"] as const;
export type CardStatus = (typeof CARD_STATUSES)[number];
export type CardKind = "new" | "last24";

/** A failed Facebook post is tried this many times, waiting 15, 30, then 60 minutes. */
export const MAX_ATTEMPTS = 3;

export const DEFAULT_CAPTION = "🎨 নতুন লোগো কনটেস্ট! {{brand_name}} ({{category}}) একটি নতুন লোগো চায়।\n🏆 পুরস্কার: ৳{{prize}} · ⏳ {{days_left}} days left (ends {{end_date}})\n👉 Join now: {{contest_link}}\n{{hashtags}}";
export const DEFAULT_HASHTAGS = ["#logocontest", "#logodesign", "#bangladesh", "#designcontest"];
export const CAPTION_VARS = ["brand_name", "category", "prize", "days_left", "end_date", "contest_link", "hashtags"] as const;

/** Short lines for the card (owner can edit per card). Picked by the contest number, so cards don't all say the same. */
export const BANGLA_LINES = ["নতুন লোগো চাই — আপনার ডিজাইন জমা দিন", "আপনার সেরা আইডিয়া পাঠান, পুরস্কার জিতুন", "ডিজাইনাররা, এখনই অংশ নিন", "সেরা ডিজাইনটি জিতবে পুরো পুরস্কার"];
export const banglaLine = (contestNumber: number | null) => BANGLA_LINES[Math.abs(contestNumber ?? 0) % BANGLA_LINES.length];

export type CardContest = { status: string; isPrivate: boolean; isNda: boolean; shareOnFacebook: boolean; endsAt: Date | null; /** A test client's contest (owner, 2026-10-22). */ isTest?: boolean };
export type Eligibility = "ok" | "private" | "client_off" | "not_live" | "test";

/**
 * Only live (paid) contests that are still open get a card. Private and NDA contests never do (no card, no post);
 * neither does a contest whose client switched "Share my contest on Facebook" off, or a test client's contest.
 */
export function cardEligibility(c: CardContest, now: Date): Eligibility {
  if (c.status !== "open" || !c.endsAt || c.endsAt.getTime() <= now.getTime()) return "not_live";
  if (c.isTest) return "test";
  if (c.isPrivate || c.isNda) return "private";
  if (!c.shareOnFacebook) return "client_off";
  return "ok";
}

/** Big prize from the admin's amount up; otherwise Maroon night and Clean light in turn. An admin choice wins. */
export function pickStyle(o: { prize: number; bigFrom: number; setting: "auto" | CardStyle; lastTurn: "maroon" | "light" | null }): CardStyle {
  if (o.setting !== "auto") return o.setting;
  if (o.prize >= o.bigFrom) return "big";
  return o.lastTurn === "maroon" ? "light" : "maroon";
}

/** Text from people (brand names) as one clean line: no control characters, no line breaks, no {{ }} tricks. */
export function cleanText(s: string, max = 120): string {
  return s
    .replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g, " ")
    .replace(/\{\{|\}\}/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/** Hashtags as #words: one per item, no spaces, no duplicates, at most 12. */
export function cleanHashtags(list: string[]): string[] {
  const out: string[] = [];
  for (const raw of list) {
    const tag = raw.trim().replace(/^#+/, "").replace(/[^\p{L}\p{N}_]/gu, "");
    if (tag && !out.includes(`#${tag}`)) out.push(`#${tag}`);
  }
  return out.slice(0, 12);
}

/** Fills the caption template in one pass, so text from a contest can never bring in another variable. */
export function fillCaption(template: string, vars: Record<(typeof CAPTION_VARS)[number], string>): string {
  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (all, key: string) => ((CAPTION_VARS as readonly string[]).includes(key) ? vars[key as (typeof CAPTION_VARS)[number]] : all)).slice(0, 2000);
}

export const daysLeft = (endsAt: Date, now: Date) => Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / 86_400_000));
export const endDateText = (endsAt: Date) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Dhaka" }).format(endsAt);
/** "LC-0012", the contest number everyone sees. */
export const contestCode = (n: number) => `LC-${String(n).padStart(4, "0")}`;
/** The short link on the card; /c/LC-0012 goes to the contest page. */
export const shortLinkText = (n: number) => `logocontest.bd/c/${contestCode(n)}`;
export const shortLinkPath = (n: number) => `/c/${contestCode(n)}`;
export const SHORT_LINK = /^\/c\/LC-?(\d{1,7})$/i;

/** Prize as on the card: the real amount with commas, never rounded. */
export const prizeText = (n: number) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);

const DHAKA = 6 * 3_600_000;
/** Next time it is HH:MM in Dhaka, at least 15 minutes from now (Facebook needs 10). */
export function nextDhakaTime(hhmm: string, now: Date): Date {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  const [h, min] = m ? [Math.min(23, Number(m[1])), Math.min(59, Number(m[2]))] : [20, 30];
  const local = new Date(now.getTime() + DHAKA);
  let at = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), h, min) - DHAKA;
  if (at < now.getTime() + 15 * 60_000) at += 86_400_000;
  return new Date(at);
}

export type PostWhen = "now" | "best" | "custom";
/** When an automatic post goes out: right away (null), in the best window (8–10 pm Dhaka) or at the admin's time. */
export function autoPostTime(when: PostWhen, customTime: string, now: Date): Date | null {
  if (when === "now") return null;
  if (when === "custom") return nextDhakaTime(customTime, now);
  const hour = new Date(now.getTime() + DHAKA).getUTCHours();
  return hour >= 20 && hour < 22 ? null : nextDhakaTime("20:30", now);
}

/** A failed post may be tried again: up to MAX_ATTEMPTS, waiting 15, 30, 60 minutes. */
export function retryDue(attempts: number, triedAt: Date | null, now: Date): boolean {
  if (attempts >= MAX_ATTEMPTS) return false;
  if (!triedAt) return true;
  return now.getTime() - triedAt.getTime() >= 15 * 60_000 * 2 ** Math.max(0, attempts - 1);
}

/** Facebook said the page key may not post (missing pages_manage_posts, expired or wrong token). */
export const isPermissionProblem = (code: number | null, message: string) => code === 10 || code === 190 || code === 200 || (code !== null && code >= 200 && code <= 299) || /permission|pages_manage_posts|access token/i.test(message);

/** The brand name on a card: at most 40 letters (then "…"), so it never runs past two lines. */
export const cardBrand = (brand: string) => {
  const b = cleanText(brand, 200);
  return b.length > 40 ? `${b.slice(0, 39).trimEnd()}…` : b;
};

/** The brand name's size class: long names get smaller so they fit in two lines. */
export const nameSize = (brand: string) => (brand.length > 26 ? "xl" : brand.length > 12 ? "lg" : "");
