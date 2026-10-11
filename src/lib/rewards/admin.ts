import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { avatarUrl } from "@/lib/profile/avatar";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ClaimStatus } from "./claims";
import { monthlyCardImage, rewardLink, rewardNumber, type RewardKind } from "./month-close";

/**
 * Admin → Monthly winner: every prize and its claim (owner, 2026-10-11; Design/rewards/admin-monthly-winner.html).
 * The claim details (name, mobile, address) are read only here, for admins with Monthly winner permission.
 */

export type AdminReward = {
  id: string;
  number: string;
  month: string;
  kind: RewardKind;
  status: ClaimStatus;
  stats: Record<string, number>;
  winner: { id: string; name: string; avatarUrl: string | null };
  sentAt: Date | null;
  /** The winner opened the "You won" notice. */
  seen: boolean;
  card: string;
  claim: { name: string; mobile: string; address: string } | null;
  claimedAt: Date | null;
  contactedAt: Date | null;
  deliveredAt: Date | null;
  note: string;
  reminderCount: number;
};

export async function adminRewards(isTest: boolean): Promise<AdminReward[]> {
  if (!isSupabaseConfigured()) return [];
  const db = createAdminClient();
  const { data } = await db
    .from("monthly_rewards")
    .select(
      "id, number, month, kind, status, stats, sent_at, card_square_path, claim_name, claim_mobile, claim_address, claimed_at, contacted_at, delivered_at, admin_note, reminder_count, winner:profiles!winner_id(id, name, username, avatar_path)",
    )
    .eq("is_test", isTest)
    .order("month", { ascending: false })
    .order("kind", { ascending: false })
    .limit(240);
  const rows = data ?? [];
  const links = rows.map((r) => rewardLink(r.id as string));
  const { data: read } = links.length
    ? await db.from("notifications").select("link").in("link", links).in("type", ["monthly_smartphone_won", "monthly_gift_box_won"]).not("read_at", "is", null)
    : { data: [] };
  const seen = new Set((read ?? []).map((r) => r.link as string));
  const at = (v: unknown) => (v ? new Date(v as string) : null);
  return rows.map((r) => {
    const w = (Array.isArray(r.winner) ? r.winner[0] : r.winner) as { id: string; name: string | null; username: string | null; avatar_path: string | null } | null;
    const id = r.id as string;
    return {
      id,
      number: rewardNumber(r.number as number),
      month: r.month as string,
      kind: r.kind as RewardKind,
      status: r.status as ClaimStatus,
      stats: (r.stats ?? {}) as Record<string, number>,
      winner: { id: w?.id ?? "", name: (w?.name ?? "").trim() || (w?.username ? `@${w.username}` : "—"), avatarUrl: avatarUrl(w?.avatar_path ?? null) },
      sentAt: at(r.sent_at),
      seen: seen.has(rewardLink(id)),
      card: monthlyCardImage(id, "square", (r.card_square_path as string | null) ?? null),
      claim: r.claimed_at ? { name: r.claim_name as string, mobile: r.claim_mobile as string, address: r.claim_address as string } : null,
      claimedAt: at(r.claimed_at),
      contactedAt: at(r.contacted_at),
      deliveredAt: at(r.delivered_at),
      note: (r.admin_note as string | null) ?? "",
      reminderCount: (r.reminder_count as number) ?? 0,
    };
  });
}
