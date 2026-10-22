"use server";

import { adminUser, audit } from "@/lib/admin/core";
import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";
import type { MessageKey } from "@/lib/i18n/translate";
import { contestDesignerIds, notify } from "@/lib/notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import { cleanBrief, validateBrief, type Brief, type FieldErrors } from "./brief";
import { createBriefUpload, deleteBriefFile, dropBriefUpload, saveBriefUpload, type BriefFileResult } from "./brief-files";
import { getOnboarding } from "@/lib/onboarding/store";
import { contestRepository } from "./services";
import { briefDetailColumns } from "./supabase-repository";

/** The contest's client, or staff with Contests › Manage (A-02 Edit brief, BLUEPRINT §13.3); null for anyone else. */
async function liveEditor(contestId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(contestId)) return null;
  const user = await getCurrentUser();
  if (!user) return null;
  const staff = user.role === "admin" ? await adminUser("contests.manage") : null;
  if (!staff && (user.role !== "client" || user.status === "banned")) return null;
  const contest = await contestRepository().findContest(contestId);
  if (!contest || (!staff && contest.clientId !== user.id)) return null;
  return { user, isAdmin: Boolean(staff), contest };
}

/**
 * C-13b Edit details (owner, 2026-10-08): the client changes the brief while the contest
 * is open; package, prize and length stay. Everyone who submitted is told.
 */
export async function saveContestBrief(contestId: string, input: Brief): Promise<{ ok: true } | { ok: false; error?: MessageKey; errors?: FieldErrors }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "auth.errors.notConfigured" };
  const editor = await liveEditor(contestId);
  if (!editor) return { ok: false, error: "auth.errors.generic" };
  const { user, isAdmin, contest } = editor;
  if (contest.status !== "open") return { ok: false, error: "manage.edit.closed" };

  const brief = cleanBrief(input);
  // Questions the owner hid (Admin › Onboarding) can stay empty.
  const errors = validateBrief(brief, new Set((await getOnboarding("client")).hidden));
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const { data, error } = await createAdminClient()
    .from("contests")
    .update({
      brand_name: brief.brandName,
      logo_text: brief.logoText || null,
      slogan: brief.slogan || null,
      business_type: brief.businessType,
      business_description: brief.businessDescription,
      website_url: brief.websiteUrl || null,
      styles: brief.styles,
      style_sliders: brief.sliders,
      colors: brief.colors,
      let_designers_choose_colors: brief.letDesignersChoose,
      used_on: brief.usedOn,
      likes_text: brief.likes,
      dislikes_text: brief.dislikes || null,
      ...briefDetailColumns(brief),
    })
    .eq("id", contest.id)
    .eq("status", "open")
    .select("id");
  if (error) return { ok: false, error: "auth.errors.generic" };
  // Closed in the meantime: nothing changed, so nobody is told.
  if (!data?.length) return { ok: false, error: "manage.edit.closed" };

  if (isAdmin) await audit(user.id, "edit_brief", "contest", contest.id, { brand: brief.brandName });
  await notify(await contestDesignerIds(contest.id), "brief_updated", { brand: brief.brandName }, `/contest/${contest.slug}?tab=brief`, user.id);
  refresh();
  return { ok: true };
}

// Reference photos on a live contest (owner, 2026-10-22): Edit details adds and removes them, then Save sends the one
// "brief updated" notice above. Same limits as the wizard.
type Live = BriefFileResult<object>;

async function openFor(contestId: string) {
  if (!isSupabaseConfigured()) return null;
  const editor = await liveEditor(contestId);
  return editor && editor.contest.status === "open" ? editor : null;
}

export async function prepareLiveBriefUpload(input: { contestId: string; name: string; type: string; size: number }): Promise<BriefFileResult<{ path: string; token: string }>> {
  if (!(await openFor(input.contestId))) return { ok: false, error: { key: "manage.edit.closed" } };
  return createBriefUpload(input.contestId, { name: String(input.name), type: String(input.type), size: Number(input.size) });
}

export async function recordLiveBriefUpload(input: {
  contestId: string;
  path: string;
  name: string;
  type: string;
  size: number;
  isCurrentLogo: boolean;
}): Promise<BriefFileResult<{ id: string }>> {
  const editor = isSupabaseConfigured() ? await liveEditor(input.contestId) : null;
  if (!editor) return { ok: false, error: { key: "auth.errors.generic" } };
  if (editor.contest.status !== "open") {
    // The contest closed while the photo was uploading: don't leave it in storage.
    await dropBriefUpload(input.contestId, String(input.path));
    return { ok: false, error: { key: "manage.edit.closed" } };
  }
  const file = { path: String(input.path), name: String(input.name), type: String(input.type), size: Number(input.size), isCurrentLogo: input.isCurrentLogo === true };
  const res = await saveBriefUpload(input.contestId, file);
  if (res.ok && editor.isAdmin) await audit(editor.user.id, "add_contest_files", "contest", input.contestId, { count: 1, names: [file.name.slice(0, 200)], status: "open" });
  return res;
}

/**
 * Photos-only save (owner, 2026-10-22): a non-logo contest's brief has its own questions, so Edit details only changes
 * its photos, then tells the designers who sent designs once, as saveContestBrief does.
 */
export async function tellLivePhotos(contestId: string): Promise<{ ok: true } | { ok: false; error: MessageKey }> {
  const editor = await openFor(contestId);
  if (!editor) return { ok: false, error: "manage.edit.closed" };
  const { user, isAdmin, contest } = editor;
  const designers = await contestDesignerIds(contest.id);
  if (isAdmin) await audit(user.id, "tell_contest_files", "contest", contest.id, { designers: designers.length });
  await notify(designers, "brief_updated", { brand: contest.brief.brandName }, `/contest/${contest.slug}?tab=brief`, user.id);
  refresh();
  return { ok: true };
}

export async function removeLiveBriefFile(input: { contestId: string; fileId: string }): Promise<Live> {
  const editor = await openFor(input.contestId);
  if (!editor) return { ok: false, error: { key: "manage.edit.closed" } };
  const gone = await deleteBriefFile(input.contestId, String(input.fileId));
  if (gone && editor.isAdmin) await audit(editor.user.id, "remove_contest_file", "contest", input.contestId, { name: gone.name });
  return { ok: true };
}
