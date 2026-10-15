import "server-only";
import { after } from "next/server";
import { designersForAlert, emailContestNew } from "@/lib/email/events";
import { isSupabaseConfigured } from "@/lib/env";
import { broadcastToDesigners, notifyWithPush } from "@/lib/notifications/broadcast";
import { notifyInvited } from "@/lib/pro/invites";
import { opensToAllAt } from "@/lib/pro/rules";
import { getProSettings } from "@/lib/pro/settings";
import { allProIds } from "@/lib/pro/status";
import { createAdminClient } from "@/lib/supabase/admin";

// Pro "Instant alerts" (Contests page): app and email on or off, and which design types (empty = all).
async function proAlertIds(pro: string[], service: string): Promise<{ app: string[]; email: string[] }> {
  const { data } = await createAdminClient().from("pro_preferences").select("designer_id, alert_app, alert_email, alert_services").in("designer_id", pro);
  const prefs = new Map((data ?? []).map((r) => [r.designer_id as string, r]));
  const wants = (id: string) => {
    const types = (prefs.get(id)?.alert_services as string[] | null) ?? [];
    return types.length === 0 || types.includes(service);
  };
  return {
    app: pro.filter((id) => wants(id) && prefs.get(id)?.alert_app !== false),
    email: pro.filter((id) => wants(id) && prefs.get(id)?.alert_email !== false),
  };
}

/**
 * "New logo contest: submit your logo and win" to every designer, once per contest (owner, 2026-10-09).
 * Called when a payment opens a contest, and by the lifecycle job for any it finds unannounced.
 */
export async function announceContest(contestId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const db = createAdminClient();
  const { data: c } = await db.from("contests").select("id, slug, brand_name, prize_amount, status, is_private, is_nda, starts_at, service").eq("id", contestId).maybeSingle();
  if (!c || c.status !== "open") return false;
  // Private and NDA contests still want designers; their names stay hidden from people who can't see the brief.
  const brand = c.is_private || c.is_nda ? null : (c.brand_name as string);
  const data = { brand: brand ?? undefined, amount: c.prize_amount as number };
  const link = `/contest/${c.slug}`;

  // Pro early access (owner, 2026-10-13): Pro designers hear at once ("instant contest alert"), and invited designers
  // get their invitation; everyone else hears when the contest opens to them (the lifecycle job calls this again).
  const { settings, ready } = await getProSettings();
  const pro = ready ? await allProIds() : [];
  const early = ready && settings.features.early_access && settings.earlyAccessMinutes > 0;
  if (early) {
    const { error: sentEarly } = await db.from("lifecycle_events").insert({ contest_id: c.id, kind: "announced_pro" });
    if (!sentEarly && pro.length) {
      const alerts = await proAlertIds(pro, (c.service as string | null) ?? "logo");
      await notifyWithPush(alerts.app, brand ? "contest_new_pro" : "contest_new_pro_private", data, link);
      // contest-new.html with the "Pro early access" note (owner, 2026-10-15).
      await emailContestNew(c.id as string, alerts.email, { headStartMinutes: settings.earlyAccessMinutes });
    }
    await notifyInvited(c.id as string);
    const startsAt = c.starts_at ? new Date(c.starts_at as string) : new Date();
    if (opensToAllAt(startsAt, settings) > new Date()) return !sentEarly;
  } else if (ready) {
    await notifyInvited(c.id as string);
  }

  // Recorded first, so two callers never announce twice.
  const { error } = await db.from("lifecycle_events").insert({ contest_id: c.id, kind: "announced" });
  if (error) return false;
  await broadcastToDesigners(brand ? "contest_new" : "contest_new_private", data, link, early ? pro : []);
  // And by email (contest-new.html) to every designer who hasn't turned these off; Pro designers had theirs already.
  // Sent after the reply, so approving a payment never waits for many emails.
  const except = early ? pro : [];
  after(async () => {
    await emailContestNew(c.id as string, await designersForAlert(except), null);
  });
  return true;
}

/** The contest a payment opened, if it is one. */
export async function announceForPayment(paymentId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const { data } = await createAdminClient().from("payments").select("contest_id, purpose, status").eq("id", paymentId).maybeSingle();
  if (data && data.purpose === "contest" && data.status === "paid") await announceContest(data.contest_id as string);
}
