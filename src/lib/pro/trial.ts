import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProSettings } from "./settings";
import { getSubscription, getTrial, toTrial, TRIAL_COLUMNS, type Trial } from "./status";
import { logProActivity, tellDesigner } from "./subscription";
import { extendedEnd, trialEligibility, trialEnd, trialReminderDue, trialShouldExpire } from "./trial-rules";

/**
 * 3-day free Pro Trial (owner, 2026-10-14): starting, ending, extending and the last-day reminder. Every change is
 * kept in pro_trial_events (Admin › Pro plan › Pro Trials) and in the Pro activity log.
 */

const db = () => createAdminClient();

async function event(t: { id: string; designerId: string }, kind: "started" | "reminded" | "extended" | "cancelled" | "expired" | "upgraded", actorId: string | null, detail?: Record<string, unknown>) {
  const { error } = await db().from("pro_trial_events").insert({ trial_id: t.id, designer_id: t.designerId, kind, actor_id: actorId, detail: detail ?? null });
  if (error) console.error("[pro] trial event:", error.message);
}

/** Can this designer start the trial now? */
export async function trialEligibilityFor(designerId: string, role: string): Promise<ReturnType<typeof trialEligibility>> {
  const { settings, ready } = await getProSettings();
  if (!ready) return "off";
  const [trial, sub] = await Promise.all([getTrial(designerId), getSubscription(designerId)]);
  return trialEligibility({ enabled: settings.freeTrialEnabled, isDesigner: role === "designer", hadTrial: !!trial, hadPro: !!sub });
}

export type StartTrialError = "off" | "used" | "had_pro" | "not_designer" | "generic";

/**
 * Starts the trial. A designer may start it once, when trials are on and they never had Pro. An admin may start it
 * for any designer who never had a trial, even while trials are off. One row per designer makes a second trial
 * impossible, even with two clicks at once.
 */
export async function startTrial(designerId: string, by: { kind: "designer" } | { kind: "admin"; adminId: string }): Promise<{ ok: true; trial: Trial } | { ok: false; error: StartTrialError }> {
  const { settings, ready } = await getProSettings();
  if (!ready) return { ok: false, error: "off" };
  const { data: person } = await db().from("profiles").select("role").eq("id", designerId).maybeSingle();
  if (by.kind === "designer") {
    const why = await trialEligibilityFor(designerId, (person?.role as string) ?? "");
    if (why !== "ok") return { ok: false, error: why };
  } else if (person?.role !== "designer") return { ok: false, error: "not_designer" };
  const now = new Date();
  const { data, error } = await db()
    .from("pro_trials")
    .insert({
      designer_id: designerId,
      status: "active",
      started_at: now.toISOString(),
      ends_at: trialEnd(now, settings.freeTrialDays).toISOString(),
      started_by: by.kind,
      started_by_admin: by.kind === "admin" ? by.adminId : null,
    })
    .select(TRIAL_COLUMNS)
    .single();
  if (error || !data) return { ok: false, error: error?.code === "23505" ? "used" : "generic" };
  const trial = toTrial(data as Record<string, unknown>);
  const actor = by.kind === "admin" ? by.adminId : designerId;
  await event(trial, "started", actor, { days: settings.freeTrialDays, by: by.kind });
  await logProActivity(actor, by.kind === "admin" ? "admin_started_trial" : "trial_started", designerId, null, { until: trial.endsAt.toISOString() });
  await tellDesigner(designerId, "pro_trial_started", { days: settings.freeTrialDays }, "/dashboard");
  return { ok: true, trial };
}

/** Ends a running trial now (the designer or an admin): the designer is Basic again. */
export async function cancelTrial(designerId: string, by: { kind: "designer" } | { kind: "admin"; adminId: string }): Promise<boolean> {
  const now = new Date().toISOString();
  const { data } = await db()
    .from("pro_trials")
    .update({ status: "cancelled", ended_at: now, cancelled_by: by.kind, updated_at: now })
    .eq("designer_id", designerId)
    .eq("status", "active")
    .select(TRIAL_COLUMNS);
  if (!data?.length) return false;
  const trial = toTrial(data[0] as Record<string, unknown>);
  const actor = by.kind === "admin" ? by.adminId : designerId;
  await event(trial, "cancelled", actor, { by: by.kind });
  await logProActivity(actor, by.kind === "admin" ? "admin_cancelled_trial" : "trial_cancelled", designerId, { status: "active" }, { status: "cancelled" });
  await tellDesigner(designerId, "pro_trial_ended", {}, "/pro");
  return true;
}

