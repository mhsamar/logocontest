/* eslint-disable @next/next/no-img-element */
import type { Translate } from "@/lib/i18n/translate";

/** Line icons for the Pro pages (24×24, stroked with the current colour). */
const PATHS = {
  crown: <path d="M3.5 8.5 7.5 12l4.5-6.5 4.5 6.5 4-3.5-1.8 9.5H5.3ZM5.5 20.5h13" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  lock: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  clock: <path d="M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />,
  bell: <path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9ZM10 20a2 2 0 0 0 4 0" />,
  chat: <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.7A8 8 0 1 1 21 12Z" />,
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  wallet: <path d="M3 7h18v12H3ZM3 11h18M16 15h2" />,
  user: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 20a8 8 0 0 1 16 0" />,
  gear: <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4.9a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.5a7 7 0 0 0-2 1.2l-2.4-.9-2 3.4 2 1.6a7 7 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-.9a7 7 0 0 0 2 1.2L10 21h4l.5-2.5a7 7 0 0 0 2-1.2l2.4.9 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z" />,
  help: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5h.01" />,
  grid: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.6" />
    </>
  ),
  heart: <path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 7.9 3.6 4.5 7 4.5c2 0 3.6 1.2 5 3 1.4-1.8 3-3 5-3 3.4 0 5.6 3.4 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2Z" />,
  search: <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4" />,
  mail: <path d="M3.5 5.5h17v13h-17ZM3.5 6l8.5 7 8.5-7" />,
  phone: <path d="M5 3.5h3.5l1.8 4.5-2.3 1.4a11 11 0 0 0 6.6 6.6l1.4-2.3 4.5 1.8V19a1.5 1.5 0 0 1-1.6 1.5A17 17 0 0 1 3.5 5.1 1.5 1.5 0 0 1 5 3.5Z" />,
  upload: <path d="M12 15V3M7 8l5-5 5 5M5 21h14" />,
  file: <path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8ZM14 3v5h5" />,
  clip: <path d="M20 11.5 12.4 19a5 5 0 0 1-7.1-7.1l7.6-7.6a3.3 3.3 0 0 1 4.7 4.7L10 16.6a1.7 1.7 0 0 1-2.4-2.4l7-7" />,
  star: <path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7Z" />,
  bolt: <path d="M13 2 4 14h7l-1 8 9-12h-7Z" />,
  shield: <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6zM9 12l2.2 2.2L15.5 10" />,
  eye: <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />,
  image: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <path d="M3.5 16l5-5 4 4 3-3 5 5M15 9.5h.01" />
    </>
  ),
  send: <path d="M21 3 10 14M21 3l-7 18-4-7-7-4Z" />,
  share: <path d="M12 3v13M7 8l5-5 5 5M5 14v5.5h14V14" />,
  download: <path d="M12 3v13M7 11l5 5 5-5M5 20.5h14" />,
  trophy: <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0ZM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4" />,
  invite: <path d="M15 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 3 17.5V19M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM19 8v6M22 11h-6" />,
  sparkle: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />,
};
export type ProIconName = keyof typeof PATHS;

export function Icon({ name, size = 18, className, strokeWidth = 2.2 }: { name: ProIconName; size?: number; className?: string; strokeWidth?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      {PATHS[name]}
    </svg>
  );
}

/** The gold-red "PRO" badge. */
export function ProBadge({ label = "PRO", size, light }: { label?: string; size?: "sm"; light?: boolean }) {
  return (
    <span className={`pr-badge${size === "sm" ? " sm" : ""}${light ? " lt" : ""}`}>
      <Icon name="crown" size={size === "sm" ? 10 : 13} strokeWidth={2.4} />
      {label}
    </span>
  );
}

/** Round photo with the turning gold ring (or the first letter). */
export function ProAvatar({ name, url, large }: { name: string; url: string | null; large?: boolean }) {
  return (
    <span className={`pr-av${large ? " lg" : ""}`}>
      <span className="ring" aria-hidden />
      {url ? <img src={url} alt="" /> : <b>{(name.trim()[0] ?? "?").toUpperCase()}</b>}
    </span>
  );
}

export function SmallAvatar({ name, url }: { name: string; url: string | null }) {
  return <span className="pr-sa">{url ? <img src={url} alt="" /> : (name.trim()[0] ?? "?").toUpperCase()}</span>;
}

/** "1h 20m", "45m", "3 days" in the reader's language. */
export function durationText(minutes: number, t: Translate): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return t("pro.time.m", { n: m });
  if (m < 48 * 60) {
    const h = Math.floor(m / 60);
    const r = m % 60;
    return r ? t("pro.time.hm", { h, m: r }) : t("pro.time.h", { n: h });
  }
  const d = Math.round(m / (24 * 60));
  return d === 1 ? t("pro.time.d1") : t("pro.time.d", { n: d });
}

/** A thin progress bar (used / max). */
export function Slot({ used, max }: { used: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
  return (
    <span className="pr-slot" role="presentation">
      <s style={{ width: `${pct}%` }} />
    </span>
  );
}
