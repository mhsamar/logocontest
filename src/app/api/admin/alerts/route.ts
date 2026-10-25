import { NextResponse, type NextRequest } from "next/server";
import { adminUser } from "@/lib/admin/core";
import { hasPermission } from "@/lib/admin/permissions";
import { ALERT_EVENTS, EVENT_TYPES, eventOf, inQuietHours, type AlertPop } from "@/lib/admin/unpaid-alert-rules";
import { getI18n } from "@/lib/i18n/server";
import { listNotifications, unreadCount, type AppNotification, type NotificationData, type NotificationType } from "@/lib/notifications";
import { renderNotification } from "@/lib/notifications/render";
import { getSettings } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The admin panel's bell list and the unpaid pop-ups (owner, 2026-10-26; Design/unpaid-contests §2): the admin's own
 * latest notifications, and with ?after=<time> the unpaid alerts that came in since, to pop up (not in quiet hours, and
 * only the events switched on). A plain GET every few seconds, so it never waits in line with the admin's clicks. In the
 * panel's language. A tab that was hidden or asleep doesn't pop up what came in meanwhile: that is in the bell.
 */

/** Pop-ups only for what arrived in the last minute (a tab back from sleep starts fresh). */
const POP_WINDOW_MS = 60_000;

const leadKey = (data: NotificationData, link: string | null) => data.lead ?? link?.match(/[?&]sel=([cgl]:[0-9a-f-]{36})/i)?.[1] ?? null;

export async function GET(req: NextRequest) {
  const user = await adminUser();
  if (!user) return NextResponse.json(null, { status: 401 });
  const now = new Date();
  const { t, locale } = await getI18n();
  const [list, unread] = await Promise.all([listNotifications(user.id, 10), unreadCount(user.id)]);
  const items = list.map((n) => renderNotification(n, t, locale, now, "admin"));
  let pops: AlertPop[] = [];
  let sound = false;
  const asked = Date.parse(req.nextUrl.searchParams.get("after") ?? "");
  const after = Number.isFinite(asked) ? Math.max(asked, now.getTime() - POP_WINDOW_MS) : NaN;
  if (hasPermission(user, "unpaid.view") && Number.isFinite(after)) {
    const alerts = (await getSettings(["notify.unpaid_alerts"]))["notify.unpaid_alerts"];
    const quiet = inQuietHours(alerts.quiet, now);
    const types = ALERT_EVENTS.filter((e) => alerts.events[e]).flatMap((e) => EVENT_TYPES[e]);
    sound = alerts.send.sound && !quiet;
    if (alerts.send.popup && !quiet && types.length) {
      const { data } = await createAdminClient()
        .from("notifications")
        .select("id, type, data, link, read_at, created_at")
        .eq("user_id", user.id)
        .in("type", types)
        .is("read_at", null)
        .gt("created_at", new Date(after).toISOString())
        .order("created_at", { ascending: false })
        .limit(5);
      // A follow-up whose owner chose "Remind me by" without Admin alert stays in the bell only.
      pops = (data ?? []).filter((r) => (r.data as NotificationData | null)?.pop !== false).reverse().map((r) => {
        const n: AppNotification = { id: r.id as string, type: r.type as NotificationType, data: (r.data ?? {}) as NotificationData, link: (r.link as string | null) ?? null, read: false, createdAt: new Date(r.created_at as string) };
        const event = eventOf(n.type) ?? "new_unpaid";
        return { id: n.id, event, title: t(`admin.unpaid.alerts.pop.${event}`), line: renderNotification(n, t, locale, now).text, key: leadKey(n.data, n.link), link: n.link, at: n.createdAt.toISOString() };
      });
    }
  }
  return NextResponse.json({ now: now.toISOString(), unread, items, pops, sound, canCall: hasPermission(user, "unpaid.manage") }, { headers: { "Cache-Control": "no-store" } });
}
