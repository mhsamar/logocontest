/**
 * Contest services (owner, 2026-10-13): logo contests now, more kinds later (YouTube thumbnail, social post, …).
 * Each service has its own brief questions, sizes, upload rules and defaults, set in Admin → Services and stored in
 * `contest_services` (migration 0045). Logo is built in and keeps its own wizard; every other service uses the
 * questions set here. Pure: shared by the admin editor, the wizard, the server and the tests.
 */

export type Lang = { en: string; bn: string };
export const FIELD_TYPES = ["text", "long_text", "choice", "multi_choice", "link", "colours"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];
/** Image types a designer can upload as their design (the entry pipeline reads these). */
export const ENTRY_FILE_TYPES = ["png", "jpg", "webp"] as const;
export type EntryFileType = (typeof ENTRY_FILE_TYPES)[number];
/** Final files the winner can be asked for (the handover reads these). */
export const FINAL_FILE_TYPES = ["png", "jpg", "pdf", "svg", "ai", "eps"] as const;
export type FinalFileType = (typeof FINAL_FILE_TYPES)[number];

export type BriefField = {
  key: string;
  type: FieldType;
  label: Lang;
  help: Lang;
  required: boolean;
  /** For choice / multi_choice. */
  options: Lang[];
};

export type ServiceDef = {
  slug: string;
  /** Logo: the original wizard and brief; never deleted. */
  builtIn: boolean;
  on: boolean;
  position: number;
  name: Lang;
  short: Lang;
  clientInstruction: Lang;
  designerInstruction: Lang;
  /** Design size, e.g. 1280 × 720 px; 0 when it is free. */
  width: number;
  height: number;
  entryTypes: EntryFileType[];
  maxImages: number;
  maxMb: number;
  finalTypes: FinalFileType[];
  fields: BriefField[];
  defaultPrize: number;
  minPrize: number;
  defaultDays: number;
  winners: number;
};

export type Answers = Record<string, string | string[]>;

export const SLUG_RE = /^[a-z][a-z0-9_]{1,39}$/;
export const FIELD_KEY_RE = /^[a-z][a-z0-9_]{0,29}$/;
export const LIMITS = {
  name: 60,
  short: 200,
  instruction: 2000,
  label: 80,
  help: 200,
  option: 60,
  options: 12,
  fields: 15,
  text: 120,
  longText: 1000,
  link: 300,
  colours: 5,
  /** Every non-logo contest asks for a title and a short description first (they become the contest's name and lead). */
  title: { min: 2, max: 60 },
  description: { min: 20, max: 300 },
};

const L = (en: string, bn: string): Lang => ({ en, bn });
const field = (key: string, type: FieldType, label: Lang, required: boolean, help: Lang = L("", ""), options: Lang[] = []): BriefField => ({ key, type, label, help, required, options });

const base = {
  builtIn: false,
  on: false,
  entryTypes: ["png", "jpg"] as EntryFileType[],
  maxImages: 4,
  maxMb: 8,
  finalTypes: ["png", "jpg"] as FinalFileType[],
  defaultDays: 5,
  winners: 1,
};

/**
 * The services the owner planned (2026-10-13). Logo is on; the rest start off and are switched on in Admin →
 * Services. Until an admin saves a service, these defaults are used.
 */
