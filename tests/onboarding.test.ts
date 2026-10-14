import { describe, expect, it } from "vitest";
import { flattenTexts, isEditableKey, type TextTree } from "@/lib/content/rules";
import { MESSAGES } from "@/lib/i18n/messages";
import { checkExtraAnswers, clientStepShown, EMPTY_ONBOARDING, FLOWS, parseOnboarding } from "@/lib/onboarding/config";

const textOf = (locale: "en" | "bn", key: string) => key.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), MESSAGES[locale]);

describe("onboarding the owner controls (owner, 2026-10-14)", () => {
  it("every built-in question points at real texts in English and Bangla", () => {
    for (const flow of Object.values(FLOWS)) {
      for (const key of [...flow.steps.map((s) => s.title), ...flow.questions.flatMap((q) => q.texts)]) {
        expect(typeof textOf("en", key), key).toBe("string");
        expect(typeof textOf("bn", key), key).toBe("string");
      }
    }
  });

  it("their wording can be edited like any site text (Admin › Texts)", () => {
    const en = flattenTexts(MESSAGES.en as unknown as TextTree);
    for (const flow of Object.values(FLOWS)) for (const key of flow.questions.flatMap((q) => q.texts)) expect(isEditableKey(key, en), key).toBe(true);
  });

  it("only optional questions can be hidden; own questions need a key and a brief step", () => {
    const cfg = parseOnboarding("client", {
      hidden: ["slogan", "brandName", "nonsense", "slogan"],
      extra: [
        { key: "budget_note", step: 2, type: "text", label: { en: "Anything else?", bn: "আর কিছু?" }, help: { en: "", bn: "" }, required: false, options: [] },
        { key: "Bad Key", step: 2, type: "text", label: { en: "x", bn: "x" }, help: { en: "", bn: "" }, required: false, options: [] },
        { key: "on_price_step", step: 8, type: "text", label: { en: "x", bn: "x" }, help: { en: "", bn: "" }, required: false, options: [] },
        { key: "budget_note", step: 3, type: "text", label: { en: "dup", bn: "dup" }, help: { en: "", bn: "" }, required: false, options: [] },
      ],
    });
    expect(cfg.hidden).toEqual(["slogan"]);
    expect(cfg.extra.map((q) => q.key)).toEqual(["budget_note"]);
    expect(parseOnboarding("designer", { hidden: ["bio", "email"] }).hidden).toEqual(["bio"]);
    expect(parseOnboarding("client", null)).toEqual(EMPTY_ONBOARDING);
  });

  it("a step goes away when all its questions are hidden and it has none of the owner's", () => {
    expect(clientStepShown(EMPTY_ONBOARDING, 3)).toBe(true);
    expect(clientStepShown({ hidden: ["websiteUrl"], extra: [] }, 3)).toBe(false);
    expect(clientStepShown({ hidden: ["colors"], extra: [] }, 5)).toBe(true);
    expect(clientStepShown({ hidden: ["colors", "usedOn", "deliverables"], extra: [] }, 5)).toBe(false);
    const q = { key: "q1", step: 3, type: "text" as const, label: { en: "Q", bn: "Q" }, help: { en: "", bn: "" }, required: true, options: [] };
    expect(clientStepShown({ hidden: ["websiteUrl"], extra: [q] }, 3)).toBe(true);
    expect(clientStepShown({ hidden: ["websiteUrl"], extra: [] }, 1)).toBe(true);
  });

  it("answers to the owner's questions are checked step by step", () => {
    const q = { key: "q1", step: 3, type: "text" as const, label: { en: "Q", bn: "Q" }, help: { en: "", bn: "" }, required: true, options: [] };
    const cfg = { hidden: [], extra: [q] };
    expect(checkExtraAnswers(cfg, {}, [3]).errors).toEqual({ q1: "required" });
    expect(checkExtraAnswers(cfg, {}, [1]).errors).toEqual({});
    expect(checkExtraAnswers(cfg, { q1: " yes " }).answers).toEqual({ q1: "yes" });
  });
});
