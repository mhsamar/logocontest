/**
 * The contest brief collected by the wizard (BLUEPRINT §8.1, UI-JOURNEY C-01…C-08)
 * and its validation. Pure functions, shared by the browser and the server.
 */
import type { MessageKey } from "@/lib/i18n/translate";
import { findContactDetails } from "@/lib/moderation/contact-filter";

export const BUSINESS_TYPES = [
  "food",
  "fashion",
  "beauty",
  "education",
  "technology",
  "ecommerce",
  "health",
  "real_estate",
  "travel",
  "agriculture",
  "manufacturing",
  "services",
  "nonprofit",
  "other",
] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

export const LOGO_STYLES = ["wordmark", "lettermark", "pictorial", "abstract", "emblem", "mascot", "calligraphy"] as const;
export type LogoStyle = (typeof LOGO_STYLES)[number];

// C-04 sliders, 1 (left label) … 5 (right label)
export const STYLE_SLIDERS = ["complexity", "era", "tone"] as const;
export type StyleSlider = (typeof STYLE_SLIDERS)[number];

export const USED_ON = ["social", "website", "signboard", "packaging", "print", "merchandise", "video"] as const;
export type UsedOn = (typeof USED_ON)[number];

// C-05 "What you need": extras on top of the main logo and the standard files (owner, 2026-10-08).
export const DELIVERABLES = ["icon_only", "short_logo", "versions", "app_icons"] as const;
export type Deliverable = (typeof DELIVERABLES)[number];

// C-06 requirements the client can add to the always-on rules (owner, 2026-10-08).
export const REQUIREMENTS = ["no_stock", "home_mockup"] as const;
export type Requirement = (typeof REQUIREMENTS)[number];

// Owner, 2026-10-08: Starter (economy), Growth (standard), Pro, Premium, Elite and Custom.
export const PACKAGES = ["economy", "standard", "pro", "premium", "elite", "custom"] as const;
export type PackageKey = (typeof PACKAGES)[number];

// Add-ons chosen at launch, in the order shown (owner, 2026-10-08). "promoted" is shown as Featured.
export const UPGRADES = ["promoted", "blind", "private", "logo_scan", "highlight", "urgent", "nda"] as const;
export type UpgradeKey = (typeof UPGRADES)[number];

/** No add-ons chosen. Older saved orders are merged onto this so new keys start off. */
export const noUpgrades = (): Record<UpgradeKey, boolean> => ({ promoted: false, blind: false, private: false, logo_scan: false, highlight: false, urgent: false, nda: false });

export const MAX_COLORS = 5;

// Field rules from BLUEPRINT §8.1. Logo text and slogan maxima are ours (not in the blueprint).
export const LIMITS = {
  brandName: { min: 2, max: 60 },
  shortName: { max: 30 },
  targetAudience: { min: 10, max: 300 },
  requirementsNote: { max: 500 },
  logoText: { max: 60 },
  slogan: { max: 100 },
  description: { min: 20, max: 300 },
  likes: { max: 1000 },
  dislikes: { max: 1000 },
  url: { max: 300 },
} as const;

export type Brief = {
  brandName: string;
  shortName: string;
  logoText: string;
  slogan: string;
  businessType: BusinessType | "";
  businessDescription: string;
  targetAudience: string;
  websiteUrl: string;
  noWebsite: boolean;
  styles: LogoStyle[];
  sliders: Record<StyleSlider, number>;
  colors: string[];
  letDesignersChoose: boolean;
  usedOn: UsedOn[];
  deliverables: Deliverable[];
  likes: string;
  dislikes: string;
  requirements: Requirement[];
  requirementsNote: string;
};

export type Order = {
  package: PackageKey;
  customPrize: number | null;
  durationDays: number;
  upgrades: Record<UpgradeKey, boolean>;
};

export function emptyBrief(): Brief {
  return {
    brandName: "",
    shortName: "",
    logoText: "",
    slogan: "",
    businessType: "",
    businessDescription: "",
    targetAudience: "",
    websiteUrl: "",
    noWebsite: false,
    styles: [],
    sliders: { complexity: 3, era: 3, tone: 3 },
    colors: [],
    letDesignersChoose: false,
    usedOn: [],
    deliverables: [],
    likes: "",
    dislikes: "",
    requirements: [],
    requirementsNote: "",
  };
}

export type FieldErrors = Partial<Record<string, MessageKey>>;

const HEX = /^#[0-9a-f]{6}$/i;