export const DEFAULT_SERVICES: ServiceDef[] = [
  {
    slug: "logo",
    builtIn: true,
    on: true,
    position: 0,
    name: L("Logo design", "লোগো ডিজাইন"),
    short: L("A logo for your business, with all the final files.", "আপনার ব্যবসার লোগো, সব ফাইনাল ফাইলসহ।"),
    clientInstruction: L("Tell us about your business, the style and colours you like. Designers send logo ideas and you pick the winner.", "আপনার ব্যবসা, পছন্দের স্টাইল আর রং জানান। ডিজাইনাররা লোগোর আইডিয়া পাঠাবেন, আপনি বিজয়ী বেছে নেবেন।"),
    designerInstruction: L("Send your logo on clean mockups. Original work only, no AI-generated logos.", "পরিষ্কার মকআপে লোগো পাঠান। শুধু নিজের কাজ, AI দিয়ে বানানো লোগো নয়।"),
    width: 0,
    height: 0,
    entryTypes: ["png", "jpg", "webp"],
    maxImages: 5,
    maxMb: 10,
    finalTypes: ["ai", "eps", "svg", "pdf", "png", "jpg"],
    fields: [],
    defaultPrize: 5000,
    minPrize: 3000,
    defaultDays: 7,
    winners: 1,
  },
  {
    ...base,
    slug: "youtube_thumbnail",
    position: 1,
    name: L("YouTube thumbnail", "ইউটিউব থাম্বনেইল"),
    short: L("An eye-catching thumbnail that gets your video clicked.", "চোখে পড়ার মতো থাম্বনেইল, যাতে ভিডিওতে ক্লিক পড়ে।"),
    clientInstruction: L("Give the video title, who it is for and the text you want on the thumbnail. Add links to reference images if you have them.", "ভিডিওর টাইটেল, কাদের জন্য আর থাম্বনেইলে কী লেখা চান জানান। রেফারেন্স ছবি থাকলে লিংক দিন।"),
    designerInstruction: L("1280 × 720 px (16:9). Big, readable text. Send the thumbnail as PNG or JPG.", "১২৮০ × ৭২০ পিক্সেল (১৬:৯)। বড়, সহজে পড়া যায় এমন লেখা। PNG বা JPG দিন।"),
    width: 1280,
    height: 720,
    fields: [
      field("video_title", "text", L("Video title", "ভিডিওর টাইটেল"), true),
      field("audience", "text", L("Who is the video for?", "ভিডিওটি কাদের জন্য?"), true),
      field("thumb_text", "text", L("Text on the thumbnail", "থাম্বনেইলে লেখা"), false, L("Keep it short: 2 to 5 words.", "ছোট রাখুন: ২ থেকে ৫ শব্দ।")),
      field("references", "link", L("Reference image link", "রেফারেন্স ছবির লিংক"), false),
    ],
    defaultPrize: 1500,
    minPrize: 1000,
    defaultDays: 3,
  },
  {
    ...base,
    slug: "social_post",
    position: 2,
    name: L("Social media post", "সোশ্যাল মিডিয়া পোস্ট"),
    short: L("Instagram and Facebook posts that look great in the feed.", "ইনস্টাগ্রাম আর ফেসবুকের জন্য সুন্দর পোস্ট।"),
    clientInstruction: L("Tell us what the post is about, the text to show and where it will be posted.", "পোস্টটি কী নিয়ে, কী লেখা থাকবে আর কোথায় পোস্ট হবে জানান।"),
    designerInstruction: L("1080 × 1080 px (1:1). PNG or JPG.", "১০৮০ × ১০৮০ পিক্সেল (১:১)। PNG বা JPG।"),
    width: 1080,
    height: 1080,
    fields: [
      field("platform", "multi_choice", L("Where will it be posted?", "কোথায় পোস্ট হবে?"), true, L("", ""), [L("Facebook", "ফেসবুক"), L("Instagram", "ইনস্টাগ্রাম")]),
      field("post_text", "long_text", L("Text on the post", "পোস্টের লেখা"), true),
      field("colours", "colours", L("Brand colours", "ব্র্যান্ডের রং"), false),
    ],
    defaultPrize: 1500,
    minPrize: 1000,
    defaultDays: 3,
  },
  {
    ...base,
    slug: "facebook_cover",
    position: 3,
    name: L("Facebook cover", "ফেসবুক কভার"),
    short: L("A cover photo for your Facebook page.", "আপনার ফেসবুক পেজের কভার ছবি।"),
    clientInstruction: L("Tell us your page name, what to show and any text you want.", "পেজের নাম, কী দেখাতে চান আর কোনো লেখা থাকলে জানান।"),
    designerInstruction: L("1640 × 624 px. Keep text in the middle so it isn't cut on phones. PNG or JPG.", "১৬৪০ × ৬২৪ পিক্সেল। লেখা মাঝখানে রাখুন যাতে ফোনে কাটা না পড়ে। PNG বা JPG।"),
    width: 1640,
    height: 624,
    fields: [field("page_name", "text", L("Page name", "পেজের নাম"), true), field("cover_text", "text", L("Text on the cover", "কভারে লেখা"), false), field("colours", "colours", L("Brand colours", "ব্র্যান্ডের রং"), false)],
    defaultPrize: 1500,
    minPrize: 1000,
    defaultDays: 3,
  },
  {
    ...base,
    slug: "youtube_banner",
    position: 4,
    name: L("YouTube banner", "ইউটিউব ব্যানার"),
    short: L("Channel art that works on TV, desktop and phone.", "টিভি, কম্পিউটার আর ফোনে মানানসই চ্যানেল আর্ট।"),
    clientInstruction: L("Tell us the channel name, what the channel is about and any text to show.", "চ্যানেলের নাম, চ্যানেলটি কী নিয়ে আর কোনো লেখা থাকলে জানান।"),
    designerInstruction: L("2560 × 1440 px; keep the logo and text inside the middle 1546 × 423 px. PNG or JPG.", "২৫৬০ × ১৪৪০ পিক্সেল; লোগো আর লেখা মাঝের ১৫৪৬ × ৪২৩ পিক্সেলের ভেতরে রাখুন। PNG বা JPG।"),
    width: 2560,
    height: 1440,
    fields: [field("channel_name", "text", L("Channel name", "চ্যানেলের নাম"), true), field("about", "long_text", L("What is the channel about?", "চ্যানেলটি কী নিয়ে?"), true), field("colours", "colours", L("Brand colours", "ব্র্যান্ডের রং"), false)],
    defaultPrize: 2000,
    minPrize: 1000,
    defaultDays: 4,
  },
  {
    ...base,
    slug: "x_header",
    position: 5,
    name: L("Twitter / X header", "টুইটার / এক্স হেডার"),
    short: L("A header image for your X (Twitter) profile.", "আপনার এক্স (টুইটার) প্রোফাইলের হেডার ছবি।"),
    clientInstruction: L("Tell us the profile name, what to show and any text you want.", "প্রোফাইলের নাম, কী দেখাতে চান আর কোনো লেখা থাকলে জানান।"),
    designerInstruction: L("1500 × 500 px (3:1). PNG or JPG.", "১৫০০ × ৫০০ পিক্সেল (৩:১)। PNG বা JPG।"),
    width: 1500,
    height: 500,
    fields: [field("profile_name", "text", L("Profile name", "প্রোফাইলের নাম"), true), field("header_text", "text", L("Text on the header", "হেডারে লেখা"), false)],
    defaultPrize: 1500,
    minPrize: 1000,
    defaultDays: 3,
  },
  {
    ...base,
    slug: "business_card",
    position: 6,
    name: L("Business card", "বিজনেস কার্ড"),
    short: L("A front and back business card, ready to print.", "সামনে-পেছনে বিজনেস কার্ড, প্রিন্টের জন্য তৈরি।"),
    // Briefs never carry phone numbers or emails (no-contact rule): designers use sample contact lines.
    clientInstruction: L("Give the name and title to print, and your logo link if you have one. Designers use sample contact lines; you put in your real ones once you have the files.", "যে নাম আর পদবি প্রিন্ট হবে তা দিন, লোগো থাকলে লিংক দিন। ডিজাইনাররা নমুনা যোগাযোগের তথ্য ব্যবহার করবেন; ফাইল পাওয়ার পর আপনি আসল তথ্য বসাবেন।"),
    designerInstruction: L("3.5 × 2 in (1050 × 600 px at 300 dpi), front and back. Final files: print-ready PDF.", "৩.৫ × ২ ইঞ্চি (৩০০ ডিপিআই-তে ১০৫০ × ৬০০ পিক্সেল), সামনে ও পেছনে। ফাইনাল ফাইল: প্রিন্টের জন্য PDF।"),
    width: 1050,
    height: 600,
    finalTypes: ["pdf", "png"],
    fields: [field("card_name", "text", L("Name and title on the card", "কার্ডে নাম ও পদবি"), true), field("logo_link", "link", L("Your logo (link)", "আপনার লোগো (লিংক)"), false), field("colours", "colours", L("Brand colours", "ব্র্যান্ডের রং"), false)],
    defaultPrize: 2000,
    minPrize: 1000,
    defaultDays: 4,
  },
  {
    ...base,
    slug: "flyer",
    position: 7,
    name: L("Flyer", "ফ্লায়ার"),
    short: L("A flyer for your offer, event or shop.", "অফার, ইভেন্ট বা দোকানের জন্য ফ্লায়ার।"),
    clientInstruction: L("Tell us what the flyer is for, the headline and the details to show.", "ফ্লায়ারটি কীসের জন্য, হেডলাইন আর কী কী তথ্য থাকবে জানান।"),
    designerInstruction: L("A4 portrait (2480 × 3508 px at 300 dpi). Final files: print-ready PDF.", "A4 লম্বালম্বি (৩০০ ডিপিআই-তে ২৪৮০ × ৩৫০৮ পিক্সেল)। ফাইনাল ফাইল: প্রিন্টের জন্য PDF।"),
    width: 2480,
    height: 3508,
    finalTypes: ["pdf", "png"],
    fields: [field("headline", "text", L("Headline", "হেডলাইন"), true), field("details", "long_text", L("Details to show", "কী কী তথ্য থাকবে"), true), field("size", "choice", L("Size", "সাইজ"), true, L("", ""), [L("A4", "A4"), L("A5", "A5"), L("Letter", "লেটার")])],
    defaultPrize: 2500,
    minPrize: 1500,
    defaultDays: 4,
  },
  {
    ...base,
    slug: "tshirt",
    position: 8,
    name: L("T-shirt design", "টি-শার্ট ডিজাইন"),
    short: L("A print design for T-shirts.", "টি-শার্টে প্রিন্টের জন্য ডিজাইন।"),
    clientInstruction: L("Tell us what the T-shirt is for, the text or idea, and the shirt colour.", "টি-শার্টটি কীসের জন্য, লেখা বা আইডিয়া আর শার্টের রং জানান।"),
    designerInstruction: L("Show the design on a T-shirt mockup. Final files: SVG or PDF, plus PNG with a clear background.", "টি-শার্ট মকআপে ডিজাইন দেখান। ফাইনাল ফাইল: SVG বা PDF, আর স্বচ্ছ ব্যাকগ্রাউন্ডে PNG।"),
    width: 0,
    height: 0,
    finalTypes: ["svg", "pdf", "png"],
    fields: [field("idea", "long_text", L("Text or idea", "লেখা বা আইডিয়া"), true), field("shirt_colour", "text", L("Shirt colour", "শার্টের রং"), true), field("print_side", "choice", L("Print side", "কোন দিকে প্রিন্ট"), false, L("", ""), [L("Front", "সামনে"), L("Back", "পেছনে"), L("Both", "দুই দিকে")])],
    defaultPrize: 2000,
    minPrize: 1000,
    defaultDays: 4,
  },
];

