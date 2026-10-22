import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { getFileStorage } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { endAllSessions } from "@/lib/auth/sessions";
import { one } from "./core";

/**
 * Trash (owner, 2026-10-14). "Delete" in the admin moves a contest or a user here (status 'deleted', the old status
 * kept for Restore). After `trash.keep_days` (90) the lifecycle job erases everything about it for good: the rows,
 * their payments and the stored files. A contest still unpaid `trash.unpaid_hours` (72) after it was started comes
 * here on its own. Designers keep the prize money they earned: wallet lines only lose their link to the contest.
 */

const db = () => createAdminClient();
const DAY = 86_400_000;
const HOUR = 3_600_000;

export type TrashError = "notFound" | "already" | "admin" | "self" | "liveContests" | "openHandover" | "walletMoney" | "notInTrash" | "refundClaim";
type Done = { ok: true } | { ok: false; error: TrashError };

/** Contests a client can't be deleted with: the designers and the client are still working on them. */
const LIVE = ["open", "judging", "winner_selected", "handover"];

/** A money-back claim still to decide or pay (owner, 2026-10-21): its contest and its client stay until it is done. */
export async function openRefundClaim(column: "contest_id" | "client_id", id: string): Promise<boolean> {
  const { count } = await db().from("guarantee_claims").select("id", { count: "exact", head: true }).eq(column, id).in("status", ["pending", "approved"]);
  return (count ?? 0) > 0;
}

// ---------------------------------------------------------------------------------------------------------------
// Contests
// ---------------------------------------------------------------------------------------------------------------

export async function trashContest(contestId: string, by: string | null, reason: string): Promise<Done> {
  const { data: c } = await db().from("contests").select("id, status").eq("id", contestId).maybeSingle();
  if (!c) return { ok: false, error: "notFound" };
  if (c.status === "deleted") return { ok: false, error: "already" };
  if (await openRefundClaim("contest_id", contestId)) return { ok: false, error: "refundClaim" };
  const { data, error } = await db()
    .from("contests")
    .update({ status: "deleted", deleted_at: new Date().toISOString(), deleted_by: by, delete_reason: reason.slice(0, 500), deleted_from_status: c.status })
    .eq("id", contestId)
    .eq("status", c.status)
    .select("id");
  if (error) throw new Error(error.message);
  return data?.length ? { ok: true } : { ok: false, error: "already" };
}

export async function restoreContest(contestId: string): Promise<Done> {
  const { data: c } = await db().from("contests").select("id, status, deleted_from_status").eq("id", contestId).maybeSingle();
  if (!c) return { ok: false, error: "notFound" };
  if (c.status !== "deleted") return { ok: false, error: "notInTrash" };
  const { error } = await db()
    .from("contests")
    .update({ status: (c.deleted_from_status as string | null) ?? "draft", deleted_at: null, deleted_by: null, delete_reason: null, deleted_from_status: null })
    .eq("id", contestId)
    .eq("status", "deleted");
  if (error) throw new Error(error.message);
  return { ok: true };
}

type Files = Map<string, string[]>;
const add = (files: Files, bucket: string, paths: (string | null | undefined)[]) => {
  const list = files.get(bucket) ?? [];
  for (const p of paths) if (p && !p.startsWith("/")) list.push(p);
  files.set(bucket, list);
};

async function removeFiles(files: Files): Promise<void> {
  const storage = getFileStorage();
  for (const [bucket, paths] of files) {
    const unique = [...new Set(paths)];
    for (let i = 0; i < unique.length; i += 100) await storage.remove(bucket, unique.slice(i, i + 100)).catch((e) => console.error(`[trash] remove ${bucket}:`, e instanceof Error ? e.message : e));
  }
}

