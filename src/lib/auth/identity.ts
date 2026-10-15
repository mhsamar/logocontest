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

export type LoginIdentifier = { kind: "email"; email: string } | { kind: "mobile"; mobile: string } | { kind: "username"; username: string };

/** A username typed to log in (owner, 2026-10-15): starts with a letter, then letters, digits, _ or -. */
const LOGIN_USERNAME = /^@?[a-z][a-z0-9_-]{1,59}$/i;

/** P-11 accepts a mobile number, an email or a username. */
export function parseLoginIdentifier(input: string): LoginIdentifier | null {
  const value = input.trim();
  // "@name" is a username; anything else with an @ is an email.
  if (value.includes("@") && !value.startsWith("@")) {
    const email = normalizeEmail(value);
    return email ? { kind: "email", email } : null;
  }
  // A number from another country is typed with its code, +44… or 0044… (owner, 2026-10-14).
  const mobile = /^\s*(\+|00)/.test(value) ? toE164(value) : normalizeBdMobile(value);
  if (mobile) return { kind: "mobile", mobile };
  // Or the person's username (owner, 2026-10-15).
  return LOGIN_USERNAME.test(value) ? { kind: "username", username: value.replace(/^@/, "").toLowerCase() } : null;
}
