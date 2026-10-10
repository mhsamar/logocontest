/**
 * Every country (ISO 3166-1 alpha-2), for address forms. Bangladesh first (owner, 2026-10-10); the names
 * come from the browser in the page's language (Intl.DisplayNames), so they need no translation files.
 */
const CODES =
  "AF AX AL DZ AS AD AO AI AQ AG AR AM AW AU AT AZ BS BH BB BY BE BZ BJ BM BT BO BQ BA BW BV BR IO BN BG BF BI CV KH CM CA KY CF TD CL CN CX CC CO KM CG CD CK CR CI HR CU CW CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FK FO FJ FI FR GF PF TF GA GM GE DE GH GI GR GL GD GP GU GT GG GN GW GY HT HM VA HN HK HU IS IN ID IR IQ IE IM IL IT JM JP JE JO KZ KE KI KP KR KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MQ MR MU YT MX FM MD MC MN ME MS MA MZ MM NA NR NP NL NC NZ NI NE NG NU NF MK MP NO OM PK PW PS PA PG PY PE PH PN PL PT PR QA RE RO RU RW BL SH KN LC MF PM VC WS SM ST SA SN RS SC SL SG SX SK SI SB SO ZA GS SS ES LK SD SR SJ SE CH SY TW TJ TZ TH TL TG TK TO TT TN TR TM TC TV UG UA AE GB US UM UY UZ VU VE VN VG VI WF EH YE ZM ZW XK".split(
    " ",
  );

export const DEFAULT_COUNTRY = "BD";

export const isCountryCode = (v: string) => v === DEFAULT_COUNTRY || CODES.includes(v);

/** Bangladesh, then every other country A-Z in the given language. */
export function countryOptions(locale: "en" | "bn"): { code: string; name: string }[] {
  const names = new Intl.DisplayNames([locale === "bn" ? "bn" : "en"], { type: "region" });
  const name = (c: string) => names.of(c) ?? c;
  const rest = CODES.map((code) => ({ code, name: name(code) })).sort((a, b) => a.name.localeCompare(b.name, locale === "bn" ? "bn" : "en"));
  return [{ code: DEFAULT_COUNTRY, name: name(DEFAULT_COUNTRY) }, ...rest];
}

/** The country's English name, for the one-line address the admin reads. */
export const countryName = (code: string) => new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
