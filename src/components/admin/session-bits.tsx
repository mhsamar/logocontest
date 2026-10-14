import Link from "next/link";
import type { SessionRow } from "@/lib/auth/sessions";
import { cx } from "@/lib/cx";
import type { MessageKey } from "@/lib/i18n/translate";
import { Pill } from "./ui";

/** Shared bits of Admin › Sign-ins, Staff activity and a user's Devices (owner, 2026-10-14). */

type T = (key: MessageKey, params?: Record<string, string | number>) => string;
type Locale = "en" | "bn";

export const whenText = (d: Date, locale: Locale) =>
  d.toLocaleString(locale === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Dhaka" });

export function durationText(seconds: number, t: T, locale: Locale): string {
  const n = (v: number) => new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US").format(v);
  const mins = Math.round(seconds / 60);
  if (mins < 60) return t("admin.security.mins", { m: n(mins) });
  return t("admin.security.hours", { h: n(Math.floor(mins / 60)), m: n(mins % 60) });
}

export function placeText(r: Pick<SessionRow, "city" | "country">, locale: Locale): string | null {
  let country = r.country;
  if (country) {
    try {
      country = new Intl.DisplayNames([locale === "bn" ? "bn" : "en"], { type: "region" }).of(country) ?? country;
    } catch {
      // keep the two letters
    }
  }
  return [r.city, country].filter(Boolean).join(", ") || null;
}

/** "Phone · Chrome on Android" */
export function deviceText(r: Pick<SessionRow, "device" | "browser" | "os">, t: T): string {
  const kind = r.device ? t(`admin.security.devices.${r.device}`) : t("admin.security.devices.unknown");
  const what = [r.browser, r.os].filter(Boolean).join(t("admin.security.on"));
  return what ? `${kind} · ${what}` : kind;
}

export function SessionStatus({ r, t, locale, now }: { r: SessionRow; t: T; locale: Locale; now: Date }) {
  if (!r.endedAt) {
    const online = now.getTime() - r.lastSeenAt.getTime() < 3 * 60_000;
    return <Pill tone={online ? "good" : "neutral"}>{online ? t("admin.security.onlineNow") : t("admin.security.signedIn")}</Pill>;
  }
  return (
    <span className="text-[13px] text-muted">
      {t(`admin.security.reasons.${r.endReason ?? "admin"}`)} · {whenText(r.endedAt, locale)}
    </span>
  );
}

/** The three log pages, one tab each: admin actions, sign-ins and (Super admin) staff activity. */
export function AuditTabs({ current, t, staff }: { current: "actions" | "signins" | "staff"; t: T; staff: boolean }) {
  const tabs = [
    { key: "actions", href: "/admin/audit", label: t("admin.security.tabs.actions") },
    { key: "signins", href: "/admin/sign-ins", label: t("admin.security.tabs.signins") },
    ...(staff ? [{ key: "staff", href: "/admin/staff-activity", label: t("admin.security.tabs.staff") }] : []),
  ];
  return (
    <nav className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none]" aria-label={t("admin.security.tabs.label")}>
      <ul className="m-0 flex w-max list-none gap-1 rounded-[14px] border border-adm-line bg-surface p-1">
        {tabs.map((x) => (
          <li key={x.key}>
            <Link
              href={x.href}
              aria-current={x.key === current ? "page" : undefined}
              className={cx("flex min-h-10 items-center rounded-[10px] px-3.5 text-[14.5px] font-semibold", x.key === current ? "bg-ink text-white" : "text-adm-strong hover:bg-adm-bg")}
            >
              {x.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
