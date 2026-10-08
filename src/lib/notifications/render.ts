import { timeAgo } from "@/lib/dates";
import type { Locale } from "@/lib/i18n/config";
import type { Translate } from "@/lib/i18n/translate";
import type { AppNotification, NotificationType } from "./index";

export type ShownNotification = { id: string; type: NotificationType; text: string; ago: string; link: string | null; read: boolean };

/** The text and "time ago" of a notification in the reader's language. */
export function renderNotification(n: AppNotification, t: Translate, locale: Locale, now: Date): ShownNotification {
  const fmt = (v: number | undefined) => (typeof v === "number" ? new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US").format(v) : "");
  const text = t(`notifications.types.${n.type}`, {
    brand: n.data.brand ?? "",
    number: fmt(n.data.number),
    stars: fmt(n.data.stars),
    days: fmt(n.data.days),
  });
  return { id: n.id, type: n.type, text, ago: timeAgo(n.createdAt, now, locale), link: n.link, read: n.read };
}
