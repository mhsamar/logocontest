"use server";

/**
 * Onboarding v2's brief after paying (owner, 2026-10-29; client-onboarding-v2-spec.md §3): the client changes one
 * part of the brief at a time (the hub's cards), or keeps it as it is. Only the brief's own columns are written, never
 * the status, order or amounts (a bKash payment may be waiting for approval). A live contest's designers are told, as
 * with Edit details.
 */
import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { cleanBrief, validateBriefStepV2, type Brief, type FieldErrors } from "@/lib/contests/brief";
import type { ContestRecord } from "@/lib/contests/service";
import { contestRepository } from "@/lib/contests/services";
import { briefColumns } from "@/lib/contests/supabase-repository";
import { isSupabaseConfigured } from "@/lib/env";
import type { MessageKey, MessageParams } from "@/lib/i18n/translate";
import { createBriefUpload, deleteBriefFile, dropBriefUpload, saveBriefUpload } from "@/lib/contests/brief-files";
import { contestDesignerIds, notify } from "@/lib/notifications";
import { checkExtraAnswers } from "@/lib/onboarding/config";
import { getOnboarding } from "@/lib/onboarding/store";
import { createAdminClient } from "@/lib/supabase/admin";
import { BRIEF_SECTIONS, SECTION_FIELDS, SECTION_STEPS, sectionsChanged, type BriefCompletion, type BriefSection } from "./brief-defaults";
import { acceptBrief, markEdited } from "./brief-store";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: MessageKey; errors?: FieldErrors; extraErrors?: Record<string, string> };

/** While its brief can change: unpaid, waiting for approval, or live (not once judging starts). */
const OPEN_FOR_BRIEF = ["draft", "pending_payment", "open"] as const;

/** The client's own onboarding v2 contest whose brief can still change. */
async function ownBrief(contestId: unknown): Promise<{ ok: true; contest: ContestRecord; userId: string } | { ok: false; error: MessageKey }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "auth.errors.notConfigured" };
  if (typeof contestId !== "string" || !/^[0-9a-f-]{36}$/i.test(contestId)) return { ok: false, error: "wizard.errors.notSaved" };
  const user = await getCurrentUser();
  if (!user || user.role !== "client" || user.status === "banned") return { ok: false, error: "wizard.errors.signInAgain" };
  const contest = await contestRepository().findContest(contestId);
  if (!contest || contest.clientId !== user.id || !contest.briefCompletion) return { ok: false, error: "wizard.errors.notSaved" };
  if (!(OPEN_FOR_BRIEF as readonly string[]).includes(contest.status)) return { ok: false, error: "wizardV2.hub.notEditable" };
  return { ok: true, contest, userId: user.id };
}

/** The same kind of value as the stored field (text, tick, list, or the sliders' numbers), so nothing odd is saved. */
function sameKind(stored: unknown, given: unknown): boolean {
  if (Array.isArray(stored)) return Array.isArray(given);
  if (stored && typeof stored === "object") return Boolean(given) && typeof given === "object" && !Array.isArray(given);
  return typeof given === typeof stored;
}

/**
 * Saves one part of the brief (a hub card): only that part's fields are taken from `brief`, checked by onboarding v2's
 * rule, with the owner's own questions asked on that part (Admin › Onboarding). The part is marked as the client's.
 */
