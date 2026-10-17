/**
 * Onboarding the owner controls (owner, 2026-10-14): Admin › Onboarding lists every question a new client (the logo
 * contest wizard) and a new designer (sign-up) answers. Optional ones can be hidden, every one's wording is edited in
 * English and Bangla (the site texts), and the owner adds their own questions to any step. Pure: shared by the admin
 * page, the wizard, the sign-up, the server and the tests.
 */

import { cleanAnswers, type Answers, type BriefField } from "@/lib/services/types";

export type OnboardingFlow = "client" | "designer";

/** One of the owner's own questions, and the step it is asked on. */
export type ExtraQuestion = BriefField & { step: number };

export type OnboardingConfig = { hidden: string[]; extra: ExtraQuestion[] };

export const EMPTY_ONBOARDING: OnboardingConfig = { hidden: [], extra: [] };

/** A question the site asks on its own: where, its texts, and whether the owner may hide it. */
export type BuiltInQuestion = { key: string; step: number; hideable: boolean; texts: string[] };

export type FlowStep = { step: number; title: string };

export const FLOWS: Record<OnboardingFlow, { steps: FlowStep[]; questions: BuiltInQuestion[]; extraSteps: number[] }> = {
  client: {
    // Owner, 2026-10-15: 8 grouped steps (signed-in clients skip step 1; the password is on the prize step).
    steps: [
      { step: 1, title: "wizard.you.heading" },
      { step: 2, title: "wizard.c01.heading" },
      { step: 3, title: "wizard.c02.heading" },
      { step: 4, title: "wizard.links.heading" },
      { step: 5, title: "wizard.look.heading" },
      { step: 6, title: "wizard.needs.heading" },
      { step: 7, title: "wizard.c08.heading" },
    ],
    questions: [
      { key: "name", step: 1, hideable: false, texts: ["wizard.you.heading", "wizard.you.helper", "wizard.you.nameLabel", "wizard.you.nameHint"] },
      { key: "mobile", step: 1, hideable: false, texts: ["auth.phone.label"] },
      { key: "whatsapp", step: 1, hideable: true, texts: ["auth.phone.whatsapp", "auth.phone.whatsappHint"] },
      { key: "email", step: 1, hideable: false, texts: ["wizard.c09.emailLabel", "wizard.c09.emailHint"] },
      { key: "brandName", step: 2, hideable: false, texts: ["wizard.c01.heading", "wizard.c01.helper", "wizard.c01.brandLabel"] },
      { key: "slogan", step: 2, hideable: true, texts: ["wizard.c01.sloganLabel"] },
      { key: "logoText", step: 2, hideable: true, texts: ["wizard.c01.logoTextLabel", "wizard.c01.logoTextHint"] },
      { key: "shortName", step: 2, hideable: true, texts: ["wizard.c01.shortNameLabel", "wizard.c01.shortNameHint"] },
      { key: "businessType", step: 3, hideable: false, texts: ["wizard.c02.heading", "wizard.c02.helper", "wizard.c02.typeLabel", "wizard.c02.otherLabel"] },
      { key: "businessDescription", step: 3, hideable: false, texts: ["wizard.c02.descLabel", "wizard.c02.descHint"] },
      { key: "targetAudience", step: 3, hideable: true, texts: ["wizard.c02.audienceLabel", "wizard.c02.audienceHint"] },
      { key: "links", step: 4, hideable: true, texts: ["wizard.links.heading", "wizard.links.helper", "wizard.links.linksTitle", "wizard.links.linksSub", "wizard.links.none"] },
      { key: "competitors", step: 4, hideable: true, texts: ["wizard.links.competitorsTitle", "wizard.links.competitorsSub", "wizard.links.competitorsLabel"] },
      { key: "styles", step: 5, hideable: true, texts: ["wizard.look.heading", "wizard.look.helper", "wizard.c04.heading", "wizard.c04.slidersTitle"] },
      { key: "colors", step: 5, hideable: true, texts: ["wizard.c05.heading", "wizard.c05.helper", "wizard.c05.letChoose"] },
      { key: "usedOn", step: 6, hideable: true, texts: ["wizard.needs.heading", "wizard.needs.helper", "wizard.c05.usedOnTitle"] },
      { key: "deliverables", step: 6, hideable: true, texts: ["wizard.c05.needTitle", "wizard.c05.needHelper"] },
      { key: "requirements", step: 6, hideable: true, texts: ["wizard.c06.heading", "wizard.c06.helper", "wizard.c06.requirementsTitle"] },
      { key: "requirementsNote", step: 6, hideable: true, texts: ["wizard.c06.noteLabel"] },
      { key: "files", step: 6, hideable: true, texts: ["wizard.c07.heading", "wizard.c07.helper"] },
      { key: "package", step: 7, hideable: false, texts: ["wizard.c08.heading", "wizard.c08.helper"] },
      { key: "password", step: 7, hideable: false, texts: ["wizard.c10.heading", "wizard.c10.helper"] },
    ],
    // The owner's questions go on the brief steps (not on About you, the prize or the review).
    extraSteps: [2, 3, 4, 5, 6],
  },
  designer: {
    steps: [
      { step: 1, title: "designerSignup.steps.s1" },
      { step: 2, title: "designerSignup.steps.s2" },
      { step: 3, title: "designerSignup.steps.s3" },
      { step: 4, title: "designerSignup.steps.s4" },
    ],
    questions: [
      { key: "name", step: 1, hideable: false, texts: ["designerSignup.name.label", "designerSignup.name.hint"] },
      { key: "mobile", step: 1, hideable: false, texts: ["designerSignup.mobile"] },
      { key: "whatsapp", step: 1, hideable: true, texts: ["auth.phone.whatsapp", "auth.phone.whatsappHint"] },
      { key: "email", step: 2, hideable: false, texts: ["designerSignup.email"] },
      { key: "password", step: 2, hideable: false, texts: ["designerSignup.password"] },
      { key: "username", step: 3, hideable: false, texts: ["designerSignup.username.label", "designerSignup.username.auto"] },
      { key: "bio", step: 3, hideable: true, texts: ["designerSignup.bio.label", "designerSignup.bio.hint"] },
      { key: "payout", step: 4, hideable: false, texts: ["designerSignup.payout.title"] },
      { key: "rules", step: 4, hideable: false, texts: ["designerSignup.rules.title", "designerSignup.rules.accept"] },
    ],
    extraSteps: [1, 3],
  },
};

