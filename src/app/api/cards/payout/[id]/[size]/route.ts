import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isCardSize } from "@/lib/rewards/card-html";
import { cardJpeg, cardWebp } from "@/lib/rewards/card-picture";
import { renderPayoutCard } from "@/lib/wallet/payout-card";

// Drawing a card starts headless Chrome, which takes a few seconds the first time.
export const maxDuration = 60;

/**
 * The "Payment sent" card (owner, 2026-10-12): only for the designer who was paid. Pages get a small WebP (640 px);
 * `?download=1` saves the full card as a JPEG (owner, 2026-10-27). The browser keeps it for a week, because a paid
 * card never changes and drawing it takes a few seconds.
 */
export async function GET(req: Request, ctx: RouteContext<"/api/cards/payout/[id]/[size]">) {
  const { id, size } = await ctx.params;
  const user = await getCurrentUser();
  if (!user || !isCardSize(size)) return new NextResponse("Not found", { status: 404 });
  try {
    const origin = process.env.SITE_URL?.replace(/\/$/, "") || new URL(req.url).origin;
    const png = await renderPayoutCard(id, user, size, origin);
    if (!png) return new NextResponse("Not found", { status: 404 });
    const download = new URL(req.url).searchParams.get("download") === "1";
    const picture = download ? await cardJpeg(png) : await cardWebp(png, 640);
    return new NextResponse(Buffer.from(picture), {
      headers: {
        "Content-Type": download ? "image/jpeg" : "image/webp",
        "Cache-Control": "private, max-age=604800",
        ...(download ? { "Content-Disposition": `attachment; filename="logocontest-payment-${size}.jpg"` } : {}),
      },
    });
  } catch (err) {
    console.error("[payout-card] drawing failed:", err instanceof Error ? err.message : err);
    return new NextResponse("The card could not be made right now.", { status: 503 });
  }
}
