import "server-only";
import { pictureUrl } from "@/lib/content/pictures";
import { getSettings } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { payTarget } from "./manual";
import { payReference, showMobile } from "./manual-rules";
import { methodRows } from "./methods";

/** One line of the voice guide: from and to (seconds), the box lit up meanwhile, and the line shown. */
export type VoiceCue = { from: number; to: number; box: "none" | "bkash-number" | "amount" | "reference" | "trxid-step" | "money-held" | "whatsapp"; text: string };

/**
 * Everything the contest payment screens show (owner, 2026-11-06; Design/logocontest-update PayV3, PayTrx, PayBank,
 * PayWait): the order, the bKash number and its account name, the amount and the reference, the voice guide and the
 * help, and where the payment stands. Never the payer's details beyond their own mobile for the sender box.
 */
export type PayV3 = {
  paymentId: string;
  contestId: string;
  slug: string;
  brand: string;
  packageKey: string;
  days: number;
  prize: number;
  addons: number;
  fee: number;
  feePercent: number;
  amount: number;
  number: string;
  accountName: string | null;
  method: "bkash_personal" | "bkash_merchant";
  reference: string | null;
  /** The payer's own mobile, for the "sent from" box (01XXXXXXXXX). */
  mobile: string;
  voice: { url: string; cues: VoiceCue[] } | null;
  videoId: string | null;
  whatsapp: string;
  hours: string;
  approvalMinutes: number;
  state: "open" | "pending" | "paid" | "closed";
  pending: { txn: string; method: "bkash" | "bank" | "other" } | null;
  rejected: string | null;
};

/** The payment screens' data for this contest payment, or null when it isn't the payer's open manual contest payment. */
export async function contestPayV3(paymentId: string, userId: string): Promise<PayV3 | null> {
  const target = await payTarget("contest", paymentId);
  if (!target || target.userId !== userId || !target.contest) return null;
  const db = createAdminClient();
  const [{ data: c }, { data: me }, rows, s] = await Promise.all([
    db.from("contests").select("id, slug, brand_name, package, duration_days, prize_amount, upgrades_amount, contest_number").eq("id", target.contest.id).maybeSingle(),
    db.from("profiles").select("mobile").eq("id", userId).maybeSingle(),
    methodRows(),
    getSettings(["pay.voice_on", "pay.voice_path", "pay.voice_cues", "pay.howto_video", "pay.support_hours", "contact.whatsapp", "onboarding.approval_minutes"]),
  ]);
  if (!c) return null;
  const row = rows.find((r) => r.key === target.method) ?? null;
  const prize = c.prize_amount as number;
  const addons = (c.upgrades_amount as number | null) ?? 0;
  // What is left of the amount after the prize and the add-ons is the fee (a promo code may have lowered it).
  const fee = Math.max(0, target.amount - prize - addons);
  const voiceUrl = s["pay.voice_on"] && s["pay.voice_path"] ? pictureUrl(s["pay.voice_path"]) : null;
  const proof = target.proof;
  return {
    paymentId,
    contestId: c.id as string,
    slug: c.slug as string,
    brand: c.brand_name as string,
    packageKey: c.package as string,
    days: c.duration_days as number,
    prize,
    addons,
    fee,
    feePercent: prize > 0 ? Math.round((fee * 100) / prize) : 0,
    amount: target.amount,
    number: row?.number ?? "",
    accountName: row?.name ?? null,
    method: target.method,
    reference: payReference(c.contest_number as number | null),
    mobile: showMobile(me?.mobile as string | null).replace(/-/g, ""),
    voice: voiceUrl ? { url: voiceUrl, cues: s["pay.voice_cues"] } : null,
    videoId: s["pay.howto_video"].kind === "youtube" ? s["pay.howto_video"].id : null,
    whatsapp: s["contact.whatsapp"],
    hours: s["pay.support_hours"],
    approvalMinutes: s["onboarding.approval_minutes"],
    state: target.state === "open" ? (proof?.status === "pending" ? "pending" : "open") : target.state,
    pending: proof?.status === "pending" ? { txn: proof.txnId, method: proof.method } : null,
    rejected: proof?.status === "rejected" ? (proof.note ?? "") : null,
  };
}
