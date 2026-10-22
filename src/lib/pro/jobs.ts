import "server-only";
import { notifyWithPush } from "@/lib/notifications/broadcast";
import { twoSlots } from "@/lib/notifications/admin-catalog";
import { getSettings } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { remindInvited } from "./invites";
import { qualityScore } from "./rules";
import { getProSettings } from "./settings";
import { allProIds } from "./status";
import { designerStatsBulk } from "./stats";
import { weekNumbers } from "./workspace";
import { expireEndedPlans, logFunnel, sendRenewalReminders, tellDesigner } from "./subscription";
import { expireTrials, sendTrialReminders } from "./trial";
import { testContestIds, testIdsAmong } from "@/lib/seo/test-accounts";

const db = () => createAdminClient();
const HOUR = 3_600_000;

/**
 * Pro: "a contest you saved ends in 24 hours / 2 hours", once each, for saved contests with Remind me on. The hours
 * are set in Admin › Notifications (one or two reminders; the columns keep their first and second slot).
 */
async function savedReminders(now: Date): Promise<number> {
  const pro = await allProIds();
  if (!pro.length) return 0;
  const [first, second] = twoSlots((await getSettings(["notify.saved_reminder_hours"]))["notify.saved_reminder_hours"]);
  const { data: contests } = await db().from("contests").select("id, slug, brand_name, ends_at, is_private, is_nda").eq("status", "open").gt("ends_at", now.toISOString()).lte("ends_at", new Date(now.getTime() + first * HOUR).toISOString());
  // A test client's contest reminds test designers only (owner, 2026-10-22).
  const tests = await testContestIds((contests ?? []).map((c) => c.id as string));
  const testPro = tests.size ? [...(await testIdsAmong(pro))] : [];
  let n = 0;
  for (const c of contests ?? []) {
    const left = new Date(c.ends_at as string).getTime() - now.getTime();
    const col = second !== null && left <= second * HOUR ? "reminded_2_at" : "reminded_24_at";
    const { data: rows } = await db().from("contest_favorites").update({ [col]: now.toISOString() }).eq("contest_id", c.id).eq("remind", true).in("user_id", tests.has(c.id as string) ? testPro : pro).is(col, null).select("user_id");
    const ids = (rows ?? []).map((r) => r.user_id as string);
    if (!ids.length) continue;
    const brand = c.is_private || c.is_nda ? undefined : (c.brand_name as string);
    await notifyWithPush(ids, "pro_saved_reminder", { brand, hours: Math.max(1, Math.round(left / HOUR)) }, `/contest/${c.slug}`);
    n += ids.length;
  }
  return n;
}

/** Auto reminder (Admin › Pro plan): designers who clicked Upgrade and didn't pay hear once after 1 hour and after 3 days. */
async function clickReminders(now: Date): Promise<number> {
  const { settings } = await getProSettings();
  if (!settings.autoRemind || !settings.isForSale) return 0;
  const { data: events } = await db().from("pro_funnel_events").select("designer_id, event, step, created_at").not("designer_id", "is", null).gte("created_at", new Date(now.getTime() - 16 * 24 * HOUR).toISOString()).order("created_at");
  const by = new Map<string, { clicked: number | null; paid: boolean; sent: Set<string> }>();
  for (const e of events ?? []) {
    const id = e.designer_id as string;
    const s = by.get(id) ?? by.set(id, { clicked: null, paid: false, sent: new Set() }).get(id)!;
    if (e.event === "upgrade_clicked" && s.clicked === null) s.clicked = new Date(e.created_at as string).getTime();
    if (e.event === "paid") s.paid = true;
    if (e.event === "reminded" && e.step) s.sent.add(e.step as string);
  }
  const pro = new Set(await allProIds());
  // The hours after the click (Admin › Notifications): first and, if set, second reminder ("1h" and "3d" slots).
  const [later, sooner] = twoSlots((await getSettings(["notify.upgrade_reminder_hours"]))["notify.upgrade_reminder_hours"]);
  const firstAt = (sooner ?? later) * HOUR;
  const secondAt = sooner === null ? null : later * HOUR;
  let n = 0;
  for (const [id, s] of by) {
    if (s.clicked === null || s.paid || pro.has(id)) continue;
    const age = now.getTime() - s.clicked;
    const step = secondAt !== null && age >= secondAt && !s.sent.has("3d") ? "3d" : age >= firstAt && (secondAt === null || age < secondAt) && !s.sent.has("1h") ? "1h" : null;
    if (!step) continue;
    await logFunnel("reminded", { designerId: id, step });
    await tellDesigner(id, "pro_checkout_reminder", { amount: settings.priceBdt }, "/pro/checkout");
    n++;
  }
  return n;
}

