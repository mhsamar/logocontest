import { NextResponse } from "next/server";
import { adminUser } from "@/lib/admin/core";
import { isCardSize } from "@/lib/rewards/card-html";
import { monthlyRewardById, renderMonthlyCard } from "@/lib/rewards/month-close";
import { cardPictureUrl } from "@/lib/rewards/win-cards";

// Drawing a card starts headless Chrome, which takes a few seconds the first time.
export const maxDuration = 60;

/**
 * A monthly prize card picture (owner, 2026-10-11): the stored PNG when it exists, otherwise it is drawn now, kept,
 * and sent. Anyone with the link once the card has gone to the winner (it is made to be shared); before that, only
 * admins who can see Monthly winner (a month held by "Ask me first").
 */
export async function GET(req: Request, ctx: RouteContext<"/api/cards/monthly/[id]/[size]">) {
  const { id, size } = await ctx.params;
  if (!isCardSize(size)) return new NextResponse("Not found", { status: 404 });
  const reward = await monthlyRewardById(id);
  if (!reward || (!reward.sentAt && !(await adminUser("monthly.view")))) return new NextResponse("Not found", { status: 404 });
  const path = size === "square" ? reward.squarePath : reward.storyPath;
  if (path) return NextResponse.redirect(cardPictureUrl(path), { status: 302 });
  try {
    const origin = process.env.SITE_URL?.replace(/\/$/, "") || new URL(req.url).origin;
    const png = await renderMonthlyCard(reward, size, origin);
    return new NextResponse(Buffer.from(png), { headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=300" } });
  } catch (err) {
    console.error("[monthly-card] drawing failed:", err instanceof Error ? err.message : err);
    return new NextResponse("The card could not be made right now.", { status: 503 });
  }
}
