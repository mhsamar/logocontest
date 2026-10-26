"use server";

import { contestHref } from "@/lib/client/rules";
import { refresh } from "next/cache";
import type { MessageKey, MessageParams } from "@/lib/i18n/translate";
import { createBriefUpload, deleteBriefFile, dropBriefUpload, saveBriefUpload } from "@/lib/contests/brief-files";
import { contestServiceInfo } from "@/lib/services/contest-service";
import { contestDesignerIds, notify } from "@/lib/notifications";
import { tellUser } from "@/lib/moderation/suspension";
import { getSettings } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { designerFeeWithCode, markPromoUsed } from "@/lib/promos/promos";
import { feeRateFor } from "@/lib/wallet/fees";
import { adminUser, audit, cleanReason, superAdmin, UUID } from "./core";
import { switchOnAddon } from "@/lib/contests/addon-payments";
import { notifyWithPush } from "@/lib/notifications/broadcast";
import { afterWinnerPicked } from "@/lib/rewards/win-card-hook";
import { emailWon } from "@/lib/email/events";

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

/**
 * Super admin: switch Featured, Private or Blind on for the client's live contest, free (owner, 2026-10-26). The same
 * safe switch as a free add-on (open contest, not on yet, no bKash payment for it waiting); no payment is recorded, so
 * revenue and refunds stay true. In the audit log with the reason; the client is told (bell and phone).
 */
export async function grantAddon(contestId: string, f: Fields): Promise<Result> {
  const admin = await superAdmin();
  const c = admin ? await loadContest(contestId) : null;
  if (!admin || !c) return fail("auth.errors.generic");
  const reason = cleanReason(f.reason);
  if (!reason) return fail("admin.errors.reason");
  const addon = f.addon;
  if (addon !== "promote" && addon !== "private" && addon !== "blind") return fail("admin.errors.generic");
  const res = await switchOnAddon(c.id, addon);
  if (!res.ok) return fail(res.error === "closed" ? "manage.addons.closed" : res.error === "active" ? "manage.addons.alreadyActive" : res.error === "waiting" ? "admin.contests.addonWaiting" : "admin.errors.generic");
  await audit(admin.id, "grant_addon", "contest", c.id, { addon, reason });
  await notifyWithPush([c.client_id], "addon_granted", { brand: c.brand_name, addon }, `${contestHref(c.slug, "payment")}#addons`, admin.id);
  refresh();
  return { ok: true };
}

/** A-02 Cancel: reason required, no refund (owner, 2026-10-09); "adult content" also bans the client (2026-10-12). */
export async function cancelContest(contestId: string, f: Fields): Promise<Result> {
  const admin = await adminUser("contests.manage");
  const c = admin ? await loadContest(contestId) : null;
  if (!admin || !c) return fail("auth.errors.generic");
  const reason = cleanReason(f.reason);
  if (!reason) return fail("admin.errors.reason");
  const designers = await contestDesignerIds(c.id);
  const { error } = await createAdminClient().rpc("admin_cancel_contest", { p_contest_id: c.id, p_admin_id: admin.id, p_reason: reason });
  if (error) return fail("admin.contests.cannotCancel");
  // A nude or sexual contest (owner, 2026-10-12): the client agreed to the rule before paying, so the payment is
  // kept, the contest leaves the site, and the client is banned for good.
  const adult = f.adult === "1";
  await audit(admin.id, "cancel_contest", "contest", c.id, { reason, status: c.status, adult: adult || undefined });
  await notify(designers, "contest_cancelled", { brand: c.brand_name }, null, admin.id);
  if (adult) {
    const { error: banError } = await createAdminClient().from("profiles").update({ status: "banned", suspended_until: null }).eq("id", c.client_id).neq("role", "admin");
    if (banError) return fail("admin.errors.generic");
    await audit(admin.id, "ban_user", "user", c.client_id, { reason, adult: true, contest: c.slug });
    await tellUser(c.client_id, "banned", reason, null, admin.id);
  } else await notify([c.client_id], "contest_cancelled_client", { brand: c.brand_name, reason }, `/dashboard`, admin.id);
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
  // A designer fee code (owner, 2026-10-14) lowers the fee on this win.
  const { rate: feeRate, redemptionId } = await designerFeeWithCode(entry.designer_id as string, feeRateFor(designer?.counted_wins_count ?? 0, s["fees.designer_tiers"]));
  const dueAt = new Date(Date.now() + s["timers.designer_file_upload_days"] * 86_400_000).toISOString();
  const { error } = await db.rpc("pick_winner", { p_contest_id: c.id, p_entry_id: entry.id, p_fee_rate: feeRate, p_due_at: dueAt });
  if (error) return fail("manage.closed");
  await markPromoUsed(redemptionId, { contestId: c.id });
  await audit(admin.id, "force_award", "contest", c.id, { entry: entry.number, reason, feeRate });
  const n = { brand: c.brand_name, number: entry.number as number };
  await notify([entry.designer_id as string], "winner_picked", n, `/dashboard/handover/${c.slug}`, admin.id);
  await emailWon(entry.id as string);
  await notify([c.client_id], "winner_picked_by_admin", n, contestHref(c.slug, "payment"), admin.id);
  await notify((await contestDesignerIds(c.id)).filter((id) => id !== entry.designer_id), "contest_closed", n, `/contest/${c.slug}`, admin.id);
  await afterWinnerPicked(c.id, entry.id as string);
  refresh();
  return { ok: true };
}

