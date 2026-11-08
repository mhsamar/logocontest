import type { Locale } from "@/lib/i18n/config";
import type { Translate } from "@/lib/i18n/translate";
import { formatNumber } from "@/lib/money";

const ZONE = "Asia/Dhaka";

/** The day (YYYY-MM-DD) and time of a moment in Bangladesh. */
function dhaka(d: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  return { day: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour), minute: Number(parts.minute) };
}

/** "রাত ৯:১০" / "9:10 pm": the part of the day in Bangla, as people say it. */
export function timeLabel(d: Date, locale: Locale): string {
  const { hour, minute } = dhaka(d);
  const h12 = hour % 12 || 12;
  const mm = String(minute).padStart(2, "0");
  if (locale !== "bn") return `${h12}:${mm} ${hour < 12 ? "am" : "pm"}`;
  const part = hour >= 4 && hour < 6 ? "ভোর" : hour >= 6 && hour < 12 ? "সকাল" : hour >= 12 && hour < 15 ? "দুপুর" : hour >= 15 && hour < 18 ? "বিকেল" : hour >= 18 && hour < 20 ? "সন্ধ্যা" : "রাত";
  return `${part} ${formatNumber(h12, "bn")}:${mm.replace(/\d/g, (c) => "০১২৩৪৫৬৭৮৯"[Number(c)])}`;
}

/** "গতকাল, রাত ৯:১০", "আজ, সকাল ১০:০৫" or a date with the time, in Bangladesh time. */
export function whenLabel(iso: string, t: Translate, locale: Locale, now: Date = new Date()): string {
  const d = new Date(iso);
  const day = dhaka(d).day;
  const today = dhaka(now).day;
  const yesterday = dhaka(new Date(now.getTime() - 86_400_000)).day;
  const time = timeLabel(d, locale);
  if (day === today) return t("briefV3.when.todayAt", { time });
  if (day === yesterday) return t("briefV3.when.yesterdayAt", { time });
  const date = new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { timeZone: ZONE, day: "numeric", month: "long" }).format(d);
  return `${date}, ${time}`;
}

/** Only the day: "আজ", "গতকাল" or the date (the designers' "New update · …"). */
export function dayLabel(iso: string, t: Translate, locale: Locale, now: Date = new Date()): string {
  const d = new Date(iso);
  const day = dhaka(d).day;
  if (day === dhaka(now).day) return t("briefV3.when.today");
  if (day === dhaka(new Date(now.getTime() - 86_400_000)).day) return t("briefV3.when.yesterday");
  return new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { timeZone: ZONE, day: "numeric", month: "long" }).format(d);
}
