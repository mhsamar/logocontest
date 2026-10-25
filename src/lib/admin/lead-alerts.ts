import "server-only";
import { dhakaStart } from "@/lib/admin/analytics";
import { adminIdsWith } from "@/lib/admin/recipients";
import type { Locale } from "@/lib/i18n/config";
import type { MessageKey } from "@/lib/i18n/translate";
import { formatNumber } from "@/lib/money";
import { alertAdmins } from "@/lib/notifications/admin-alerts";
import { noticeOn } from "@/lib/notifications/switches";
import { serviceNames } from "@/lib/pro/workspace";
import { personNameFrom } from "@/lib/profile/name-rules";
import { LOGO } from "@/lib/services/types";
import { getSettings } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { leadPath } from "./lead-path";

/** At most this many people get their own alert per run; more at once go out as one summary. */
export const LEAD_ALERTS_MAX = 3;
const DAY = 86_400_000;
const CHANNELS = ["bell", "push", "email"] as const;

type Row = Record<string, unknown>;

/**
 * New clients who gave their mobile number but still have no account some minutes later (owner, 2026-10-25): every
 * admin who can see Unpaid contests hears about each person once, by bell, phone and email (Admin › Notifications,
 * "New clients who didn't sign up"). Run by the 15-minute job. A number first seen more than a day before it was due
 * is never alerted, so a stopped job doesn't flood the team; a number that signed up or was already alerted is marked
 * quietly. The number never goes into the notification, the email or the link, and the email carries no name or brand
 * (it outlives the 90 days the lead is kept). Returns how many people were alerted.
 */
export async function alertNewLeads(now = new Date()): Promise<number> {
  // Turned off in Admin › Notifications: nobody is marked "alerted" without being told.
  const [bellOn, pushOn, emailOn] = await Promise.all(CHANNELS.map((c) => noticeOn("admin_leads", c)));
  if (!bellOn && !pushOn && !emailOn) return 0;
  const db = createAdminClient();
  const s = await getSettings(["notify.lead_alert_minutes", "notify.lead_alert_emails_day"]);
  const dueBy = new Date(now.getTime() - s["notify.lead_alert_minutes"] * 60_000);
  const { data, error } = await db
    .from("wizard_leads")
    .select("mobile")
    .is("alerted_at", null)
    .lte("created_at", dueBy.toISOString())
    .gte("created_at", new Date(dueBy.getTime() - DAY).toISOString())
    .limit(200);
  if (error) {
    // Before migration 0075 there is no alerted_at column: nothing to do yet.
    if (error.code === "42703" || error.code === "PGRST204") return 0;
    throw new Error(error.message);
  }
  const mobiles = [...new Set((data ?? []).map((r) => r.mobile as string))];
  if (!mobiles.length) return 0;
  const [accounts, told] = await Promise.all([
    db.from("profiles").select("mobile").in("mobile", mobiles),
    db.from("wizard_leads").select("mobile").in("mobile", mobiles).not("alerted_at", "is", null),
  ]);
  // Without knowing who signed up or was told, nothing is marked; the next run tries again.
  if (accounts.error || told.error) throw new Error((accounts.error ?? told.error)!.message);
  const quiet = new Set([...(accounts.data ?? []), ...(told.data ?? [])].map((r) => r.mobile as string));
  const iso = now.toISOString();

  /** Marks this number's due visits as handled: those visits, newest first (none: another run got there first). */
  const claim = async (mobile: string): Promise<Row[]> => {
    const { data: claimed, error: claimError } = await db
      .from("wizard_leads")
      .update({ alerted_at: iso })
      .eq("mobile", mobile)
      .is("alerted_at", null)
      .lte("created_at", dueBy.toISOString())
      .select("visit_id, name, brand_name, service, furthest_step, created_at, updated_at");
    if (claimError) throw new Error(claimError.message);
    return ((claimed ?? []) as Row[]).sort((a, b) => Date.parse(b.updated_at as string) - Date.parse(a.updated_at as string));
  };
  for (const mobile of mobiles) if (quiet.has(mobile)) await claim(mobile);
  const fresh = mobiles.filter((m) => !quiet.has(m));
  if (!fresh.length) return 0;

  // Anyone can type a number, so emails for these alerts stop at a daily limit (one per admin counts); the bell and
  // phone still go. With only email on and the limit reached, nobody is marked until tomorrow.
  const { count: emailedToday } = await db
    .from("email_log")
    .select("id", { count: "exact", head: true })
    .eq("template", "notification")
    .like("ref", "lead%")
    .eq("status", "sent")
    .gte("created_at", dhakaStart(0, now).toISOString());
  const perAlert = Math.max(1, (await adminIdsWith("unpaid.view")).length);
  let emailsLeft = s["notify.lead_alert_emails_day"] - (emailedToday ?? 0);
  const email = () => {
    const ok = emailOn && emailsLeft >= perAlert;
    if (ok) emailsLeft -= perAlert;
    return ok;
  };
  const canTell = () => bellOn || pushOn || (emailOn && emailsLeft >= perAlert);
  if (!canTell()) return 0;

  if (fresh.length > LEAD_ALERTS_MAX) {
    let n = 0;
    for (const mobile of fresh) if ((await claim(mobile)).length) n++;
    if (!n) return 0;
    await alertAdmins({
      permission: "unpaid.view",
      type: "leads_new_admin",
      data: { number: n },
      path: "/admin/unpaid",
      notice: "admin_leads",
      ref: `leads:${iso}`,
      email: email(),
      subject: "admin.alerts.lead.manySubject",
      body: "admin.alerts.lead.manyBody",
      params: (_t, locale) => ({ number: formatNumber(n, locale) }),
    });
    return n;
  }

  const services: Record<Locale, Map<string, string>> = { en: await serviceNames("en"), bn: await serviceNames("bn") };
  let sent = 0;
  for (const mobile of fresh) {
    if (!canTell()) break;
    // Each number is marked just before its own alert, so a run cut short loses at most the one it was sending.
    const rows = await claim(mobile);
    if (!rows.length) continue;
    const latest = (key: string) => (rows.map((r) => r[key]).find((v) => typeof v === "string" && v.trim()) as string | undefined) ?? "";
    const visitId = rows[0].visit_id as string;
    // The bell and phone say who it is; the email doesn't (see above). The brand stands in only as plain words.
    const fromBrand = personNameFrom(latest("brand_name")).slice(0, 60).trim();
    const service = (rows[0].service as string | null) || LOGO;
    const step = Math.max(...rows.map((r) => Number(r.furthest_step) || 1));
    const firstAt = new Date(Math.min(...rows.map((r) => Date.parse(r.created_at as string))));
    await alertAdmins({
      permission: "unpaid.view",
      type: "lead_new_admin",
      data: { name: latest("name") || (fromBrand.length >= 2 ? fromBrand : "") || "—" },
      path: leadPath(visitId),
      notice: "admin_leads",
      ref: `lead:${visitId}`,
      email: email(),
      subject: "admin.alerts.lead.subject",
      body: "admin.alerts.lead.body",
      params: (t, locale) => ({
        service: services[locale].get(service) ?? service,
        // The service forms don't record their steps, so only a logo lead says how far it got.
        step: service === LOGO ? t(`admin.dashboard.steps.s${Math.min(step, 10)}` as MessageKey) : "—",
        when: firstAt.toLocaleString(locale === "bn" ? "bn-BD" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" }),
      }),
    });
    sent++;
  }
  return sent;
}
