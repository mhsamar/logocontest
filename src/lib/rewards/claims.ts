import "server-only";
import { adminIdsWith } from "@/lib/admin/recipients";
import { translatorFor } from "@/lib/content/texts";
import { getEmailSender } from "@/lib/email";
import { isSupabaseConfigured } from "@/lib/env";
import { notify } from "@/lib/notifications";
import { monthLabel } from "@/lib/notifications/render";
import { getSettings } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { monthlyCardImage, rewardLink, rewardNumber, type RewardKind } from "./month-close";

/**
 * Claiming a monthly prize (owner, 2026-10-11; Design/rewards/client-smartphone-claim.html and
 * designer-gift-box-claim.html, REWARDS-HANDOFF §D). The winner gives a full name, a Bangladesh mobile and a full
 * address once (claim_monthly_reward); afterwards it is read-only and changes go through support. The claim details
 * are private: read here only for the winner themself, and on Admin → Monthly winner.
 */

export type ClaimStatus = "not_claimed" | "claimed" | "contacted" | "delivered";

export type MyReward = {
  id: string;
  number: string;
  month: string;
  kind: RewardKind;
  status: ClaimStatus;
  stats: Record<string, number>;
  images: { square: string; story: string };
  claim: { name: string; mobile: string; address: string; claimedAt: Date } | null;
};

const SELECT = "id, number, month, kind, status, stats, sent_at, card_square_path, card_story_path, claim_name, claim_mobile, claim_address, claimed_at";

function toMine(r: Record<string, unknown>): MyReward {
  const id = r.id as string;
  return {
    id,
    number: rewardNumber(r.number as number),
    month: r.month as string,
    kind: r.kind as RewardKind,
    status: r.status as ClaimStatus,
    stats: (r.stats ?? {}) as Record<string, number>,
    images: { square: monthlyCardImage(id, "square", r.card_square_path as string | null), story: monthlyCardImage(id, "story", r.card_story_path as string | null) },
    claim: r.claimed_at
      ? { name: r.claim_name as string, mobile: r.claim_mobile as string, address: r.claim_address as string, claimedAt: new Date(r.claimed_at as string) }
      : null,
  };
}

/** One of the user's own prizes, once it was sent to them (a held month stays hidden). */
export async function myReward(id: string, userId: string): Promise<MyReward | null> {
  if (!isSupabaseConfigured() || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await createAdminClient().from("monthly_rewards").select(SELECT).eq("id", id).eq("winner_id", userId).not("sent_at", "is", null).maybeSingle();
  return data ? toMine(data as Record<string, unknown>) : null;
}

/** The user's prizes still waiting for a claim, newest first (the dashboard banner). */
export async function myUnclaimedRewards(userId: string): Promise<MyReward[]> {
  if (!isSupabaseConfigured()) return [];
  const { data } = await createAdminClient()
    .from("monthly_rewards")
    .select(SELECT)
    .eq("winner_id", userId)
    .eq("status", "not_claimed")
    .not("sent_at", "is", null)
    .order("month", { ascending: false });
  return (data ?? []).map((r) => toMine(r as Record<string, unknown>));
}

/** The user's newest prize (for the old /dashboard/gift link). */
export async function myLatestRewardId(userId: string): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const { data } = await createAdminClient().from("monthly_rewards").select("id").eq("winner_id", userId).not("sent_at", "is", null).order("month", { ascending: false }).limit(1).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

/** The claim deadline from Settings (end of that day, Dhaka), or null when it is empty. */
export function claimDeadline(setting: string): Date | null {
  return /^\d{4}-\d{2}-\d{2}$/.test(setting) ? new Date(`${setting}T23:59:59+06:00`) : null;
}

/** Tells the admins with Monthly winner that a claim arrived: in the app and by email (no claim details in the email). */
export async function tellAdminsClaimed(reward: { id: string; month: string; kind: RewardKind; number: string }, winnerName: string, origin: string): Promise<void> {
  const ids = await adminIdsWith("monthly.view");
  await notify(ids, "monthly_claimed", { month: reward.month, name: winnerName }, "/admin/monthly");
  if (!ids.length) return;
  const { data } = await createAdminClient().from("profiles").select("email, locale").in("id", ids);
  for (const a of data ?? []) {
    if (!a.email) continue;
    const lang = a.locale === "bn" ? "bn" : "en";
    const t = await translatorFor(lang);
    const prize = t(reward.kind === "smartphone" ? "monthlyReward.page.smartphone" : "monthlyReward.page.giftBox");
    await getEmailSender()
      .send({
        to: a.email as string,
        subject: t("monthlyReward.adminEmail.subject", { name: winnerName, prize }),
        text: t("monthlyReward.adminEmail.body", { name: winnerName, prize, month: monthLabel(reward.month, lang), number: reward.number, link: `${origin}/admin/monthly` }),
      })
      .catch((err: unknown) => console.error("[claim] admin email failed:", err instanceof Error ? err.message : err));
  }
}

/**
 * Reminds winners who haven't claimed (the 15-minute job): every few days (Settings), up to a set number of times,
 * in the app and by email. Not after the claim deadline. Returns how many were reminded.
 */
export async function remindUnclaimed(origin: string, now = new Date()): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  const s = await getSettings(["rewards.claim_reminder_days", "rewards.claim_reminders_max", "rewards.claim_deadline"]);
  const deadline = claimDeadline(s["rewards.claim_deadline"]);
  if (s["rewards.claim_reminders_max"] <= 0 || (deadline && now > deadline)) return 0;
  const due = new Date(now.getTime() - s["rewards.claim_reminder_days"] * 86_400_000).toISOString();
  const db = createAdminClient();
  const { data } = await db
    .from("monthly_rewards")
    .select(REMINDER_SELECT)
    .eq("status", "not_claimed")
    .lt("sent_at", due)
    .lt("reminder_count", s["rewards.claim_reminders_max"])
    .or(`reminded_at.is.null,reminded_at.lt.${due}`)
    .limit(50);
  let n = 0;
  for (const r of data ?? []) if (await sendReminder(r as ReminderRow, origin, now)) n++;
  return n;
}

