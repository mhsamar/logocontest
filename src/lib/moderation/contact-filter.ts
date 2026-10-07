import { toAsciiDigits } from "@/lib/phone";

/**
 * No-contact filter (BLUEPRINT §10). Comments, bios, logo stories, brief text
 * and file names must not carry a way to reach someone off the site.
 */
export type ContactKind = "phone" | "number_words" | "email" | "link" | "term";

// Number words in English, Bangla and Banglish. Six or more in a row is a spelled-out phone number.
const NUMBER_WORDS = new Set([
  "zero", "oh", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "শূন্য", "এক", "দুই", "তিন", "চার", "পাঁচ", "ছয়", "ছয়", "সাত", "আট", "নয়", "নয়",
  "shunno", "shunyo", "sunno", "ek", "dui", "tin", "teen", "char", "chaar", "panch", "pach", "pas",
  "choy", "chhoy", "choi", "sat", "shat", "saat", "at", "aat", "noy", "nou", "noi",
]);

const LINK_PATTERNS = [
  /https?:/,
  /\bwww\b/,
  /\.\s*(com|net|org|bd|me|io|co)\b/,
  /\bdot\s*(com|net|org|bd)\b/,
  /\bm\.me\b/,
  /\bwa\.me\b/,
  /\b(facebook|fb|whats\s*app|whatsapp|imo|telegram|instagram|insta|behance|dribbble|linkedin|skype|viber|messenger)\b/,
  /(ফেসবুক|হোয়াটসঅ্যাপ|হোয়াটসঅ্যাপ|ইমো|টেলিগ্রাম|ইনস্টাগ্রাম)/,
];

export function findContactDetails(text: string, extraTerms: readonly string[] = []): ContactKind | null {
  const lower = toAsciiDigits(text).toLowerCase();

  // Phone numbers, even when the digits are split by spaces, dots, dashes or brackets.
  const joined = lower.replace(/(?<=\d)[\s.\-()_/]+(?=\d)/g, "");
  if (/(?:\+?88)?01[3-9]\d{8}/.test(joined)) return "phone";

  const words = lower.split(/[^\p{L}\p{M}\d]+/u).filter(Boolean);
  let run = 0;
  for (const w of words) {
    run = NUMBER_WORDS.has(w) || /^\d$/.test(w) ? run + 1 : 0;
    if (run >= 6) return "number_words";
  }

  if (/@/.test(lower) || /\bg\s*mail\b/.test(lower) || /\b(yahoo|hotmail|outlook)\b/.test(lower)) return "email";
  if (LINK_PATTERNS.some((p) => p.test(lower))) return "link";

  for (const term of extraTerms) {
    const t = term.trim().toLowerCase();
    if (t && lower.includes(t)) return "term";
  }
  return null;
}