/** Every stored file that belongs to these contests. */
async function contestFiles(ids: string[], files: Files): Promise<void> {
  if (!ids.length) return;
  const [briefs, entries, handovers, proofs, checks, chats] = await Promise.all([
    db().from("contest_files").select("path").in("contest_id", ids),
    db().from("entries").select("id, entry_images(original_path, preview_path), reports(evidence_image_path)").in("contest_id", ids),
    db().from("handovers").select("handover_files(path)").in("contest_id", ids),
    db().from("manual_payments").select("screenshot_path").in("contest_id", ids),
    db().from("logo_checks").select("image_path, certificate_pdf_path, certificate_png_path, logo_check_matches(image_path)").in("contest_id", ids),
    db().from("contest_messages").select("file_path").in("contest_id", ids),
  ]);
  add(files, "contest-files", (briefs.data ?? []).map((r) => r.path as string));
  for (const e of entries.data ?? []) {
    for (const i of (e.entry_images ?? []) as { original_path: string; preview_path: string }[]) add(files, "entry-files", [i.original_path, i.preview_path]);
    add(files, "entry-files", ((e.reports ?? []) as { evidence_image_path: string | null }[]).map((r) => r.evidence_image_path));
  }
  for (const h of handovers.data ?? []) add(files, "handover-files", ((h.handover_files ?? []) as { path: string }[]).map((f) => f.path));
  add(files, "payment-proofs", (proofs.data ?? []).map((r) => r.screenshot_path as string | null));
  for (const k of checks.data ?? []) {
    add(files, "logo-checks", [k.image_path as string, k.certificate_pdf_path as string | null, k.certificate_png_path as string | null]);
    add(files, "logo-checks", ((k.logo_check_matches ?? []) as { image_path: string | null }[]).map((m) => m.image_path));
  }
  add(files, "pro-files", (chats.data ?? []).map((r) => r.file_path as string | null));
}

/** Erases a contest for good: its payments and bKash proofs, the contest (designs, files, handover…) and the files. */
export async function purgeContest(contestId: string): Promise<void> {
  const files: Files = new Map();
  await contestFiles([contestId], files);
  const { data: pays } = await db().from("payments").select("id").eq("contest_id", contestId);
  const payIds = (pays ?? []).map((p) => p.id as string);
  await db().from("manual_payments").delete().eq("contest_id", contestId);
  if (payIds.length) await db().from("manual_payments").delete().in("payment_id", payIds);
  const { error: payError } = await db().from("payments").delete().eq("contest_id", contestId);
  if (payError) throw new Error(payError.message);
  const { error } = await db().from("contests").delete().eq("id", contestId);
  if (error) throw new Error(error.message);
  await removeFiles(files);
}

// ---------------------------------------------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------------------------------------------

/** Why this account can't go to the Trash now, or null. */
export async function userBlocker(userId: string): Promise<TrashError | null> {
  const { data: p } = await db().from("profiles").select("id, role, status").eq("id", userId).maybeSingle();
  if (!p) return "notFound";
  if (p.status === "deleted") return "already";
  if (p.role === "admin") return "admin";
  const [live, handovers, balance, waiting] = await Promise.all([
    db().from("contests").select("id", { count: "exact", head: true }).eq("client_id", userId).in("status", LIVE),
    db().from("handovers").select("id", { count: "exact", head: true }).eq("designer_id", userId).not("status", "in", "(approved,no_result,cancelled)"),
    p.role === "designer" ? db().rpc("wallet_balance", { p_designer_id: userId }) : Promise.resolve({ data: 0 }),
    db().from("withdrawals").select("id", { count: "exact", head: true }).eq("designer_id", userId).eq("status", "requested"),
  ]);
  if ((live.count ?? 0) > 0) return "liveContests";
  if (await openRefundClaim("client_id", userId)) return "refundClaim";
  if ((handovers.count ?? 0) > 0) return "openHandover";
  if (((balance.data as number | null) ?? 0) > 0 || (waiting.count ?? 0) > 0) return "walletMoney";
  return null;
}

export async function trashUser(userId: string, by: string, reason: string): Promise<Done> {
  if (userId === by) return { ok: false, error: "self" };
  const blocked = await userBlocker(userId);
  if (blocked) return { ok: false, error: blocked };
  const { data: p } = await db().from("profiles").select("status").eq("id", userId).maybeSingle();
  const { data, error } = await db()
    .from("profiles")
    .update({ status: "deleted", deleted_at: new Date().toISOString(), deleted_by: by, delete_reason: reason.slice(0, 500), deleted_from_status: p!.status, suspended_until: null })
    .eq("id", userId)
    .neq("status", "deleted")
    .select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) return { ok: false, error: "already" };
  // They can't log in or stay logged in (a 100-year ban on the login itself; Restore lifts it).
  await db().auth.admin.updateUserById(userId, { ban_duration: "876000h" }).catch((e) => console.error("[trash] ban:", e));
  await endAllSessions(userId, "deleted");
  return { ok: true };
}

