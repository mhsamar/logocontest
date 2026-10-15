/**
 * The contest brief collected by the wizard (BLUEPRINT §8.1, UI-JOURNEY C-01…C-08)
 * and its validation. Pure functions, shared by the browser and the server.
 */
import type { MessageKey } from "@/lib/i18n/translate";

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

// Requirements the client can add to the always-on rules (owner, 2026-10-08; the design ones 2026-10-15).
export const REQUIREMENTS = ["trust", "simple", "no_effects", "strong_idea", "readable_small", "one_colour", "no_stock", "home_mockup"] as const;
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

/**
 * The wizard's steps (owner, 2026-10-15: grouped into 8). A signed-in client skips "you"; the password is asked on
 * the prize step. The numbers are also what the drop-off chart in Admin › Dashboard counts (9 = went to payment).
 */
export const WIZARD_STEPS = { you: 1, logo: 2, business: 3, links: 4, look: 5, needs: 6, prize: 7, review: 8 } as const;
export const BRIEF_STEPS = [2, 3, 4, 5, 6] as const;

// Website & social links (owner, 2026-10-15).
export const LINK_KINDS = ["website", "facebook", "instagram", "tiktok"] as const;
export type LinkKind = (typeof LINK_KINDS)[number];
export type BriefLink = { kind: LinkKind; url: string };
export const MAX_LINKS = 4;

/** Which kind a pasted link is, from its address. */
export function linkKindOf(url: string): LinkKind {
  const host = url.toLowerCase();
  if (/(^|[/.])(facebook\.com|fb\.com|fb\.me)/.test(host)) return "facebook";
  if (/(^|[/.])instagram\.com/.test(host)) return "instagram";
  if (/(^|[/.])tiktok\.com/.test(host)) return "tiktok";
  return "website";
}

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
  businessTypeOther: { min: 2, max: 60 },
  competitors: { max: 300 },
} as const;

