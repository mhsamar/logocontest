/**
 * The new brief (owner, 2026-11-08; Design/logocontest-onboarding): the logo name and one text with everything in it,
 * helped by 9 headings the client may use or not. Pure, shared by the browser, the server and the tests.
 */
import { BUSINESS_TYPES, type BusinessType } from "@/lib/contests/brief";

/** The 9 parts of a brief, in this order, in the owner's exact words. */
export const HEADINGS = ["ব্র্যান্ড পরিচিতি", "আইকনের ধরন", "ডিজাইনের দিক", "টাইপোগ্রাফি", "রঙের দিক", "টার্গেট অডিয়েন্স", "ব্র্যান্ড পার্সোনালিটি", "বিশেষ নির্দেশনা", "চূড়ান্ত লক্ষ্য"] as const;
export type Heading = (typeof HEADINGS)[number];

export const BRIEF_LIMITS = {
  logoName: { min: 2, max: 60 },
  words: { min: 10, warn: 4500, max: 5000 },
  otherWords: 50,
  updateWords: 500,
  /** A guard on characters too (5,000 very long "words" can't be a brief). */
  chars: 60_000,
} as const;

export const BRIEF_SOURCES = ["manual", "template", "ai"] as const;
export type BriefSource = (typeof BRIEF_SOURCES)[number];

