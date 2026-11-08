import { z } from "zod";
import { BUSINESS_TYPES } from "@/lib/contests/brief";

/** One business category as Admin › Brief saves it (owner, 2026-11-08). */
export const BRIEF_CATEGORY_SCHEMA = z.object({
  id: z.string().regex(/^[a-z0-9_-]{1,40}$/).refine((v) => v !== "other" && v !== "general"),
  bn: z.string().trim().min(1).max(60),
  en: z.string().trim().max(60),
  type: z.enum(BUSINESS_TYPES),
  on: z.boolean(),
});
