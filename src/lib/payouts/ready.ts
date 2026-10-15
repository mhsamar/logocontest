/**
 * Automatic bKash withdrawals (owner, 2026-10-15): switched on in Admin › Withdrawals once bKash's payout
 * (disbursement) API is connected. Until then the switch is locked and every withdrawal waits for an admin.
 *
 * To connect it once bKash approves the payout account and gives the API details:
 * 1. Put the keys in the server env (never in the code): BKASH_PAYOUT_BASE_URL, BKASH_PAYOUT_APP_KEY,
 *    BKASH_PAYOUT_APP_SECRET, BKASH_PAYOUT_USERNAME, BKASH_PAYOUT_PASSWORD (see .env.example).
 * 2. Send the money in BkashPayouts.sendBkash (payouts/index.ts) and set its sendsBkash to true.
 * 3. Set CONNECTED below to true. The switch in Admin › Withdrawals then unlocks.
 */
const CONNECTED = false;

const KEYS = ["BKASH_PAYOUT_BASE_URL", "BKASH_PAYOUT_APP_KEY", "BKASH_PAYOUT_APP_SECRET", "BKASH_PAYOUT_USERNAME", "BKASH_PAYOUT_PASSWORD"] as const;

/** True once the code is connected and every key is set on this server. */
export function bkashPayoutsReady(env: Record<string, string | undefined> = process.env, connected = CONNECTED): boolean {
  return connected && KEYS.every((k) => Boolean(env[k]?.trim()));
}
