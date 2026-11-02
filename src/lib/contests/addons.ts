/** Add-ons a client can buy while a contest is open (BLUEPRINT §7.4, owner 2026-10-08). */
// Urgent and Highlight after launch too (owner, 2026-11-02; migration 0082).
export const ADDON_KEYS = ["promote", "urgent", "highlight", "private", "blind", "logo_scan"] as const;
export type AddonKey = (typeof ADDON_KEYS)[number];
export const isAddonKey = (v: string): v is AddonKey => (ADDON_KEYS as readonly string[]).includes(v);
