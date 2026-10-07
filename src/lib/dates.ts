import type { Locale } from "@/lib/i18n/config";

/** "12 October 2026"; `short` is "12 Oct"; `month` is "October 2026". */
export function formatDate(d: Date, locale: Locale, style: "long" | "short" | "month" = "long"): string {
  const options: Intl.DateTimeFormatOptions =
    style === "month"
      ? { month: "long", year: "numeric" } // "October 2026"
      : { day: "numeric", month: style === "long" ? "long" : "short", ...(style === "long" ? { year: "numeric" } : {}) };
  return new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { ...options, timeZone: "Asia/Dhaka" }).format(d);
}

/** "2 days ago" / "২ দিন আগে", in the largest whole unit (minutes up to months). */
export function timeAgo(d: Date, now: Date, locale: Locale): string {
  const tag = locale === "bn" ? "bn-BD" : "en";
  // "always" keeps "2 days ago" instead of words like "day before yesterday".
  const rtf = new Intl.RelativeTimeFormat(tag, { numeric: "always" });
  const minutes = Math.round((d.getTime() - now.getTime()) / 60_000);
  if (minutes === 0) return new Intl.RelativeTimeFormat(tag, { numeric: "auto" }).format(0, "second");
  if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(hours, "hour");
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return rtf.format(days, "day");
  return rtf.format(Math.round(days / 30), "month");
}