export async function restoreUser(userId: string): Promise<Done> {
  const { data: p } = await db().from("profiles").select("status, deleted_from_status").eq("id", userId).maybeSingle();
  if (!p) return { ok: false, error: "notFound" };
  if (p.status !== "deleted") return { ok: false, error: "notInTrash" };
  const back = (p.deleted_from_status as string | null) ?? "active";
  const { error } = await db()
    .from("profiles")
    .update({ status: back === "deleted" ? "active" : back, deleted_at: null, deleted_by: null, delete_reason: null, deleted_from_status: null })
    .eq("id", userId)
    .eq("status", "deleted");
  if (error) throw new Error(error.message);
  await db().auth.admin.updateUserById(userId, { ban_duration: "none" }).catch((e) => console.error("[trash] unban:", e));
  return { ok: true };
}

/** Erases a user for good: the contests they started (with everything in them), their payments, the account and every row and file that belongs to it. */
export async function purgeUser(userId: string): Promise<void> {
  const { data: own } = await db().from("contests").select("id").eq("client_id", userId);
  for (const c of own ?? []) await purgeContest(c.id as string);
  const files: Files = new Map();
  const [profile, entries, portfolio, agreement, proofs, checks, chats, reports] = await Promise.all([
    db().from("profiles").select("avatar_path").eq("id", userId).maybeSingle(),
    db().from("entries").select("entry_images(original_path, preview_path)").eq("designer_id", userId),
    db().from("portfolio_items").select("image_path, preview_path").eq("designer_id", userId),
    db().from("designer_agreements").select("id_front_path, id_back_path").eq("designer_id", userId).maybeSingle(),
    db().from("manual_payments").select("screenshot_path").eq("user_id", userId),
    db().from("logo_checks").select("image_path, certificate_pdf_path, certificate_png_path").eq("requested_by", userId),
    db().from("contest_messages").select("file_path").eq("sender_id", userId),
    db().from("reports").select("evidence_image_path").eq("reporter_id", userId),
  ]);
  add(files, "avatars", [profile.data?.avatar_path as string | null]);
  for (const e of entries.data ?? []) for (const i of (e.entry_images ?? []) as { original_path: string; preview_path: string }[]) add(files, "entry-files", [i.original_path, i.preview_path]);
  for (const r of portfolio.data ?? []) add(files, "pro-files", [r.image_path as string, r.preview_path as string]);
  const a = agreement.data as { id_front_path: string | null; id_back_path: string | null } | null;
  add(files, "id-documents", [a?.id_front_path, a?.id_back_path]);
  add(files, "payment-proofs", (proofs.data ?? []).map((r) => r.screenshot_path as string | null));
  for (const k of checks.data ?? []) add(files, "logo-checks", [k.image_path as string, k.certificate_pdf_path as string | null, k.certificate_png_path as string | null]);
  add(files, "pro-files", (chats.data ?? []).map((r) => r.file_path as string | null));
  add(files, "entry-files", (reports.data ?? []).map((r) => r.evidence_image_path as string | null));

  const { error: payError } = await db().from("payments").delete().eq("client_id", userId);
  if (payError) throw new Error(payError.message);
  // A money-back claim stays as the refund record, without the person's number and note (owner, 2026-10-21).
  await db().from("guarantee_claims").update({ refund_to: null, client_note: null }).eq("client_id", userId);
  // Deleting the login removes the profile and everything linked to it.
  const { error } = await db().auth.admin.deleteUser(userId);
  if (error && !/not.?found/i.test(error.message)) throw new Error(error.message);
  await db().from("profiles").delete().eq("id", userId);
  await removeFiles(files);
}

// ---------------------------------------------------------------------------------------------------------------
// The lifecycle job and the Trash page
// ---------------------------------------------------------------------------------------------------------------