// A-02 Reference photos (owner, 2026-10-22): the team puts the photos a client sent (on WhatsApp, say) on the contest.
// Same file types and sizes as the client, but no count limit: every add is in the audit log. Never in the Trash.
type FileResult<T = object> = ({ ok: true } & T) | { ok: false; error: { key: MessageKey; params?: MessageParams } };
const fileFail = (key: MessageKey, params?: MessageParams) => ({ ok: false as const, error: { key, params } });

async function filesContest(contestId: string) {
  const admin = await adminUser("contests.manage");
  const c = admin ? await loadContest(contestId) : null;
  return admin && c ? { admin, c } : null;
}

/** A one-time link the browser uploads one file to (files never pass through our server: the 4 MB action limit). */
export async function prepareContestFile(contestId: string, f: { name: string; type: string; size: number }): Promise<FileResult<{ path: string; token: string }>> {
  const found = await filesContest(contestId);
  if (!found) return fileFail("auth.errors.generic");
  if (found.c.status === "deleted") return fileFail("admin.contests.files.inTrash");
  return createBriefUpload(found.c.id, { name: String(f?.name ?? "").slice(0, 200), type: String(f?.type ?? ""), size: Number(f?.size) }, false);
}

/** Records uploaded files (the card sends each one as soon as it is uploaded, so a closed tab leaves nothing behind). */
export async function addContestFiles(contestId: string, input: { kind: string; files: { path: string; name: string; type: string; size: number }[] }): Promise<FileResult<{ added: number; failed: string[] }>> {
  const found = await filesContest(contestId);
  if (!found) return fileFail("auth.errors.generic");
  const { admin, c } = found;
  const list = (Array.isArray(input?.files) ? input.files : []).slice(0, 20).map((f) => ({ path: String(f?.path ?? ""), name: String(f?.name ?? "").slice(0, 200), type: String(f?.type ?? ""), size: Number(f?.size) }));
  if (c.status === "deleted") {
    for (const f of list) await dropBriefUpload(c.id, f.path).catch(() => undefined);
    return fileFail("admin.contests.files.inTrash");
  }
  // "Current logo" only means something on a logo contest.
  const logo = (await contestServiceInfo([c.id])).get(c.id)?.service === "logo";
  const isCurrentLogo = input?.kind === "current_logo" && logo;
  const names: string[] = [];
  const failed: string[] = [];
  for (const f of list) {
    const res = await saveBriefUpload(c.id, { ...f, isCurrentLogo }, false).catch(async () => {
      await dropBriefUpload(c.id, f.path).catch(() => undefined);
      return null;
    });
    if (res?.ok) names.push(f.name);
    else failed.push(f.name);
  }
  // No refresh here: the card refreshes the page once, after the whole batch.
  if (names.length > 0) await audit(admin.id, "add_contest_files", "contest", c.id, { count: names.length, names, kind: isCurrentLogo ? "current_logo" : "example", status: c.status });
  return { ok: true, added: names.length, failed };
}

/**
 * After a batch: one "brief updated" notice to the designers who sent designs (as when the client edits the brief).
 * Only while the contest is open, only right after this staff member added files, and in the audit log.
 */
export async function tellAboutContestFiles(contestId: string): Promise<Result> {
  const found = await filesContest(contestId);
  if (!found) return fail("auth.errors.generic");
  const { admin, c } = found;
  if (c.status !== "open") return { ok: true };
  const { data: last } = await createAdminClient()
    .from("audit_logs")
    .select("action")
    .eq("admin_id", admin.id)
    .eq("subject_id", c.id)
    .in("action", ["add_contest_files", "tell_contest_files"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (last?.action !== "add_contest_files") return { ok: true };
  const designers = await contestDesignerIds(c.id);
  await audit(admin.id, "tell_contest_files", "contest", c.id, { designers: designers.length });
  await notify(designers, "brief_updated", { brand: c.brand_name }, `/contest/${c.slug}?tab=brief`, admin.id);
  return { ok: true };
}

/** Takes one file off the contest (and out of storage), with a reason for the audit log. */
export async function removeContestFile(contestId: string, fileId: string, f: Fields): Promise<Result> {
  const found = await filesContest(contestId);
  if (!found) return fail("auth.errors.generic");
  if (found.c.status === "deleted") return fail("admin.contests.files.inTrash");
  const reason = cleanReason(f.reason);
  if (!reason) return fail("admin.errors.reason");
  const gone = await deleteBriefFile(found.c.id, fileId);
  if (!gone) return fail("admin.errors.generic");
  await audit(found.admin.id, "remove_contest_file", "contest", found.c.id, { name: gone.name, reason });
  refresh();
  return { ok: true };
}
