import { timeAgo } from "@/lib/dates";
import type { Locale } from "@/lib/i18n/config";
import type { Translate } from "@/lib/i18n/translate";
import { categoryOf, type NotificationCategory } from "./categories";
import type { AppNotification } from "./index";
import type { NotificationType } from "./types";

/** "2026-09" → "September 2026" in the reader's language. */
export function monthLabel(month: string, locale: Locale): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString(locale === "bn" ? "bn-BD" : "en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

export type ShownNotification = { id: string; type: NotificationType; category: NotificationCategory; text: string; ago: string; link: string | null; read: boolean };

/** The text and "time ago" of a notification in the reader's language. */
export function renderNotification(n: AppNotification, t: Translate, locale: Locale, now: Date): ShownNotification {
  const fmt = (v: number | undefined) => (typeof v === "number" ? new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US").format(v) : "");
  const text = t(`notifications.types.${n.type}`, {
    brand: n.data.brand ?? "",
    number: fmt(n.data.number),
    stars: fmt(n.data.stars),
    days: fmt(n.data.days),
    hours: fmt(n.data.hours),
    amount: typeof n.data.amount === "number" ? `৳${fmt(n.data.amount)}` : "",
    reason: n.data.reason ?? "",
    name: n.data.name ?? "",
    month: n.data.month ? monthLabel(n.data.month, locale) : "",
  });
  return { id: n.id, type: n.type, category: categoryOf(n.type), text, ago: timeAgo(n.createdAt, now, locale), link: n.link, read: n.read };
}
