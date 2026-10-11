import { NextResponse } from "next/server";
import { isCardSize } from "@/lib/rewards/card-html";
import { cardPictureUrl, renderWinCard, winCardBySlug } from "@/lib/rewards/win-cards";

// Drawing a card starts headless Chrome, which takes a few seconds the first time.
export const maxDuration = 60;

/**
 * A win card picture (owner, 2026-10-11): the stored PNG when it exists, otherwise it is drawn now, kept, and sent.
 * Public, because the cards are made to be shared (blind, private and NDA contests show the logo blurred).
 */
export async function GET(req: Request, ctx: RouteContext<"/api/cards/win/[slug]/[size]">) {
  const { slug, size } = await ctx.params;
  if (!isCardSize(size)) return new NextResponse("Not found", { status: 404 });
  const card = await winCardBySlug(slug);
  if (!card) return new NextResponse("Not found", { status: 404 });
  const path = size === "square" ? card.squarePath : card.storyPath;
  if (path) return NextResponse.redirect(cardPictureUrl(path), { status: 302 });
  try {
    const origin = process.env.SITE_URL?.replace(/\/$/, "") || new URL(req.url).origin;
    const png = await renderWinCard(card, size, origin);
    return new NextResponse(Buffer.from(png), { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=300" } });
  } catch (err) {
    console.error("[win-card] drawing failed:", err instanceof Error ? err.message : err);
    return new NextResponse("The card could not be made right now.", { status: 503 });
  }
}