export const LOGO = "logo";
export const isLogo = (slug: string | null | undefined) => !slug || slug === LOGO;

const HEX = /^#[0-9a-f]{6}$/i;
const httpUrl = (v: string) => {
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    return /^https?:$/.test(u.protocol) && u.hostname.includes(".") ? u.toString() : null;
  } catch {
    return null;
  }
};

export type AnswerErrors = Record<string, "required" | "too_long" | "invalid">;

/** Checks and cleans a client's answers against the service's questions; unknown keys are dropped. */
export function cleanAnswers(def: Pick<ServiceDef, "fields">, raw: unknown): { answers: Answers; errors: AnswerErrors } {
  const input = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const answers: Answers = {};
  const errors: AnswerErrors = {};
  for (const f of def.fields) {
    const v = input[f.key];
    if (f.type === "multi_choice" || f.type === "colours") {
      const list = (Array.isArray(v) ? v : []).filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean);
      const uniq = [...new Set(list)];
      if (f.type === "colours" ? uniq.length > LIMITS.colours || uniq.some((c) => !HEX.test(c)) : uniq.some((x) => !f.options.some((o) => o.en === x))) errors[f.key] = "invalid";
      if (f.required && uniq.length === 0) errors[f.key] = "required";
      if (uniq.length) answers[f.key] = f.type === "colours" ? uniq.map((c) => c.toLowerCase()) : uniq;
      continue;
    }
    const s = typeof v === "string" ? v.trim() : "";
    if (!s) {
      if (f.required) errors[f.key] = "required";
      continue;
    }
    if (f.type === "choice" && !f.options.some((o) => o.en === s)) errors[f.key] = "invalid";
    else if (f.type === "link") {
      const url = httpUrl(s);
      if (!url || s.length > LIMITS.link) errors[f.key] = "invalid";
      else answers[f.key] = url;
      continue;
    } else if (s.length > (f.type === "long_text" ? LIMITS.longText : LIMITS.text)) errors[f.key] = "too_long";
    answers[f.key] = s;
  }
  return { answers, errors };
}

