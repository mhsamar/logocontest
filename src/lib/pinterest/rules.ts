/**
 * Pinterest auto-posting (owner, 2026-10-19): what is pinned and how. Pure, so it is easy to test.
 * The site's own Pinterest account is connected once in Admin › Pinterest; the 15-minute job pins new designs.
 */

import { isShareableDesign, type EntryStatus, type PublicDesignContest } from "@/lib/entries/rules";

export const PINTEREST_RULES = ["winners", "winners_public"] as const;
export type PinterestRule = (typeof PINTEREST_RULES)[number];
export type PinKind = "winner" | "design";

/** Read our own boards, read the account name, create pins. Nothing else. */
export const PINTEREST_SCOPES = ["boards:read", "pins:read", "pins:write", "user_accounts:read"];
export const PINTEREST_OAUTH = "https://www.pinterest.com/oauth/";
export const PINTEREST_API = "https://api.pinterest.com/v5";
export const CALLBACK_PATH = "/api/pinterest/callback";

/** Pins per 15-minute run: well under Pinterest's limits, and the board never fills with a burst. */
export const PINS_PER_RUN = 3;
/** A failed pin is tried this many times, waiting an hour longer each time. */
export const MAX_ATTEMPTS = 3;

export function authorizeUrl(o: { clientId: string; redirectUri: string; state: string }): string {
  const q = new URLSearchParams({ client_id: o.clientId, redirect_uri: o.redirectUri, response_type: "code", scope: PINTEREST_SCOPES.join(","), state: o.state });
  return `${PINTEREST_OAUTH}?${q.toString()}`;
}

/** Which pin a design gets under the admin's rule, or null. Only designs a logged-out visitor sees, never NDA. */
export function pinKindFor(rule: PinterestRule, entry: { status: EntryStatus; isHidden?: boolean | null }, contest: PublicDesignContest & { isNda: boolean }): PinKind | null {
  if (!isShareableDesign(entry, contest)) return null;
  if (entry.status === "winner") return "winner";
  if (rule === "winners_public" && entry.status === "active") return "design";
  return null;
}

/** May a design be (re)tried now? Never after it was posted; failed ones wait 1, 2, 3 hours, up to MAX_ATTEMPTS. */
export function dueForPin(prev: { status: "queued" | "posted" | "failed"; attempts: number; createdAt: Date; lastTryAt?: Date | null } | null, now: Date): boolean {
  if (!prev) return true;
  if (prev.status === "posted") return false;
  if (prev.attempts >= MAX_ATTEMPTS) return false;
  const last = prev.lastTryAt ?? prev.createdAt;
  return now.getTime() - last.getTime() >= prev.attempts * 3_600_000;
}

const cut = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`);

/** The pin's title (100), description (500) and alt text (500), in English for Pinterest search. */
export function pinText(o: { brand: string; number: number; designer: string | null; kind: PinKind; service?: string | null }) {
  const what = o.service && o.service !== "logo" ? "design" : "logo";
  const title = o.kind === "winner" ? `Winning ${what} for ${o.brand}` : `${what === "logo" ? "Logo" : "Design"} idea #${o.number} for ${o.brand}`;
  const by = o.designer ? ` by ${o.designer}` : "";
  const description =
    o.kind === "winner"
      ? `The winning ${what}${by} for ${o.brand}, picked in a design contest on logocontest.bd. Get your own ${what} from designers across Bangladesh: start a contest, get many ideas, pay the winner.`
      : `Design #${o.number}${by} for the ${o.brand} contest on logocontest.bd. Designers across Bangladesh send ideas; the client picks the winner. Start your own contest on logocontest.bd.`;
  return { title: cut(title, 100), description: cut(description, 500), altText: cut(`${title}${by}`, 500) };
}

/** Refresh the access token when it ends within two days (Pinterest tokens last 30 days). */
export const needsRefresh = (expiresAt: Date | null, now: Date) => !expiresAt || expiresAt.getTime() - now.getTime() < 2 * 86_400_000;

export const pinUrl = (pinId: string) => `https://www.pinterest.com/pin/${pinId}/`;
