"use server";

import { refresh } from "next/cache";
import type { MessageKey } from "@/lib/i18n/translate";
import { contestDesignerIds, notify } from "@/lib/notifications";
import { getSettings } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { feeRateFor } from "@/lib/wallet/fees";
import { adminUser, audit, cleanReason, UUID } from "./core";

type Result = { ok: true } | { ok: false; error: MessageKey };
type Fields = Record<string, string>;
const fail = (error: MessageKey): Result => ({ ok: false, error });

async function loadContest(id: string) {
  if (!UUID.test(id)) return null;
  const { data } = await createAdminClient().from("contests").select("id, slug, brand_name, client_id, status").eq("id", id).maybeSingle();
  return data as { id: string; slug: string; brand_name: string; client_id: string; status: string } | null;
}

/** A-02 Extend: free, admin only, open contests, with a reason. */
export async function extendContest(contestId: string, f: Fields): Promise<Result> {
  const admin = await adminUser("contests.manage");
  const c = admin ? await loadContest(contestId) : null;
  if (!admin || !c) return fail("auth.errors.generic");
  const reason = cleanReason(f.reason);
  if (!reason) return fail("admin.errors.reason");
  const days = Math.floor(Number(f.days));
  if (!(days >= 1 && days <= 30)) return fail("admin.errors.days");
  const { error } = await createAdminClient().rpc("admin_extend_contest", { p_contest_id: c.id, p_days: days });
  if (error) return fail("admin.contests.notOpen");
  await audit(admin.id, "extend_contest", "contest", c.id, { days, reason });
  await notify([c.client_id, ...(await contestDesignerIds(c.id))], "contest_extended", { brand: c.brand_name, days }, `/contest/${c.slug}`, admin.id);
  refresh();
  return { ok: true };
}

/** A-02 Cancel: reason required, no refund (owner, 2026-10-09). */
export async function cancelContest(contestId: string, f: Fields): Promise<Result> {
  const admin = await adminUser("contests.manage");
  const c = admin ? await loadContest(contestId) : null;
  if (!admin || !c) return fail("auth.errors.generic");
  const reason = cleanReason(f.reason);
  if (!reason) return fail("admin.errors.reason");
  const designers = await contestDesignerIds(c.id);
  const { error } = await createAdminClient().rpc("admin_cancel_contest", { p_contest_id: c.id, p_admin_id: admin.id, p_reason: reason });
  if (error) return fail("admin.contests.cannotCancel");
  await audit(admin.id, "cancel_contest", "contest", c.id, { reason, status: c.status });
  await notify([c.client_id], "contest_cancelled_client", { brand: c.brand_name, reason }, `/dashboard`, admin.id);
  await notify(designers, "contest_cancelled", { brand: c.brand_name }, null, admin.id);
  refresh();
  return { ok: true };
}

/** A-02 Force-award: an admin picks the winner for the client (same rules as the client's pick). */
export async function forceAward(contestId: string, f: Fields): Promise<Result> {
  const admin = await adminUser("contests.manage");
  const c = admin ? await loadContest(contestId) : null;
  if (!admin || !c || !UUID.test(f.entry ?? "")) return fail("auth.errors.generic");
  const reason = cleanReason(f.reason);
  if (!reason) return fail("admin.errors.reason");
  const db = createAdminClient();
  const { data: entry } = await db.from("entries").select("id, number, status, designer_id").eq("id", f.entry).eq("contest_id", c.id).maybeSingle();
  if (!entry || entry.status !== "active") return fail("manage.winner.notActive");
  const [{ data: designer }, s] = await Promise.all([
    db.from("profiles").select("counted_wins_count").eq("id", entry.designer_id).single(),
    getSettings(["fees.designer_tiers", "timers.designer_file_upload_days"]),
  ]);
  const feeRate = feeRateFor(designer?.counted_wins_count ?? 0, s["fees.designer_tiers"]);
  const dueAt = new Date(Date.now() + s["timers.designer_file_upload_days"] * 86_400_000).toISOString();
  const { error } = await db.rpc("pick_winner", { p_contest_id: c.id, p_entry_id: entry.id, p_fee_rate: feeRate, p_due_at: dueAt });
  if (error) return fail("manage.closed");
  await audit(admin.id, "force_award", "contest", c.id, { entry: entry.number, reason, feeRate });
  const n = { brand: c.brand_name, number: entry.number as number };
  await notify([entry.designer_id as string], "winner_picked", n, `/dashboard/handover/${c.slug}`, admin.id);
  await notify([c.client_id], "winner_picked_by_admin", n, `/dashboard/contests/${c.slug}`, admin.id);
  await notify((await contestDesignerIds(c.id)).filter((id) => id !== entry.designer_id), "contest_closed", n, `/contest/${c.slug}`, admin.id);
  refresh();
  return { ok: true };
}
