/**
 * Bangla QR (owner, 2026-10-15): Bangladesh Bank's national QR. People scan one QR with any bank or mobile banking
 * app, and the payment is verified automatically through the Bangla QR API. The API is not public yet, so the method
 * sits in Admin › Payments › Methods, switched off and locked, until it is connected.
 *
 * To connect it once the API details and keys arrive:
 * 1. Put the keys in the server env (never in the code): BANGLA_QR_BASE_URL, BANGLA_QR_MERCHANT_ID,
 *    BANGLA_QR_API_KEY, BANGLA_QR_API_SECRET (see .env.example).
 * 2. Add the gateway behind the PaymentGateway interface (gateway.ts): create the payment and its QR, then verify the
 *    callback, like SSLCommerz and Stripe.
 * 3. Set CONNECTED below to true. The switch in Admin › Payments › Methods then unlocks.
 */
const CONNECTED = false;

const KEYS = ["BANGLA_QR_BASE_URL", "BANGLA_QR_MERCHANT_ID", "BANGLA_QR_API_KEY", "BANGLA_QR_API_SECRET"] as const;

/** True once the code is connected and every key is set on this server. */
export function banglaQrReady(env: Record<string, string | undefined> = process.env, connected = CONNECTED): boolean {
  return connected && KEYS.every((k) => Boolean(env[k]?.trim()));
}
