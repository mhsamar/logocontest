/**
 * Ready-made answers for C-02 (owner, 2026-10-07; the C-06 like/dislike boxes were removed
 * 2026-10-08): five detailed suggestions per box, written from the client's earlier answers
 * (the target audience ones also read the description). Tapping one fills the box;
 * the client can then edit it. Pure functions, built from en/bn messages.
 */
import type { Translate } from "@/lib/i18n/translate";
import { LIMITS, type Brief, type BusinessType } from "./brief";

const fit = (s: string, max: number) => (s.length > max ? s.slice(0, max).trimEnd() : s);

function common(brief: Brief, t: Translate) {
  const type: BusinessType = brief.businessType || "other";
  return {
    brand: brief.brandName.trim() || t("wizard.suggest.yourBrand"),
    noun: t(`wizard.suggest.nouns.${type}`),
    audience: t(`wizard.suggest.audiences.${type}`),
  };
}

/** C-02 "Describe your business" */
export function descriptionSuggestions(brief: Brief, t: Translate): string[] {
  const p = common(brief, t);
  return (["d1", "d2", "d3", "d4", "d5"] as const).map((k) => fit(t(`wizard.suggest.desc.${k}`, p), LIMITS.description.max));
}

// Places we can spot in the client's description (English, Banglish and Bangla spellings).
const CITIES: { key: string; match: RegExp }[] = [
  { key: "dhaka", match: /dhaka|dacca|ঢাকা|mirpur|dhanmondi|uttara|gulshan|banani|mohammadpur|motijheel|মিরপুর|ধানমন্ডি|উত্তরা|গুলশান/ },
  { key: "chattogram", match: /chattogram|chittagong|ctg|চট্টগ্রাম/ },
  { key: "sylhet", match: /sylhet|সিলেট/ },
  { key: "khulna", match: /khulna|খুলনা/ },
  { key: "rajshahi", match: /rajshahi|রাজশাহী/ },
  { key: "barishal", match: /barishal|barisal|বরিশাল/ },
  { key: "rangpur", match: /rangpur|রংপুর/ },
  { key: "mymensingh", match: /mymensingh|ময়মনসিংহ/ },
  { key: "cumilla", match: /cumilla|comilla|কুমিল্লা/ },
  { key: "gazipur", match: /gazipur|গাজীপুর/ },
  { key: "narayanganj", match: /narayanganj|নারায়ণগঞ্জ/ },
  { key: "coxsbazar", match: /cox'?s\s*bazar|কক্সবাজার/ },
];
const ONLINE = /online|facebook|\bfb\b|instagram|website|web\s*site|delivery|e-?commerce|অনলাইন|ফেসবুক|ডেলিভারি/;
const SHOP = /\bshop\b|store|showroom|outlet|stall|branch|office|clinic|centre|center|restaurant|salon|দোকান|শোরুম|অফিস|ক্লিনিক|রেস্টুরেন্ট/;
const STUDENTS = /student|coaching|school|college|university|exam|ছাত্র|শিক্ষার্থী|কোচিং|স্কুল|কলেজ/;
const WOMEN = /women|woman|ladies|girls|bridal|মহিলা|নারী|মেয়ে|ব্রাইডাল/;

const capitalise = (s: string) => s.charAt(0).toLocaleUpperCase() + s.slice(1);

/** C-02 "Target audience" (owner, 2026-10-08): five detailed answers built from the business type and what the client wrote. */
export function audienceSuggestions(brief: Brief, t: Translate): string[] {
  const p = common(brief, t);
  const text = brief.businessDescription.toLowerCase();
  const city = CITIES.find((c) => c.match.test(text));
  const place = city ? t(`wizard.suggest.cities.${city.key as "dhaka"}`) : t("wizard.suggest.audience.everywhere");
  const online = ONLINE.test(text);
  const shop = SHOP.test(text);
  const channel = t(online && !shop ? "wizard.suggest.audience.online" : shop && !online ? "wizard.suggest.audience.shop" : "wizard.suggest.audience.mixed");
  const vars = { ...p, place, channel, audience: capitalise(p.audience) };
  return [
    t("wizard.suggest.audience.a1", vars),
    t(STUDENTS.test(text) || brief.businessType === "education" ? "wizard.suggest.audience.a2Students" : "wizard.suggest.audience.a2", vars),
    t(WOMEN.test(text) || brief.businessType === "beauty" ? "wizard.suggest.audience.a3Women" : "wizard.suggest.audience.a3", vars),
    t("wizard.suggest.audience.a4", vars),
    t("wizard.suggest.audience.a5", vars),
  ].map((s) => fit(s, LIMITS.targetAudience.max));
}

const uniq = (list: string[], max: number, not: string[] = [], caseMatters = false) => {
  const k = (x: string) => (caseMatters ? x : x.toLowerCase());
  const seen = new Set(not.map(k));
  const out: string[] = [];
  for (const s of list.map((x) => x.replace(/\s+/g, " ").trim())) {
    if (!s || s.length > max || seen.has(k(s))) continue;
    seen.add(k(s));
    out.push(s);
  }
  return out;
};
// Letters, marks (Bangla vowel signs), numbers, & and '.
const words = (s: string) => s.replace(/[^\p{L}\p{M}\p{N}&' -]/gu, " ").split(/\s+/).filter(Boolean);
/** Initials only for Latin names: a Bangla letter on its own can be half a character. */
const initialsOf = (w: string[]) => (w.length >= 2 && w.every((x) => /^[A-Za-z0-9]/.test(x)) ? w.map((x) => x.charAt(0)).join("").toUpperCase() : "");

/** C-01 short name (owner, 2026-10-13): built from the brand name — the first word, the first two, the initials. */
export function shortNameSuggestions(brief: Brief): string[] {
  const w = words(brief.brandName);
  if (w.length === 0) return [];
  const initials = initialsOf(w);
  return uniq([w[0], w.slice(0, 2).join(" "), initials, initials ? initials.split("").join(".") : "", w.length >= 3 ? `${w[0]} ${w[w.length - 1]}` : ""], LIMITS.shortName.max, [brief.brandName]);
}

/** C-01 the text in the logo: the brand name as it is, in capitals, the short name, the initials. */
export function logoTextSuggestions(brief: Brief): string[] {
  const name = brief.brandName.trim();
  if (!name) return [];
  const w = words(name);
  const initials = initialsOf(w);
  // Capitals count as their own choice here.
  return uniq([name, name.toLocaleUpperCase(), brief.shortName.trim(), initials, initials ? `${initials} · ${name}` : ""], LIMITS.logoText.max, [], true);
}

/** C-01 slogan: five short lines, one with the brand name. */
export function sloganSuggestions(brief: Brief, t: Translate): string[] {
  const p = common(brief, t);
  return uniq((["s1", "s2", "s3", "s4", "s5"] as const).map((k) => t(`wizard.suggest.slogan.${k}`, p)), LIMITS.slogan.max);
}

/** C-06 other requirements: notes clients often add. */
export function requirementSuggestions(brief: Brief, t: Translate): string[] {
  const p = common(brief, t);
  return uniq((["n1", "n2", "n3", "n4", "n5"] as const).map((k) => t(`wizard.suggest.note.${k}`, p)), LIMITS.requirementsNote.max);
}
