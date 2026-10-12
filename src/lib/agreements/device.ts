/**
 * "Chrome · Android phone" from the browser text saved when the designer signed (owner, 2026-10-12). Only reads
 * what was already recorded; nothing new is collected. Null when there is nothing to show.
 */
export const DEVICE_KINDS = ["ipad", "iphone", "androidPhone", "androidTablet", "windows", "mac", "linux", "other"] as const;
export type DeviceKind = (typeof DEVICE_KINDS)[number];
/** The browser is a name ("Chrome"); the device is a kind, shown in the reader's language. */
export type Device = { browser: string; device: DeviceKind };

export function describeDevice(userAgent: string | null | undefined): Device | null {
  const ua = (userAgent ?? "").trim();
  if (!ua) return null;
  const browser = /EdgA?\//.test(ua)
    ? "Edge"
    : /SamsungBrowser\//.test(ua)
      ? "Samsung Internet"
      : /OPR\/|Opera/.test(ua)
        ? "Opera"
        : /Firefox\/|FxiOS\//.test(ua)
          ? "Firefox"
          : /CriOS\/|Chrome\//.test(ua)
            ? "Chrome"
            : /Safari\//.test(ua)
              ? "Safari"
              : "Other browser";
  const device: DeviceKind = /iPad/.test(ua)
    ? "ipad"
    : /iPhone/.test(ua)
      ? "iphone"
      : /Android/.test(ua)
        ? /Mobile/.test(ua)
          ? "androidPhone"
          : "androidTablet"
        : /Windows/.test(ua)
          ? "windows"
          : /Macintosh|Mac OS X/.test(ua)
            ? "mac"
            : /Linux/.test(ua)
              ? "linux"
              : "other";
  return { browser, device };
}