/** Adds https:// when missing; returns null if it still isn't a usable http(s) URL. */
export function normalizeUrl(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withProtocol);
    if (!/^https?:$/.test(url.protocol) || !url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

const len = (s: string) => s.trim().length;

/** Brief steps are 1–7 (C-01…C-07). Returns an empty object when the step is valid. */
export function validateBriefStep(step: number, b: Brief): FieldErrors {
  const e: FieldErrors = {};
  switch (step) {
    case 1:
      if (len(b.brandName) < LIMITS.brandName.min || len(b.brandName) > LIMITS.brandName.max) e.brandName = "wizard.errors.brandName";
      if (len(b.shortName) > LIMITS.shortName.max) e.shortName = "wizard.errors.tooLong";
      if (len(b.logoText) > LIMITS.logoText.max) e.logoText = "wizard.errors.tooLong";
      if (len(b.slogan) > LIMITS.slogan.max) e.slogan = "wizard.errors.tooLong";
      break;
    case 2:
      if (!BUSINESS_TYPES.includes(b.businessType as BusinessType)) e.businessType = "wizard.errors.businessType";
      if (len(b.businessDescription) < LIMITS.description.min || len(b.businessDescription) > LIMITS.description.max)
        e.businessDescription = "wizard.errors.description";
      if (len(b.targetAudience) < LIMITS.targetAudience.min || len(b.targetAudience) > LIMITS.targetAudience.max) e.targetAudience = "wizard.errors.audience";
      break;
    case 3:
      if (!b.noWebsite && b.websiteUrl.trim() && (!normalizeUrl(b.websiteUrl) || len(b.websiteUrl) > LIMITS.url.max))
        e.websiteUrl = "wizard.errors.url";
      break;
    case 4:
      if (b.styles.length === 0 || b.styles.some((s) => !LOGO_STYLES.includes(s))) e.styles = "wizard.errors.styles";
      if (STYLE_SLIDERS.some((k) => !Number.isInteger(b.sliders[k]) || b.sliders[k] < 1 || b.sliders[k] > 5)) e.sliders = "wizard.errors.generic";
      break;
    case 5:
      if (!b.letDesignersChoose && b.colors.length === 0) e.colors = "wizard.errors.colors";
      if (b.colors.length > MAX_COLORS || b.colors.some((c) => !HEX.test(c))) e.colors = "wizard.errors.colors";
      if (b.usedOn.some((u) => !USED_ON.includes(u))) e.usedOn = "wizard.errors.generic";
      if (b.deliverables.some((d) => !DELIVERABLES.includes(d))) e.deliverables = "wizard.errors.generic";
      break;
    case 6:
      // Likes/dislikes are no longer asked for (owner, 2026-10-08); older contests keep theirs.
      if (len(b.likes) > LIMITS.likes.max) e.likes = "wizard.errors.tooLong";
      if (len(b.dislikes) > LIMITS.dislikes.max) e.dislikes = "wizard.errors.tooLong";
      if (b.requirements.some((r) => !REQUIREMENTS.includes(r))) e.requirements = "wizard.errors.generic";
      if (len(b.requirementsNote) > LIMITS.requirementsNote.max) e.requirementsNote = "wizard.errors.tooLong";
      break;
  }
  return e;
}

/** Validates the whole brief (steps 1–6; step 7 files are checked separately). */
export function validateBrief(b: Brief): FieldErrors {
  return Object.assign({}, ...[1, 2, 3, 4, 5, 6].map((s) => validateBriefStep(s, b)));
}

/** Trims text and drops fields the client didn't mean to send. */
export function cleanBrief(b: Brief): Brief {
  return {
    ...b,
    brandName: b.brandName.trim(),
    shortName: (b.shortName ?? "").trim(),
    logoText: b.logoText.trim(),
    slogan: b.slogan.trim(),
    businessDescription: b.businessDescription.trim(),
    targetAudience: (b.targetAudience ?? "").trim(),
    websiteUrl: b.noWebsite ? "" : (normalizeUrl(b.websiteUrl) ?? ""),
    colors: b.letDesignersChoose ? [] : b.colors.map((c) => c.toLowerCase()),
    styles: [...new Set(b.styles)],
    usedOn: [...new Set(b.usedOn)],
    // Kept in list order; unknown values are dropped.
    deliverables: DELIVERABLES.filter((d) => (b.deliverables ?? []).includes(d)),
    likes: b.likes.trim(),
    dislikes: b.dislikes.trim(),
    requirements: REQUIREMENTS.filter((r) => (b.requirements ?? []).includes(r)),
    requirementsNote: (b.requirementsNote ?? "").trim(),
  };
}

/**
 * Free-text brief fields that must pass the no-contact filter (BLUEPRINT §10),
 * with the wizard step (C-01…C-06) that asks for each, in step order.
 */
export const CONTACT_CHECKED_FIELDS = {
  shortName: 1,
  logoText: 1,
  slogan: 1,
  businessDescription: 2,
  targetAudience: 2,
  likes: 6,
  dislikes: 6,
  requirementsNote: 6,
} as const satisfies Partial<Record<keyof Brief, number>>;

export type ContactCheckedField = keyof typeof CONTACT_CHECKED_FIELDS;

/** The first brief field that carries contact details, or null. The server passes the admin's blocked terms. */
export function findBriefContact(b: Brief, blockedTerms: readonly string[]): ContactCheckedField | null {
  for (const field of Object.keys(CONTACT_CHECKED_FIELDS) as ContactCheckedField[]) {
    if (b[field] && findContactDetails(b[field], blockedTerms)) return field;
  }
  return null;
}
