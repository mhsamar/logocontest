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
