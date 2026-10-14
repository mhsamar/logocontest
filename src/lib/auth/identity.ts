import { normalizeBdMobile, toE164 } from "@/lib/phone";

/**
 * Accounts created before sign-up asked for an email used an internal address
 * derived from the mobile number. Login still falls back to it for those.
 */
export function authEmailForPhone(e164: string): string {
  return `${e164.replace(/^\+/, "")}@phone.logocontest.bd`;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Lower-cased, trimmed email, or null if it doesn't look like one. */
export function normalizeEmail(input: string): string | null {
  const email = input.trim().toLowerCase();
  return email.length <= 254 && EMAIL.test(email) ? email : null;
}

export type LoginIdentifier = { kind: "email"; email: string } | { kind: "mobile"; mobile: string };

/** P-11 accepts "Mobile number or email". */
export function parseLoginIdentifier(input: string): LoginIdentifier | null {
  const value = input.trim();
  if (value.includes("@")) {
    const email = normalizeEmail(value);
    return email ? { kind: "email", email } : null;
  }
  // A number from another country is typed with its code, +44… or 0044… (owner, 2026-10-14).
  const mobile = /^\s*(\+|00)/.test(value) ? toE164(value) : normalizeBdMobile(value);
  return mobile ? { kind: "mobile", mobile } : null;
}
