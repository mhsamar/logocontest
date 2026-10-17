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
  /** Ready answers the client can tap to fill a text box (owner, 2026-10-13). */
  suggestions?: Lang[];
  /**
   * Private (owner, 2026-10-17): the answer is shown only to the client, the admin team and the winning designer, for
   * details that must not reach every designer (the phone, email and address printed on a business card).
   */
  private?: boolean;
  /** A heading shown above this question, starting a new part of the brief (owner, 2026-10-17). */
  section?: Lang;
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
  /** Design size, e.g. 1280 × 720 px; 0 when it is free (then designs are square like logos). Designs keep this real shape (owner, 2026-10-13). */
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
  suggestions: 8,
  fields: 25,
  text: 120,
  longText: 1000,
  link: 300,
  colours: 5,
  /** Every non-logo contest asks for a title and a short description first (they become the contest's name and lead). */
  title: { min: 2, max: 60 },
  description: { min: 20, max: 300 },
};

const L = (en: string, bn: string): Lang => ({ en, bn });
const field = (key: string, type: FieldType, label: Lang, required: boolean, help: Lang = L("", ""), options: Lang[] = [], suggestions: Lang[] = []): BriefField => ({ key, type, label, help, required, options, suggestions });
const ideas = (...pairs: [string, string][]) => pairs.map(([en, bn]) => L(en, bn));
const opts = (...pairs: [string, string][]) => pairs.map(([en, bn]) => L(en, bn));
/** A question whose answer only the client, the team and the winner see. */
const privateField = (f: BriefField): BriefField => ({ ...f, private: true });
/** The first question of a part of the brief, with the part's heading above it. */
const startsSection = (section: Lang, f: BriefField): BriefField => ({ ...f, section });

/**
 * The business card brief (owner, 2026-10-17): brand, colours, reference and style, the card holder's details, what
 * goes on each side and the printing. The brand name and description are the contest's title and description. The
 * phone, email, address and QR link on the card are private: designers use sample details until the winner is picked.
 */