/** Nightly quality score for every designer with designs (designer search order, invite ranking). */
async function qualityScores(now: Date): Promise<number> {
  const { data: last } = await db().from("designer_quality_score").select("computed_at").order("computed_at", { ascending: false }).limit(1).maybeSingle();
  if (last?.computed_at && now.getTime() - new Date(last.computed_at as string).getTime() < 20 * HOUR) return 0;
  const { data: people } = await db().from("profiles").select("id, last_seen_at").eq("role", "designer").eq("status", "active").limit(20000);
  const ids = (people ?? []).map((p) => p.id as string);
  if (!ids.length) return 0;
  const seen = new Map((people ?? []).map((p) => [p.id as string, p.last_seen_at as string | null]));
  let n = 0;
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500);
    const stats = await designerStatsBulk(chunk);
    const { data: views } = await db().from("page_views").select("user_id, created_at").in("user_id", chunk).gte("created_at", new Date(now.getTime() - 30 * 24 * HOUR).toISOString()).limit(50000);
    const days = new Map<string, Set<string>>();
    for (const v of views ?? []) (days.get(v.user_id as string) ?? days.set(v.user_id as string, new Set()).get(v.user_id as string)!).add((v.created_at as string).slice(0, 10));
    const rows = chunk.map((id) => {
      const s = stats.get(id)!;
      const activeDays = days.get(id)?.size ?? (seen.get(id) && now.getTime() - new Date(seen.get(id)!).getTime() < 7 * 24 * HOUR ? 1 : 0);
      return {
        designer_id: id,
        score: qualityScore({ rating: s.rating, winRate: s.winRate, contests: s.contests, activeDays, replyMinutes: s.replyMinutes }),
        rating: s.rating,
        win_rate: s.winRate,
        wins: s.wins,
        entries: s.entries,
        contests: s.contests,
        reply_minutes: s.replyMinutes,
        active_days: activeDays,
        computed_at: now.toISOString(),
      };
    });
    const { error } = await db().from("designer_quality_score").upsert(rows, { onConflict: "designer_id" });
    if (!error) n += rows.length;
  }
  return n;
}

/** Pro "Weekly report": this week's numbers by email, once every 7 days, for those who switched it on. */
async function weeklyReports(now: Date): Promise<number> {
  const pro = await allProIds();
  if (!pro.length) return 0;
  const { data: prefs } = await db().from("pro_preferences").select("designer_id, weekly_sent_at").in("designer_id", pro).eq("weekly_report", true);
  const due = (prefs ?? []).filter((p) => !p.weekly_sent_at || now.getTime() - new Date(p.weekly_sent_at as string).getTime() >= 7 * 24 * HOUR - HOUR);
  let n = 0;
  for (const p of due) {
    const id = p.designer_id as string;
    const { data: claimed } = await db().from("pro_preferences").update({ weekly_sent_at: now.toISOString() }).eq("designer_id", id).eq("weekly_report", true).select("designer_id");
    if (!claimed?.length) continue;
    const { data: who } = await db().from("profiles").select("username").eq("id", id).maybeSingle();
    const w = await weekNumbers(id, (who?.username as string | null) ?? null);
    await tellDesigner(id, "pro_weekly", { number: w.designViews }, "/dashboard/insights", {
      subject: "pro.mail.weekly.subject",
      body: "pro.mail.weekly.body",
      params: { profile: w.profileViews, designs: w.designViews, shortlists: w.shortlists, wins: w.wins },
    });
    n++;
  }
  return n;
}

export type ProJobReport = { expired: number; trialReminders: number; trialsEnded: number; renewalReminders: number; inviteReminders: number; savedReminders: number; clickReminders: number; quality: number; weekly: number; errors: string[] };

/** Every Pro job, run by the 15-minute lifecycle job. Nothing runs before migration 0046. Never throws. */
export async function runProJobs(now: Date = new Date()): Promise<ProJobReport> {
  const report: ProJobReport = { expired: 0, trialReminders: 0, trialsEnded: 0, renewalReminders: 0, inviteReminders: 0, savedReminders: 0, clickReminders: 0, quality: 0, weekly: 0, errors: [] };
  const { ready } = await getProSettings();
  if (!ready) return report;
  const steps: [keyof Omit<ProJobReport, "errors">, () => Promise<number>][] = [
    ["expired", () => expireEndedPlans(now)],
    // 3-day free Pro Trial (owner, 2026-10-14): remind on the last day, then end it.
    ["trialReminders", () => sendTrialReminders(now)],
    ["trialsEnded", () => expireTrials(now)],
    ["renewalReminders", () => sendRenewalReminders(now)],
    ["inviteReminders", () => remindInvited(now)],
    ["savedReminders", () => savedReminders(now)],
    ["clickReminders", () => clickReminders(now)],
    ["quality", () => qualityScores(now)],
    ["weekly", () => weeklyReports(now)],
  ];
  for (const [key, run] of steps) {
    try {
      report[key] = await run();
    } catch (e) {
      report.errors.push(`${key}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return report;
}
