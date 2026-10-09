import "server-only";
import { cookies } from "next/headers";
import type { Locale } from "@/lib/i18n/config";
import { getSettings } from "@/lib/settings";
import { NOTICE_COOKIE, noticeId, type Notice } from "./notice-rules";

/** The notice bar for this visitor, or null when it's off, empty, or closed today (BLUEPRINT §13.1). */
export async function currentNotice(locale: Locale): Promise<Notice | null> {
  const s = await getSettings(["notice.on", "notice.text_en", "notice.text_bn", "notice.link", "notice.tone"]);
  const text = ((locale === "bn" && s["notice.text_bn"]) || s["notice.text_en"]).trim();
  if (!s["notice.on"] || !text) return null;
  const id = noticeId(s["notice.text_en"], s["notice.text_bn"], s["notice.link"]);
  if ((await cookies()).get(NOTICE_COOKIE)?.value === id) return null;
  return { id, text, link: s["notice.link"], tone: s["notice.tone"] };
}
