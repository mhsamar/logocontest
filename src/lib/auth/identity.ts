/**
 * Supabase Auth needs an email (or a configured SMS provider) for password
 * sign-in. We authenticate by mobile number, so each account gets an internal
 * address derived from its number. It is never shown and never receives mail.
 */
export function authEmailForPhone(e164: string): string {
  return `${e164.replace(/^\+/, "")}@phone.logocontest.bd`;
}
