import { NextResponse, type NextRequest } from "next/server";
import { stripeReady, webhookSecret } from "@/lib/payments/stripe-config";
import { toSession, verifyStripeSignature } from "@/lib/payments/stripe-rules";
import { settleSession } from "@/lib/payments/stripe-settle";

export const dynamic = "force-dynamic";

/**
 * Stripe's webhook (owner, 2026-10-14). Set it in Stripe › Developers › Webhooks to
 * https://<site>/api/payments/stripe/webhook with the checkout.session.* events below. Only a request signed with
 * STRIPE_WEBHOOK_SECRET is used; the payment is then checked against our own record before anything changes.
 */
export async function POST(req: NextRequest) {
  if (!stripeReady()) return new NextResponse("Not found", { status: 404 });
  const raw = await req.text();
  if (!verifyStripeSignature(raw, req.headers.get("stripe-signature"), webhookSecret(), Math.floor(Date.now() / 1000))) {
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }
  let event: { type?: string; data?: { object?: Record<string, unknown> } };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad body" }, { status: 400 });
  }
  const obj = event.data?.object;
  if (obj && obj.object === "checkout.session") {
    const session = toSession(obj);
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
      case "checkout.session.expired":
        await settleSession(session);
        break;
      case "checkout.session.async_payment_failed":
        await settleSession(session, { failed: true });
        break;
    }
  }
  // Anything else is acknowledged so Stripe doesn't keep sending it.
  return NextResponse.json({ received: true });
}
