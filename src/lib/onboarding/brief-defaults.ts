/**
 * Onboarding v2's brief defaults (owner, 2026-10-28; client-onboarding-v2-spec.md §3): the contest is saved after the
 * logo name and business type, with the rest of the brief already filled in from the business type, so a client who
 * never opens the brief still gives designers a sensible one. Admin › Onboarding can change them per business type
 * (setting onboarding.brief_defaults); a type with no valid entry of its own uses "other". Pure: shared by the
 * settings registry, the server and the tests.
 */
import { z } from "zod";
import {
  DELIVERABLES,
  LOGO_STYLES,
  REQUIREMENTS,
  USED_ON,
  type Brief,
  type BusinessType,
  type Deliverable,
  type LogoStyle,
  type Requirement,
  type StyleSlider,
  type UsedOn,
} from "@/lib/contests/brief";

export type BriefDefault = {
  styles: LogoStyle[];
  /** The brief's 1–5 feel sliders (1 = Minimal / Modern / Playful, 5 = Complex / Classic / Serious). */
  sliders: Record<StyleSlider, number>;
  usedOn: UsedOn[];
  deliverables: Deliverable[];
  requirements: Requirement[];
};

/** The spec's feel values (0–100) on the brief's 1–5 sliders. */
export const feelToSlider = (v: number) => 1 + Math.round((Math.min(100, Math.max(0, v)) * 4) / 100);

// "All standard requirements on": the six that suit any logo. Not "no effects" (a style choice) or "home screen
// mockup" (extra work that only an app icon needs).
const STANDARD: Requirement[] = ["trust", "simple", "strong_idea", "readable_small", "one_colour", "no_stock"];

/** The spec's examples (feel 35/35/40 → 2/2/3 and so on); every other business type starts from "other". */
export const SEED: Record<"food" | "fashion" | "ecommerce" | "technology" | "education" | "other", BriefDefault> = {
  food: { styles: ["wordmark", "pictorial", "emblem"], sliders: { complexity: 2, era: 2, tone: 3 }, usedOn: ["social", "signboard", "packaging", "print"], deliverables: ["icon_only", "versions"], requirements: STANDARD },
  fashion: { styles: ["wordmark", "calligraphy", "pictorial"], sliders: { complexity: 2, era: 3, tone: 3 }, usedOn: ["social", "packaging", "print", "merchandise"], deliverables: ["icon_only", "versions"], requirements: STANDARD },
  ecommerce: { styles: ["wordmark", "lettermark", "abstract"], sliders: { complexity: 2, era: 2, tone: 3 }, usedOn: ["social", "website", "packaging"], deliverables: ["icon_only", "versions"], requirements: STANDARD },
  technology: { styles: ["lettermark", "abstract", "wordmark"], sliders: { complexity: 2, era: 2, tone: 3 }, usedOn: ["website", "social", "print"], deliverables: ["icon_only", "versions", "app_icons"], requirements: STANDARD },
  education: { styles: ["emblem", "wordmark", "pictorial"], sliders: { complexity: 3, era: 3, tone: 3 }, usedOn: ["social", "signboard", "print"], deliverables: ["icon_only", "versions"], requirements: STANDARD },
  other: { styles: ["wordmark", "pictorial", "abstract"], sliders: { complexity: 2, era: 2, tone: 3 }, usedOn: ["social", "signboard", "print"], deliverables: ["icon_only", "versions"], requirements: STANDARD },
};

const slider = z.number().int().min(1).max(5);
const BriefDefaultShape = z.object({
  styles: z.array(z.enum(LOGO_STYLES)).max(LOGO_STYLES.length),
  sliders: z.object({ complexity: slider, era: slider, tone: slider }),
  usedOn: z.array(z.enum(USED_ON)).max(USED_ON.length),
  deliverables: z.array(z.enum(DELIVERABLES)).max(DELIVERABLES.length),
  requirements: z.array(z.enum(REQUIREMENTS)).max(REQUIREMENTS.length),
});

/**
 * The setting's own check: an object keyed by business type. Each entry is checked on its own when it is read, so one
 * broken entry falls back alone and the rest keep working.
 */
export const BRIEF_DEFAULTS_SCHEMA = z.record(z.string().max(40), z.unknown());

/** The defaults for one business type: its saved entry if valid, else its seed, else "other"'s. */
export function defaultsFor(saved: unknown, type: BusinessType | ""): BriefDefault {
  const key: BusinessType = type || "other";
  const all = saved && typeof saved === "object" ? (saved as Record<string, unknown>) : {};
  for (const k of [key, "other"] as const) {
    const parsed = BriefDefaultShape.safeParse(all[k]);
    if (parsed.success) return { ...parsed.data, styles: [...new Set(parsed.data.styles)], usedOn: [...new Set(parsed.data.usedOn)] };
  }
  return SEED[key as keyof typeof SEED] ?? SEED.other;
}

