import { NextResponse } from "next/server";
import { isCardSize } from "@/lib/rewards/card-html";
import { cardViewWidth, cardWebp } from "@/lib/rewards/card-picture";
import { REWARD_CARDS_BUCKET, cardPictureUrl, renderWinCard, winCardBySlug } from "@/lib/rewards/win-cards";
import { getFileStorage } from "@/lib/storage";

// Drawing a card starts headless Chrome, which takes a few seconds the first time.
export const maxDuration = 60;

/**
 * A win card picture (owner, 2026-10-11): the stored picture when it exists, otherwise it is drawn now, kept, and sent.
 * Public, because the cards are made to be shared (blind, private and NDA contests show the logo blurred). `?w=640`
 * (or 320) is the small WebP copy pages show, kept by the CDN for a week (owner, 2026-10-27).
 */
export async function GET(req: Request, ctx: RouteContext<"/api/cards/win/[slug]/[size]">) {
  const { slug, size } = await ctx.params;
  if (!isCardSize(size)) return new NextResponse("Not found", { status: 404 });
  const width = cardViewWidth(new URL(req.url).searchParams.get("w"));
  const card = await winCardBySlug(slug);
  if (!card) return new NextResponse("Not found", { status: 404 });
  const path = size === "square" ? card.squarePath : card.storyPath;
  if (path && !width) return NextResponse.redirect(cardPictureUrl(path), { status: 302 });
  try {
    const origin = process.env.SITE_URL?.replace(/\/$/, "") || new URL(req.url).origin;
    const picture = path ? await getFileStorage().download(REWARD_CARDS_BUCKET, path) : await renderWinCard(card, size, origin);
    if (width) return new NextResponse(Buffer.from(await cardWebp(picture, width)), { headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=86400, s-maxage=604800" } });
    return new NextResponse(Buffer.from(picture), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=300" } });
  } catch (err) {
    console.error("[win-card] drawing failed:", err instanceof Error ? err.message : err);
    return new NextResponse("The card could not be made right now.", { status: 503 });
  }
}
