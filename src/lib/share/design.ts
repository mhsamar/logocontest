import "server-only";
import { cache } from "react";
import { getContestBySlug, type ContestDetail } from "@/lib/contests/browse";
import { getEntryDetail, type EntryDetail } from "@/lib/entries/queries";
import { isShareableDesign } from "@/lib/entries/rules";
import { isLatin } from "@/lib/og";

export type SharedDesign = { contest: ContestDetail; entry: EntryDetail };

/**
 * One design as a logged-out visitor sees it (owner, 2026-10-18), for its public page and share pictures. Null unless
 * the design may be shared: same rule for everyone, so a signed-in client or designer never shares more than a visitor sees.
 */
export const sharedDesign = cache(async (slug: string, number: number): Promise<SharedDesign | null> => {
  if (!Number.isInteger(number) || number < 1) return null;
  const contest = await getContestBySlug(slug, null);
  if (!contest || !contest.canSeeBrief) return null;
  const forEntries = { ownerId: contest.ownerId, isBlind: contest.isBlind, canSeeBrief: contest.canSeeBrief, status: contest.status, winnerIsPublic: contest.winnerIsPublic };
  const entry = await getEntryDetail(contest.id, number, forEntries, null);
  if (!entry || entry.locked || entry.previews.length === 0) return null;
  const ok = isShareableDesign(
    { status: entry.status, isHidden: entry.hidden },
    { status: contest.rawStatus, isPrivate: contest.isPrivate, isNda: contest.isNda, isBlind: contest.isBlind, winnerIsPublic: contest.winnerIsPublic },
  );
  return ok ? { contest, entry } : null;
});

/** A picture from storage as a data URL for a share card; null when it can't be read. */
export async function pictureDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "image/jpeg";
    // Share cards draw JPEG and PNG only.
    if (!/^image\/(jpeg|png)/.test(type)) return null;
    return `data:${type.split(";")[0]};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
  } catch {
    return null;
  }
}

/** What a share picture says about the design. Brand and name only in Latin letters (the picture's font has no Bangla). */
export function designFacts({ contest, entry }: SharedDesign) {
  const name = entry.designer ? (entry.designer.username ? `@${entry.designer.username}` : entry.designer.name) : null;
  return { number: entry.number, brand: isLatin(contest.brandName) ? contest.brandName : null, by: name && isLatin(name) ? name : null, winner: entry.status === "winner" };
}

/** Share pictures change when a design wins, so they are cached for a day, not forever. */
export const SHARE_PICTURE_HEADERS = { "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400" };