/**
 * The brief with the defaults in place: styles, feel, where it is used, extras and requirements from the business
 * type; designers choose the colours; no website or competitors yet; the type's usual customers (`audience`, already
 * in the client's language) unless they wrote their own. The logo name, slogan and description are left as they are.
 */
export function applyDefaults(brief: Brief, d: BriefDefault, audience: string): Brief {
  return {
    ...brief,
    styles: [...d.styles],
    sliders: { ...d.sliders },
    usedOn: [...d.usedOn],
    deliverables: [...d.deliverables],
    requirements: [...d.requirements],
    colors: [],
    letDesignersChoose: true,
    links: [],
    noLinks: true,
    websiteUrl: "",
    noWebsite: true,
    competitors: "",
    noCompetitors: true,
    targetAudience: brief.targetAudience.trim() ? brief.targetAudience : audience.slice(0, 300),
  };
}

/** The brief sections the client can change after paying (the hub's cards). */
export const BRIEF_SECTIONS = ["business", "links", "look", "needs"] as const;
export type BriefSection = (typeof BRIEF_SECTIONS)[number];

/** A v2 contest's mark: which sections the client changed, and when they said "keep it as it is". */
export type BriefCompletion = { v: 2; edited: BriefSection[]; acceptedAt: string | null };

export const newCompletion = (): BriefCompletion => ({ v: 2, edited: [], acceptedAt: null });

/** The stored mark, cleaned; null for a contest made by the old wizard (or before migration 0079). */
export function parseCompletion(raw: unknown): BriefCompletion | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.v !== 2) return null;
  const edited = Array.isArray(r.edited) ? BRIEF_SECTIONS.filter((s) => (r.edited as unknown[]).includes(s)) : [];
  return { v: 2, edited, acceptedAt: typeof r.acceptedAt === "string" ? r.acceptedAt : null };
}

/** While a contest's brief can still change (the hub, its actions and the client's "Edit brief"): unpaid, waiting for
 * approval, or live. */
export const BRIEF_OPEN_STATUSES = ["draft", "pending_payment", "open"] as const;
export const briefOpen = (status: string) => (BRIEF_OPEN_STATUSES as readonly string[]).includes(status);

/**
 * Where the client's "Edit brief" goes (owner, 2026-10-30: after "Finish" there was no way back): an onboarding v2
 * contest to its brief page (the hub) while unpaid, waiting for approval or live; an older contest to Edit details
 * while live. Null when the brief can't change now.
 */
export function briefEditHref(c: { id: string; slug: string; status: string; v2: boolean; hubOn: boolean }): string | null {
  if (c.v2 && c.hubOn && briefOpen(c.status)) return `/start-v2/brief?c=${c.id}`;
  return c.status === "open" ? `/dashboard/contests/${c.slug}/edit` : null;
}

/** The brief steps (2–6) and fields each section covers: the hub's cards, Edit details and designers' tags. */
export const SECTION_STEPS: Record<BriefSection, number[]> = { business: [2, 3], links: [4], look: [5], needs: [6] };
export const SECTION_FIELDS: Record<BriefSection, (keyof Brief)[]> = {
  business: ["brandName", "logoText", "shortName", "slogan", "businessType", "businessTypeOther", "businessDescription", "targetAudience"],
  // links and competitors only: "none yet" ticks aren't stored, so they never count as a change on their own.
  links: ["links", "competitors"],
  look: ["styles", "sliders", "colors", "letDesignersChoose"],
  needs: ["usedOn", "deliverables", "requirements", "requirementsNote"],
};

/**
 * What each of the hub's cards may change (owner, 2026-10-30): card 1 is the slogan, description and customers only,
 * so the logo name, logo text, short name and business type it hides always stay as saved and can never stop a save
 * the client can't see.
 */
export const HUB_FIELDS: Record<BriefSection, (keyof Brief)[]> = { ...SECTION_FIELDS, business: ["slogan", "businessDescription", "targetAudience"] };

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const trimmed = (v: unknown) => (typeof v === "string" ? v.trim() : v);

/** The sections whose fields differ between the brief before and after (text compared without outer spaces). */
export function sectionsChanged(before: Brief, after: Brief): BriefSection[] {
  return BRIEF_SECTIONS.filter((s) => SECTION_FIELDS[s].some((f) => !same(trimmed(before[f]), trimmed(after[f]))));
}

/**
 * "Brief X% ready" (spec §3): the parts a designer reads, counted as filled when they hold an answer. The defaults
 * fill most of them; the slogan and description are the client's own.
 */
export function briefReadyPercent(b: Brief): number {
  const parts = [
    Boolean(b.slogan.trim()),
    Boolean(b.businessDescription.trim()),
    Boolean(b.targetAudience.trim()),
    true, // links: some, or "none yet"
    true, // competitors: some, or "none yet"
    b.styles.length > 0,
    true, // the feel sliders always have a value
    b.letDesignersChoose || b.colors.length > 0,
    b.usedOn.length > 0,
    true, // the main logo and its files always come
    b.requirements.length > 0,
  ];
  return Math.round((parts.filter(Boolean).length / parts.length) * 100);
}
