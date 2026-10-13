"use server";

import { refresh } from "next/cache";
import { adminUser, audit, UUID } from "@/lib/admin/core";
import { removeEntry } from "@/lib/admin/moderation-actions";
import type { MessageKey } from "@/lib/i18n/translate";
import { createAdminClient } from "@/lib/supabase/admin";

type Result = { ok: true } | { ok: false; error: MessageKey };

/**
 * Admin › Copyright checker › High match entries (owner, 2026-10-14): keep the entry, or remove it (the usual
 * "remove a design" step: the designer is told why). Needs the same permission as removing designs.
 */
export async function reviewCheckFlag(flagId: string, decision: "keep" | "remove"): Promise<Result> {
  const admin = await adminUser("designs.manage");
  if (!admin || !UUID.test(flagId) || (decision !== "keep" && decision !== "remove")) return { ok: false, error: "auth.errors.generic" };
  const db = createAdminClient();
  const { data: flag } = await db.from("logo_check_flags").select("id, status, entry_id, score, check:logo_checks!check_id(report_id)").eq("id", flagId).maybeSingle();
  if (!flag) return { ok: false, error: "auth.errors.generic" };
  if (flag.status !== "open") return { ok: true };
  const reportId = (Array.isArray(flag.check) ? flag.check[0] : flag.check)?.report_id ?? "";
  if (decision === "remove") {
    const res = await removeEntry(flag.entry_id as string, { reason: `High match in the logo check (${reportId}).` });
    if (!res.ok) return res;
  }
  const { error } = await db
    .from("logo_check_flags")
    .update({ status: decision === "keep" ? "kept" : "removed", reviewed_by: admin.id, reviewed_at: new Date().toISOString() })
    .eq("id", flagId)
    .eq("status", "open");
  if (error) return { ok: false, error: "admin.errors.generic" };
  await audit(admin.id, decision === "keep" ? "logo_check_keep" : "logo_check_remove", "entry", flag.entry_id as string, { report: reportId, score: flag.score });
  refresh();
  return { ok: true };
}