/** An admin adds days. A trial that ended (not upgraded) runs again from now. */
export async function extendTrial(designerId: string, days: number, adminId: string): Promise<Trial | null> {
  const t = await getTrial(designerId);
  if (!t || t.status === "upgraded" || !Number.isInteger(days) || days < 1 || days > 30) return null;
  const until = extendedEnd(t, days);
  const { data } = await db()
    .from("pro_trials")
    .update({ status: "active", ends_at: until.toISOString(), extended_days: t.extendedDays + days, reminded_at: null, ended_at: null, cancelled_by: null, updated_at: new Date().toISOString() })
    .eq("id", t.id)
    .select(TRIAL_COLUMNS)
    .single();
  if (!data) return null;
  const next = toTrial(data as Record<string, unknown>);
  await event(next, "extended", adminId, { days, until: until.toISOString(), was: t.status });
  await logProActivity(adminId, "admin_extended_trial", designerId, { status: t.status, until: t.endsAt.toISOString() }, { status: "active", until: until.toISOString() });
  await tellDesigner(designerId, "pro_trial_extended", { days }, "/dashboard");
  return next;
}

/** A paid upgrade during or after the trial: the trial counts as upgraded (once). */
export async function markTrialUpgraded(designerId: string, paymentId: string): Promise<void> {
  const now = new Date().toISOString();
  const { data } = await db()
    .from("pro_trials")
    .update({ status: "upgraded", upgraded_at: now, upgrade_payment_id: paymentId, ended_at: now, updated_at: now })
    .eq("designer_id", designerId)
    .in("status", ["active", "expired"])
    .select(TRIAL_COLUMNS);
  if (data?.length) await event(toTrial(data[0] as Record<string, unknown>), "upgraded", designerId, { payment: paymentId });
}

/** The last-day reminder (once per trial run): "Your Pro Trial is ending. Upgrade now to keep your Pro benefits active." */
export async function sendTrialReminders(now: Date = new Date()): Promise<number> {
  const soon = new Date(now.getTime() + 86_400_000).toISOString();
  const { data, error } = await db().from("pro_trials").select(TRIAL_COLUMNS).eq("status", "active").is("reminded_at", null).gt("ends_at", now.toISOString()).lte("ends_at", soon);
  if (error) return 0;
  let n = 0;
  for (const r of data ?? []) {
    const t = toTrial(r as Record<string, unknown>);
    if (!trialReminderDue(t, now)) continue;
    const { data: claimed } = await db().from("pro_trials").update({ reminded_at: now.toISOString(), updated_at: now.toISOString() }).eq("id", t.id).is("reminded_at", null).select("id");
    if (!claimed?.length) continue;
    n++;
    await tellDesigner(t.designerId, "pro_trial_ending", {}, "/pro", { subject: "pro.mail.trialEnding.subject", body: "pro.mail.trialEnding.body" });
    await event(t, "reminded", null, { endsAt: t.endsAt.toISOString() });
  }
  return n;
}

/** Trials whose time is up end: the designer is Basic again (unless they paid). Portfolio images are kept, hidden. */
export async function expireTrials(now: Date = new Date()): Promise<number> {
  const { data, error } = await db().from("pro_trials").select(TRIAL_COLUMNS).eq("status", "active").lte("ends_at", now.toISOString());
  if (error) return 0;
  let n = 0;
  for (const r of data ?? []) {
    const t = toTrial(r as Record<string, unknown>);
    if (!trialShouldExpire(t, now)) continue;
    const { data: done } = await db().from("pro_trials").update({ status: "expired", ended_at: now.toISOString(), updated_at: now.toISOString() }).eq("id", t.id).eq("status", "active").select("id");
    if (!done?.length) continue;
    n++;
    await event(t, "expired", null);
    await logProActivity(null, "trial_expired", t.designerId, { status: "active" }, { status: "expired" });
    await tellDesigner(t.designerId, "pro_trial_ended", {}, "/pro", { subject: "pro.mail.trialEnded.subject", body: "pro.mail.trialEnded.body" });
  }
  return n;
}
