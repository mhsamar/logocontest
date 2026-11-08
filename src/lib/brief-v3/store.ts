import "server-only";
import { cache } from "react";
import type { BriefLink, Deliverable, LogoStyle, Requirement, StyleSlider, UsedOn } from "@/lib/contests/brief";
import type { Translate } from "@/lib/i18n/translate";
import { getSetting } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { BRIEF_SOURCES, countDone, HEADINGS, OTHER, parseCategories, parseTemplates, type BriefCategory, type BriefSource } from "./rules";

// A column migration 0087 adds, read before it has run.
const MISSING = /PGRST204|PGRST205|42703|42P01/;

/** The new brief is switched on (Admin › Brief; off until the owner has tried it). */
export const briefV3On = cache(async (): Promise<boolean> => {
  try {
    return (await getSetting("brief.v3_on")) === true;
  } catch {
    return false;
  }
});

export async function briefConfig(): Promise<{ categories: BriefCategory[]; templates: Record<string, string> }> {
  const [cats, tpls] = await Promise.all([getSetting("brief.categories"), getSetting("brief.templates")]);
  return { categories: parseCategories(cats), templates: parseTemplates(tpls) };
}

export type BriefV3Row = {
  text: string | null;
  done: number;
  category: string | null;
  other: string | null;
  source: BriefSource | null;
  updatedAt: string | null;
};

/** A contest's new-brief columns (null before migration 0087 has run). */
export async function readBriefV3(contestId: string): Promise<BriefV3Row | null> {
  const { data, error } = await createAdminClient()
    .from("contests")
    .select("brief_text, brief_sections_done, business_category, business_category_other, brief_source, brief_updated_at")
    .eq("id", contestId)
    .maybeSingle();
  if (error) {
    if (!MISSING.test(error.code ?? "")) console.error("[brief-v3] read:", error.message);
    return null;
  }
  if (!data) return null;
  const text = (data.brief_text as string | null) ?? null;
  return {
    text,
    done: text ? countDone(text) : 0,
    category: (data.business_category as string | null) ?? null,
    other: (data.business_category_other as string | null) ?? null,
    source: BRIEF_SOURCES.find((s) => s === data.brief_source) ?? null,
    updatedAt: (data.brief_updated_at as string | null) ?? null,
  };
}

export type BriefUpdate = { id: string; text: string; createdAt: string };

/** The client's updates to designers, newest first. */
export async function listBriefUpdates(contestId: string, limit = 50): Promise<BriefUpdate[]> {
  const { data, error } = await createAdminClient().from("brief_updates").select("id, text, created_at").eq("contest_id", contestId).order("created_at", { ascending: false }).limit(limit);
  if (error) {
    if (!MISSING.test(error.code ?? "")) console.error("[brief-v3] updates:", error.message);
    return [];
  }
  return (data ?? []).map((u) => ({ id: u.id as string, text: u.text as string, createdAt: u.created_at as string }));
}

/** The older brief's fields that are written out under the 9 headings (both the contest page's and the wizard's names). */
export type LegacyBrief = {
  description?: string | null;
  shortName?: string | null;
  businessTypeOther?: string | null;
  logoText?: string | null;
  slogan?: string | null;
  links?: BriefLink[];
  competitors?: string | null;
  styles?: LogoStyle[];
  sliders?: Partial<Record<StyleSlider, number>>;
  colors?: string[];
  letDesignersChoose?: boolean;
  usedOn?: UsedOn[];
  targetAudience?: string | null;
  deliverables?: Deliverable[];
  requirements?: Requirement[];
  requirementsNote?: string | null;
  likes?: string | null;
  dislikes?: string | null;
};

const one = (s: string | null | undefined) => (s ?? "").trim().replace(/\s*\n+\s*/g, " ");

/**
 * An older contest's brief written under the 9 headings (owner, 2026-11-08: nothing is lost and designers see one kind
 * of brief): description → brand, styles, feel and likes → design, colours → colours, customers → audience, the rest
 * (slogan, logo text, requirements, links) → special instructions, where it is used → final goal. Empty parts are left out.
 */
