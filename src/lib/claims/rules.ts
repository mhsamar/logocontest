/** Copy claims on the winning design and the payout hold (BLUEPRINT §7.3, §7.6, owner 2026-10-09). Pure, so they are tested. */

const DAY = 24 * 60 * 60 * 1000;

export const CLAIM_NOTE_MIN = 20;
export const CLAIM_NOTE_MAX = 1000;
/** Pictures that show the copy, on top of the links (owner, 2026-10-10). */
export const CLAIM_MAX_PHOTOS = 3;
export const CLAIM_MAX_LINKS = 5;
export const CLAIM_DECISIONS = ["rejected", "correction", "fine", "ban"] as const;
export type ClaimDecision = (typeof CLAIM_DECISIONS)[number];
export const isClaimDecision = (v: string): v is ClaimDecision => (CLAIM_DECISIONS as readonly string[]).includes(v);

/** The claim window and the payout hold both end this many days after the winner was picked. */
export function claimWindowEnds(pickedAt: Date, days: number): Date {
  return new Date(pickedAt.getTime() + days * DAY);
}

/** Handovers a claim can be made on: anything still live or approved. */
const CLAIMABLE = new Set(["awaiting_files", "submitted", "revision_requested", "approved"]);

export function canOpenClaim(h: { status: string; pickedAt: Date }, now: Date, days: number, hasOpenClaim: boolean): boolean {
  return CLAIMABLE.has(h.status) && !hasOpenClaim && now < claimWindowEnds(h.pickedAt, days);
}

/** Up to five distinct http(s) links; anything else is dropped. Returns null when a non-empty line is not a link. */
export function cleanEvidenceUrls(lines: string[]): string[] | null {
  const out: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    let url: URL;
    try {
      url = new URL(/^https?:\/\//i.test(line) ? line : `https://${line}`);
    } catch {
      return null;
    }
    if (!/^https?:$/.test(url.protocol) || !url.hostname.includes(".")) return null;
    const href = url.toString();
    if (!out.includes(href)) out.push(href);
  }
  return out.slice(0, CLAIM_MAX_LINKS);
}

/** A held prize: approved, not yet in the wallet. Available from the end of the hold, unless a claim is open. */
export function heldPrizeAvailableAt(pickedAt: Date, days: number, claimOpen: boolean): Date | null {
  return claimOpen ? null : claimWindowEnds(pickedAt, days);
}
