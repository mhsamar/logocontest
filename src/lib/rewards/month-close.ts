import "server-only";
import { after } from "next/server";
import { adminIdsWith } from "@/lib/admin/recipients";
import { audit } from "@/lib/admin/core";
import { translatorFor } from "@/lib/content/texts";
import { emailText } from "@/lib/email/events";
import { isSupabaseConfigured } from "@/lib/env";
import { notify } from "@/lib/notifications";
import { monthLabel } from "@/lib/notifications/render";
import { avatarUrl } from "@/lib/profile/avatar";
import { renderPng } from "@/lib/render/chrome";
import { getSettings } from "@/lib/settings";
import { offersOn } from "./program";
import { getFileStorage } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { CARD_SIZES, monthlyCardHtml, type CardSize } from "./card-html";
import { monthRace } from "./race";
import { REWARD_CARDS_BUCKET, cardPictureUrl } from "./win-cards";

/**
 * Closing a month (owner, 2026-10-11; Design/rewards/REWARDS-HANDOFF.md §E, BLUEPRINT §11). At 23:59 Asia/Dhaka on the
 * last day, the top client wins the smartphone and the top designer the mystery gift box (rules in race-rules.ts).
 * Each gets a monthly_rewards row with their numbers frozen, a photo card, a notice and an email. With "Ask me
 * first" on, everything is prepared and waits for an admin to approve before anything goes out.
 *
 * Safe to run twice: the month's reward_months row is written once (primary key month + is_test), the rewards are
 * unique per month and kind, and each reward is sent once (sent_at). Test mode counts only test accounts and keeps
 * its rows apart (is_test), so it never touches real people or the public leaderboard.
 */

export type RewardKind = "smartphone" | "gift_box";
export type CloseStatus = "waiting_approval" | "sent" | "no_winner";
export type CloseResult = { month: string; isTest: boolean; status: CloseStatus | "already"; rewards: number };

/** Where a monthly card picture can be loaded: the stored file, or the route that draws it the first time. */
export const monthlyCardImage = (id: string, size: CardSize, path: string | null) => (path ? cardPictureUrl(path) : `/api/cards/monthly/${id}/${size}`);

/** The site's address for links and card pictures when there is no request (the scheduled jobs). */
export const jobOrigin = () =>
  process.env.SITE_URL?.replace(/\/$/, "") || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

/** The winner's page for their prize (the claim, Phase 6). */
export const rewardLink = (id: string) => `/dashboard/rewards/${id}`;

/**
 * Closes the month: picks the winners, saves the rewards, and sends them (or holds them for approval).
 * `by` is the admin who pressed "Close the month and send now" (always sends), or null for the scheduled job.
 */
