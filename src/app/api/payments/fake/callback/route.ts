import { NextResponse, type NextRequest } from "next/server";
import { contestService } from "@/lib/contests/services";
import { getFakeGateway } from "@/lib/payments";

/** Callback from the development test checkout. Verified by FakeGateway's signature. */
export async function POST(request: NextRequest) {
  if (!getFakeGateway()) return new NextResponse("Not found", { status: 404 });

  const form = await request.formData();
  const params = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)]));
  const result = await contestService().handleCallback(params);

  if (!result.ok) {
    return new NextResponse(`Payment could not be verified (${result.error}).`, { status: 400 });
  }
  return NextResponse.redirect(new URL(`/start/result?payment=${result.paymentId}`, request.url), 303);
}
