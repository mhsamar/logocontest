export type PaymentMethod = "bkash" | "card";

export type CheckoutInput = {
  paymentId: string;
  amount: number;
  method: PaymentMethod;
  description: string;
  customer: { name: string; mobile: string };
};

export type VerifiedCallback = {
  paymentId: string;
  status: "paid" | "failed";
  amount: number;
  txnId: string | null;
  raw: Record<string, string>;
};

/**
 * Every payment provider sits behind this interface (BLUEPRINT §4).
 * FakeGateway is for local development; SSLCommerz is added in milestone 9.
 */
export interface PaymentGateway {
  readonly name: string;
  createCheckout(input: CheckoutInput): Promise<{ redirectUrl: string }>;
  /** Returns null when the callback cannot be trusted (bad signature, missing fields). */
  verifyCallback(params: Record<string, string>): Promise<VerifiedCallback | null>;
}