/** Words, counted the simple way: anything between spaces or line breaks. */
export function countWords(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

/** The text cut after `max` words, keeping the spaces and line breaks the client typed. */
export function clipWords(text: string, max: number): string {
  if (countWords(text) <= max) return text;
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  let n = 0;
  while ((m = re.exec(text))) {
    n += 1;
    if (n === max) return text.slice(0, m.index + m[0].length);
  }
  return text;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const LINE = HEADINGS.map((h) => new RegExp(`^[ \\t]*${escape(h)}[ \\t]*[:：][ \\t]*(.*)$`, "m"));
/** "…" or dots alone (a template's blank to fill) is not something written yet. */
const filled = (s: string) => s.replace(/[.…।\s]/g, "").length > 0;

/** Which of the 9 headings start a line, with something written after the colon. */
export function sectionsDone(text: string): boolean[] {
  return LINE.map((re) => {
    const lines = text.match(new RegExp(re.source, "gm")) ?? [];
    return lines.some((l) => filled(l.replace(re, "$1")));
  });
}

export const countDone = (text: string) => sectionsDone(text).filter(Boolean).length;

/** The first heading not written yet, for the hint under the text (null when all 9 are there). */
export function firstMissing(text: string): Heading | null {
  const done = sectionsDone(text);
  const i = done.indexOf(false);
  return i < 0 ? null : HEADINGS[i];
}

/** A chip tapped: "<heading>: " on a new line at the end; the caret goes after it. */
export function insertHeading(text: string, heading: Heading): { text: string; caret: number } {
  const base = text.replace(/[ \t]+$/, "");
  const sep = base === "" || base.endsWith("\n") ? "" : "\n";
  const next = `${base}${sep}${heading}: `;
  return { text: next, caret: next.length };
}

/**
 * The brief as it is saved: no HTML or scripts (it is always shown as plain text), no odd control characters, Windows
 * line breaks made plain, at most one empty line in a row, and no spaces left at the end.
 */
export function cleanBriefText(raw: unknown, maxChars: number = BRIEF_LIMITS.chars): string {
  return String(raw ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/<\/?[a-z!][^>]*>/gi, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .slice(0, maxChars)
    .trimEnd()
    .replace(/^\n+/, "");
}

/** One line of the brief as it is shown: its heading (bold red) when it starts with one, and the rest. */
export type BriefLine = { heading: Heading | null; text: string; /** The whole line as written. */ raw: string };
export function briefLines(text: string): BriefLine[] {
  return text.split("\n").map((line) => {
    for (let i = 0; i < HEADINGS.length; i += 1) {
      const m = line.match(new RegExp(`^[ \\t]*(${escape(HEADINGS[i])})[ \\t]*[:：][ \\t]?(.*)$`));
      if (m) return { heading: HEADINGS[i], text: m[2], raw: line };
    }
    return { heading: null, text: line, raw: line };
  });
}

/** Links in a line, for the designers' view: plain text and clickable addresses in turn. */
export function linkParts(line: string): { text: string; href?: string }[] {
  const out: { text: string; href?: string }[] = [];
  const re = /\bhttps?:\/\/[^\s<>"')]+/gi;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    const url = m[0].replace(/[.,;:!?।]+$/, "");
    if (m.index > last) out.push({ text: line.slice(last, m.index) });
    out.push({ text: url, href: url });
    last = m.index + url.length;
    re.lastIndex = last;
  }
  if (last < line.length) out.push({ text: line.slice(last) });
  return out;
}

// ---- Business categories and suggestion templates (Admin › Brief) ----------------------------------------------------

/** A business category in the suggest box. `type` is the older business type it stands for (filters, search pages). */
export type BriefCategory = { id: string; bn: string; en: string; type: BusinessType; on: boolean };
/** "Other (write it yourself)": always last, never in the admin list. */
export const OTHER = "other";

export const DEFAULT_CATEGORIES: BriefCategory[] = [
  { id: "cafe", bn: "ক্যাফে / রেস্টুরেন্ট", en: "Cafe / Restaurant", type: "food", on: true },
  { id: "fashion", bn: "পোশাক / ফ্যাশন", en: "Clothing / Fashion", type: "fashion", on: true },
  { id: "shop", bn: "অনলাইন শপ / ই-কমার্স", en: "Online shop / E-commerce", type: "ecommerce", on: true },
  { id: "tech", bn: "আইটি / টেক / এজেন্সি", en: "IT / Tech / Agency", type: "technology", on: true },
  { id: "beauty", bn: "বিউটি / সেলুন / স্কিনকেয়ার", en: "Beauty / Salon / Skincare", type: "beauty", on: true },
  { id: "education", bn: "শিক্ষা / কোচিং", en: "Education / Coaching", type: "education", on: true },
  { id: "realestate", bn: "রিয়েল এস্টেট / কনস্ট্রাকশন", en: "Real estate / Construction", type: "real_estate", on: true },
  { id: "health", bn: "স্বাস্থ্য / ফার্মেসি", en: "Health / Pharmacy", type: "health", on: true },
];

/** The template for "Other" and for a category without its own. {business}: what the client wrote about it. */
export const GENERAL = "general";

const T = (lines: string[]) => lines.join("\n");
export const DEFAULT_TEMPLATES: Record<string, string> = {
  cafe: T([
    "ব্র্যান্ড পরিচিতি: {logo_name} একটা ক্যাফে / রেস্টুরেন্ট, … এলাকায়। আমাদের মূল খাবার: …",
    "আইকনের ধরন: কফি কাপ, চামচ বা খাবারের সাথে মিলিয়ে একটা সহজ সিম্বল।",
    "ডিজাইনের দিক: সিম্পল, মডার্ন, ফ্ল্যাট। ছোট সাইজেও যেন পরিষ্কার দেখা যায়।",
    "টাইপোগ্রাফি: গোল ধাঁচের, বন্ধুসুলভ ফন্ট।",
    "রঙের দিক: উষ্ণ রং, যেমন বাদামি, ক্রিম বা সবুজ। চাই না: …",
    "টার্গেট অডিয়েন্স: … বছরের মানুষ, যেমন স্টুডেন্ট, পরিবার আর অফিসের মানুষ।",
    "ব্র্যান্ড পার্সোনালিটি: আরামদায়ক, বন্ধুসুলভ, ফ্রেশ।",
    "বিশেষ নির্দেশনা: …",
    "চূড়ান্ত লক্ষ্য: সাইনবোর্ড, মেনু, কাপ আর ফেসবুকে দেখে মানুষ যেন সহজে চিনে ফেলে।",
  ]),
  fashion: T([
    "ব্র্যান্ড পরিচিতি: {logo_name} একটা পোশাক / ফ্যাশন ব্র্যান্ড। আমরা বিক্রি করি: …",
    "আইকনের ধরন: নামের প্রথম অক্ষর দিয়ে একটা স্টাইলিশ মনোগ্রাম, বা শুধু সুন্দর করে লেখা নাম।",
    "ডিজাইনের দিক: এলিগ্যান্ট, পরিষ্কার, প্রিমিয়াম লুক।",
    "টাইপোগ্রাফি: সরু, স্টাইলিশ ফন্ট। পড়তে যেন সহজ হয়।",
    "রঙের দিক: কালো, সাদা বা গোল্ডেন। চাই না: …",
    "টার্গেট অডিয়েন্স: … বছরের মানুষ, যারা ট্রেন্ডি পোশাক পছন্দ করেন।",
    "ব্র্যান্ড পার্সোনালিটি: আধুনিক, আত্মবিশ্বাসী, স্টাইলিশ।",
    "বিশেষ নির্দেশনা: …",
    "চূড়ান্ত লক্ষ্য: ট্যাগ, শপিং ব্যাগ, ফেসবুক আর ইনস্টাগ্রামে যেন সুন্দর দেখায়।",
  ]),
  shop: T([
    "ব্র্যান্ড পরিচিতি: {logo_name} একটা অনলাইন শপ। আমরা বিক্রি করি: …",
    "আইকনের ধরন: শপিং ব্যাগ, বক্স বা নামের প্রথম অক্ষর দিয়ে একটা সহজ সিম্বল।",
    "ডিজাইনের দিক: সিম্পল আর মডার্ন। মোবাইলের ছোট স্ক্রিনেও যেন পরিষ্কার দেখা যায়।",
    "টাইপোগ্রাফি: বোল্ড, সহজে পড়া যায় এমন ফন্ট।",
    "রঙের দিক: উজ্জ্বল, চোখে পড়ার মতো রং। চাই না: …",
    "টার্গেট অডিয়েন্স: … বছরের মানুষ, যারা ফেসবুক আর অনলাইনে কেনাকাটা করেন।",
    "ব্র্যান্ড পার্সোনালিটি: বিশ্বস্ত, ঝামেলাহীন, বন্ধুসুলভ।",
    "বিশেষ নির্দেশনা: …",
    "চূড়ান্ত লক্ষ্য: ফেসবুক পেজ, ওয়েবসাইট আর প্যাকেটে দেখে মানুষ যেন ভরসা পায়।",
  ]),
  tech: T([
    "ব্র্যান্ড পরিচিতি: {logo_name} একটা আইটি / টেক কোম্পানি বা এজেন্সি। আমাদের কাজ: …",
    "আইকনের ধরন: জ্যামিতিক বা অ্যাবস্ট্রাক্ট একটা সিম্বল, বা নামের প্রথম অক্ষর দিয়ে।",
    "ডিজাইনের দিক: মিনিমাল, শার্প, আধুনিক।",
    "টাইপোগ্রাফি: পরিষ্কার, মডার্ন ফন্ট।",
    "রঙের দিক: নীল, বেগুনি বা কালো। চাই না: …",
    "টার্গেট অডিয়েন্স: ব্যবসা প্রতিষ্ঠান আর … ধরনের ক্লায়েন্ট।",
    "ব্র্যান্ড পার্সোনালিটি: স্মার্ট, নির্ভরযোগ্য, প্রফেশনাল।",
    "বিশেষ নির্দেশনা: …",
    "চূড়ান্ত লক্ষ্য: ওয়েবসাইট, অ্যাপ আইকন আর ভিজিটিং কার্ডে যেন প্রফেশনাল দেখায়।",
  ]),
  beauty: T([
    "ব্র্যান্ড পরিচিতি: {logo_name} একটা বিউটি / সেলুন / স্কিনকেয়ার ব্র্যান্ড। আমাদের সার্ভিস বা পণ্য: …",
    "আইকনের ধরন: পাতা, ফুল বা নামের প্রথম অক্ষর দিয়ে নরম একটা সিম্বল।",
    "ডিজাইনের দিক: নরম, এলিগ্যান্ট, পরিষ্কার।",
    "টাইপোগ্রাফি: সরু, স্টাইলিশ বা হাতের লেখার মতো ফন্ট।",
    "রঙের দিক: হালকা গোলাপি, ক্রিম, গোল্ডেন বা সবুজ। চাই না: …",
    "টার্গেট অডিয়েন্স: … বছরের মানুষ, যারা নিজের যত্ন নিতে পছন্দ করেন।",
    "ব্র্যান্ড পার্সোনালিটি: কোমল, প্রিমিয়াম, ভরসার।",
    "বিশেষ নির্দেশনা: …",
    "চূড়ান্ত লক্ষ্য: পণ্যের প্যাকেট, সেলুনের সাইনবোর্ড আর সোশ্যাল মিডিয়ায় যেন সুন্দর দেখায়।",
  ]),
  education: T([
    "ব্র্যান্ড পরিচিতি: {logo_name} একটা শিক্ষা প্রতিষ্ঠান / কোচিং। আমরা পড়াই: …",
    "আইকনের ধরন: বই, কলম বা আলোর সাথে মিলিয়ে একটা সহজ সিম্বল।",
    "ডিজাইনের দিক: পরিষ্কার, বিশ্বস্ত, সহজ।",
    "টাইপোগ্রাফি: বোল্ড, সহজে পড়া যায় এমন ফন্ট।",
    "রঙের দিক: নীল, সবুজ বা কমলা। চাই না: …",
    "টার্গেট অডিয়েন্স: … শ্রেণির শিক্ষার্থী আর তাদের অভিভাবক।",
    "ব্র্যান্ড পার্সোনালিটি: নির্ভরযোগ্য, উৎসাহ দেয়, বন্ধুসুলভ।",
    "বিশেষ নির্দেশনা: …",
    "চূড়ান্ত লক্ষ্য: সাইনবোর্ড, লিফলেট, খাতা আর ফেসবুকে দেখে অভিভাবকরা যেন ভরসা পান।",
  ]),
  realestate: T([
    "ব্র্যান্ড পরিচিতি: {logo_name} একটা রিয়েল এস্টেট / কনস্ট্রাকশন কোম্পানি, … এলাকায় কাজ করে।",
    "আইকনের ধরন: বিল্ডিং, ছাদ বা ঘরের রেখা দিয়ে শক্ত একটা সিম্বল।",
    "ডিজাইনের দিক: শক্তিশালী, স্থির, প্রফেশনাল।",
    "টাইপোগ্রাফি: মোটা, শক্ত ধাঁচের ফন্ট।",
    "রঙের দিক: নেভি ব্লু, ধূসর বা গোল্ডেন। চাই না: …",
    "টার্গেট অডিয়েন্স: যারা ফ্ল্যাট বা জমি কিনতে চান, আর … ধরনের ক্লায়েন্ট।",
    "ব্র্যান্ড পার্সোনালিটি: বিশ্বস্ত, মজবুত, প্রিমিয়াম।",
    "বিশেষ নির্দেশনা: …",
    "চূড়ান্ত লক্ষ্য: সাইনবোর্ড, ব্রোশিওর আর প্রজেক্টের বিলবোর্ডে যেন ভরসার ছাপ দেয়।",
  ]),
  health: T([
    "ব্র্যান্ড পরিচিতি: {logo_name} একটা স্বাস্থ্যসেবা / ফার্মেসি। আমাদের সেবা: …",
    "আইকনের ধরন: প্লাস চিহ্ন, পাতা বা হার্টের সাথে মিলিয়ে একটা সহজ সিম্বল।",
    "ডিজাইনের দিক: পরিষ্কার, শান্ত, সহজ।",
    "টাইপোগ্রাফি: পরিষ্কার, সহজে পড়া যায় এমন ফন্ট।",
    "রঙের দিক: সবুজ, নীল বা সাদা। চাই না: …",
    "টার্গেট অডিয়েন্স: … এলাকার পরিবার আর রোগী।",
    "ব্র্যান্ড পার্সোনালিটি: যত্নশীল, নির্ভরযোগ্য, পেশাদার।",
    "বিশেষ নির্দেশনা: …",
    "চূড়ান্ত লক্ষ্য: দোকানের সাইনবোর্ড, প্যাকেট আর প্রেসক্রিপশন প্যাডে যেন ভরসা জাগায়।",
  ]),
  [GENERAL]: T([
    "ব্র্যান্ড পরিচিতি: {logo_name}: {business}",
    "আইকনের ধরন: আমাদের কাজের সাথে মিল আছে এমন একটা সহজ সিম্বল, বা নামের প্রথম অক্ষর দিয়ে।",
    "ডিজাইনের দিক: সিম্পল আর মডার্ন। ছোট সাইজেও যেন পরিষ্কার দেখা যায়।",
    "টাইপোগ্রাফি: পরিষ্কার, সহজে পড়া যায় এমন ফন্ট।",
    "রঙের দিক: … রং পছন্দ। চাই না: …",
    "টার্গেট অডিয়েন্স: …",
    "ব্র্যান্ড পার্সোনালিটি: বিশ্বস্ত, বন্ধুসুলভ, প্রফেশনাল।",
    "বিশেষ নির্দেশনা: …",
    "চূড়ান্ত লক্ষ্য: সাইনবোর্ড, ফেসবুক আর ভিজিটিং কার্ডে দেখে মানুষ যেন সহজে চিনে ফেলে।",
  ]),
};

/** The saved categories, or the defaults; broken entries and repeated ids are left out. */
export function parseCategories(raw: unknown): BriefCategory[] {
  if (!Array.isArray(raw)) return DEFAULT_CATEGORIES;
  const seen = new Set<string>();
  const out: BriefCategory[] = [];
  for (const c of raw) {
    if (!c || typeof c !== "object") continue;
    const x = c as Record<string, unknown>;
    const id = typeof x.id === "string" ? x.id.trim() : "";
    const bn = typeof x.bn === "string" ? x.bn.trim() : "";
    if (!/^[a-z0-9_-]{1,40}$/.test(id) || id === OTHER || id === GENERAL || !bn || seen.has(id)) continue;
    seen.add(id);
    const type = (BUSINESS_TYPES as readonly string[]).includes(String(x.type)) ? (x.type as BusinessType) : "other";
    out.push({ id, bn: bn.slice(0, 60), en: (typeof x.en === "string" && x.en.trim() ? x.en.trim() : bn).slice(0, 60), type, on: x.on !== false });
  }
  return out;
}

export function parseTemplates(raw: unknown): Record<string, string> {
  const out: Record<string, string> = { ...DEFAULT_TEMPLATES };
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) if (typeof v === "string" && v.trim()) out[k] = cleanBriefText(v, 8000);
  }
  return out;
}

/** A category's label in the page's language; "Other" uses the client's own words when given. */
export function categoryLabel(id: string | null, list: BriefCategory[], locale: "bn" | "en", other?: string | null): string | null {
  if (!id) return null;
  if (id === OTHER) return other?.trim() ? other.trim() : null;
  const c = list.find((x) => x.id === id);
  return c ? (locale === "bn" ? c.bn : c.en) : null;
}

/** The older business type a category stands for (search pages, filters and the logo checker still read it). */
export const categoryType = (id: string, list: BriefCategory[]): BusinessType => (id === OTHER ? "other" : (list.find((c) => c.id === id)?.type ?? "other"));

/**
 * The suggested draft: the category's template (the general one for "Other" or a category without its own), with the
 * logo name and, for "Other", what the client wrote about the business. Nothing is made up: blanks stay "…".
 */
export function fillTemplate(templates: Record<string, string>, category: string, v: { logoName: string; other?: string }): string {
  const tpl = (category !== OTHER && templates[category]) || templates[GENERAL] || DEFAULT_TEMPLATES[GENERAL];
  const name = v.logoName.trim() || "…";
  const business = (v.other ?? "").trim().replace(/\s+/g, " ") || "…";
  return tpl.replaceAll("{logo_name}", name).replaceAll("{business}", business);
}
