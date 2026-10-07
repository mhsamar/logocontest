import { createHmac, timingSafeEqual } from "node:crypto";
import type { CheckoutInput, PaymentGateway, VerifiedCallback } from "./gateway";

/**
 * Local development gateway. "Checkout" is our own test page (/dev/checkout/…)
 * where the developer chooses success or failure. Every value it sends back is
 * HMAC-signed, so a tampered amount or status is rejected just like a real
 * gateway's verification would.
 */
export class FakeGateway implements PaymentGateway {
  readonly name = "fake";

  constructor(private readonly secret: string) {}

  private sign(fields: string[]): string {
    return createHmac("sha256", this.secret).update(fields.join("|")).digest("hex");
  }

  private matches(expected: string, given: string | undefined): boolean {
    if (!given || given.length !== expected.length) return false;
    return timingSafeEqual(Buffer.from(expected), Buffer.from(given));
  }

  async createCheckout(input: CheckoutInput) {
    const params = new URLSearchParams({
      amount: String(input.amount),
      method: input.method,
      sig: this.sign([input.paymentId, String(input.amount), input.method]),
    });
    return { redirectUrl: `/dev/checkout/${input.paymentId}?${params}` };
  }

  /** Used by the test checkout page to confirm the link it was opened with is genuine. */
  checkCheckoutLink(paymentId: string, amount: string, method: string, sig: string | undefined): boolean {
    return this.matches(this.sign([paymentId, amount, method]), sig);
  }

  /** Builds the signed fields the test checkout page posts back. */
  callbackFields(paymentId: string, amount: number, status: "paid" | "failed"): Record<string, string> {
    const txnId = status === "paid" ? `FAKE-${paymentId.slice(0, 8).toUpperCase()}` : "";
    return {
      payment_id: paymentId,
      amount: String(amount),
      status,
      txn_id: txnId,
      sig: this.sign([paymentId, String(amount), status, txnId]),
    };
  }

  async verifyCallback(params: Record<string, string>): Promise<VerifiedCallback | null> {
    const { payment_id, amount, status, txn_id = "", sig } = params;
    if (!payment_id || !amount || (status !== "paid" && status !== "failed")) return null;
    if (!this.matches(this.sign([payment_id, amount, status, txn_id]), sig)) return null;
    const value = Number(amount);
    if (!Number.isInteger(value) || value <= 0) return null;
    return { paymentId: payment_id, status, amount: value, txnId: txn_id || null, raw: params };
  }
}
