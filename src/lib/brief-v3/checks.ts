import "server-only";
import type { MessageKey } from "@/lib/i18n/translate";
import { getSetting } from "@/lib/settings";
import { BRIEF_LIMITS, categoryType, clipWords, cleanBriefText, countWords, OTHER, parseCategories } from "./rules";

/** The step's input, checked the same way here and on the "Your brief" page. */
export type BriefInput = { logoName: string; text: string; category: string; other: string };

/** The category (one from Admin › Brief, "other", or none yet) and what was written under Other, checked. */
export async function checkCategory(category: unknown, other: unknown): Promise<{ category: string | null; other: string | null; type: ReturnType<typeof categoryType> } | null> {
  const list = parseCategories(await getSetting("brief.categories"));
  const id = typeof category === "string" ? category.trim() : "";
  if (!id) return { category: null, other: null, type: "other" };
  if (id !== OTHER && !list.some((c) => c.id === id)) return null;
  const text = id === OTHER ? clipWords(cleanBriefText(other, 2000).replace(/\s+/g, " ").trim(), BRIEF_LIMITS.otherWords) : "";
  return { category: id, other: text || null, type: categoryType(id, list) };
}

/** The brief's text, clean, with its word count; an error past 5,000 words (or under 10 when it must be complete). */
export async function checkText(raw: unknown, complete: boolean): Promise<{ ok: true; text: string; words: number } | { ok: false; key: MessageKey }> {
  const text = cleanBriefText(raw);
  const words = countWords(text);
  if (words > BRIEF_LIMITS.words.max) return { ok: false, key: "briefV3.errors.maxWords" };
  if (complete && words < BRIEF_LIMITS.words.min) return { ok: false, key: "briefV3.errors.minWords" };
  return { ok: true, text, words };
}

export const cleanLogoName = (v: unknown) => String(v ?? "").trim().replace(/\s+/g, " ");
