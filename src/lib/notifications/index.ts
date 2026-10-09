import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * In-app notifications (BLUEPRINT §12, owner 2026-10-08). Texts are built when shown,
 * from `type` and `data`, so they follow the reader's language.
 */

export const NOTIFICATION_TYPES = [
  "entry_new",
  "entry_comment",
  "contest_comment",
  "brief_updated",
  "contest_extended",
  "entry_rated",
  "entry_rejected",
  "winner_picked",
  "contest_closed",
  "handover_submitted",
  "handover_revision",
  "handover_approved",
  "withdrawal_paid",
  "withdrawal_rejected",
  "ending_soon",
  "ending_soon_extend",
  "ending_soon_designer",
  "judging_started",
  "judging_reminder",
  "win_cancelled",
  "repick_winner",
  "no_result_client",
  "no_result_share",
  "handover_approved_held",
  "prize_released",
  "claim_opened",
  "claim_opened_admin",
  "claim_rejected_client",
  "claim_rejected_designer",
  "claim_correction_client",
  "claim_correction_designer",
  "claim_upheld_client",
  "claim_fined",
  "claim_banned",
  "strike_received",
  "account_suspended",
  "account_banned",
  "flag_warning",
  "report_upheld",
  "report_dismissed",
  "entry_removed",
  "contest_cancelled",
  "contest_cancelled_client",
  "winner_picked_by_admin",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export type NotificationData = { brand?: string; number?: number; stars?: number; name?: string; days?: number; amount?: number; reason?: string };

export type AppNotification = { id: string; type: NotificationType; data: NotificationData; link: string | null; read: boolean; createdAt: Date };

/** Sends one notification to each user (the actor is always left out). Never throws. */
export async function notify(userIds: (string | null | undefined)[], type: NotificationType, data: NotificationData, link: string | null, actorId?: string): Promise<void> {
  const ids = [...new Set(userIds.filter((id): id is string => Boolean(id) && id !== actorId))];
  if (ids.length === 0 || !isSupabaseConfigured()) return;
  const { error } = await createAdminClient()
    .from("notifications")
    .insert(ids.map((user_id) => ({ user_id, type, data, link })));
  if (error) console.error("[notifications] insert failed:", error.message);
}

/** Designers with a design in this contest that is still shown. */
export async function contestDesignerIds(contestId: string): Promise<string[]> {
  const { data } = await createAdminClient().from("entries").select("designer_id").eq("contest_id", contestId).in("status", ["active", "winner", "forfeited", "rejected"]);
  return [...new Set((data ?? []).map((r) => r.designer_id as string))];
}

export async function listNotifications(userId: string, limit: number): Promise<AppNotification[]> {
  if (!isSupabaseConfigured()) return [];
  const { data } = await createAdminClient()
    .from("notifications")
    .select("id, type, data, link, read_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? [])
    .filter((r) => (NOTIFICATION_TYPES as readonly string[]).includes(r.type as string))
    .map((r) => ({
      id: r.id as string,
      type: r.type as NotificationType,
      data: (r.data ?? {}) as NotificationData,
      link: r.link as string | null,
      read: Boolean(r.read_at),
      createdAt: new Date(r.created_at as string),
    }));
}

export async function unreadCount(userId: string): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  const { count } = await createAdminClient().from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null);
  return count ?? 0;
}
