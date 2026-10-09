import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { translatorFor } from "@/lib/content/texts";
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
      const t = await translatorFor(locale);
      const body = renderNotification({ id: "", type, data, link, read: false, createdAt: now }, t, locale, now).text;
      await notifyUser(d.id as string, { title: t("brand.name"), body, url: link });
    }
    return list.length;
  } catch (e) {
    console.error("[broadcast]", e instanceof Error ? e.message : e);
    return 0;
  }
}

/** Bell + browser push to these people, each in their own language (support chat, team messages). Never throws. */
export async function notifyWithPush(userIds: string[], type: NotificationType, data: NotificationData, link: string, actorId?: string): Promise<void> {
  const ids = [...new Set(userIds)].filter((id) => id !== actorId);
  if (!ids.length || !isSupabaseConfigured()) return;
  try {
    await notify(ids, type, data, link, actorId);
    const db = createAdminClient();
    const { data: subs } = await db.from("push_subscriptions").select("user_id").in("user_id", ids.slice(0, 5000));
    const withPush = [...new Set((subs ?? []).map((s) => s.user_id as string))];
    if (!withPush.length) return;
    const { data: people } = await db.from("profiles").select("id, locale").in("id", withPush);
    const now = new Date();
    for (const p of people ?? []) {
      const locale = p.locale === "bn" ? "bn" : "en";
      const t = await translatorFor(locale);
      const body = renderNotification({ id: "", type, data, link, read: false, createdAt: now }, t, locale, now).text;
      await notifyUser(p.id as string, { title: t("brand.name"), body, url: link });
    }
  } catch (e) {
    console.error("[notifyWithPush]", e instanceof Error ? e.message : e);
  }
}
