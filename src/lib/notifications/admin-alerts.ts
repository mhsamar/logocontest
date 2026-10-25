import "server-only";
import { adminIdsWith } from "@/lib/admin/recipients";
import type { Permission } from "@/lib/admin/permissions";
import { translatorFor } from "@/lib/content/texts";
import { emailText } from "@/lib/email/events";
import type { Locale } from "@/lib/i18n/config";
import type { MessageKey, MessageParams, Translate } from "@/lib/i18n/translate";
import { linkOrigin } from "@/lib/site-origin";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyWithPush } from "./broadcast";
import { notify, type NotificationData, type NotificationType } from "./index";

/**
 * Money waiting for the team (owner, 2026-10-22): a bKash payment to approve or a withdrawal to pay reaches every
 * admin who can act on it in the app, as a phone notification and by email, each in their own language, so nobody has
 * to open the site to notice it. Staff who may only look at it keep just the bell. Each way can be turned off in
 * Admin › Notifications (its row). Never throws. Also new clients who didn't sign up (owner, 2026-10-25).
 */
export async function alertAdmins(input: {
  /** Who can act on it: bell, phone and email. */
  permission: Permission;
  /** Who may only look at it: the bell alone. */
  bellPermission?: Permission;
  type: NotificationType;
  data: NotificationData;
  /** The admin page that handles it, e.g. /admin/payments/approvals. */
  path: string;
  /** The person who caused it (never told); none for a visitor without an account. */
  actorId?: string;
  /** Its row in Admin › Notifications. */
  notice: string;
  /** For the email log, e.g. the proof id. */
  ref: string;
  /** False: the bell and phone only (a daily email limit was reached). */
  email?: boolean;
  /** False: no phone notification (quiet hours, or turned off for these alerts). */
  push?: boolean;
  subject: MessageKey;
  body: MessageKey;
  /** The email's {placeholders}, in the reader's language; {link} is added. */
  params: (t: Translate, locale: Locale) => MessageParams;
}): Promise<void> {
  try {
    const ids = (await adminIdsWith(input.permission)).filter((id) => id !== input.actorId);
    if (input.bellPermission) {
      const lookers = (await adminIdsWith(input.bellPermission)).filter((id) => !ids.includes(id));
      await notify(lookers, input.type, input.data, input.path, input.actorId);
    }
    if (!ids.length) return;
    if (input.push === false) await notify(ids, input.type, input.data, input.path, input.actorId);
    else await notifyWithPush(ids, input.type, input.data, input.path, input.actorId);
    if (input.email === false) return;
    const { data } = await createAdminClient().from("profiles").select("id, email, locale").in("id", ids);
    const link = `${await linkOrigin()}${input.path}`;
    for (const a of data ?? []) {
      if (!a.email) continue;
      const locale: Locale = a.locale === "bn" ? "bn" : "en";
      const t = await translatorFor(locale);
      const params = { ...input.params(t, locale), link };
      await emailText({ notice: input.notice, userId: a.id as string, email: a.email as string, locale, ref: input.ref, subject: t(input.subject, params), body: t(input.body, params) });
    }
  } catch (e) {
    console.error("[admin-alerts]", e instanceof Error ? e.message : e);
  }
}
