"use server";

import { refresh } from "next/cache";
import { adminUser, audit } from "@/lib/admin/core";
import type { MessageKey } from "@/lib/i18n/translate";
import { parseService } from "@/lib/services/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { FLOWS, parseOnboarding, type OnboardingFlow } from "./config";
import { getOnboarding, onboardingKey } from "./store";

type Result = { ok: true } | { ok: false; error: MessageKey };

/**
 * Saves one flow's onboarding (owner, 2026-10-14): which optional questions are hidden and the owner's own questions.
 * The own questions get the same checks as a service's questions (Admin › Services).
 */
export async function saveOnboarding(flow: OnboardingFlow, raw: unknown): Promise<Result> {
  const admin = await adminUser("content.manage");
  if (!admin || !(flow in FLOWS)) return { ok: false, error: "auth.errors.generic" };
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const extraIn = Array.isArray(r.extra) ? r.extra : [];
  // Each own question through the service question rules (labels, options, keys), keeping its step.
  const checked = parseService({ slug: "onboarding_check", name: { en: "x", bn: "x" }, entryTypes: ["png"], finalTypes: ["png"], fields: extraIn }, null);
  if (!checked.ok) return { ok: false, error: `admin.onboarding.errors.${checked.error}` as MessageKey };
  const steps = new Map(extraIn.map((q) => [(q as { key?: string }).key, Number((q as { step?: unknown }).step)]));
  const cfg = parseOnboarding(flow, { hidden: r.hidden, extra: checked.service.fields.map((f) => ({ ...f, step: steps.get(f.key) })) });
  if (cfg.extra.length !== checked.service.fields.length) return { ok: false, error: "admin.onboarding.errors.step" };
  const before = await getOnboarding(flow);
  const { error } = await createAdminClient()
    .from("settings")
    .upsert({ key: onboardingKey(flow), value: cfg, type: "json", group: "onboarding", description: `Admin › Onboarding (${flow})`, updated_by: admin.id, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) return { ok: false, error: "auth.errors.generic" };
  await audit(admin.id, "update_onboarding", "settings", onboardingKey(flow), { hidden: { from: before.hidden, to: cfg.hidden }, questions: { from: before.extra.length, to: cfg.extra.length } });
  refresh();
  return { ok: true };
}