/** Contests still unpaid `hours` after they were started go to the Trash (not while a bKash payment waits). */
export async function trashUnpaidContests(now: Date, hours: number, limit = 100): Promise<number> {
  if (!isSupabaseConfigured() || hours <= 0) return 0;
  const { data } = await db().from("contests").select("id").in("status", ["draft", "pending_payment"]).lt("created_at", new Date(now.getTime() - hours * HOUR).toISOString()).limit(limit);
  const ids = (data ?? []).map((r) => r.id as string);
  if (!ids.length) return 0;
  const [waiting, paid] = await Promise.all([
    db().from("manual_payments").select("contest_id").eq("status", "pending").in("contest_id", ids),
    db().from("payments").select("contest_id").eq("status", "paid").in("contest_id", ids),
  ]);
  const keep = new Set([...(waiting.data ?? []), ...(paid.data ?? [])].map((r) => r.contest_id as string));
  let n = 0;
  for (const id of ids.filter((x) => !keep.has(x))) if ((await trashContest(id, null, "unpaid")).ok) n++;
  return n;
}

/** Erases what has been in the Trash longer than `days`. A few per run, so the job stays short. */
export async function purgeExpiredTrash(now: Date, days: number, limit = 10): Promise<{ contests: number; users: number; errors: string[] }> {
  const out = { contests: 0, users: 0, errors: [] as string[] };
  if (!isSupabaseConfigured()) return out;
  const cutoff = new Date(now.getTime() - days * DAY).toISOString();
  const [{ data: contests }, { data: users }] = await Promise.all([
    db().from("contests").select("id").eq("status", "deleted").lt("deleted_at", cutoff).limit(limit),
    db().from("profiles").select("id").eq("status", "deleted").lt("deleted_at", cutoff).limit(limit),
  ]);
  for (const c of contests ?? []) {
    try {
      await purgeContest(c.id as string);
      out.contests++;
    } catch (e) {
      out.errors.push(`contest ${c.id}: ${e instanceof Error ? e.message : e}`);
    }
  }
  for (const u of users ?? []) {
    try {
      await purgeUser(u.id as string);
      out.users++;
    } catch (e) {
      out.errors.push(`user ${u.id}: ${e instanceof Error ? e.message : e}`);
    }
  }
  return out;
}

export type TrashRow = { id: string; kind: "contest" | "user"; title: string; sub: string | null; link: string; deletedAt: Date; eraseAt: Date; by: string | null; reason: string | null; auto: boolean };

/** Everything in the Trash, newest first. */
export async function trashList(days: number): Promise<{ contests: TrashRow[]; users: TrashRow[] }> {
  if (!isSupabaseConfigured()) return { contests: [], users: [] };
  const [{ data: contests }, { data: users }] = await Promise.all([
    db().from("contests").select("id, slug, brand_name, contest_number, deleted_at, delete_reason, deleted_from_status, deleter:profiles!deleted_by(name), client:profiles!client_id(name)").eq("status", "deleted").order("deleted_at", { ascending: false }).limit(500),
    db().from("profiles").select("id, name, username, role, deleted_at, delete_reason, deleter:profiles!deleted_by(name)").eq("status", "deleted").order("deleted_at", { ascending: false }).limit(500),
  ]);
  const erase = (d: string) => new Date(new Date(d).getTime() + days * DAY);
  return {
    contests: (contests ?? []).map((c) => ({
      id: c.id as string,
      kind: "contest" as const,
      title: c.brand_name as string,
      sub: [c.contest_number ? `#${String(c.contest_number).padStart(5, "0")}` : null, one(c.client as { name: string } | { name: string }[] | null)?.name ?? null, c.deleted_from_status as string | null].filter(Boolean).join(" · ") || null,
      link: `/admin/contests/${c.slug}`,
      deletedAt: new Date(c.deleted_at as string),
      eraseAt: erase(c.deleted_at as string),
      by: one(c.deleter as { name: string } | { name: string }[] | null)?.name ?? null,
      reason: c.delete_reason === "unpaid" ? null : ((c.delete_reason as string | null) ?? null),
      auto: c.delete_reason === "unpaid" && !c.deleter,
    })),
    users: (users ?? []).map((u) => ({
      id: u.id as string,
      kind: "user" as const,
      title: u.name as string,
      sub: [u.username ? `@${u.username}` : null, u.role as string].filter(Boolean).join(" · "),
      link: `/admin/users/${u.id}`,
      deletedAt: new Date(u.deleted_at as string),
      eraseAt: erase(u.deleted_at as string),
      by: one(u.deleter as { name: string } | { name: string }[] | null)?.name ?? null,
      reason: (u.delete_reason as string | null) ?? null,
      auto: false,
    })),
  };
}
