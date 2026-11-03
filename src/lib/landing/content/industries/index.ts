import type { IndustrySlug } from "../../industries";
import type { LandingContent } from "../../types";
import { content as beautySalon } from "./beauty-salon";
import { content as education } from "./education";
import { content as fashion } from "./fashion";
import { content as itCompany } from "./it-company";
import { content as onlineShop } from "./online-shop";
import { content as restaurant } from "./restaurant";

/** The words of each business page (owner, 2026-11-03), by its slug in lib/landing/industries.ts. */
export const INDUSTRY_CONTENT: Record<IndustrySlug, LandingContent> = {
  restaurant,
  fashion,
  "beauty-salon": beautySalon,
  education,
  "it-company": itCompany,
  "online-shop": onlineShop,
};
