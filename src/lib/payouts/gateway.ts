/**
 * Sending withdrawals (BLUEPRINT §7.3, owner 2026-10-08: automatic for bKash). Every payout
 * provider sits behind this interface; anything a driver can't send waits for an admin.
 */
export type PayoutRequest = { withdrawalId: string; amount: number; bkashNumber: string };

export type PayoutResult = { ok: true; txnId: string } | { ok: false; error: string };

export interface PayoutGateway {
  readonly name: string;
  /** Whether this driver can send bKash payouts by itself. */
  readonly sendsBkash: boolean;
  sendBkash(req: PayoutRequest): Promise<PayoutResult>;
}
