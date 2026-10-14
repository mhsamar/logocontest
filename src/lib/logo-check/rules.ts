/**
 * AI copyright checker rules (owner, 2026-10-10; BLUEPRINT §7.7). Pure: used by the server job, the pages
 * and the tests. The numbers come from Settings.
 */

export type CheckStatus = "queued" | "running" | "done" | "failed";
export type Verdict = "no_match" | "similar" | "high_risk";
export type MatchSource = "lens" | "vision" | "site";
/**
 * Owner, 2026-10-14: the checker is free on every logo contest ("free"); the ৳500 add-on is gone. "paid" is kept
 * only to read older contests that bought it; "locked" is never given to a logo contest any more.
 */
export type CheckAccess = "free" | "paid" | "locked";

export type CheckLimits = {
  /** Checks for each full ৳1,000 of prize (owner, 2026-10-14: 15, so ৳3,000 → 45). */
  perThousand: number;
  /** Checks per contest when the checker is free (owner, 2026-10-13: 20; not used since 2026-10-14). */
  freeChecks: number;
  /** Checks the paid add-on gives (owner, 2026-10-13: 10). */
  paidChecks: number;
  /** Prize (taka) from which the checker is free. */
  freeFrom: number;
  /** Add-on price (taka) below the free prize. */
  price: number;
  /** Similarity (0-100) from which a found logo counts as close. */
  closeFrom: number;
  /** Similarity (0-100) from which the result is High risk. */
  highRiskFrom: number;
};

/** Contest statuses in which the client may run a check: judging time, before a winner is picked. */
// Owner, 2026-10-11: also after a winner is picked (the "You picked a winner" pop-up offers the checker).
export const CHECKABLE_STATUSES = ["open", "judging", "winner_selected", "handover"] as const;
export const isCheckable = (status: string) => (CHECKABLE_STATUSES as readonly string[]).includes(status);

/** Every logo contest has the checker free (owner, 2026-10-14). */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function accessFor(_prize: number, _addonBought: boolean, _limits?: unknown): CheckAccess {
  return "free";
}

/**
 * Checks a logo contest gets (owner, 2026-10-14): 15 for each full ৳1,000 of prize (৳1,000 → 15, ৳3,000 → 45,
 * ৳5,000 → 75). A contest that bought the old add-on keeps at least the checks it paid for.
 */
export const limitFor = (prize: number, addonBought: boolean, limits: Pick<CheckLimits, "perThousand" | "paidChecks">) =>
  Math.max(Math.floor(Math.max(0, prize) / 1000) * limits.perThousand, addonBought ? limits.paidChecks : 0);

export const checksLeft = (used: number, limit: number) => Math.max(0, limit - used);

/** The verdict from the similarity of every found logo. */
export function verdictFor(similarities: number[], limits: Pick<CheckLimits, "closeFrom" | "highRiskFrom">): Verdict {
  const top = similarities.length ? Math.max(...similarities) : 0;
  if (top >= limits.highRiskFrom) return "high_risk";
  if (top >= limits.closeFrom) return "similar";
  return "no_match";
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** Uniqueness is the opposite of the closest similarity found. */
export const uniquenessScore = (closest: number) => clamp(100 - closest);

/** Overall: half uniqueness, a quarter each legibility and colour. */
export const overallScore = (uniqueness: number, legibility: number, colour: number) => clamp(uniqueness * 0.5 + legibility * 0.25 + colour * 0.25);

/** CC-0001 */
export const certNumber = (n: number) => `CC-${String(n).padStart(4, "0")}`;

/** "CC-0003", "cc-3" or "3" → 3; anything else → null. */
export function parseCertNumber(input: string): number | null {
  const m = /^(?:CC-?)?0*(\d{1,7})$/i.exec(input.trim());
  if (!m) return null;
  const n = Number(m[1]);
  return n > 0 ? n : null;
}

/** Host of a URL without "www.", or null. */
export function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    return u.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** True when the URL is on one of these hosts (or a subdomain of one): our own site, the client's site. */
export function isOnHosts(url: string | null | undefined, hosts: (string | null)[]): boolean {
  const h = hostOf(url);
  if (!h) return false;
  return hosts.some((x) => !!x && (h === x || h.endsWith(`.${x}`)));
}

/** Only plain https links on public hosts are fetched (no local or private addresses). */
export function isFetchableUrl(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return false;
  if (/^\[.*\]$/.test(h)) return false; // IPv6 literals
  const ip = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (ip) {
    const [a, b] = [Number(ip[1]), Number(ip[2])];
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)) return false;
  }
  return true;
}
