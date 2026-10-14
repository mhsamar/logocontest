/**
 * What a login came from (owner, 2026-10-14: Admin › Sign-ins): the kind of device, the browser and the system, read
 * from the browser's user agent, and the place from the host's request headers (Vercel). Pure, so it can be tested.
 */

export type DeviceInfo = { device: "mobile" | "tablet" | "desktop"; browser: string | null; os: string | null };

export function deviceFromUserAgent(ua: string | null | undefined): DeviceInfo {
  const s = ua ?? "";
  const tablet = /iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(s);
  const mobile = !tablet && /Mobi|iPhone|iPod|Android|Windows Phone|Opera Mini/i.test(s);
  const browser = /Edg\//.test(s)
    ? "Edge"
    : /OPR\/|Opera/.test(s)
      ? "Opera"
      : /SamsungBrowser/.test(s)
        ? "Samsung Internet"
        : /UCBrowser/.test(s)
          ? "UC Browser"
          : /Firefox\/|FxiOS/.test(s)
            ? "Firefox"
            : /Chrome\/|CriOS/.test(s)
              ? "Chrome"
              : /Safari\//.test(s)
                ? "Safari"
                : null;
  const os = /Windows NT/.test(s)
    ? "Windows"
    : /iPhone|iPad|iPod/.test(s)
      ? "iOS"
      : /Android/.test(s)
        ? "Android"
        : /Mac OS X|Macintosh/.test(s)
          ? "macOS"
          : /CrOS/.test(s)
            ? "ChromeOS"
            : /Linux/.test(s)
              ? "Linux"
              : null;
  return { device: tablet ? "tablet" : mobile ? "mobile" : "desktop", browser, os };
}

/** The visitor's IP address (the first one the host saw). */
export function ipFrom(forwardedFor: string | null | undefined, realIp?: string | null): string | null {
  const first = (forwardedFor ?? "").split(",")[0]?.trim() || (realIp ?? "").trim();
  return first ? first.slice(0, 64) : null;
}

/** "Dhaka" from the host's URL-encoded city header. */
export function cityFrom(header: string | null | undefined): string | null {
  if (!header) return null;
  try {
    return decodeURIComponent(header).slice(0, 80) || null;
  } catch {
    return header.slice(0, 80);
  }
}
