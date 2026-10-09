"use server";

import { refresh } from "next/cache";
import { adminUser, audit, cleanReason, UUID } from "@/lib/admin/core";
import { getCurrentUser } from "@/lib/auth/session";
import type { MessageKey } from "@/lib/i18n/translate";
import { notify } from "@/lib/notifications";
import { normalizeBdMobile } from "@/lib/phone";
import { createAdminClient } from "@/lib/supabase/admin";
import { winningDesigns } from "./queries";
import { canLike, isMonthKey, monthKey } from "./rules";

type Result = { ok: true } | { ok: false; error: MessageKey };
const fail = (error: MessageKey): Result => ({ ok: false, error });

/** Like or unlike a winning design (owner, 2026-10-09): designers only, never their own, public winners only. */
export async function toggleLike(entryId: string): Promise<{ ok: true; liked: boolean; likes: number } | { ok: false; error: MessageKey }> {
  const user = await getCurrentUser();
  if (!user || !UUID.test(entryId)) return { ok: false, error: "likes.loginDesigner" };
  const [design] = await winningDesigns({ entryIds: [entryId], viewerId: user.id, limit: 1 });
  if (!design) return { ok: false, error: "likes.notWinner" };
  if (!canLike(user, design.designerId)) return { ok: false, error: user.id === design.designerId ? "likes.own" : "likes.loginDesigner" };
  const db = createAdminClient();
  const { error } = design.liked
    ? await db.from("design_likes").delete().eq("entry_id", entryId).eq("user_id", user.id)
    : await db.from("design_likes").insert({ entry_id: entryId, user_id: user.id });
  if (error && error.code !== "23505") return { ok: false, error: "admin.errors.generic" };
  const { count } = await db.from("design_likes").select("entry_id", { count: "exact", head: true }).eq("entry_id", entryId);
  // A new like tells the designer, and the client whose contest it won (owner, 2026-10-09). Taking a like back is silent.
  if (!design.liked && !error) {
    const n = { brand: design.brandName, number: design.number, name: user.username ? `@${user.username}` : user.name, liker: user.id, entry: entryId };
    // Liking, unliking and liking again tells them only once.
    const { count: told } = await db.from("notifications").select("id", { count: "exact", head: true }).eq("type", "design_liked").eq("data->>entry", entryId).eq("data->>liker", user.id);
    if (told) return { ok: true, liked: true, likes: count ?? 0 };
    const { data: c } = await db.from("contests").select("client_id").eq("slug", design.contestSlug).maybeSingle();
    await notify([design.designerId], "design_liked", n, `/contest/${design.contestSlug}?tab=entries&entry=${design.number}`, user.id);
    if (c?.client_id) await notify([c.client_id as string], "design_liked_client", n, `/contest/${design.contestSlug}?tab=entries&entry=${design.number}`, user.id);
  }
  return { ok: true, liked: !design.liked, likes: count ?? 0 };
}

/** A-08: pick a finished month's winning design; the winner is asked for the gift delivery details. */
export async function pickMonthlyDesign(month: string, entryId: string, f: Record<string, string>): Promise<Result> {
  const admin = await adminUser();
  if (!admin || !isMonthKey(month) || !UUID.test(entryId)) return fail("auth.errors.generic");
  if (month >= monthKey(new Date())) return fail("admin.monthly.notOver");
  const reason = cleanReason(f.reason);
  if (!reason) return fail("admin.errors.reason");
  const design = (await winningDesigns({ month, limit: 1000 })).find((d) => d.entryId === entryId);
  if (!design) return fail("admin.monthly.notRanked");
  const { error } = await createAdminClient().rpc("pick_monthly_design", { p_month: month, p_entry_id: entryId, p_likes: design.likes, p_admin_id: admin.id });
  if (error) return fail("admin.monthly.alreadyConfirmed");
  await audit(admin.id, "confirm_monthly_winner", "user", design.designerId, { month, entry: entryId, contest: design.contestSlug, likes: design.likes, reason });
  await notify([design.designerId], "monthly_champion", { month, brand: design.brandName }, "/dashboard/gift", admin.id);
  const { data: designers } = await createAdminClient().from("profiles").select("id").eq("role", "designer").eq("status", "active").neq("id", design.designerId);
  const name = design.designer ? (design.designer.username ? `@${design.designer.username}` : design.designer.name) : design.brandName;
  await notify((designers ?? []).map((d) => d.id as string), "monthly_announced", { name, month, brand: design.brandName }, "/leaderboard", admin.id);
  refresh();
  return { ok: true };
}

/** The winner gives (or fixes) the gift delivery details until the gift is sent. */
export async function saveGiftAddress(month: string, f: Record<string, string>): Promise<Result> {
  const user = await getCurrentUser();
  if (!user || user.role !== "designer" || !isMonthKey(month)) return fail("auth.errors.generic");
  const name = (f.name ?? "").replace(/\s+/g, " ").trim();
  const address = (f.address ?? "").replace(/\s+/g, " ").trim();
  const phone = normalizeBdMobile(f.phone ?? "");
  if (name.length < 3 || name.length > 80) return fail("gift.errors.name");
  if (!phone) return fail("gift.errors.phone");
  if (address.length < 10 || address.length > 400) return fail("gift.errors.address");
  const db = createAdminClient();
  const { data, error } = await db
    .from("monthly_winners")
    .update({ ship_name: name, ship_phone: phone, ship_address: address, address_at: new Date().toISOString(), gift_status: "address_given" })
    .eq("month", month)
    .eq("designer_id", user.id)
    .eq("status", "confirmed")
    .in("gift_status", ["awaiting_address", "address_given"])
    .select("month")
    .maybeSingle();
  if (error || !data) return fail("gift.errors.closed");
  const { data: admins } = await db.from("profiles").select("id").eq("role", "admin").eq("status", "active");
  await notify((admins ?? []).map((a) => a.id as string), "gift_address_given", { month, name: user.name }, `/admin/monthly?month=${month}`, user.id);
  refresh();
  return { ok: true };
}

/** A-08: the gift box was sent (with a courier note); the winner is told. */
export async function markGiftSent(month: string, f: Record<string, string>): Promise<Result> {
  const admin = await adminUser();
  if (!admin || !isMonthKey(month)) return fail("auth.errors.generic");
  const note = cleanReason(f.reason);
  if (!note) return fail("admin.errors.reason");
  const { data, error } = await createAdminClient()
    .from("monthly_winners")
    .update({ gift_status: "sent", sent_at: new Date().toISOString(), sent_note: note })
    .eq("month", month)
    .eq("gift_status", "address_given")
    .select("designer_id")
    .maybeSingle();
  if (error || !data) return fail("admin.monthly.noAddress");
  await audit(admin.id, "gift_sent", "user", data.designer_id as string, { month, note });
  await notify([data.designer_id as string], "gift_sent", { month, reason: note }, "/dashboard/gift", admin.id);
  refresh();
  return { ok: true };
}