export async function closeMonth(month: string, opts: { testMode?: boolean; by?: string | null; origin: string }): Promise<CloseResult> {
  const isTest = Boolean(opts.testMode);
  const by = opts.by ?? null;
  if (!isSupabaseConfigured()) return { month, isTest, status: "already", rewards: 0 };
  const db = createAdminClient();
  const { data: done } = await db.from("reward_months").select("status").eq("month", month).eq("is_test", isTest).maybeSingle();
  if (done) return { month, isTest, status: "already", rewards: 0 };

  const s = await getSettings(["rewards.ask_first"]);
  // Owner, 2026-10-13: with the program (or one prize) switched off when the month closes, that month has no winner.
  const on = await offersOn();
  const race = await monthRace(month, { testMode: isTest });
  const client = on.smartphone ? (race.clients[0] ?? null) : null;
  const designer = on.giftBox ? (race.designers[0] ?? null) : null;
  const rows: { month: string; kind: RewardKind; is_test: boolean; winner_id: string; stats: Record<string, number> }[] = [];
  if (client) rows.push({ month, kind: "smartphone", is_test: isTest, winner_id: client.id, stats: { contests: client.contests, prize_total: client.prizeTotal, spent: client.spent } });
  if (designer) rows.push({ month, kind: "gift_box", is_test: isTest, winner_id: designer.id, stats: { wins: designer.wins, joined: designer.joined, earned: designer.earned } });
  if (rows.length) {
    // A run that stopped half way left some of these already; those stay as they were.
    const { error } = await db.from("monthly_rewards").upsert(rows, { onConflict: "month,kind,is_test", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }

  const status: CloseStatus = !rows.length ? "no_winner" : by || !s["rewards.ask_first"] ? "sent" : "waiting_approval";
  const now = new Date().toISOString();
  const { error: closeError } = await db
    .from("reward_months")
    .insert({ month, is_test: isTest, status, closed_by: by, approved_at: status === "sent" ? now : null, approved_by: status === "sent" ? by : null });
  // Another run closed it first; that run sends.
  if (closeError) return { month, isTest, status: "already", rewards: 0 };

  await audit(by, "close_month", "reward_month", month, { test: isTest || undefined, status, smartphone: client?.id, gift_box: designer?.id });
  // Test runs are for trying things out: no notices to the admins.
  if (!isTest) {
    const type = status === "waiting_approval" ? "monthly_review" : status === "sent" ? "monthly_sent" : "monthly_no_winner";
    await notify(await adminIdsWith("monthly.view"), type, { month }, "/admin/monthly", by ?? undefined);
  }
  if (status === "sent") await sendMonthRewards(month, isTest, opts.origin);
  return { month, isTest, status, rewards: rows.length };
}

/** "Ask me first": an admin approves a held month, and the cards and messages go out. False when nothing was waiting. */
export async function approveMonth(month: string, isTest: boolean, by: string, origin: string): Promise<boolean> {
  const db = createAdminClient();
  const { data } = await db
    .from("reward_months")
    .update({ status: "sent", approved_at: new Date().toISOString(), approved_by: by })
    .eq("month", month)
    .eq("is_test", isTest)
    .eq("status", "waiting_approval")
    .select("month");
  if (!data?.length) return false;
  await audit(by, "approve_month", "reward_month", month, { test: isTest || undefined });
  await sendMonthRewards(month, isTest, origin);
  return true;
}

/**
 * Sends every reward of a month that hasn't gone out: the winner's notice and email, then both card pictures are
 * drawn in the background. Each reward is marked sent first, so it is sent once even when two runs meet.
 */
export async function sendMonthRewards(month: string, isTest: boolean, origin: string): Promise<number> {
  const db = createAdminClient();
  const { data } = await db.from("monthly_rewards").select("id, kind").eq("month", month).eq("is_test", isTest).is("sent_at", null);
  const sent: string[] = [];
  for (const r of data ?? []) {
    const { data: mine } = await db
      .from("monthly_rewards")
      .update({ sent_at: new Date().toISOString() })
      .eq("id", r.id)
      .is("sent_at", null)
      .select("id, kind, winner:profiles!winner_id(id, name, email, locale)")
      .maybeSingle();
    if (!mine) continue;
    const kind = mine.kind as RewardKind;
    const w = (Array.isArray(mine.winner) ? mine.winner[0] : mine.winner) as { id: string; name: string | null; email: string | null; locale: string | null } | null;
    if (!w) continue;
    const link = rewardLink(mine.id as string);
    await notify([w.id], kind === "smartphone" ? "monthly_smartphone_won" : "monthly_gift_box_won", { month }, link);
    if (w.email) {
      const lang = w.locale === "bn" ? "bn" : "en";
      const t = await translatorFor(lang);
      await emailText({ userId: w.id, email: w.email, locale: lang, subject: t(`monthlyReward.email.${kind}.subject`, { month: monthLabel(month, lang) }), body: t(`monthlyReward.email.${kind}.body`, { name: (w.name ?? "").trim(), month: monthLabel(month, lang), link: `${origin}${link}` }), notice: "monthly_won" });
    }
    sent.push(mine.id as string);
  }
  if (sent.length) {
    // The pictures take a few seconds each; the winners already have their notices.
    after(async () => {
      for (const id of sent) {
        const reward = await monthlyRewardById(id);
        for (const size of ["square", "story"] as const) {
          if (reward) await renderMonthlyCard(reward, size, origin).catch((err: unknown) => console.error("[month-close] card failed:", err instanceof Error ? err.message : err));
        }
      }
    });
  }
  return sent.length;
}

/**
 * Test mode only: removes a month's test results so the close can be tried again (rewards, their pictures, and the
 * notices the test accounts got).
 */
export async function clearTestMonth(month: string, by: string): Promise<number> {
  const db = createAdminClient();
  const { data } = await db.from("monthly_rewards").select("id, card_square_path, card_story_path").eq("month", month).eq("is_test", true);
  const rows = data ?? [];
  const paths = rows.flatMap((r) => [r.card_square_path, r.card_story_path].filter((p): p is string => Boolean(p)));
  if (paths.length) await db.storage.from(REWARD_CARDS_BUCKET).remove(paths);
  if (rows.length) await db.from("notifications").delete().in("link", rows.map((r) => rewardLink(r.id as string)));
  await db.from("monthly_rewards").delete().eq("month", month).eq("is_test", true);
  await db.from("reward_months").delete().eq("month", month).eq("is_test", true);
  await audit(by, "clear_test_month", "reward_month", month, { rewards: rows.length });
  return rows.length;
}

export type MonthlyReward = {
  id: string;
  number: number;
  month: string;
  kind: RewardKind;
  isTest: boolean;
  sentAt: Date | null;
  squarePath: string | null;
  storyPath: string | null;
  stats: Record<string, number>;
  winner: { id: string; name: string; avatarUrl: string | null; locale: "en" | "bn" };
};

const REWARD_SELECT = "id, number, month, kind, is_test, sent_at, card_square_path, card_story_path, stats, winner:profiles!winner_id(id, name, username, avatar_path, locale)";

function toReward(r: Record<string, unknown>): MonthlyReward | null {
  const w = (Array.isArray(r.winner) ? r.winner[0] : r.winner) as Record<string, unknown> | null;
  if (!w) return null;
  return {
    id: r.id as string,
    number: r.number as number,
    month: r.month as string,
    kind: r.kind as RewardKind,
    isTest: Boolean(r.is_test),
    sentAt: r.sent_at ? new Date(r.sent_at as string) : null,
    squarePath: (r.card_square_path as string | null) ?? null,
    storyPath: (r.card_story_path as string | null) ?? null,
    stats: (r.stats ?? {}) as Record<string, number>,
    winner: {
      id: w.id as string,
      name: ((w.name as string) || "").trim() || (w.username ? `@${w.username as string}` : "—"),
      avatarUrl: avatarUrl(w.avatar_path as string | null),
      locale: w.locale === "bn" ? "bn" : "en",
    },
  };
}

/** Shown as RW-0001. */
export const rewardNumber = (n: number) => `RW-${String(n).padStart(4, "0")}`;

export async function monthlyRewardById(id: string): Promise<MonthlyReward | null> {
  if (!isSupabaseConfigured() || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await createAdminClient().from("monthly_rewards").select(REWARD_SELECT).eq("id", id).maybeSingle();
  return data ? toReward(data as Record<string, unknown>) : null;
}

/** A month's close (real or test) and its rewards, for Admin → Monthly winner. */
export async function monthClose(month: string, isTest: boolean): Promise<{ status: CloseStatus | null; closedAt: Date | null; byJob: boolean; rewards: MonthlyReward[] }> {
  if (!isSupabaseConfigured()) return { status: null, closedAt: null, byJob: false, rewards: [] };
  const db = createAdminClient();
  const [{ data: m }, { data: rows }] = await Promise.all([
    db.from("reward_months").select("status, closed_at, closed_by").eq("month", month).eq("is_test", isTest).maybeSingle(),
    db.from("monthly_rewards").select(REWARD_SELECT).eq("month", month).eq("is_test", isTest).order("kind", { ascending: false }),
  ]);
  return {
    status: (m?.status as CloseStatus | undefined) ?? null,
    closedAt: m?.closed_at ? new Date(m.closed_at as string) : null,
    byJob: Boolean(m && !m.closed_by),
    rewards: (rows ?? []).map((r) => toReward(r as Record<string, unknown>)).filter((r): r is MonthlyReward => Boolean(r)),
  };
}

/** Draws one monthly card picture in the winner's language and keeps it; returns the PNG. */
export async function renderMonthlyCard(reward: MonthlyReward, size: CardSize, origin: string): Promise<Uint8Array> {
  const lang = reward.winner.locale;
  const t = await translatorFor(lang);
  const html = monthlyCardHtml({
    size,
    origin,
    lang,
    kind: reward.kind,
    month: monthLabel(reward.month, lang),
    kicker: t("monthlyReward.card.kicker"),
    name: reward.winner.name,
    line: t(`monthlyReward.card.${reward.kind}.line`),
    footer: t(`monthlyReward.card.${reward.kind}.footer`),
    photoUrl: reward.winner.avatarUrl,
  });
  const png = await renderPng(html, CARD_SIZES[size]);
  const path = `monthly/${reward.id}-${size}.png`;
  await getFileStorage().upload(REWARD_CARDS_BUCKET, path, png, "image/png");
  await createAdminClient()
    .from("monthly_rewards")
    .update(size === "square" ? { card_square_path: path } : { card_story_path: path })
    .eq("id", reward.id);
  return png;
}
