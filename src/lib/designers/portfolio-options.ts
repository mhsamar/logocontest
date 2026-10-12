/** Portfolio choices on D-12 (owner, 2026-10-08). Labels live in i18n under portfolio.skills.* and portfolio.tools.* */
export const SKILLS = ["logo", "brand", "banglaLettering", "calligraphy", "mascot", "social", "packaging", "print", "motion"] as const;
export const TOOLS = ["illustrator", "photoshop", "coreldraw", "figma", "affinity", "procreate", "indesign", "aftereffects"] as const;
export type SkillKey = (typeof SKILLS)[number];
export type ToolKey = (typeof TOOLS)[number];

/** Free "other" entries are stored as-is; known ones as keys. */
export const OTHER_MAX = 30;
export const EXPERIENCE_MAX = 60;

export const isSkillKey = (v: string): v is SkillKey => (SKILLS as readonly string[]).includes(v);
export const isToolKey = (v: string): v is ToolKey => (TOOLS as readonly string[]).includes(v);

/**
 * Designer profile extras (owner, 2026-10-12; migration 0042): languages, a level per skill and years per tool.
 * All optional. Labels live in i18n under portfolio.languages.* and portfolio.levels.*
 */
export const LANGUAGES = ["bangla", "english", "hindi", "urdu", "arabic"] as const;
export type LanguageKey = (typeof LANGUAGES)[number];
export const isLanguageKey = (v: string): v is LanguageKey => (LANGUAGES as readonly string[]).includes(v);

export const SKILL_LEVELS = ["learning", "good", "strong", "expert"] as const;
export type SkillLevel = (typeof SKILL_LEVELS)[number];
export const isSkillLevel = (v: unknown): v is SkillLevel => typeof v === "string" && (SKILL_LEVELS as readonly string[]).includes(v);
/** Bar width for a level. */
export const levelPercent = (l: SkillLevel) => (SKILL_LEVELS.indexOf(l) + 1) * 25;
/** At most this many skills show as bars; the rest are chips. */
export const SKILL_BARS_MAX = 5;

/** The 2-letter tile and colour for a tool (text only: never a tool's official logo). */
const TOOL_TILES: Record<ToolKey, { code: string; bg: string; ink: string }> = {
  illustrator: { code: "Ai", bg: "#FFF1DC", ink: "#B35A00" },
  photoshop: { code: "Ps", bg: "#E1EEFF", ink: "#1F5FB0" },
  coreldraw: { code: "Cd", bg: "#E3F5E8", ink: "#1C7A3A" },
  figma: { code: "Fg", bg: "#F1E6FF", ink: "#6B3FB3" },
  affinity: { code: "Af", bg: "#FFE6EC", ink: "#B0243F" },
  procreate: { code: "Pc", bg: "#EDEDF0", ink: "#3A3C45" },
  indesign: { code: "Id", bg: "#FFE3EE", ink: "#B3195A" },
  aftereffects: { code: "Ae", bg: "#ECE6FF", ink: "#4B36A8" },
};
export function toolTile(tool: string): { code: string; bg: string; ink: string } {
  if (isToolKey(tool)) return TOOL_TILES[tool];
  const letters = tool.replace(/[^\p{L}\p{N}]/gu, "");
  return { code: (letters.slice(0, 1).toUpperCase() + letters.slice(1, 2).toLowerCase()) || "•", bg: "#F0F1F4", ink: "#3A3C45" };
}
