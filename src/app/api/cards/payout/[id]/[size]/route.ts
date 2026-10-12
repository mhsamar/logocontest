import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isCardSize } from "@/lib/rewards/card-html";
import { renderPayoutCard } from "@/lib/wallet/payout-card";

// Drawing a card starts headless Chrome, which takes a few seconds the first time.
export const maxDuration = 60;

/** The "Payment sent" card (owner, 2026-10-12): only for the designer who was paid. `?download=1` saves it. */
export async function GET(req: Request, ctx: RouteContext<"/api/cards/payout/[id]/[size]">) {
  const { id, size } = await ctx.params;
  const user = await getCurrentUser();
  if (!user || !isCardSize(size)) return new NextResponse("Not found", { status: 404 });
  try {
    const origin = process.env.SITE_URL?.replace(/\/$/, "") || new URL(req.url).origin;
    const png = await renderPayoutCard(id, user, size, origin);
    if (!png) return new NextResponse("Not found", { status: 404 });
    const download = new URL(req.url).searchParams.get("download") === "1";
    return new NextResponse(Buffer.from(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, max-age=3600",
        ...(download ? { "Content-Disposition": `attachment; filename="logocontest-payment-${size}.png"` } : {}),
      },
    });
  } catch (err) {
    console.error("[payout-card] drawing failed:", err instanceof Error ? err.message : err);
    return new NextResponse("The card could not be made right now.", { status: 503 });
  }
}
