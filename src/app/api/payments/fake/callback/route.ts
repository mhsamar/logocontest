import { NextResponse, type NextRequest } from "next/server";
import { isAddonPayment, settleAddonPayment } from "@/lib/contests/addon-payments";
import { announceForPayment } from "@/lib/contests/announce";
import { contestService } from "@/lib/contests/services";
import { getFakeGateway } from "@/lib/payments";

/** Callback from the development test checkout. Verified by FakeGateway's signature. */
export async function POST(request: NextRequest) {
  if (!getFakeGateway()) return new NextResponse("Not found", { status: 404 });

  const form = await request.formData();
  const params = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));

  // Add-ons and extensions bought after launch return to the contest's manage page (C-13b).
  const verified = await getFakeGateway()!.verifyCallback(params);
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
  return NextResponse.redirect(new URL(`/start/result?payment=${result.paymentId}`, request.url), 303);
}
