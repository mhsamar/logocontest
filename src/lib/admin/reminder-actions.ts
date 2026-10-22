"use server";

import { refresh } from "next/cache";
import { adminUser } from "@/lib/admin/core";
import { translatorFor } from "@/lib/content/texts";
import { emailText } from "@/lib/email/events";
import type { MessageKey } from "@/lib/i18n/translate";
import { formatNumber } from "@/lib/money";
import { notifyWithPush } from "@/lib/notifications/broadcast";
import { getSetting } from "@/lib/settings";
import { linkOrigin } from "@/lib/site-origin";
import { createAdminClient } from "@/lib/supabase/admin";
import { isRealEmail, profileStatus, reminderPath, remindersFor, REMIND_GAP_MS, REMINDER_KINDS, REMINDER_TYPE, type ReminderKind } from "./reminder-rules";

type Result = { ok: true } | { ok: false; error: MessageKey };
const fail = (error: MessageKey): Result => ({ ok: false, error });
const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Admin › Users: remind a designer or client to verify their email, add a profile photo or complete their profile
 * (owner, 2026-10-22). In the app, on their phone if they turned notifications on, and by email, in their own language,
 * with a link to the right page. One reminder of each kind per person per day; every reminder is in the audit log.
 */
export async function remindUser(userId: string, kind: ReminderKind): Promise<Result> {
  const admin = await adminUser("users.manage");
  if (!admin || !UUID.test(userId) || !(REMINDER_KINDS as readonly string[]).includes(kind)) return fail("auth.errors.generic");
  const db = createAdminClient();
  const { data: p } = await db
    .from("profiles")
    .select("id, name, role, status, email, email_verified_at, avatar_path, bio, skills, tools, experience_years, languages, locale, is_super_admin")
    .eq("id", userId)
    .maybeSingle();
  // Designers and clients only, never staff, banned or deleted accounts.
  if (!p || (p.role !== "client" && p.role !== "designer") || p.is_super_admin || p.status === "deleted" || p.status === "banned") return fail("auth.errors.generic");
  const status = profileStatus(p as Parameters<typeof profileStatus>[0]);
  if (!remindersFor(status).includes(kind)) return fail("admin.users.x.remind.errors.done");

  // Claim today's slot first (the audit row), so two admins pressing at once send one reminder: the earliest claim
  // within the day wins, a later one is taken back.
  const { data: mine } = await db.from("audit_logs").insert({ admin_id: admin.id, action: "remind_user", subject_type: "user", subject_id: userId, changes: { kind, email: "pending" } }).select("id").single();
  if (!mine) return fail("admin.users.x.remind.errors.generic");
  const { data: claims } = await db
    .from("audit_logs")
    .select("id")
    .eq("action", "remind_user")
    .eq("subject_id", userId)
    .contains("changes", { kind })
    .gte("created_at", new Date(Date.now() - REMIND_GAP_MS).toISOString())
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(1);
  if (claims?.[0]?.id !== mine.id) {
    await db.from("audit_logs").delete().eq("id", mine.id);
    return fail("admin.users.x.remind.errors.recent");
  }

  const role = p.role as "client" | "designer";
  const missing = status?.missing ?? [];
  const path = reminderPath(kind, role, missing);
  const percent = status?.percent ?? 0;
  await notifyWithPush([p.id as string], REMINDER_TYPE[kind], { number: percent }, path);

  let email: string = "none";
  // Old phone-only addresses can't receive email: the bell and the phone carry the reminder alone.
  if (isRealEmail(p.email as string | null)) {
    const locale = p.locale === "bn" ? "bn" : "en";
    const t = await translatorFor(locale);
    const params = {
      name: (p.name as string).split(/\s+/)[0] || (p.name as string),
      link: `${await linkOrigin()}${path}`,
      resend: t("auth.verify.resend"),
      percent: formatNumber(percent, locale),
      // Every open step, so the list matches the percent.
      missing: (status?.open ?? []).map((s) => `• ${t(`profileProgress.steps.${s}`)}`).join("\n"),
      length: formatNumber(await getSetting("auth.email_code_length"), locale),
    };
    const body: MessageKey = kind === "profile" ? "admin.users.x.remind.mail.profile.body" : `admin.users.x.remind.mail.${kind}.${role === "client" ? "bodyClient" : "bodyDesigner"}`;
    email = await emailText({ notice: "profile_reminders", userId: p.id as string, email: p.email as string, locale, ref: `remind:${kind}`, subject: t(`admin.users.x.remind.mail.${kind}.subject`, params), body: t(body, params) });
  }
  await db.from("audit_logs").update({ changes: { kind, email } }).eq("id", mine.id);
  refresh();
  return { ok: true };
}
