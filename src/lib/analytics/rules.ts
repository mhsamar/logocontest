/** Visit tracking (BLUEPRINT §13.2 item 3). Pure helpers shared by the tracking route and the tests. */

export const VISITOR_COOKIE = "lc_vid";
/** Someone counts as "online now" when their page pinged within this time. */
export const ONLINE_MS = 2 * 60 * 1000;
export const HEARTBEAT_MS = 30 * 1000;
export const PAGE_VIEW_DAYS = 180;

export type Device = "mobile" | "tablet" | "desktop";

export const isBot = (ua: string) => /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|preview|headless|lighthouse|monitor/i.test(ua);

export function deviceOf(ua: string): Device {
  if (/ipad|tablet|kindle|silk|playbook/i.test(ua) || (/android/i.test(ua) && !/mobile/i.test(ua))) return "tablet";
  if (/mobi|iphone|ipod|android|opera mini|iemobile/i.test(ua)) return "mobile";
  return "desktop";
}

/** Only public pages are counted: never the admin panel, APIs or dev pages. Query strings are dropped. */
export function trackablePath(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//")) return null;
  const path = raw.split(/[?#]/)[0].slice(0, 300);
  if (/^\/(admin|api|dev|_next|auth)(\/|$)/.test(path)) return null;
  return path;
}

/** The site a visitor came from (just its host), or null for direct visits and our own pages. */
export function referrerHost(raw: unknown, ownHost: string | null): string | null {
  if (typeof raw !== "string" || !raw) return null;
  try {
    const host = new URL(raw).hostname.replace(/^www\./, "").toLowerCase();
    if (!host || (ownHost && host === ownHost.replace(/^www\./, "").toLowerCase())) return null;
    return host.slice(0, 300);
  } catch {
    return null;
  }
}

export const countryOf = (raw: string | null) => (raw && /^[A-Z]{2}$/.test(raw) && raw !== "XX" ? raw : null);
export const isUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