type ReminderRow = { id: string; month: string; kind: string; reminder_count: number; winner: unknown };
const REMINDER_SELECT = "id, month, kind, reminder_count, winner:profiles!winner_id(id, name, email, locale)";

/** Admin → Monthly winner: "Send a reminder now" for one prize that isn't claimed. False when it was claimed meanwhile. */
export async function remindReward(id: string, origin: string): Promise<boolean> {
  const { data } = await createAdminClient().from("monthly_rewards").select(REMINDER_SELECT).eq("id", id).eq("status", "not_claimed").not("sent_at", "is", null).maybeSingle();
  return data ? sendReminder(data as ReminderRow, origin, new Date()) : false;
}

/** One reminder: counted first (so two runs at the same time send it once), then the notice and the email. */
async function sendReminder(r: ReminderRow, origin: string, now: Date): Promise<boolean> {
  const db = createAdminClient();
  const { data: mine } = await db
    .from("monthly_rewards")
    .update({ reminded_at: now.toISOString(), reminder_count: r.reminder_count + 1 })
    .eq("id", r.id)
    .eq("reminder_count", r.reminder_count)
    .eq("status", "not_claimed")
    .select("id")
    .maybeSingle();
  if (!mine) return false;
  const w = (Array.isArray(r.winner) ? r.winner[0] : r.winner) as { id: string; name: string | null; email: string | null; locale: string | null } | null;
  if (!w) return false;
  const kind = r.kind as RewardKind;
  const link = rewardLink(r.id);
  await notify([w.id], "monthly_claim_reminder", { month: r.month }, link);
  if (w.email) {
    const lang = w.locale === "bn" ? "bn" : "en";
    const t = await translatorFor(lang);
    const prize = t(kind === "smartphone" ? "monthlyReward.page.smartphone" : "monthlyReward.page.giftBox");
    await getEmailSender()
      .send({
        to: w.email,
        subject: t("monthlyReward.reminderEmail.subject", { prize }),
        text: t("monthlyReward.reminderEmail.body", { name: (w.name ?? "").trim(), prize, month: monthLabel(r.month, lang), link: `${origin}${link}` }),
      })
      .catch((err: unknown) => console.error("[claim] reminder email failed:", err instanceof Error ? err.message : err));
  }
  return true;
}
