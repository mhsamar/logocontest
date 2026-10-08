import { toAsciiDigits } from "@/lib/phone";

/**
 * No-contact filter (BLUEPRINT §10). Comments, bios, logo stories, brief text
 * and file names must not carry a way to reach someone off the site.
 *
 * Owner, 2026-10-08: block real contact details only. Mentioning a platform
 * ("who shop on Facebook", "it looks like Instagram's logo"), ages, prices and
 * years are fine; "contact me on my Facebook ID", a number, an email, a link or
 * an @handle are not.
 */
export type ContactKind = "phone" | "number_words" | "email" | "handle" | "link" | "term";

// Number words in English, Bangla and Banglish. Six or more in a row is a spelled-out phone number.
const NUMBER_WORDS = new Set([
  "zero", "oh", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "শূন্য", "এক", "দুই", "তিন", "চার", "পাঁচ", "ছয়", "ছয়", "সাত", "আট", "নয়", "নয়",
  "shunno", "shunyo", "sunno", "ek", "dui", "tin", "teen", "char", "chaar", "panch", "pach", "pas",
  "choy", "chhoy", "choi", "sat", "shat", "saat", "at", "aat", "noy", "nou", "noi",
]);

// Platforms people use to be reached. Only blocked together with a contact word (below).
const PLATFORMS = new Set([
  "facebook", "fb", "whatsapp", "whatsap", "imo", "telegram", "instagram", "insta", "messenger", "viber", "skype",
  "linkedin", "behance", "dribbble", "tiktok", "twitter", "signal",
  "ফেসবুক", "হোয়াটসঅ্যাপ", "হোয়াটসঅ্যাপ", "ইমো", "টেলিগ্রাম", "ইনস্টাগ্রাম", "মেসেঞ্জার",
]);

// Words that turn a platform name into a way to reach someone (English, Banglish, Bangla).
const CONTACT_WORDS = new Set([
  "contact", "message", "msg", "inbox", "knock", "nok", "dm", "pm", "text", "call", "add", "follow", "reach", "ping",
  "id", "username", "handle", "link", "number", "jogajog",
  "যোগাযোগ", "মেসেজ", "ইনবক্স", "নক", "কল", "আইডি", "লিংক", "নম্বর", "অ্যাড",
]);

const WINDOW = 4;
const OWN_SITE = /\blogocontest\s*\.\s*bd\b/g;

const LINK_PATTERNS = [
  /https?:/,
  /\bwww\b/,
  /\b[a-z0-9][a-z0-9-]*\s*\.\s*(com|net|org|bd|me|io|co|xyz|info|shop|store|app|site|online|link)\b/,
  /\bdot\s*(com|net|org|bd)\b/,
  /\b(m|wa)\s*\.\s*me\b/,
];

export function findContactDetails(text: string, extraTerms: readonly string[] = []): ContactKind | null {
  const lower = toAsciiDigits(text).toLowerCase().replace(OWN_SITE, " ");

  // Phone numbers, even when the digits are split by spaces, dots, dashes or brackets.
  const joined = lower.replace(/(?<=\d)[\s.\-()_/]+(?=\d)/g, "");
  if (/(?:\+?88)?01[3-9]\d{8}/.test(joined)) return "phone";

  const words = lower.split(/[^\p{L}\p{M}\d]+/u).filter(Boolean);
  let run = 0;
  for (const w of words) {
    run = NUMBER_WORDS.has(w) || /^\d$/.test(w) ? run + 1 : 0;
    if (run >= 6) return "number_words";
  }

  // Emails: a real address, an "@gmail.com" style ending, or an email provider's name.
  if (/[a-z0-9._%+-]+\s*@\s*[a-z0-9-]+(\s*\.\s*[a-z]{2,})+/.test(lower)) return "email";
  if (/@\s*(gmail|yahoo|hotmail|outlook|live|icloud|proton)\b/.test(lower)) return "email";
  if (/\b(g\s*mail|yahoo\s*mail|hotmail)\b/.test(lower) || /জিমেইল/.test(lower)) return "email";

  // Social handles like @rafi_designs.
  if (/(^|[\s(])@[a-z0-9_.]{2,}/.test(lower)) return "handle";

  if (LINK_PATTERNS.some((p) => p.test(lower))) return "link";

  // A platform name is only blocked when it is used to share a way to reach someone:
  // a contact word nearby ("knock me on WhatsApp", "my fb id"), or "WhatsApp: …" / "fb/name".
  for (let i = 0; i < words.length; i++) {
    const isPlatform = PLATFORMS.has(words[i]) || (words[i] === "whats" && words[i + 1] === "app");
    if (!isPlatform) continue;
    const near = words.slice(Math.max(0, i - WINDOW), i + WINDOW + 2);
    if (near.some((w) => CONTACT_WORDS.has(w))) return "link";
  }
  if (/\b(facebook|fb|whats\s*app|imo|telegram|instagram|insta|viber|skype)\s*[:/]/.test(lower)) return "link";

  for (const term of extraTerms) {
    const t = term.trim().toLowerCase();
    if (t && lower.includes(t)) return "term";
  }
  return null;
}