export async function v2SaveBriefSection(input: { contestId: string; section: BriefSection; brief: Partial<Brief>; extra?: Record<string, string | string[]> }): Promise<Result<{ edited: BriefSection[] }>> {
  const own = await ownBrief(input.contestId);
  if (!own.ok) return own;
  const { contest, userId } = own;
  const section = BRIEF_SECTIONS.find((s) => s === input.section);
  if (!section || !input.brief || typeof input.brief !== "object") return { ok: false, error: "wizard.errors.incomplete" };

  const merged: Brief = { ...contest.brief };
  for (const f of SECTION_FIELDS[section]) {
    if (!(f in input.brief)) continue;
    const given = input.brief[f];
    if (!sameKind(contest.brief[f], given)) return { ok: false, error: "wizard.errors.incomplete" };
    (merged as Record<string, unknown>)[f] = given;
  }
  // The "none yet" ticks go with their fields (they aren't stored, but they decide what is kept).
  if (section === "links") Object.assign(merged, { noLinks: Boolean(input.brief.noLinks), noCompetitors: Boolean(input.brief.noCompetitors) });
  const brief = cleanBrief(merged);
  const errors: FieldErrors = Object.assign({}, ...SECTION_STEPS[section].map((s) => validateBriefStepV2(s, brief)));
  if (Object.keys(errors).length > 0) return { ok: false, error: "wizard.errors.incomplete", errors };

  // The owner's own questions on this part's steps (optional ones may stay empty; given answers keep their rules).
  const onboarding = await getOnboarding("client");
  const asked = onboarding.extra.filter((q) => SECTION_STEPS[section].includes(q.step));
  let extraAnswers: Record<string, string | string[]> | null = null;
  if (asked.length) {
    const checked = checkExtraAnswers(onboarding, input.extra ?? {}, SECTION_STEPS[section]);
    if (Object.keys(checked.errors).length > 0) return { ok: false, error: "wizard.errors.incomplete", extraErrors: checked.errors };
    // This part's questions are replaced as a whole, so an answer the client cleared is gone (not brought back).
    const others = Object.fromEntries(Object.entries(contest.brief.extra ?? {}).filter(([k]) => !asked.some((q) => q.key === k)));
    extraAnswers = { ...others, ...checked.answers };
  }

  const { data, error } = await createAdminClient()
    .from("contests")
    .update({ ...briefColumns(brief), ...(extraAnswers ? { extra_answers: extraAnswers } : {}) })
    .eq("id", contest.id)
    .in("status", [...OPEN_FOR_BRIEF])
    .select("id, status");
  if (error) return { ok: false, error: "auth.errors.generic" };
  if (!data?.length) return { ok: false, error: "wizardV2.hub.notEditable" };

  // Only a real change makes the part the client's (saving it untouched keeps it a default).
  const changed = sectionsChanged(contest.brief, brief).includes(section) || (extraAnswers !== null && JSON.stringify(extraAnswers) !== JSON.stringify(contest.brief.extra ?? {}));
  const completion = await markEdited(contest.id, changed ? [section] : []);
  // A live contest: everyone who sent designs is told, as with Edit details.
  if ((data[0].status as string) === "open" && changed) {
    await notify(await contestDesignerIds(contest.id), "brief_updated", { brand: brief.brandName }, `/contest/${contest.slug}?tab=brief`, userId);
    refresh();
  }
  return { ok: true, edited: (completion as BriefCompletion | null)?.edited ?? [] };
}

/** "Looks right, finish" / "OK, keep it like this": the brief as it is now is the client's (no more brief reminders). */
export async function v2AcceptBrief(input: { contestId: string }): Promise<Result> {
  const own = await ownBrief(input.contestId);
  if (!own.ok) return own;
  await acceptBrief(own.contest.id);
  refresh();
  return { ok: true };
}

// ---- Reference pictures (owner, 2026-10-29: "chobi add koro") ---------------------------------------------------------
// The same uploads as the wizard and Edit details (same limits and checks), while the brief can change: unpaid, waiting
// for approval or live. The picture goes straight to storage with a one-time link, then it is recorded.

type FileResult<T = object> = ({ ok: true } & T) | { ok: false; error: { key: MessageKey; params?: MessageParams } };

export async function v2PreparePhoto(input: { contestId: string; name: string; type: string; size: number }): Promise<FileResult<{ path: string; token: string }>> {
  const own = await ownBrief(input.contestId);
  if (!own.ok) return { ok: false, error: { key: own.error } };
  return createBriefUpload(own.contest.id, { name: String(input.name), type: String(input.type), size: Number(input.size) });
}

export async function v2RecordPhoto(input: { contestId: string; path: string; name: string; type: string; size: number; isCurrentLogo: boolean }): Promise<FileResult<{ id: string }>> {
  const own = await ownBrief(input.contestId);
  if (!own.ok) {
    // It can't change any more (judging started meanwhile): don't leave the picture in storage.
    if (typeof input.contestId === "string" && /^[0-9a-f-]{36}$/i.test(input.contestId)) await dropBriefUpload(input.contestId, String(input.path));
    return { ok: false, error: { key: own.error } };
  }
  return saveBriefUpload(own.contest.id, { path: String(input.path), name: String(input.name), type: String(input.type), size: Number(input.size), isCurrentLogo: input.isCurrentLogo === true });
}

export async function v2RemovePhoto(input: { contestId: string; fileId: string }): Promise<FileResult> {
  const own = await ownBrief(input.contestId);
  if (!own.ok) return { ok: false, error: { key: own.error } };
  await deleteBriefFile(own.contest.id, String(input.fileId));
  return { ok: true };
}

/** Pictures were added or removed on a live contest: everyone who sent designs is told once, as with Edit details. */
export async function v2PhotosChanged(input: { contestId: string }): Promise<FileResult> {
  const own = await ownBrief(input.contestId);
  if (!own.ok) return { ok: false, error: { key: own.error } };
  if (own.contest.status === "open") {
    await notify(await contestDesignerIds(own.contest.id), "brief_updated", { brand: own.contest.brief.brandName }, `/contest/${own.contest.slug}?tab=brief`, own.userId);
    refresh();
  }
  return { ok: true };
}