export const BUSINESS_CARD_FIELDS: BriefField[] = [
  startsSection(L("Brand information", "ব্র্যান্ডের তথ্য"), field("industry", "text", L("Business category / industry", "ব্যবসার ধরন / ইন্ডাস্ট্রি"), true, L("", ""), [], ideas(["Restaurant", "রেস্টুরেন্ট"], ["Clothing shop", "কাপড়ের দোকান"], ["IT company", "আইটি কোম্পানি"], ["Clinic or hospital", "ক্লিনিক বা হাসপাতাল"], ["Real estate", "রিয়েল এস্টেট"], ["Law firm", "ল ফার্ম"]))),
  field("website", "link", L("Website", "ওয়েবসাইট"), false),
  field("logo_link", "link", L("Your logo (link)", "আপনার লোগো (লিংক)"), false, L("Or upload it under Reference images.", "অথবা রেফারেন্স ছবিতে আপলোড করুন।")),
  startsSection(L("Brand colours", "ব্র্যান্ডের রং"), field("colour_choice", "choice", L("Colours", "রং"), true, L("", ""), opts(["Use our existing brand colours", "আমাদের ব্র্যান্ডের রং ব্যবহার করুন"], ["Designer can suggest suitable colours", "ডিজাইনার মানানসই রং বেছে নিতে পারেন"]))),
  field("colours", "colours", L("Primary and secondary colour", "প্রধান ও দ্বিতীয় রং"), false, L("The primary colour first, then the secondary.", "প্রথমে প্রধান রং, তারপর দ্বিতীয় রং।")),
  startsSection(L("Reference and design style", "রেফারেন্স ও ডিজাইনের স্টাইল"), field("reference", "choice", L("Reference design", "রেফারেন্স ডিজাইন"), true, L("", ""), opts(["Reference image attached", "রেফারেন্স ছবি দেওয়া আছে"], ["Reference link provided", "রেফারেন্স লিংক দেওয়া আছে"], ["No reference: the designer may create a suitable design", "রেফারেন্স নেই: ডিজাইনার মানানসই ডিজাইন করবেন"]))),
  field("reference_notes", "long_text", L("Reference link or notes", "রেফারেন্স লিংক বা নোট"), false),
  field("style", "multi_choice", L("Preferred style", "পছন্দের স্টাইল"), false, L("", ""), opts(["Modern", "আধুনিক"], ["Minimal", "মিনিমাল"], ["Professional", "প্রফেশনাল"], ["Luxury", "বিলাসী"], ["Creative", "ক্রিয়েটিভ"], ["Bold", "বোল্ড"], ["Other", "অন্যান্য"])),
  field("avoid", "text", L("Colours or styles to avoid", "যে রং বা স্টাইল চান না"), false),
  startsSection(L("Card holder details", "কার্ডধারীর তথ্য"), field("card_name", "text", L("Full name on the card", "কার্ডে পুরো নাম"), true)),
  field("job_title", "text", L("Job title", "পদবি"), false, L("", ""), [], ideas(["Managing Director", "ব্যবস্থাপনা পরিচালক"], ["CEO", "সিইও"], ["Sales Manager", "সেলস ম্যানেজার"], ["Proprietor", "প্রোপ্রাইটর"])),
  privateField(field("card_phone", "text", L("Phone number on the card", "কার্ডে ফোন নম্বর"), false, L("Only the winning designer sees it.", "শুধু বিজয়ী ডিজাইনার দেখবেন।"))),
  privateField(field("card_email", "text", L("Email address on the card", "কার্ডে ইমেইল"), false, L("Only the winning designer sees it.", "শুধু বিজয়ী ডিজাইনার দেখবেন।"))),
  privateField(field("office_address", "long_text", L("Office address", "অফিসের ঠিকানা"), false, L("Only the winning designer sees it.", "শুধু বিজয়ী ডিজাইনার দেখবেন।"))),
  privateField(field("qr_link", "link", L("QR code link (if needed)", "QR কোডের লিংক (দরকার হলে)"), false, L("Only the winning designer sees it.", "শুধু বিজয়ী ডিজাইনার দেখবেন।"))),
  startsSection(L("Front and back", "সামনে ও পেছনে"), field("front_side", "multi_choice", L("Front side", "সামনের দিক"), true, L("", ""), opts(["Logo and brand/company name", "লোগো আর ব্র্যান্ড/কোম্পানির নাম"], ["Name and job title", "নাম আর পদবি"], ["Other", "অন্যান্য"]))),
  field("back_side", "multi_choice", L("Back side", "পেছনের দিক"), false, L("", ""), opts(["Contact details", "যোগাযোগের তথ্য"], ["QR code", "QR কোড"], ["Social media links", "সোশ্যাল মিডিয়া লিংক"], ["Office address", "অফিসের ঠিকানা"], ["Other", "অন্যান্য"])),
  field("side_other", "text", L("Anything else on the front or back", "সামনে বা পেছনে আর কী থাকবে"), false),
  startsSection(L("Printing details", "প্রিন্টের তথ্য"), field("card_size", "choice", L("Card size", "কার্ডের সাইজ"), true, L("", ""), opts(["Standard (3.5 × 2 in)", "স্ট্যান্ডার্ড (৩.৫ × ২ ইঞ্চি)"], ["Custom size", "নিজের সাইজ"]))),
  field("custom_size", "text", L("Custom size", "নিজের সাইজ"), false, L("Only for a custom size, for example 85 × 55 mm.", "শুধু নিজের সাইজ হলে, যেমন ৮৫ × ৫৫ মিমি।")),
  field("orientation", "choice", L("Card orientation", "কার্ডের দিক"), true, L("", ""), opts(["Horizontal", "আড়াআড়ি"], ["Vertical", "লম্বালম্বি"])),
  field("print_type", "choice", L("Print type", "প্রিন্টের ধরন"), true, L("", ""), opts(["Single-sided", "এক পাশে"], ["Double-sided", "দুই পাশে"])),
  field("notes", "long_text", L("Additional notes or instructions", "আরও নির্দেশনা"), false),
];
/** What the business card asks the client, in plain words (Admin → Services can still change it). */
export const BUSINESS_CARD_INSTRUCTION = L(
  "Fill in what goes on the card. The phone number, email, address and QR link are shown only to the winning designer; the other designers use sample details. Add your logo and any reference cards under Reference images.",
  "কার্ডে কী থাকবে তা লিখুন। ফোন নম্বর, ইমেইল, ঠিকানা আর QR লিংক শুধু বিজয়ী ডিজাইনার দেখবেন; অন্য ডিজাইনাররা নমুনা তথ্য ব্যবহার করবেন। আপনার লোগো আর পছন্দের কার্ড রেফারেন্স ছবিতে দিন।",
);
export const BUSINESS_CARD_DESIGNER = L(
  "3.5 × 2 in (1050 × 600 px at 300 dpi), front and back, unless the brief asks for another size. Use sample phone, email and address: the winner gets the real ones. Final files: print-ready PDF.",
  "৩.৫ × ২ ইঞ্চি (৩০০ ডিপিআই-তে ১০৫০ × ৬০০ পিক্সেল), সামনে ও পেছনে, ব্রিফে অন্য সাইজ না চাইলে। নমুনা ফোন, ইমেইল আর ঠিকানা দিন: বিজয়ী আসলগুলো পাবেন। ফাইনাল ফাইল: প্রিন্টের জন্য PDF।",
);

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
      field("audience", "text", L("Who is the video for?", "ভিডিওটি কাদের জন্য?"), true, L("", ""), [], ideas(["Young people aged 18–30", "১৮–৩০ বছরের তরুণরা"], ["Families who cook at home", "যারা বাসায় রান্না করেন"], ["Students preparing for exams", "পরীক্ষার প্রস্তুতি নেওয়া শিক্ষার্থীরা"], ["Small business owners", "ছোট ব্যবসার মালিকরা"])),
      field("thumb_text", "text", L("Text on the thumbnail", "থাম্বনেইলে লেখা"), false, L("Keep it short: 2 to 5 words.", "ছোট রাখুন: ২ থেকে ৫ শব্দ।"), [], ideas(["Easy in 5 minutes!", "৫ মিনিটেই সহজ!"], ["Don't miss this", "এটা মিস করবেন না"], ["Watch till the end", "শেষ পর্যন্ত দেখুন"], ["Best tips 2026", "সেরা টিপস ২০২৬"])),
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
      field("post_text", "long_text", L("Text on the post", "পোস্টের লেখা"), true, L("", ""), [], ideas(["Big Eid sale: 30% off everything this week. Order on our page.", "ঈদের বড় সেল: এই সপ্তাহে সবকিছুতে ৩০% ছাড়। আমাদের পেজে অর্ডার করুন।"], ["New arrivals are here. Limited stock, order now.", "নতুন কালেকশন এসে গেছে। স্টক সীমিত, এখনই অর্ডার করুন।"], ["Free home delivery inside Dhaka this month.", "এই মাসে ঢাকার ভেতরে ফ্রি হোম ডেলিভারি।"], ["Grand opening this Friday. Come and get a free gift.", "এই শুক্রবার আমাদের উদ্বোধন। এসে ফ্রি উপহার নিন।"])),
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
    fields: [field("page_name", "text", L("Page name", "পেজের নাম"), true), field("cover_text", "text", L("Text on the cover", "কভারে লেখা"), false, L("", ""), [], ideas(["Fresh every day", "প্রতিদিন তাজা"], ["Order on our page, delivered to your door", "পেজে অর্ডার করুন, বাসায় পৌঁছে যাবে"], ["Open every day, 10 am to 10 pm", "প্রতিদিন খোলা, সকাল ১০টা থেকে রাত ১০টা"], ["Quality you can trust", "ভরসার মান"])), field("colours", "colours", L("Brand colours", "ব্র্যান্ডের রং"), false)],
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
    fields: [field("channel_name", "text", L("Channel name", "চ্যানেলের নাম"), true), field("about", "long_text", L("What is the channel about?", "চ্যানেলটি কী নিয়ে?"), true, L("", ""), [], ideas(["Easy home cooking in Bangla, with new recipes every week.", "বাংলায় সহজ ঘরোয়া রান্না, প্রতি সপ্তাহে নতুন রেসিপি।"], ["Tech reviews and phone tips for everyone in Bangladesh.", "বাংলাদেশের সবার জন্য টেক রিভিউ আর ফোনের টিপস।"], ["Travel videos from every corner of Bangladesh.", "বাংলাদেশের প্রতিটি কোণ থেকে ভ্রমণের ভিডিও।"], ["Study tips and lessons for SSC and HSC students.", "এসএসসি আর এইচএসসি শিক্ষার্থীদের জন্য পড়ার টিপস আর পাঠ।"])), field("colours", "colours", L("Brand colours", "ব্র্যান্ডের রং"), false)],
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
    fields: [field("profile_name", "text", L("Profile name", "প্রোফাইলের নাম"), true), field("header_text", "text", L("Text on the header", "হেডারে লেখা"), false, L("", ""), [], ideas(["Ideas that move Bangladesh forward", "বাংলাদেশকে এগিয়ে নেওয়ার আইডিয়া"], ["News, tips and stories every day", "প্রতিদিন খবর, টিপস আর গল্প"], ["Building the future, one step at a time", "ধাপে ধাপে ভবিষ্যৎ গড়ছি"]))],
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
    // The card's phone, email, address and QR link are private: only the winner sees them (no-contact rule).
    clientInstruction: BUSINESS_CARD_INSTRUCTION,
    designerInstruction: BUSINESS_CARD_DESIGNER,
    width: 1050,
    height: 600,
    finalTypes: ["pdf", "png"],
    fields: BUSINESS_CARD_FIELDS,
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
    fields: [
      field("headline", "text", L("Headline", "হেডলাইন"), true, L("", ""), [], ideas(["Grand opening!", "শুভ উদ্বোধন!"], ["Eid special offer", "ঈদ স্পেশাল অফার"], ["Admission going on", "ভর্তি চলছে"], ["Free health camp", "ফ্রি স্বাস্থ্য ক্যাম্প"])),
      field("details", "long_text", L("Details to show", "কী কী তথ্য থাকবে"), true, L("", ""), [], ideas(["Date and time, place, what is on offer, and how to book.", "তারিখ ও সময়, জায়গা, কী অফার আছে আর কীভাবে বুক করবেন।"], ["Three main offers with prices, and our opening hours.", "দামসহ তিনটি প্রধান অফার, আর আমাদের খোলার সময়।"], ["Courses, start date, fees and the admission deadline.", "কোর্স, শুরুর তারিখ, ফি আর ভর্তির শেষ তারিখ।"])),
      field("size", "choice", L("Size", "সাইজ"), true, L("", ""), [L("A4", "A4"), L("A5", "A5"), L("Letter", "লেটার")]),
    ],
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
    fields: [
      field("idea", "long_text", L("Text or idea", "লেখা বা আইডিয়া"), true, L("", ""), [], ideas(["Our team name in big letters, with a number on the back.", "বড় অক্ষরে আমাদের টিমের নাম, পেছনে একটি নম্বর।"], ["A simple, modern design with our brand name for our staff.", "স্টাফদের জন্য ব্র্যান্ডের নামসহ সহজ, আধুনিক ডিজাইন।"], ["A fun Bangla line for a family trip, the same on every shirt.", "পারিবারিক ভ্রমণের জন্য মজার একটি বাংলা লাইন, সব শার্টে একই।"])),
      field("shirt_colour", "text", L("Shirt colour", "শার্টের রং"), true, L("", ""), [], ideas(["White", "সাদা"], ["Black", "কালো"], ["Navy blue", "নেভি ব্লু"], ["Maroon", "মেরুন"])),
      field("print_side", "choice", L("Print side", "কোন দিকে প্রিন্ট"), false, L("", ""), [L("Front", "সামনে"), L("Back", "পেছনে"), L("Both", "দুই দিকে")]),
    ],
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
    const suggestions = (Array.isArray(o.suggestions) ? o.suggestions : [])
      .slice(0, LIMITS.suggestions)
      .map((x) => lang(x, type === "long_text" ? LIMITS.longText : LIMITS.text))
      .filter((x) => x.en && x.bn);
    seen.add(key);
    const priv = o.private === true && (type === "text" || type === "long_text" || type === "link");
    const section = lang(o.section, LIMITS.label);
    fields.push({ key, type, label, help: lang(o.help, LIMITS.help), required: o.required === true, options: type === "choice" || type === "multi_choice" ? options : [], suggestions: type === "text" || type === "long_text" ? suggestions : [], ...(priv ? { private: true } : {}), ...(section.en ? { section: { en: section.en, bn: section.bn || section.en } } : {}) });
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

/** The keys of private questions (owner, 2026-10-17): their answers go only to the client, the team and the winner. */
export const privateKeys = (def: Pick<ServiceDef, "fields">): string[] => def.fields.filter((f) => f.private).map((f) => f.key);

/** The answers a viewer may see: without the private ones unless `allowed`. Also says which answered ones were hidden. */
export function visibleAnswers(def: Pick<ServiceDef, "fields">, answers: Answers, allowed: boolean): { answers: Answers; hidden: string[] } {
  if (allowed) return { answers, hidden: [] };
  const priv = new Set(privateKeys(def));
  const out: Answers = {};
  const hidden: string[] = [];
  for (const [k, v] of Object.entries(answers)) {
    if (!priv.has(k)) out[k] = v;
    else if (String(v ?? "").length > 0) hidden.push(k);
  }
  return { answers: out, hidden };
}
