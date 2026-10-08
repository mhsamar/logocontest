/** Add-ons a client can buy while a contest is open (BLUEPRINT §7.4, owner 2026-10-08). */
export const ADDON_KEYS = ["promote", "private", "blind", "logo_scan"] as const;
export type AddonKey = (typeof ADDON_KEYS)[number];
export const isAddonKey = (v: string): v is AddonKey => (ADDON_KEYS as readonly string[]).includes(v);
