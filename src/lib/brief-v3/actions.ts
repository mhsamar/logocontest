"use server";

/**
 * "Your brief" after paying (owner, 2026-11-08; Design/logocontest-onboarding MyBrief): the client changes the brief
 * (logo name, text, category) while the contest can still change (unpaid, waiting for approval or live; never once
 * judging starts or a winner is picked), and sends designers an update. A live contest's designers are told, as with
 * the older brief page. Only the brief's own columns are written, never the status, order or amounts.
 */
import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { contestRepository } from "@/lib/contests/services";
import type { ContestRecord } from "@/lib/contests/service";
import { isSupabaseConfigured } from "@/lib/env";
import type { MessageKey } from "@/lib/i18n/translate";
import { contestDesignerIds, notify } from "@/lib/notifications";
import { briefOpen } from "@/lib/onboarding/brief-defaults";
import { acceptBrief } from "@/lib/onboarding/brief-store";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkCategory, checkText, cleanLogoName, type BriefInput } from "./checks";
import { BRIEF_LIMITS, BRIEF_SOURCES, cleanBriefText, countDone, countWords, type BriefSource } from "./rules";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: MessageKey };
const UUID = /^[0-9a-f-]{36}$/i;

/** The client's own contest whose brief can still change. */
async function ownOpenBrief(contestId: unknown): Promise<{ ok: true; contest: ContestRecord; userId: string } | { ok: false; error: MessageKey }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "auth.errors.notConfigured" };
  if (typeof contestId !== "string" || !UUID.test(contestId)) return { ok: false, error: "wizard.errors.notSaved" };
  const user = await getCurrentUser();
  if (!user || user.role !== "client" || user.status === "banned") return { ok: false, error: "wizard.errors.signInAgain" };
  const contest = await contestRepository().findContest(contestId);
  if (!contest || contest.clientId !== user.id || contest.service !== "logo") return { ok: false, error: "wizard.errors.notSaved" };
  if (!briefOpen(contest.status)) return { ok: false, error: "briefV3.errors.locked" };
  return { ok: true, contest, userId: user.id };
}

/** ✎ Edit saved: the logo name, the text and the category. Designers of a live contest are told once per save. */
export async function v3SaveMyBrief(input: BriefInput & { contestId: string; source?: BriefSource }): Promise<Result> {
  const own = await ownOpenBrief(input.contestId);
  if (!own.ok) return own;
  const name = cleanLogoName(input.logoName);
  if (name.length < BRIEF_LIMITS.logoName.min || name.length > BRIEF_LIMITS.logoName.max) return { ok: false, error: "briefV3.errors.logoName" };
  const cat = await checkCategory(input.category, input.other);
  if (!cat) return { ok: false, error: "briefV3.errors.category" };
  const text = await checkText(input.text, true);
  if (!text.ok) return { ok: false, error: text.key };

  const db = createAdminClient();
  const { data: before } = await db.from("contests").select("brand_name, brief_text, business_category, business_category_other").eq("id", own.contest.id).maybeSingle();
  const changed =
    !before ||
    before.brand_name !== name ||
    (before.brief_text ?? "") !== text.text ||
    (before.business_category ?? null) !== cat.category ||
    (before.business_category_other ?? null) !== cat.other;
  if (!changed) return { ok: true };

  const { error } = await db
    .from("contests")
    .update({
      brand_name: name,
      business_type: cat.type,
      business_type_other: cat.type === "other" ? (cat.other ?? "").slice(0, 60) || null : null,
      business_category: cat.category,
      business_category_other: cat.other,
      brief_text: text.text,
      brief_sections_done: countDone(text.text),
      brief_source: BRIEF_SOURCES.find((s) => s === input.source) ?? "manual",
      brief_updated_at: new Date().toISOString(),
    })
    .eq("id", own.contest.id)
    .in("status", ["draft", "pending_payment", "open"]);
  if (error) {
    console.error("[brief-v3] edit:", error.message);
    return { ok: false, error: "wizard.errors.notSaved" };
  }
  // The older "your brief is on our defaults" banner has nothing left to ask.
  await acceptBrief(own.contest.id);
  if (own.contest.status === "open") await notify(await contestDesignerIds(own.contest.id), "brief_updated", { brand: name }, `/contest/${own.contest.slug}?tab=brief`, own.userId);
  refresh();
  return { ok: true };
}

/** "আপডেট পাঠান": a short note for designers (up to 500 words), kept with its time and shown on the contest page. */
export async function v3SendBriefUpdate(input: { contestId: string; text: string }): Promise<Result<{ update: { id: string; text: string; createdAt: string } }>> {
  const own = await ownOpenBrief(input.contestId);
  if (!own.ok) return own;
  const text = cleanBriefText(input.text, 8000).trim();
  const words = countWords(text);
  if (words === 0) return { ok: false, error: "briefV3.errors.updateEmpty" };
  if (words > BRIEF_LIMITS.updateWords) return { ok: false, error: "briefV3.errors.updateMax" };

  const { data, error } = await createAdminClient().from("brief_updates").insert({ contest_id: own.contest.id, text }).select("id, created_at").single();
  if (error || !data) {
    console.error("[brief-v3] update:", error?.message);
    return { ok: false, error: "wizard.errors.notSaved" };
  }
  if (own.contest.status === "open") await notify(await contestDesignerIds(own.contest.id), "brief_updated", { brand: own.contest.brief.brandName }, `/contest/${own.contest.slug}?tab=brief`, own.userId);
  refresh();
  return { ok: true, update: { id: data.id as string, text, createdAt: data.created_at as string } };
}
