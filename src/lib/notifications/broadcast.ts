import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { MESSAGES } from "@/lib/i18n/messages";
import { createTranslator } from "@/lib/i18n/translate";
import { notifyUser } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify, type NotificationData, type NotificationType } from "./index";
import { renderNotification } from "./render";

/**
 * Tells every active designer (owner, 2026-10-09): in-app for all, plus a browser push for those who allowed it,
 * written in each designer's own language. Never throws.
 */
export async function broadcastToDesigners(type: NotificationType, data: NotificationData, link: string, except: string[] = []): Promise<number> {
  if (!isSupabaseConfigured()) return 0;
  try {
    const db = createAdminClient();
    const { data: designers } = await db.from("profiles").select("id, locale").eq("role", "designer").eq("status", "active");
    const list = (designers ?? []).filter((d) => !except.includes(d.id as string));
    await notify(list.map((d) => d.id as string), type, data, link);

    const { data: subs } = list.length ? await db.from("push_subscriptions").select("user_id").in("user_id", list.map((d) => d.id as string)) : { data: [] };
    const withPush = new Set((subs ?? []).map((s) => s.user_id as string));
    const now = new Date();
    for (const d of list) {
      if (!withPush.has(d.id as string)) continue;
      const locale = d.locale === "bn" ? "bn" : "en";
      const t = createTranslator(locale, MESSAGES[locale]);
      const body = renderNotification({ id: "", type, data, link, read: false, createdAt: now }, t, locale, now).text;
      await notifyUser(d.id as string, { title: t("brand.name"), body, url: link });
    }
    return list.length;
  } catch (e) {
    console.error("[broadcast]", e instanceof Error ? e.message : e);
    return 0;
  }
}
