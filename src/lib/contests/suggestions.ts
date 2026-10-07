/**
 * Ready-made answers for C-02 and C-06 (owner, 2026-10-07): five suggestions per
 * box, written from the client's earlier answers. Tapping one fills the box;
 * the client can then edit it. Pure functions, built from en/bn messages.
 */
import type { Translate } from "@/lib/i18n/translate";
import { LIMITS, type Brief, type BusinessType } from "./brief";

const fit = (s: string, max: number) => (s.length > max ? s.slice(0, max).trimEnd() : s);

function common(brief: Brief, t: Translate) {
  const type: BusinessType = brief.businessType || "other";
  return {
    brand: brief.brandName.trim() || t("wizard.suggest.yourBrand"),
    noun: t(`wizard.suggest.nouns.${type}`),
    audience: t(`wizard.suggest.audiences.${type}`),
  };
}

/** C-02 "Describe your business" */
export function descriptionSuggestions(brief: Brief, t: Translate): string[] {
  const p = common(brief, t);
  return (["d1", "d2", "d3", "d4", "d5"] as const).map((k) => fit(t(`wizard.suggest.desc.${k}`, p), LIMITS.description.max));
}

function feel(brief: Brief, t: Translate) {
  const era = brief.sliders.era <= 2 ? "modern" : brief.sliders.era >= 4 ? "classic" : "timeless";
  const tone = brief.sliders.tone <= 2 ? "friendly" : brief.sliders.tone >= 4 ? "professional" : "confident";
  return t("wizard.suggest.feel", { era: t(`wizard.suggest.feelWords.${era}`), tone: t(`wizard.suggest.feelWords.${tone}`) });
}

/** C-06 "I like" */
export function likesSuggestions(brief: Brief, t: Translate): string[] {
  const p = common(brief, t);
  const style = brief.styles[0] ? t(`wizard.styles.${brief.styles[0]}`) : t("wizard.suggest.simpleStyle");
  const usedOn = brief.usedOn.length
    ? brief.usedOn
        .slice(0, 2)
        .map((u) => t(`wizard.usedOn.${u}`))
        .join(t("wizard.suggest.and"))
    : t("wizard.suggest.usedOnDefault");
  const colours =
    !brief.letDesignersChoose && brief.colors.length
      ? t("wizard.suggest.likes.l2Colors", { colors: brief.colors.join(", ").toUpperCase() })
      : t("wizard.suggest.likes.l2Free", p);
  return [
    t("wizard.suggest.likes.l1", { ...p, style }),
    colours,
    t("wizard.suggest.likes.l3", { usedOn }),
    t("wizard.suggest.likes.l4"),
    t("wizard.suggest.likes.l5", { ...p, feel: feel(brief, t) }),
  ].map((s) => fit(s, LIMITS.likes.max));
}

/** C-06 "I don't like" */
export function dislikesSuggestions(brief: Brief, t: Translate): string[] {
  const p = common(brief, t);
  return (["d1", "d2", "d3", "d4", "d5"] as const).map((k) => fit(t(`wizard.suggest.dislikes.${k}`, p), LIMITS.dislikes.max));
}
