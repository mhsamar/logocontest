/**
 * Ready messages for following up an unpaid contest (owner, 2026-11-06): the team copies one, or sends it on WhatsApp
 * or by SMS, with the client's name, the logo's name, the link and the bKash number already in. The owner's own words.
 * Two groups: stopped before the payment step (A), and stopped on it (B), each with a first message and a reminder a
 * day later, and one last message for both after 3–4 days. Pure, so it is tested.
 */

export const MESSAGE_KEYS = ["a1", "a2", "b1", "b2", "last"] as const;
export type MessageKey = (typeof MESSAGE_KEYS)[number];

/** How to address the client: ভাই, আপু, or the owner's "ভাই/আপু" for when it isn't known. */
export const SALUTES = ["both", "bhai", "apu"] as const;
export type Salute = (typeof SALUTES)[number];
const SALUTE: Record<Salute, string> = { both: "ভাই/আপু", bhai: "ভাই", apu: "আপু" };

const TEXT: Record<MessageKey, string> = {
  a1: "আসসালামু আলাইকুম {name} {salute} 🙂\nlogocontest.bd-তে “{logo}”-এর জন্য আপনার কনটেস্টটা অর্ধেক তৈরি হয়ে আছে। আপনার দেওয়া তথ্যগুলো সেভ করা আছে, বাকি কয়েকটা ধাপ শেষ করলেই ডিজাইনাররা লোগো জমা দেওয়া শুরু করবে।\nকোনো ধাপে বুঝতে সমস্যা হলে এখানেই লিখুন, সাথে সাথে সাহায্য করবো।",
  a2: "{name} {salute}, “{logo}”-এর কনটেস্টটা শেষ করতে আর মাত্র কয়েক মিনিট লাগবে।\nঅনেকে এই ধাপে এসে ভাবেন কী লিখবেন। চিন্তা নেই, যতটুকু জানেন ততটুকুই দিন, বাকিটা ডিজাইনাররা বুঝে নেবে। চাইলে আমি ফর্মটা আপনার হয়ে পূরণ করে দিতে পারি, শুধু লোগোর নাম আর ব্যবসার ধরনটা বলুন।\nলিংক: {link}",
  b1: "আসসালামু আলাইকুম {name} {salute} 🙂\n“{logo}”-এর লোগো কনটেস্টটা পুরোপুরি রেডি, শুধু পেমেন্টটা বাকি। বিকাশে প্রাইজ মানি পাঠিয়ে Transaction ID-টা দিলেই কনটেস্ট লাইভ হয়ে যাবে।\nবিকাশ নম্বর: {bkash}\nপেমেন্ট নিয়ে কোনো সমস্যা বা প্রশ্ন থাকলে এখানেই লিখুন।",
  b2: "{name} {salute}, “{logo}” কনটেস্টটা এখনো পেমেন্টের অপেক্ষায়।\nযদি প্যাকেজ বা দাম নিয়ে ভাবছেন, বলুন, আপনার বাজেট অনুযায়ী কোনটা ভালো হবে বুঝিয়ে দিচ্ছি। আর যদি শুধু সময় পাননি, কোনো তাড়া নেই। logocontest.bd-তে লগইন করে My Contest থেকে যেকোনো সময় শেষ করতে পারবেন।",
  last: "{name} {salute}, “{logo}”-এর কনটেস্টটা আর কয়েকদিন সেভ থাকবে।\nএখন লোগো না লাগলে কোনো সমস্যা নেই, পরে দরকার হলে আমরা আছি। আর কিছু নিয়ে দ্বিধা থাকলে একটা লাইন লিখুন, উত্তর দিচ্ছি 🙂\nLogo Contest BD",
};

/** Whether this message has a link in it (so the client's resume link is fetched first). */
export const needsLink = (key: MessageKey) => TEXT[key].includes("{link}");

/** The message: the owner's text with the client's details in; a detail that's missing leaves a short gap. */
export function fillMessage(key: MessageKey, v: { name: string | null; logo: string; salute: Salute; link?: string | null; bkash?: string | null }): string {
  return TEXT[key]
    .replace("{name}", (v.name ?? "").trim() || "")
    .replace("{salute}", SALUTE[v.salute])
    .replace("{logo}", v.logo.trim())
    .replace("{link}", v.link ?? "https://logocontest.bd/client/contests")
    .replace("{bkash}", v.bkash ?? "")
    .replace(/^(আসসালামু আলাইকুম) +/m, "$1 ")
    .replace(/ {2,}/g, " ");
}

/**
 * The message to send now: on the payment step (B) or before it (A); the first while nobody has contacted them, the
 * reminder after, and the last one once 3 days have passed since they started.
 */
export function pickMessage(l: { atPayment: boolean; contacts: number; startedAt: Date }, now = new Date()): MessageKey {
  if (now.getTime() - l.startedAt.getTime() >= 3 * 86_400_000 && l.contacts > 0) return "last";
  if (l.contacts === 0) return l.atPayment ? "b1" : "a1";
  return l.atPayment ? "b2" : "a2";
}
