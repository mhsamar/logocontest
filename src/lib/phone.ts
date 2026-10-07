const BANGLA_DIGITS = "০১২৩৪৫৬৭৮৯";

export function toAsciiDigits(input: string): string {
  return input.replace(/[০-৯]/g, (d) => String(BANGLA_DIGITS.indexOf(d)));
}

/**
 * Normalises a Bangladeshi mobile number to E.164 (+8801XXXXXXXXX).
 * Accepts 01712345678, 01712-345678, +8801712345678, 8801712345678, Bangla digits.
 * Returns null when the input is not a valid BD mobile number.
 */
export function normalizeBdMobile(input: string): string | null {
  let s = toAsciiDigits(input.trim()).replace(/[\s\-().]/g, "");
  if (s.startsWith("+")) s = s.slice(1);
  else if (s.startsWith("00")) s = s.slice(2);
  if (s.startsWith("880")) s = s.slice(3);
  if (s.startsWith("0")) s = s.slice(1);
  if (!/^1[3-9]\d{8}$/.test(s)) return null;
  return `+880${s}`;
}

/** +8801712345678 → 01712-345678 */
export function formatBdMobile(e164: string): string {
  const local = `0${e164.replace(/^\+880/, "")}`;
  return `${local.slice(0, 5)}-${local.slice(5)}`;
}

/** +8801712345678 → 01712-•••678, for showing where a code was sent. */
export function maskBdMobile(e164: string): string {
  const formatted = formatBdMobile(e164);
  return `${formatted.slice(0, 6)}•••${formatted.slice(-3)}`;
}
