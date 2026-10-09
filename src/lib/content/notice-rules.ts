/** Notice bar (BLUEPRINT §13.1): shared by the server, the close button and the admin preview. */

export type NoticeTone = "info" | "warning" | "offer";
export type Notice = { id: string; text: string; link: string; tone: NoticeTone };

export const NOTICE_COOKIE = "lc_notice_closed";

/** A short id for one version of the notice, so closing it hides only that version. */
export function noticeId(...parts: string[]): string {
  let h = 5381;
  for (const ch of parts.join("\u0000")) h = ((h << 5) + h + ch.codePointAt(0)!) >>> 0;
  return h.toString(36);
}

export const NOTICE_TONES: Record<NoticeTone, string> = {
  info: "bg-ink text-white",
  warning: "bg-[#fde68a] text-[#713f12]",
  offer: "bg-primary text-white",
};

export const isExternal = (link: string) => /^https:\/\//.test(link);
