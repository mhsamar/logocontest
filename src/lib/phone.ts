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

// ---------------------------------------------------------------------------------------------------------------
// Mobile numbers from any country (owner, 2026-10-14): Bangladesh first and the default; kept as +<code><number>.
// ---------------------------------------------------------------------------------------------------------------

/** Country (ISO 3166 two letters) → calling code. */
export const CALLING_CODES: Record<string, string> = {
  BD: "880", IN: "91", PK: "92", NP: "977", LK: "94", BT: "975", MV: "960", AF: "93", MM: "95", CN: "86", HK: "852", MO: "853", TW: "886", JP: "81",
  KR: "82", KP: "850", MN: "976", TH: "66", VN: "84", LA: "856", KH: "855", MY: "60", SG: "65", ID: "62", PH: "63", BN: "673", TL: "670",
  AE: "971", SA: "966", QA: "974", KW: "965", BH: "973", OM: "968", YE: "967", IQ: "964", IR: "98", JO: "962", LB: "961", SY: "963", IL: "972",
  PS: "970", TR: "90", CY: "357", GE: "995", AM: "374", AZ: "994", KZ: "7", KG: "996", TJ: "992", TM: "993", UZ: "998", RU: "7", UA: "380",
  BY: "375", MD: "373", GB: "44", IE: "353", FR: "33", DE: "49", IT: "39", ES: "34", PT: "351", NL: "31", BE: "32", LU: "352", CH: "41", AT: "43",
  DK: "45", SE: "46", NO: "47", FI: "358", IS: "354", PL: "48", CZ: "420", SK: "421", HU: "36", RO: "40", BG: "359", GR: "30", HR: "385",
  SI: "386", RS: "381", BA: "387", ME: "382", MK: "389", AL: "355", XK: "383", EE: "372", LV: "371", LT: "370", MT: "356", MC: "377", SM: "378",
  AD: "376", LI: "423", VA: "39", US: "1", CA: "1", MX: "52", GT: "502", BZ: "501", SV: "503", HN: "504", NI: "505", CR: "506", PA: "507",
  CU: "53", JM: "1876", HT: "509", DO: "1809", PR: "1787", TT: "1868", BB: "1246", BS: "1242", AG: "1268", DM: "1767", GD: "1473", KN: "1869",
  LC: "1758", VC: "1784", BM: "1441", KY: "1345", TC: "1649", AI: "1264", AS: "1684", BR: "55", AR: "54", CL: "56", CO: "57", PE: "51",
  VE: "58", EC: "593", BO: "591", PY: "595", UY: "598", GY: "592", SR: "597", AU: "61", NZ: "64", FJ: "679", PG: "675", SB: "677", VU: "678",
  WS: "685", TO: "676", KI: "686", TV: "688", NR: "674", PW: "680", FM: "691", MH: "692", EG: "20", MA: "212", DZ: "213", TN: "216", LY: "218",
  SD: "249", SS: "211", ET: "251", ER: "291", DJ: "253", SO: "252", KE: "254", UG: "256", TZ: "255", RW: "250", BI: "257", NG: "234", GH: "233",
  CI: "225", SN: "221", ML: "223", BF: "226", NE: "227", TG: "228", BJ: "229", GM: "220", GN: "224", GW: "245", SL: "232", LR: "231", MR: "222",
  CV: "238", CM: "237", CF: "236", TD: "235", GA: "241", GQ: "240", CG: "242", CD: "243", AO: "244", ZM: "260", ZW: "263", MW: "265", MZ: "258",
  MG: "261", MU: "230", SC: "248", KM: "269", NA: "264", BW: "267", ZA: "27", LS: "266", SZ: "268", ST: "239",
};

/** Several countries share a code: this one stands for the code. */
const MAIN_FOR_CODE: Record<string, string> = { "1": "US", "7": "RU", "39": "IT", "44": "GB" };
const CODE_TO_COUNTRY = new Map<string, string>();
for (const [iso, code] of Object.entries(CALLING_CODES)) if (!CODE_TO_COUNTRY.has(code) || MAIN_FOR_CODE[code] === iso) CODE_TO_COUNTRY.set(code, iso);

export const isCountry = (iso: unknown): iso is string => typeof iso === "string" && iso in CALLING_CODES;

/** 🇧🇩 from "BD". */
export const flagOf = (iso: string) => String.fromCodePoint(...[...iso.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));

/** The country of an international number (longest matching code), or null. */
export function countryOfMobile(e164: string): string | null {
  const digits = e164.replace(/^\+/, "");
  for (let n = 4; n >= 1; n--) {
    const hit = CODE_TO_COUNTRY.get(digits.slice(0, n));
    if (hit) return hit;
  }
  return null;
}

/**
 * Any country's mobile in international form (+<code><number>), or null. Bangladesh numbers follow the strict
 * Bangladesh rule. A number typed with "+" or "00" carries its own country; otherwise `country` is used.
 */
export function toE164(input: string, country = "BD"): string | null {
  const s = toAsciiDigits(input.trim()).replace(/[\s\-().]/g, "");
  if (!s) return null;
  if (s.startsWith("+") || s.startsWith("00")) {
    const digits = s.replace(/^(\+|00)/, "");
    if (!/^[1-9]\d{6,14}$/.test(digits)) return null;
    if (digits.startsWith("880")) return normalizeBdMobile(digits);
    return countryOfMobile(digits) ? `+${digits}` : null;
  }
  if (!isCountry(country) || country === "BD") return normalizeBdMobile(s);
  if (!/^\d+$/.test(s)) return null;
  // A leading 0 is the country's own trunk prefix, not part of the international number.
  const national = s.replace(/^0+/, "");
  const all = `${CALLING_CODES[country]}${national}`;
  return national.length >= 4 && all.length >= 8 && all.length <= 15 ? `+${all}` : null;
}

/** For people to read: Bangladesh 01712-345678, any other +44 7911123456. */
export function formatMobile(e164: string | null | undefined): string {
  if (!e164) return "";
  if (/^\+8801\d{9}$/.test(e164)) return formatBdMobile(e164);
  const iso = countryOfMobile(e164);
  const code = iso ? CALLING_CODES[iso] : "";
  return code ? `+${code} ${e164.slice(1 + code.length)}` : e164;
}

/** The national part of a stored number, for an input that has the country chosen beside it. */
export function nationalPart(e164: string | null | undefined): { country: string; number: string } {
  if (!e164) return { country: "BD", number: "" };
  if (/^\+8801\d{9}$/.test(e164)) return { country: "BD", number: `0${e164.slice(4)}` };
  const iso = countryOfMobile(e164) ?? "BD";
  return { country: iso, number: e164.slice(1 + (CALLING_CODES[iso]?.length ?? 0)) };
}