/** The design size as text: "1280 × 720 px", or "" when it is free. */
export const sizeText = (s: Pick<ServiceDef, "width" | "height">) => (s.width > 0 && s.height > 0 ? `${s.width} × ${s.height} px` : "");

/** Turns admin form input into a service, or the first problem found. */
export function parseService(raw: unknown, existing: ServiceDef | null): { ok: true; service: ServiceDef } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "invalid" };
  const r = raw as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const lang = (v: unknown, max: number): Lang => {
    const o = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
    return { en: str(o.en, max), bn: str(o.bn, max) };
  };
  const int = (v: unknown, min: number, max: number) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
  };
  const slug = existing?.slug ?? str(r.slug, 40).toLowerCase();
  if (!SLUG_RE.test(slug)) return { ok: false, error: "slug" };
  const name = lang(r.name, LIMITS.name);
  if (!name.en || !name.bn) return { ok: false, error: "name" };
  const pick = <T extends string>(v: unknown, allowed: readonly T[]) => allowed.filter((x) => Array.isArray(v) && v.includes(x));
  const entryTypes = pick(r.entryTypes, ENTRY_FILE_TYPES);
  const finalTypes = pick(r.finalTypes, FINAL_FILE_TYPES);
  if (!entryTypes.length) return { ok: false, error: "entryTypes" };
  if (!finalTypes.length) return { ok: false, error: "finalTypes" };

  const fields: BriefField[] = [];
  const seen = new Set<string>();
  for (const f of (Array.isArray(r.fields) ? r.fields : []).slice(0, LIMITS.fields)) {
    const o = f && typeof f === "object" ? (f as Record<string, unknown>) : {};
    const key = str(o.key, 30).toLowerCase();
    const type = FIELD_TYPES.find((t) => t === o.type);
    const label = lang(o.label, LIMITS.label);
    if (!FIELD_KEY_RE.test(key) || seen.has(key) || key === "title" || key === "description") return { ok: false, error: "fieldKey" };
    if (!type) return { ok: false, error: "fieldType" };
    if (!label.en || !label.bn) return { ok: false, error: "fieldLabel" };
    const options = (Array.isArray(o.options) ? o.options : [])
      .slice(0, LIMITS.options)
      .map((x) => lang(x, LIMITS.option))
      .filter((x) => x.en && x.bn);
    if ((type === "choice" || type === "multi_choice") && options.length < 2) return { ok: false, error: "fieldOptions" };
    seen.add(key);
    fields.push({ key, type, label, help: lang(o.help, LIMITS.help), required: o.required === true, options: type === "choice" || type === "multi_choice" ? options : [] });
  }
  const minPrize = int(r.minPrize, 100, 1_000_000);
  return {
    ok: true,
    service: {
      slug,
      builtIn: existing?.builtIn ?? false,
      on: existing?.on ?? false,
      position: existing?.position ?? int(r.position, 0, 999),
      name,
      short: lang(r.short, LIMITS.short),
      clientInstruction: lang(r.clientInstruction, LIMITS.instruction),
      designerInstruction: lang(r.designerInstruction, LIMITS.instruction),
      width: int(r.width, 0, 20_000),
      height: int(r.height, 0, 20_000),
      entryTypes,
      maxImages: int(r.maxImages, 1, 10),
      maxMb: int(r.maxMb, 1, 25),
      finalTypes,
      // Logo keeps its own wizard; its questions are not edited here.
      fields: existing?.builtIn ? [] : fields,
      defaultPrize: Math.max(minPrize, int(r.defaultPrize, 100, 1_000_000)),
      minPrize,
      defaultDays: int(r.defaultDays, 1, 60),
      winners: 1,
    },
  };
}
