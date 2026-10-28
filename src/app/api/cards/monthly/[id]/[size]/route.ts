import { NextResponse } from "next/server";
import { adminUser } from "@/lib/admin/core";
import { isCardSize } from "@/lib/rewards/card-html";
import { cardViewWidth, cardWebp } from "@/lib/rewards/card-picture";
import { monthlyRewardById, renderMonthlyCard } from "@/lib/rewards/month-close";
import { REWARD_CARDS_BUCKET, cardPictureUrl } from "@/lib/rewards/win-cards";
import { getFileStorage } from "@/lib/storage";

// Drawing a card starts headless Chrome, which takes a few seconds the first time.
export const maxDuration = 60;

/**
 * A monthly prize card picture (owner, 2026-10-11): the stored picture when it exists, otherwise it is drawn now, kept,
 * and sent. Anyone with the link once the card has gone to the winner (it is made to be shared); before that, only
 * admins who can see Monthly winner (a month held by "Ask me first"). `?w=640` (or 320) is the small WebP copy pages
 * show, kept by the CDN for a week once the card has gone out (owner, 2026-10-27).
 */
export async function GET(req: Request, ctx: RouteContext<"/api/cards/monthly/[id]/[size]">) {
  const { id, size } = await ctx.params;
  if (!isCardSize(size)) return new NextResponse("Not found", { status: 404 });
  const width = cardViewWidth(new URL(req.url).searchParams.get("w"));
  const reward = await monthlyRewardById(id);
  if (!reward || (!reward.sentAt && !(await adminUser("monthly.view")))) return new NextResponse("Not found", { status: 404 });
  const path = size === "square" ? reward.squarePath : reward.storyPath;
  if (path && !width) return NextResponse.redirect(cardPictureUrl(path), { status: 302 });
  try {
    const origin = process.env.SITE_URL?.replace(/\/$/, "") || new URL(req.url).origin;
    const picture = path ? await getFileStorage().download(REWARD_CARDS_BUCKET, path) : await renderMonthlyCard(reward, size, origin);
    const keep = reward.sentAt ? "public, max-age=86400, s-maxage=604800" : "private, max-age=300";
    if (width) return new NextResponse(Buffer.from(await cardWebp(picture, width)), { headers: { "Content-Type": "image/webp", "Cache-Control": keep } });
    return new NextResponse(Buffer.from(picture), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=300" } });
  } catch (err) {
    console.error("[monthly-card] drawing failed:", err instanceof Error ? err.message : err);
    return new NextResponse("The card could not be made right now.", { status: 503 });
  }
}
