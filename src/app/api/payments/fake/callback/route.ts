import { NextResponse, type NextRequest } from "next/server";
import { isAddonPayment, settleAddonPayment } from "@/lib/contests/addon-payments";
import { announceForPayment } from "@/lib/contests/announce";
import { contestService } from "@/lib/contests/services";
import { getFakeGateway } from "@/lib/payments";
import { isProPayment, settleProPayment } from "@/lib/pro/payments";
import { markContestPromoUsed } from "@/lib/promos/promos";

/** Callback from the development test checkout. Verified by FakeGateway's signature. */
export async function POST(request: NextRequest) {
  if (!getFakeGateway()) return new NextResponse("Not found", { status: 404 });

  const form = await request.formData();
  const params = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));

  // Add-ons and extensions bought after launch return to the contest's manage page (C-13b).
  const verified = await getFakeGateway()!.verifyCallback(params);
  // Designer Pro plan (owner, 2026-10-13): back to the Pro checkout with the result. The real gateway does the same.
  if (verified && (await isProPayment(verified.paymentId))) {
    const settled = await settleProPayment(verified);
    if (settled.status === "error") return new NextResponse("Payment could not be verified.", { status: 400 });
    return NextResponse.redirect(new URL(`/pro/checkout?status=${settled.status === "paid" ? "success" : "failed"}&payment=${settled.paymentId}`, request.url), 303);
  }
  if (verified && (await isAddonPayment(verified.paymentId))) {
    const settled = await settleAddonPayment(verified);
    const to = settled.slug ? `/dashboard/contests/${settled.slug}?payment=${settled.status}` : "/dashboard";
    return NextResponse.redirect(new URL(to, request.url), 303);
  }

  const result = await contestService().handleCallback(params);

  if (!result.ok) {
    return new NextResponse(`Payment could not be verified (${result.error}).`, { status: 400 });
  }
  // Every designer hears about the new contest (owner, 2026-10-09). The real gateway callback must do the same.
  if (result.status === "paid") await announceForPayment(result.paymentId);
  // A client fee code on the contest (owner, 2026-10-14) counts as used. The real gateway callback must do the same.
  if (result.status === "paid") await markContestPromoUsed(result.paymentId);
  return NextResponse.redirect(new URL(`/start/result?payment=${result.paymentId}`, request.url), 303);
}
