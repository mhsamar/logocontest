import { contestHref } from "@/lib/client/rules";
import type { Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/lang-path";
import type { Translate } from "@/lib/i18n/translate";
import type { BriefCompletion } from "@/lib/onboarding/brief-defaults";

/**
 * Onboarding v2's two client emails (owner, 2026-10-29; client-onboarding-v2-spec.md §2 step 4 and §3 item 3): "we got
 * your payment" when a /start-v2 contest's bKash payment is sent, and "your contest is live" when it is approved. Both
 * open the contest's page (never the /r resume link: it stops working once paid). Old contests get neither. Pure:
 * shared by events.ts and the tests.
 */

export type V2MailKind = "received" | "live";

/** Each email's own row in Admin › Notifications (on at first). */
export const V2_NOTICE: Record<V2MailKind, string> = { received: "onboarding_received", live: "onboarding_live" };

export type V2MailContest = { id: string; slug: string; brand: string; completion: BriefCompletion };

/** The client never changed a part of the brief nor said "keep it like this": the live email offers the brief once. */
export const briefUntouched = (c: BriefCompletion) => c.edited.length === 0 && !c.acceptedAt;

/** A link on this site in the client's language (a Bangla client's ends in ?lang=bn, as the resume link does). */
const link = (origin: string, path: string, locale: Locale) => `${origin}${localizedPath(path, locale)}`;

/**
 * One email's subject, text and button link. `minutes` is "usually within …" (setting onboarding.approval_minutes);
 * `briefLink` is false while /start-v2 is off, as the brief page would not open then.
 */
export function v2Mail(
  kind: V2MailKind,
  input: { t: Translate; locale: Locale; origin: string; contest: V2MailContest; minutes?: number; briefLink?: boolean },
): { subject: string; body: string; buttonUrl: string; ref: string } {
  const { t, locale, origin, contest: c } = input;
  const brand = c.brand.replace(/\s+/g, " ").trim();
  const buttonUrl = link(origin, contestHref(c.slug), locale);
  if (kind === "received") return { subject: t("wizardV2.email.receivedSubject", { brand }), body: t("wizardV2.email.receivedBody", { minutes: input.minutes ?? 30 }), buttonUrl, ref: `v2-received:${c.id}` };
  const lines = [t("wizardV2.email.liveBody")];
  // Spec §3 item 3: the brief line only when it still runs on the defaults; no other brief reminders after this.
  if (input.briefLink && briefUntouched(c.completion)) lines.push("", t("wizardV2.email.briefNote"), `${t("wizardV2.email.brief")}: ${link(origin, `/start-v2/brief?c=${c.id}`, locale)}`);
  return { subject: t("wizardV2.email.liveSubject", { brand }), body: lines.join("\n"), buttonUrl, ref: `v2-live:${c.id}` };
}
