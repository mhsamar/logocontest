import "server-only";
import { randomBytes } from "node:crypto";
import type { PayoutGateway, PayoutRequest, PayoutResult } from "./gateway";

export type { PayoutGateway, PayoutRequest, PayoutResult };

/** Development: every bKash payout succeeds at once with a FAKE transaction ID. Never in production. */
class FakePayouts implements PayoutGateway {
  readonly name = "fake";
  readonly sendsBkash = true;
  async sendBkash(): Promise<PayoutResult> {
    return { ok: true, txnId: `FAKE-${randomBytes(4).toString("hex").toUpperCase()}` };
  }
}

/** Nothing is sent: every withdrawal waits in the admin queue. */
class ManualPayouts implements PayoutGateway {
  readonly name = "manual";
  readonly sendsBkash = false;
  async sendBkash(): Promise<PayoutResult> {
    return { ok: false, error: "manual" };
  }
}

/**
 * bKash disbursement. Switched on once the merchant payout credentials are in the environment
 * (BKASH_PAYOUT_BASE_URL, BKASH_PAYOUT_APP_KEY, BKASH_PAYOUT_APP_SECRET, BKASH_PAYOUT_USERNAME,
 * BKASH_PAYOUT_PASSWORD). Until bKash approves the payout account and its API is wired here,
 * it sends nothing and the request goes to the admin queue, so no money is ever lost.
 */
class BkashPayouts implements PayoutGateway {
  readonly name = "bkash";
  readonly sendsBkash = false;
  async sendBkash(req: PayoutRequest): Promise<PayoutResult> {
    void req;
    return { ok: false, error: "bkash_not_connected" };
  }
}

export function payoutDriver(): string {
  return process.env.PAYOUT_DRIVER ?? (process.env.NODE_ENV === "production" ? "manual" : "fake");
}

export function getPayoutGateway(): PayoutGateway {
  const driver = payoutDriver();
  switch (driver) {
    case "fake":
      if (process.env.NODE_ENV === "production") throw new Error("PAYOUT_DRIVER=fake is not allowed in production");
      return new FakePayouts();
    case "manual":
      return new ManualPayouts();
    case "bkash":
      return new BkashPayouts();
    default:
      throw new Error(`Unknown PAYOUT_DRIVER "${driver}"`);
  }
}
