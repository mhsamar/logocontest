import "server-only";
import { cache } from "react";
import sharp from "sharp";
import { getContestBySlug, type ContestDetail } from "@/lib/contests/browse";
import { getEntryDetail, type EntryDetail } from "@/lib/entries/queries";
import { isShareableDesign } from "@/lib/entries/rules";
import { isLatin } from "@/lib/og";
import { internalOrigin } from "@/lib/site-origin";

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
    // The site's own picture links are relative where SITE_URL isn't set (local development).
    const res = await fetch(url.startsWith("/") ? `${await internalOrigin()}${url}` : url, { cache: "no-store" });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "image/jpeg";
    const bytes = Buffer.from(await res.arrayBuffer());
    // Share cards draw JPEG and PNG only; the site's design pictures are WebP since 2026-10-27, so they become a JPEG.
    if (/^image\/(jpeg|png)/.test(type)) return `data:${type.split(";")[0]};base64,${bytes.toString("base64")}`;
    if (!/^image\/webp/.test(type)) return null;
    const jpg = await sharp(bytes).flatten({ background: "#ffffff" }).jpeg({ quality: 90 }).toBuffer();
    return `data:image/jpeg;base64,${jpg.toString("base64")}`;
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

/**
 * A share picture drawn as PNG, sent as a JPEG (owner, 2026-10-27: the PNGs were 0.1–1.2 MB; a quality-85 JPEG looks the
 * same and is what Facebook, WhatsApp and Pinterest take best). Anything that isn't a picture passes through.
 */
export async function asJpeg(drawn: Response, headers: Record<string, string> = SHARE_PICTURE_HEADERS): Promise<Response> {
  if (!drawn.ok) return drawn;
  const jpg = await sharp(Buffer.from(await drawn.arrayBuffer())).flatten({ background: "#ffffff" }).jpeg({ quality: 85, mozjpeg: true }).toBuffer();
  return new Response(new Uint8Array(jpg), { headers: { "Content-Type": "image/jpeg", ...headers } });
}