export type Brief = {
  brandName: string;
  shortName: string;
  logoText: string;
  slogan: string;
  businessType: BusinessType | "";
  /** What the business is when "Other" is picked (owner, 2026-10-15). */
  businessTypeOther: string;
  businessDescription: string;
  targetAudience: string;
  /** The first link, kept for older screens and the logo checker (owner, 2026-10-15: `links` holds them all). */
  websiteUrl: string;
  noWebsite: boolean;
  links: BriefLink[];
  /** "I don't have one yet" for links. */
  noLinks: boolean;
  /** Competitors' names or links (owner, 2026-10-15). */
  competitors: string;
  noCompetitors: boolean;
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
  /** Answers to the owner's own questions (Admin › Onboarding, owner 2026-10-14), by question key. */
  extra?: Record<string, string | string[]>;
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
    businessTypeOther: "",
    businessDescription: "",
    targetAudience: "",
    websiteUrl: "",
    noWebsite: false,
    links: [],
    noLinks: false,
    competitors: "",
    noCompetitors: false,
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

const NONE: ReadonlySet<string> = new Set();

/**
 * The brief steps are 2–6 (WIZARD_STEPS). Returns an empty object when the step is valid. `hidden`: questions the
 * owner switched off in Admin › Onboarding (owner, 2026-10-14) are not asked, so they can't be missing.
 */
export function validateBriefStep(step: number, b: Brief, hidden: ReadonlySet<string> = NONE): FieldErrors {
  const e: FieldErrors = {};
  switch (step) {
    case WIZARD_STEPS.logo:
      if (len(b.brandName) < LIMITS.brandName.min || len(b.brandName) > LIMITS.brandName.max) e.brandName = "wizard.errors.brandName";
      if (len(b.shortName) > LIMITS.shortName.max) e.shortName = "wizard.errors.tooLong";
      if (len(b.logoText) > LIMITS.logoText.max) e.logoText = "wizard.errors.tooLong";
      if (len(b.slogan) > LIMITS.slogan.max) e.slogan = "wizard.errors.tooLong";
      break;
    case WIZARD_STEPS.business:
      if (!BUSINESS_TYPES.includes(b.businessType as BusinessType)) e.businessType = "wizard.errors.businessType";
      else if (b.businessType === "other" && (len(b.businessTypeOther ?? "") < LIMITS.businessTypeOther.min || len(b.businessTypeOther ?? "") > LIMITS.businessTypeOther.max))
        e.businessTypeOther = "wizard.errors.businessTypeOther";
      if (len(b.businessDescription) < LIMITS.description.min || len(b.businessDescription) > LIMITS.description.max)
        e.businessDescription = "wizard.errors.description";
      if (!hidden.has("targetAudience") && (len(b.targetAudience) < LIMITS.targetAudience.min || len(b.targetAudience) > LIMITS.targetAudience.max)) e.targetAudience = "wizard.errors.audience";
      else if (hidden.has("targetAudience") && len(b.targetAudience) > LIMITS.targetAudience.max) e.targetAudience = "wizard.errors.audience";
      break;
    case WIZARD_STEPS.links:
      if (!b.noLinks) {
        const links = b.links ?? [];
        if (links.length > MAX_LINKS || links.some((l) => !LINK_KINDS.includes(l.kind))) e.links = "wizard.errors.generic";
        else if (links.some((l) => l.url.trim() && (!normalizeUrl(l.url) || len(l.url) > LIMITS.url.max))) e.links = "wizard.errors.url";
      }
      if (!b.noCompetitors && len(b.competitors ?? "") > LIMITS.competitors.max) e.competitors = "wizard.errors.tooLong";
      break;
    case WIZARD_STEPS.look:
      if ((!hidden.has("styles") && b.styles.length === 0) || b.styles.some((s) => !LOGO_STYLES.includes(s))) e.styles = "wizard.errors.styles";
      if (STYLE_SLIDERS.some((k) => !Number.isInteger(b.sliders[k]) || b.sliders[k] < 1 || b.sliders[k] > 5)) e.sliders = "wizard.errors.generic";
      if (!hidden.has("colors") && !b.letDesignersChoose && b.colors.length === 0) e.colors = "wizard.errors.colors";
      if (b.colors.length > MAX_COLORS || b.colors.some((c) => !HEX.test(c))) e.colors = "wizard.errors.colors";
      break;
    case WIZARD_STEPS.needs:
      if (b.usedOn.some((u) => !USED_ON.includes(u))) e.usedOn = "wizard.errors.generic";
      if (b.deliverables.some((d) => !DELIVERABLES.includes(d))) e.deliverables = "wizard.errors.generic";
      // Likes/dislikes are no longer asked for (owner, 2026-10-08); older contests keep theirs.
      if (len(b.likes) > LIMITS.likes.max) e.likes = "wizard.errors.tooLong";
      if (len(b.dislikes) > LIMITS.dislikes.max) e.dislikes = "wizard.errors.tooLong";
      if (b.requirements.some((r) => !REQUIREMENTS.includes(r))) e.requirements = "wizard.errors.generic";
      if (len(b.requirementsNote) > LIMITS.requirementsNote.max) e.requirementsNote = "wizard.errors.tooLong";
      break;
  }
  return e;
}

/** Validates the whole brief (steps 2–6; the files on step 6 are checked separately). */
export function validateBrief(b: Brief, hidden: ReadonlySet<string> = NONE): FieldErrors {
  return Object.assign({}, ...BRIEF_STEPS.map((s) => validateBriefStep(s, b, hidden)));
}

/** Trims text and drops fields the client didn't mean to send. */
export function cleanBrief(b: Brief): Brief {
  const links = b.noLinks ? [] : briefLinks(b).flatMap((l) => {
    const url = normalizeUrl(l.url);
    return url && LINK_KINDS.includes(l.kind) ? [{ kind: l.kind, url }] : [];
  }).slice(0, MAX_LINKS);
  return {
    ...b,
    brandName: b.brandName.trim(),
    shortName: (b.shortName ?? "").trim(),
    logoText: b.logoText.trim(),
    slogan: b.slogan.trim(),
    businessDescription: b.businessDescription.trim(),
    targetAudience: (b.targetAudience ?? "").trim(),
    businessTypeOther: b.businessType === "other" ? (b.businessTypeOther ?? "").trim().replace(/\s+/g, " ") : "",
    links,
    noLinks: links.length === 0 && Boolean(b.noLinks),
    // The first link (a website first) stays in website_url for the logo checker and older pages.
    websiteUrl: (links.find((l) => l.kind === "website") ?? links[0])?.url ?? "",
    noWebsite: links.length === 0,
    competitors: b.noCompetitors ? "" : (b.competitors ?? "").trim(),
    noCompetitors: Boolean(b.noCompetitors) && !(b.competitors ?? "").trim(),
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
 * A brief's links: the saved list, or (older drafts and contests) its one website address. Clients are not checked
 * for contact details (owner, 2026-10-15), so links and every brief text are kept as written.
 */
export function briefLinks(b: Pick<Brief, "links" | "websiteUrl" | "noWebsite">): BriefLink[] {
  if (b.links && b.links.length) return b.links;
  return !b.noWebsite && b.websiteUrl?.trim() ? [{ kind: linkKindOf(b.websiteUrl), url: b.websiteUrl.trim() }] : [];
}
