import type { BusinessType } from "@/lib/contests/brief";

/**
 * Logo design pages by business (owner, 2026-11-03: "restaurant logo", "fashion logo" and the like in Bangla and
 * English): /logo-design/<slug>, each with its own words (content/industries/<slug>.ts) and the real public designs
 * sent to contests of that business type. A slug here needs its content module in INDUSTRY_CONTENT.
 */
export const INDUSTRIES = [
  { slug: "restaurant", type: "food" },
  { slug: "fashion", type: "fashion" },
  { slug: "beauty-salon", type: "beauty" },
  { slug: "education", type: "education" },
  { slug: "it-company", type: "technology" },
  { slug: "online-shop", type: "ecommerce" },
] as const satisfies readonly { slug: string; type: BusinessType }[];

export type IndustrySlug = (typeof INDUSTRIES)[number]["slug"];

export const industryOf = (slug: string) => INDUSTRIES.find((i) => i.slug === slug) ?? null;
