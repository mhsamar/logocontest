import { normalizeBdMobile, toAsciiDigits } from "@/lib/phone";

/** Designer originality agreement rules (BLUEPRINT §9.6, owner 2026-10-09). Pure, so they are tested. */

export const ID_TYPES = ["nid", "passport", "birth_certificate"] as const;
export type IdType = (typeof ID_TYPES)[number];
export const isIdType = (v: string): v is IdType => (ID_TYPES as readonly string[]).includes(v);

/** Spaces and dashes out, Bangla digits to ASCII, letters upper-case. */
export function normalizeIdNumber(raw: string): string {
  return toAsciiDigits(raw)
    .replace(/[\s\-./]/g, "")
    .toUpperCase();
}

/** NID: 10, 13 or 17 digits. Birth certificate: 17 digits. Passport: 6–9 letters and digits with at least one digit. */
export function validIdNumber(type: IdType, n: string): boolean {
  if (type === "nid") return /^(\d{10}|\d{13}|\d{17})$/.test(n);
  if (type === "birth_certificate") return /^\d{17}$/.test(n);
  return /^[A-Z0-9]{6,9}$/.test(n) && /\d/.test(n);
}

/** Always six dots and the last four, so the length is not shown either: ••••••3456. */
export function maskIdNumber(n: string): string {
  return `••••••${n.slice(-4)}`;
}

const squash = (s: string) => s.normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase();

/** The typed signature must be the full name given above (case and extra spaces ignored). */
export function signatureMatches(fullName: string, signature: string): boolean {
  return squash(fullName) !== "" && squash(fullName) === squash(signature);
}

export type AgreementInput = { fullName: string; mobile: string; address: string; idType: string; idNumber: string; signature: string; agreed: boolean };
export type AgreementField = "fullName" | "mobile" | "address" | "idType" | "idNumber" | "signature" | "agreed";
export type AgreementValues = { fullName: string; mobile: string; address: string; idType: IdType; idNumber: string; signature: string };

/** Checks and cleans the form. Returns the cleaned values, or the first problem per field. */
export function checkAgreement(input: AgreementInput): { ok: true; values: AgreementValues } | { ok: false; errors: Partial<Record<AgreementField, true>> } {
  const errors: Partial<Record<AgreementField, true>> = {};
  const fullName = input.fullName.replace(/\s+/g, " ").trim();
  const address = input.address.replace(/\s+/g, " ").trim();
  const signature = input.signature.replace(/\s+/g, " ").trim();
  const mobile = normalizeBdMobile(input.mobile);
  const idNumber = normalizeIdNumber(input.idNumber);

  if (fullName.length < 3 || fullName.length > 80) errors.fullName = true;
  if (!mobile) errors.mobile = true;
  if (address.length < 10 || address.length > 300) errors.address = true;
  if (!isIdType(input.idType)) errors.idType = true;
  else if (!validIdNumber(input.idType, idNumber)) errors.idNumber = true;
  if (!signatureMatches(fullName, signature)) errors.signature = true;
  if (!input.agreed) errors.agreed = true;

  if (Object.keys(errors).length > 0 || !mobile || !isIdType(input.idType)) return { ok: false, errors };
  return { ok: true, values: { fullName, mobile, address, idType: input.idType, idNumber, signature } };
}

/** The address in parts (owner, 2026-10-10): house, road, area, post code and country. */
export type AddressParts = { house: string; road: string; area: string; postCode: string; country: string };
export type AddressField = "house" | "area" | "country";

const clean = (s: string, max: number) => s.replace(/\s+/g, " ").trim().slice(0, max);

/**
 * Checks the parts and joins them into the one-line address the rest of the site shows. House, area and
 * country are needed; the road and post code are not (villages often have neither).
 */
export function joinAddress(raw: AddressParts, countryName: (code: string) => string, isCountry: (code: string) => boolean): { ok: true; parts: AddressParts; line: string } | { ok: false; errors: Partial<Record<AddressField, true>> } {
  const parts: AddressParts = { house: clean(raw.house, 80), road: clean(raw.road, 80), area: clean(raw.area, 80), postCode: clean(toAsciiDigits(raw.postCode), 12), country: raw.country.trim().toUpperCase() };
  const errors: Partial<Record<AddressField, true>> = {};
  if (parts.house.length < 1) errors.house = true;
  if (parts.area.length < 2) errors.area = true;
  if (!isCountry(parts.country)) errors.country = true;
  if (Object.keys(errors).length) return { ok: false, errors };
  const line = [parts.house, parts.road, parts.area, parts.postCode, countryName(parts.country)].filter(Boolean).join(", ");
  return { ok: true, parts, line };
}

/** A national ID card needs both sides; a passport or birth certificate needs one photo (owner, 2026-10-10). */
export const needsBackPhoto = (type: IdType) => type === "nid";
