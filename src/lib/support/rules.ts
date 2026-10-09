/** Support chat and team messages (BLUEPRINT §13.2 items 5–6). Pure. */

export const MESSAGE_MAX = 2000;
export const AUDIENCES = ["designers", "clients", "everyone", "one"] as const;
export type Audience = (typeof AUDIENCES)[number];
export const isAudience = (v: unknown): v is Audience => typeof v === "string" && (AUDIENCES as readonly string[]).includes(v);

/** A message as typed: line breaks kept, control characters removed, trimmed; null when empty or too long. */
export function cleanMessage(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.replace(/\r\n/g, "\n").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/\n{4,}/g, "\n\n\n").trim();
  return s.length >= 1 && s.length <= MESSAGE_MAX ? s : null;
}

/** A short one-line preview for a notification. */
export const preview = (s: string, n = 120) => {
  const one = s.replace(/\s+/g, " ").trim();
  return one.length > n ? `${one.slice(0, n - 1)}…` : one;
};
