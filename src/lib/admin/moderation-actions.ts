"use server";

import { refresh } from "next/cache";
import type { MessageKey } from "@/lib/i18n/translate";
import { notify } from "@/lib/notifications";
import { getSetting } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminUser, audit, cleanReason, one, UUID } from "./core";

type Result = { ok: true } | { ok: false; error: MessageKey };
type Fields = Record<string, string>;
const fail = (error: MessageKey): Result => ({ ok: false, error });

async function entryInfo(entryId: string) {
  const { data } = await createAdminClient().from("entries").select("id, number, status, designer_id, contest:contests!contest_id(slug, brand_name)").eq("id", entryId).maybeSingle();
  if (!data) return null;
  const c = one(data.contest as { slug: string; brand_name: string } | { slug: string; brand_name: string }[] | null);
  return { id: data.id as string, number: data.number as number, status: data.status as string, designerId: data.designer_id as string, slug: c?.slug ?? "", brand: c?.brand_name ?? "" };
}

/** A-03 Remove a design (reason required). The winning design can't be removed here; use a copy claim. */
export async function removeEntry(entryId: string, f: Fields): Promise<Result> {
  const admin = await adminUser("designs.manage");
  if (!admin || !UUID.test(entryId)) return fail("auth.errors.generic");
  const reason = cleanReason(f.reason);
  if (!reason) return fail("admin.errors.reason");
  const e = await entryInfo(entryId);
  if (!e) return fail("auth.errors.generic");
  if (e.status === "winner") return fail("admin.entries.isWinner");
  const { error } = await createAdminClient().from("entries").update({ status: "removed" }).eq("id", e.id).in("status", ["active", "rejected", "withdrawn"]);
  if (error) return fail("admin.errors.generic");
  await audit(admin.id, "remove_entry", "entry", e.id, { reason, contest: e.slug, number: e.number });
  await notify([e.designerId], "entry_removed", { brand: e.brand, number: e.number, reason }, `/contest/${e.slug}`, admin.id);
  refresh();
  return { ok: true };
}

/** A-03 Not a copy: clears the near-duplicate flag on a design's images. */
export async function clearDuplicate(entryId: string): Promise<Result> {
  const admin = await adminUser("designs.manage");
  if (!admin || !UUID.test(entryId)) return fail("auth.errors.generic");
  const { error } = await createAdminClient().from("entry_images").update({ duplicate_of_entry_id: null }).eq("entry_id", entryId);
  if (error) return fail("admin.errors.generic");
  await audit(admin.id, "clear_duplicate", "entry", entryId);
  refresh();
  return { ok: true };
}

/** A-04 Decide a report (BLUEPRINT §10): uphold (with none / strike / ban), dismiss, or dismiss as false. */
export async function resolveReport(reportId: string, decision: string, f: Fields): Promise<Result> {
  const admin = await adminUser("reports.manage");
  if (!admin || !UUID.test(reportId) || !["upheld", "dismissed", "dismissed_false"].includes(decision)) return fail("auth.errors.generic");
  const reason = cleanReason(f.reason);
  if (!reason) return fail("admin.errors.reason");
  const action = decision === "upheld" && ["strike", "ban"].includes(f.action ?? "") ? f.action : "none";
  const db = createAdminClient();
  const { data: before } = await db.from("reports").select("entry_id, reporter_id").eq("id", reportId).maybeSingle();
  if (!before) return fail("auth.errors.generic");
  const e = await entryInfo(before.entry_id as string);
  const days = await getSetting("timers.strike_suspension_days");
  const { error } = await db.rpc("resolve_report", { p_report_id: reportId, p_admin_id: admin.id, p_decision: decision, p_action: action, p_reason: reason, p_suspend_days: days });
  if (error) return fail("admin.reports.closed");
  await audit(admin.id, "resolve_report", "report", reportId, { decision, action, reason, entry: e?.number, contest: e?.slug });

  const reporter = before.reporter_id as string;
  if (decision === "upheld") {
    await notify([reporter], "report_upheld", { brand: e?.brand, number: e?.number }, null, admin.id);
    if (e) {
      await notify([e.designerId], "entry_removed", { brand: e.brand, number: e.number, reason }, `/contest/${e.slug}`, admin.id);
      if (action === "strike") await notify([e.designerId], "strike_received", { reason }, "/dashboard", admin.id);
      if (action === "ban") await notify([e.designerId], "account_banned", { reason }, null, admin.id);
    }
  } else {
    await notify([reporter], decision === "dismissed_false" ? "flag_warning" : "report_dismissed", { brand: e?.brand, number: e?.number }, null, admin.id);
  }
  refresh();
  return { ok: true };
}
