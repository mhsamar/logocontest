import "server-only";

/**
 * Stripe's two secrets live only in the server's environment (owner, 2026-10-14); never sent to the browser. The live
 * site needs both; on a local computer the secret key is enough to test (Stripe can't reach it, so the return page
 * confirms the payment instead of the webhook).
 */
export const stripeReady = () => Boolean(process.env.STRIPE_SECRET_KEY && (process.env.STRIPE_WEBHOOK_SECRET || process.env.NODE_ENV !== "production"));
export const stripeSecretKey = () => process.env.STRIPE_SECRET_KEY ?? "";
export const webhookSecret = () => process.env.STRIPE_WEBHOOK_SECRET ?? "";
