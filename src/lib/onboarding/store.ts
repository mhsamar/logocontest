import "server-only";
import { cache } from "react";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { EMPTY_ONBOARDING, parseOnboarding, type ExtraQuestion, type OnboardingConfig, type OnboardingFlow } from "./config";

/** Admin › Onboarding (owner, 2026-10-14): kept as one settings row per flow, edited only on its own page. */
export const onboardingKey = (flow: OnboardingFlow) => `onboarding.${flow}`;

export const getOnboarding = cache(async (flow: OnboardingFlow): Promise<OnboardingConfig> => {
  if (!isSupabaseConfigured()) return EMPTY_ONBOARDING;
  const { data, error } = await createAdminClient().from("settings").select("value").eq("key", onboardingKey(flow)).maybeSingle();
  if (error || !data) return EMPTY_ONBOARDING;
  return parseOnboarding(flow, data.value);
});

/** "Question → answer" lines for the owner's own questions that are still asked, in the owner's order. */
export function answerLines(cfg: { extra: ExtraQuestion[] }, answers: Record<string, string | string[]>, locale: "en" | "bn"): { label: string; answer: string }[] {
  const l = (x: { en: string; bn: string }) => (locale === "bn" ? x.bn || x.en : x.en || x.bn);
  return cfg.extra
    .map((q) => {
      const v = answers[q.key];
      if (v === undefined || (Array.isArray(v) ? v.length === 0 : !v)) return null;
      const list = Array.isArray(v) ? v : [v];
      const answer = q.type === "choice" || q.type === "multi_choice" ? list.map((x) => l(q.options.find((o) => o.en === x) ?? { en: x, bn: x })).join(", ") : list.join(q.type === "colours" ? " " : ", ");
      return { label: l(q.label), answer };
    })
    .filter((x): x is { label: string; answer: string } => x !== null);
}

/** A contest's answers to the owner's questions ({} before migration 0056). */
export async function contestExtraAnswers(contestId: string): Promise<Record<string, string | string[]>> {
  if (!isSupabaseConfigured()) return {};
  const { data, error } = await createAdminClient().from("contests").select("extra_answers").eq("id", contestId).maybeSingle();
  return error || !data?.extra_answers ? {} : (data.extra_answers as Record<string, string | string[]>);
}

/** A designer's answers at sign-up ({} before migration 0056). */
export async function designerOnboardingAnswers(userId: string): Promise<Record<string, string | string[]>> {
  if (!isSupabaseConfigured()) return {};
  const { data, error } = await createAdminClient().from("profiles").select("onboarding_answers").eq("id", userId).maybeSingle();
  return error || !data?.onboarding_answers ? {} : (data.onboarding_answers as Record<string, string | string[]>);
}
