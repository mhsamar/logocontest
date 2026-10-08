import { normalizeBdMobile } from "@/lib/phone";

/** Designer sign-up rules (UI-JOURNEY D-01). Pure, so they run the same in the browser and on the server. */

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;

const RESERVED = new Set([
  "admin", "administrator", "support", "help", "logocontest", "logocontestbd", "official", "staff", "moderator",
  "root", "system", "client", "designer", "designers", "contest", "contests", "winner", "winners", "api", "www",
]);

export type UsernameError = "short" | "long" | "format" | "reserved";

/** Lower-cases and checks a username. Returns the clean value or why it isn't allowed. */
export function checkUsernameFormat(input: string): { ok: true; username: string } | { ok: false; error: UsernameError } {
  const username = input.trim().toLowerCase();
  if (username.length < USERNAME_MIN) return { ok: false, error: "short" };
  if (username.length > USERNAME_MAX) return { ok: false, error: "long" };
  if (!/^[a-z][a-z0-9_]*$/.test(username)) return { ok: false, error: "format" };
  if (RESERVED.has(username) || RESERVED.has(username.replace(/_/g, ""))) return { ok: false, error: "reserved" };
  return { ok: true, username };
}

/** Suggests a username from the designer's name, e.g. "Rafi Ahmed" -> "rafi_ahmed". */
export function suggestUsername(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^[0-9_]+/, "")
    .slice(0, USERNAME_MAX);
  return base.length >= USERNAME_MIN ? base : "";
}

export type PayoutInput =
  | { type: "bkash"; bkashNumber: string }
  | { type: "bank"; bankName: string; branch: string; accountName: string; accountNumber: string; routingNumber: string };

export type PayoutField = "bkashNumber" | "bankName" | "accountName" | "accountNumber" | "routingNumber";

export type CleanPayout =
  | { type: "bkash"; bkash_number: string }
  | { type: "bank"; bank_name: string; branch: string | null; account_name: string; account_number: string; routing_number: string | null };

/** Checks the payout step. Returns the row to store, or the first field that is wrong. */
export function checkPayout(input: PayoutInput): { ok: true; payout: CleanPayout } | { ok: false; field: PayoutField } {
  if (input.type === "bkash") {
    const number = normalizeBdMobile(input.bkashNumber);
    return number ? { ok: true, payout: { type: "bkash", bkash_number: number } } : { ok: false, field: "bkashNumber" };
  }
  const text = (v: string, max: number) => v.trim().replace(/\s+/g, " ").slice(0, max);
  const bankName = text(input.bankName, 80);
  const accountName = text(input.accountName, 80);
  const accountNumber = input.accountNumber.replace(/[\s-]/g, "");
  const routing = input.routingNumber.replace(/\s/g, "");
  if (bankName.length < 2) return { ok: false, field: "bankName" };
  if (accountName.length < 2) return { ok: false, field: "accountName" };
  if (!/^\d{6,20}$/.test(accountNumber)) return { ok: false, field: "accountNumber" };
  if (routing && !/^\d{9}$/.test(routing)) return { ok: false, field: "routingNumber" };
  return {
    ok: true,
    payout: {
      type: "bank",
      bank_name: bankName,
      branch: text(input.branch, 80) || null,
      account_name: accountName,
      account_number: accountNumber,
      routing_number: routing || null,
    },
  };
}
