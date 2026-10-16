import { isSkillKey, isToolKey } from "@/lib/designers/portfolio-options";
import type { Locale } from "@/lib/i18n/config";
import type { Translate } from "@/lib/i18n/translate";

/**
 * Ready bios to start from (owner, 2026-10-16: "need bio suggestion"): first ones made from the designer's own
 * skills, tools and years, then the sign-up ideas. Only ones that fit the length limit.
 */
export function bioIdeas(input: { name: string; skills: string[]; tools: string[]; years: number | null; max: number }, t: Translate, locale: Locale): string[] {
  const list = (keys: string[], label: (k: string) => string) => {
    const names = keys.slice(0, 3).map(label).map((x) => (locale === "en" ? x.toLowerCase() : x));
    return names.length ? new Intl.ListFormat(locale === "bn" ? "bn" : "en", { type: "conjunction" }).format(names) : "";
  };
  const skills = list(input.skills, (k) => (isSkillKey(k) ? t(`portfolio.skills.${k}`) : k));
  const tools = input.tools.slice(0, 3).map((k) => (isToolKey(k) ? t(`portfolio.tools.${k}`) : k)).join(", ");
  const years = input.years && input.years > 1 ? new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US").format(input.years) : null;
  const first = input.name.trim().split(/\s+/)[0] || t("designerSignup.bio.suggest.you");
  const own = [
    years && skills ? t("settings.bioIdeas.yearsSkills", { years, skills }) : null,
    skills ? t("settings.bioIdeas.skills", { skills }) : null,
    tools ? t("settings.bioIdeas.tools", { tools }) : null,
    years ? t("settings.bioIdeas.years", { years }) : null,
  ];
  const general = (["b1", "b2", "b3", "b4", "b5"] as const).map((k) => t(`designerSignup.bio.suggest.${k}`, { name: first }));
  return [...own, ...general].filter((x): x is string => Boolean(x) && x!.length <= input.max);
}