export function legacyBriefText(b: LegacyBrief, brandName: string, t: Translate): string {
  const join = (parts: (string | null | undefined)[]) => parts.map((p) => one(p).replace(/\s*[।.]+$/, "")).filter(Boolean).join("। ");
  const list = (items: string[]) => items.filter(Boolean).join(", ");
  const sliders = b.sliders ?? {};
  const feel = (["complexity", "era", "tone"] as const)
    .filter((k) => typeof sliders[k] === "number" && sliders[k] !== 3)
    .map((k) => t(`wizard.sliders.${k}.${(sliders[k] as number) < 3 ? "left" : "right"}`));
  const parts: Record<(typeof HEADINGS)[number], string> = {
    "ব্র্যান্ড পরিচিতি": join([b.description, b.businessTypeOther, b.shortName ? `${t("briefV3.legacy.shortName")}: ${one(b.shortName)}` : null]),
    "আইকনের ধরন": "",
    "ডিজাইনের দিক": join([list((b.styles ?? []).map((s) => t(`wizard.styles.${s}`))), list(feel), b.likes ? `${t("briefV3.legacy.likes")}: ${one(b.likes)}` : null, b.dislikes ? `${t("briefV3.legacy.dislikes")}: ${one(b.dislikes)}` : null]),
    "টাইপোগ্রাফি": "",
    "রঙের দিক": (b.colors ?? []).length ? list(b.colors ?? []) : b.letDesignersChoose ? t("briefV3.legacy.designersChoose") : "",
    "টার্গেট অডিয়েন্স": one(b.targetAudience),
    "ব্র্যান্ড পার্সোনালিটি": "",
    "বিশেষ নির্দেশনা": join([
      b.logoText && one(b.logoText) !== brandName.trim() ? `${t("briefV3.legacy.logoText")}: ${one(b.logoText)}` : null,
      b.slogan ? `${t("briefV3.legacy.slogan")}: ${one(b.slogan)}` : null,
      list((b.requirements ?? []).map((r) => t(`wizard.requirements.${r}`))),
      b.requirementsNote,
      list((b.deliverables ?? []).map((d) => t(`wizard.deliverables.${d}.title`))),
      b.competitors ? `${t("briefV3.legacy.competitors")}: ${one(b.competitors)}` : null,
      (b.links ?? []).length ? list((b.links ?? []).map((l) => l.url)) : null,
    ]),
    "চূড়ান্ত লক্ষ্য": list((b.usedOn ?? []).map((u) => t(`wizard.usedOn.${u}`))),
  };
  return HEADINGS.filter((h) => parts[h]).map((h) => `${h}: ${parts[h]}`).join("\n");
}

/** The category's label for designers and the client (the client's own words under Other). */
export function categoryText(row: Pick<BriefV3Row, "category" | "other"> | null, list: BriefCategory[], locale: "bn" | "en"): string | null {
  if (!row?.category) return null;
  if (row.category === OTHER) return row.other?.trim() || null;
  const c = list.find((x) => x.id === row.category);
  return c ? (locale === "bn" ? c.bn : c.en) : null;
}

/** The contest's reference pictures with short-lived links (pictures only; other older files are left out). */
export async function briefPhotos(contestId: string): Promise<{ id: string; url: string; name: string }[]> {
  const { data } = await createAdminClient().from("contest_files").select("id, path, original_name, mime_type").eq("contest_id", contestId).order("created_at");
  const rows = (data ?? []).filter((f) => String(f.mime_type).startsWith("image/"));
  if (!rows.length) return [];
  const { BRIEF_FILES_BUCKET, getFileStorage } = await import("@/lib/storage");
  const urls = await getFileStorage()
    .createReadUrls(BRIEF_FILES_BUCKET, rows.map((f) => f.path as string), 3600)
    .catch(() => new Map<string, string>());
  return rows.flatMap((f) => {
    const url = urls.get(f.path as string);
    return url ? [{ id: f.id as string, url, name: f.original_name as string }] : [];
  });
}

/** Categories for the client's dropdown: the ones switched on, in the page's language. */
export const categoryOptions = (list: BriefCategory[], locale: "bn" | "en") => list.filter((c) => c.on).map((c) => ({ id: c.id, label: locale === "bn" ? c.bn : c.en }));

/**
 * What the editor starts with for a saved contest: its own text, or (an older contest) its older brief written under
 * the 9 headings, so nothing the client gave is lost.
 */
export async function editorStart(contestId: string, brandName: string, legacy: LegacyBrief, t: Translate): Promise<{ logoName: string; text: string; category: string; other: string; source: BriefSource }> {
  const row = await readBriefV3(contestId);
  return {
    logoName: brandName,
    text: row?.text ?? legacyBriefText(legacy, brandName, t),
    category: row?.category ?? "",
    other: row?.other ?? "",
    source: row?.source ?? "manual",
  };
}

export type BriefStats = { saved: number; suggest: number; other: number; avgWords: number; avgSections: number; step2: number; step3: number; updates: number };

/** Admin › Brief's counts (contests saved with the new brief; deleted ones left out). Zeros before migration 0087. */
export async function briefStats(): Promise<BriefStats> {
  const db = createAdminClient();
  const [rows, events, updates] = await Promise.all([
    db.from("contests").select("id, brief_text, business_category, pricing_viewed_at").not("brief_source", "is", null).neq("status", "deleted"),
    db.from("brief_events").select("contest_id, event"),
    db.from("brief_updates").select("id", { count: "exact", head: true }),
  ]);
  const list = rows.error ? [] : (rows.data ?? []);
  const texts = list.map((r) => (r.brief_text as string | null) ?? "").filter((x) => x.trim());
  const ev = events.error ? [] : (events.data ?? []);
  const step2 = new Set(ev.filter((e) => e.event === "step2_complete").map((e) => e.contest_id as string));
  const avg = (ns: number[]) => (ns.length ? Math.round((ns.reduce((a, b) => a + b, 0) / ns.length) * 10) / 10 : 0);
  return {
    saved: list.length,
    suggest: new Set(ev.filter((e) => e.event === "suggest").map((e) => e.contest_id as string)).size,
    other: list.filter((r) => r.business_category === OTHER).length,
    avgWords: avg(texts.map((x) => x.trim().split(/\s+/).length)),
    avgSections: avg(texts.map((x) => countDone(x))),
    step2: step2.size,
    step3: list.filter((r) => step2.has(r.id as string) && r.pricing_viewed_at).length,
    updates: updates.error ? 0 : (updates.count ?? 0),
  };
}
