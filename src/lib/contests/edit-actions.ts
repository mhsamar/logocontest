"use server";

import { audit } from "@/lib/admin/core";
import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";
import type { MessageKey } from "@/lib/i18n/translate";
import { contestDesignerIds, notify } from "@/lib/notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import { cleanBrief, findBriefContact, validateBrief, type Brief, type FieldErrors } from "./brief";
import { blockedTerms } from "./community";
import { contestRepository } from "./services";
import { briefDetailColumns } from "./supabase-repository";

/**
 * C-13b Edit details (owner, 2026-10-08): the client changes the brief while the contest
 * is open; package, prize and length stay. Everyone who submitted is told.
 */
export async function saveContestBrief(contestId: string, input: Brief): Promise<{ ok: true } | { ok: false; error?: MessageKey; errors?: FieldErrors }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "auth.errors.notConfigured" };
  const user = await getCurrentUser();
  // The client, or an admin (A-02 Edit brief, BLUEPRINT §13.3).
  const isAdmin = user?.role === "admin";
  if (!user || (user.role !== "client" && !isAdmin) || user.status !== "active" || !/^[0-9a-f-]{36}$/i.test(contestId)) return { ok: false, error: "auth.errors.generic" };
  const contest = await contestRepository().findContest(contestId);
  if (!contest || (contest.clientId !== user.id && !isAdmin)) return { ok: false, error: "auth.errors.generic" };
  if (contest.status !== "open") return { ok: false, error: "manage.edit.closed" };

  const brief = cleanBrief(input);
  const errors = validateBrief(brief);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const contact = findBriefContact(brief, await blockedTerms());
  if (contact) return { ok: false, errors: { [contact]: "contest.comments.contact" } };

  const { error } = await createAdminClient()
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
    .eq("status", "open");
  if (error) return { ok: false, error: "auth.errors.generic" };

  if (isAdmin) await audit(user.id, "edit_brief", "contest", contest.id, { brand: brief.brandName });
  await notify(await contestDesignerIds(contest.id), "brief_updated", { brand: brief.brandName }, `/contest/${contest.slug}?tab=brief`, user.id);
  refresh();
  return { ok: true };
}