const MAX_EXTRA = 15;

/** The saved config, cleaned: only questions the owner may hide, valid steps, at most 15 own questions. */
export function parseOnboarding(flow: OnboardingFlow, raw: unknown): OnboardingConfig {
  const def = FLOWS[flow];
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const hideable = new Set(def.questions.filter((q) => q.hideable).map((q) => q.key));
  const hidden = [...new Set((Array.isArray(r.hidden) ? r.hidden : []).filter((k): k is string => typeof k === "string" && hideable.has(k)))];
  const extra: ExtraQuestion[] = [];
  const keys = new Set<string>();
  for (const q of Array.isArray(r.extra) ? r.extra : []) {
    if (!q || typeof q !== "object" || extra.length >= MAX_EXTRA) continue;
    const e = q as ExtraQuestion;
    if (typeof e.key !== "string" || !/^[a-z][a-z0-9_]{0,29}$/.test(e.key) || keys.has(e.key)) continue;
    if (!def.extraSteps.includes(e.step)) continue;
    keys.add(e.key);
    extra.push(e);
  }
  return { hidden, extra };
}

/** Whether a question is hidden for this flow. */
export const isHidden = (cfg: OnboardingConfig, key: string) => cfg.hidden.includes(key);

/** The owner's questions asked on this step, in the owner's order. */
export const extraOn = (cfg: OnboardingConfig, step: number) => cfg.extra.filter((q) => q.step === step);

/**
 * Client wizard steps to show: a step whose every question is hidden, and that has none of the owner's questions, is
 * skipped (the website, styles, colours, requirements and files steps can go completely).
 */
export function clientStepShown(cfg: OnboardingConfig, step: number): boolean {
  const own = FLOWS.client.questions.filter((q) => q.step === step);
  if (own.some((q) => !q.hideable)) return true;
  if (extraOn(cfg, step).length > 0) return true;
  return own.length === 0 || own.some((q) => !isHidden(cfg, q.key));
}

/** The answers to the owner's questions on these steps (all steps when none given): cleaned, with any problems. */
export function checkExtraAnswers(cfg: OnboardingConfig, raw: unknown, steps?: number[]): { answers: Answers; errors: Record<string, string> } {
  const fields = steps ? cfg.extra.filter((q) => steps.includes(q.step)) : cfg.extra;
  return cleanAnswers({ fields }, raw);
}
