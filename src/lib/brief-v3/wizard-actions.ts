"use server";

/**
 * The new brief's step 2 (owner, 2026-11-08; Design/logocontest-onboarding Brief2/BizType): the logo name and one text
 * with everything in it. Saving makes the contest the first time (onboarding v2's own save, so the order, the team's
 * lead and the payment rules stay the same), then keeps the text, the category and where the text came from. Autosaved
 * every 10 seconds and when the page is left; "Next" also checks the text has at least 10 words.
 */
import { getCurrentUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";
import type { MessageKey, MessageParams } from "@/lib/i18n/translate";
import { acceptBrief } from "@/lib/onboarding/brief-store";
import { v2SaveBasics } from "@/lib/onboarding/v2-actions";
import { getSetting } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkCategory, checkText, cleanLogoName, type BriefInput } from "./checks";
import { BRIEF_LIMITS, BRIEF_SOURCES, countDone, fillTemplate, OTHER, parseTemplates, type BriefSource } from "./rules";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: { key: MessageKey; params?: MessageParams; field?: string } };
const err = (key: MessageKey, field?: string): Result<never> => ({ ok: false, error: { key, field } });

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Saves step 2. `complete`: the client pressed Next (the text must have 10 words; the step counts as done). Without it
 * (autosave), a missing logo name just means there is nothing to save yet.
 */
export async function v3SaveBrief(input: BriefInput & { contestId: string | null; source?: BriefSource; complete?: boolean; agreed?: boolean }): Promise<Result<{ contestId: string; slug: string }>> {
  if (!isSupabaseConfigured()) return err("auth.errors.notConfigured");
  const name = cleanLogoName(input.logoName);
  if (name.length < BRIEF_LIMITS.logoName.min || name.length > BRIEF_LIMITS.logoName.max) return err("briefV3.errors.logoName", "logoName");
  const cat = await checkCategory(input.category, input.other);
  if (!cat) return err("briefV3.errors.category", "category");
  const text = await checkText(input.text, input.complete === true);
  if (!text.ok) return err(text.key, "text");
  const source: BriefSource = BRIEF_SOURCES.find((s) => s === input.source) ?? "manual";

  // The contest itself: made or kept by onboarding v2's step-2 save (its checks, its order and its payment rules).
  const saved = await v2SaveBasics({
    contestId: input.contestId,
    brandName: name,
    businessType: cat.type,
    businessTypeOther: cat.type === "other" ? (cat.other ?? "").slice(0, 60) : "",
    agreed: input.agreed,
  });
  if (!saved.ok) return saved;

  const db = createAdminClient();
  const { error } = await db
    .from("contests")
    .update({
      business_category: cat.category,
      business_category_other: cat.other,
      brief_text: text.text || null,
      brief_sections_done: countDone(text.text),
      brief_source: source,
      brief_updated_at: new Date().toISOString(),
    })
    .eq("id", saved.contestId);
  if (error) {
    console.error("[brief-v3] save:", error.message);
    return err("wizard.errors.notSaved");
  }
  if (input.complete === true) {
    // Counted once per contest for Admin › Brief (how many finished step 2).
    const { count } = await db.from("brief_events").select("id", { count: "exact", head: true }).eq("contest_id", saved.contestId).eq("event", "step2_complete");
    if (!count) await db.from("brief_events").insert({ contest_id: saved.contestId, event: "step2_complete", category: cat.category });
    // The brief is the client's own now: the older "your brief is on our defaults" banner has nothing to ask.
    await acceptBrief(saved.contestId);
  }
  return { ok: true, contestId: saved.contestId, slug: saved.slug };
}

/**
 * ✨ Suggest: the category's draft with the logo name in (Admin › Brief's templates; "Other" uses the general one with
 * what the client wrote). Counted for Admin › Brief when the contest is already saved.
 */
export async function v3SuggestBrief(input: { contestId: string | null; logoName: string; category: string; other: string }): Promise<Result<{ text: string; source: BriefSource }>> {
  const cat = await checkCategory(input.category, input.other);
  if (!cat || !cat.category) return err("briefV3.errors.category", "category");
  if (cat.category === OTHER && !cat.other) return err("briefV3.errors.otherNeeded", "other");
  const text = fillTemplate(parseTemplates(await getSetting("brief.templates")), cat.category, { logoName: cleanLogoName(input.logoName), other: cat.other ?? "" });

  const user = await getCurrentUser();
  if (user && isSupabaseConfigured() && typeof input.contestId === "string" && UUID.test(input.contestId)) {
    const db = createAdminClient();
    const { data } = await db.from("contests").select("client_id").eq("id", input.contestId).maybeSingle();
    if (data?.client_id === user.id) await db.from("brief_events").insert({ contest_id: input.contestId, event: "suggest", category: cat.category });
  }
  return { ok: true, text, source: "template" };
}
