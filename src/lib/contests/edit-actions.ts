"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";
import type { MessageKey } from "@/lib/i18n/translate";
import { findContactDetails } from "@/lib/moderation/contact-filter";
import { contestDesignerIds, notify } from "@/lib/notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import { cleanBrief, validateBrief, type Brief, type FieldErrors } from "./brief";
import { blockedTerms } from "./community";
import { contestRepository } from "./services";

/**
 * C-13b Edit details (owner, 2026-10-08): the client changes the brief while the contest
 * is open; package, prize and length stay. Everyone who submitted is told.
 */
export async function saveContestBrief(contestId: string, input: Brief): Promise<{ ok: true } | { ok: false; error?: MessageKey; errors?: FieldErrors }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "auth.errors.notConfigured" };
  const user = await getCurrentUser();
  if (!user || user.role !== "client" || user.status !== "active" || !/^[0-9a-f-]{36}$/i.test(contestId)) return { ok: false, error: "auth.errors.generic" };
  const contest = await contestRepository().findContest(contestId);
  if (!contest || contest.clientId !== user.id) return { ok: false, error: "auth.errors.generic" };
  if (contest.status !== "open") return { ok: false, error: "manage.edit.closed" };

  const brief = cleanBrief(input);
  const errors = validateBrief(brief);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const terms = await blockedTerms();
  for (const field of ["businessDescription", "likes", "dislikes", "logoText", "slogan"] as const) {
    if (brief[field] && findContactDetails(brief[field], terms)) return { ok: false, errors: { [field]: "contest.comments.contact" } };
  }

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
    })
    .eq("id", contest.id)
    .eq("status", "open");
  if (error) return { ok: false, error: "auth.errors.generic" };

  await notify(await contestDesignerIds(contest.id), "brief_updated", { brand: brief.brandName }, `/contest/${contest.slug}?tab=brief`, user.id);
  refresh();
  return { ok: true };
}
