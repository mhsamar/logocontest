import "server-only";
import type { CurrentUser } from "@/lib/auth/policies";
import { blockedTerms } from "@/lib/contests/community";
import { translatorFor } from "@/lib/content/texts";
import { linkOrigin } from "@/lib/site-origin";
import { emailText } from "@/lib/email/events";
import type { MessageKey, MessageParams } from "@/lib/i18n/translate";
import { notify } from "@/lib/notifications";
import { getSetting, getSettings } from "@/lib/settings";
import { findBadWord } from "./bad-words";
import { findContactDetails } from "./contact-filter";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Suspensions and bans (owner, 2026-10-12; migration 0041). A suspension lasts 48 hours (Settings) and ends on its
 * own: no new designs, comments or likes until then. 3 suspensions within 30 days (Settings) = permanent ban.
 */
export type MailKind = "suspended" | "banned" | "reactivated";

/** The notice by email, in the user's language, with the reason. */
export async function emailUser(userId: string, kind: MailKind, params: { reason: string; until?: string | null }) {
  const { data: p } = await createAdminClient().from("profiles").select("email, name, locale").eq("id", userId).maybeSingle();
  if (!p?.email) return;
  const lang = p.locale === "bn" ? "bn" : "en";
  const t = await translatorFor(lang);
  const until = params.until ? new Date(params.until).toLocaleString(lang === "bn" ? "bn-BD" : "en-GB", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Dhaka" }) : "";
  const s = await getSettings(["timers.strike_expiry_days", "limits.strikes_for_ban"]);
  // A security email (owner, 2026-10-15): no Unsubscribe and no daily limit. Admin › Notifications › Account status
  // decides who gets it by email (owner, 2026-10-31: clients yes, designers in the bell only).
  await emailText({
    notice: "account_status",
    userId,
    email: p.email as string,
    locale: lang,
    subject: t(`admin.users.mail.${kind}.subject`),
    body: t(`admin.users.mail.${kind}.body`, {
      name: ((p.name as string | null) ?? "").trim(),
      reason: params.reason,
      until,
      ban: s["limits.strikes_for_ban"],
      days: s["timers.strike_expiry_days"],
      link: `${await linkOrigin()}/legal/designer-rules`,
    }),
    security: true,
  });
}

export type SuspendResult = { status: "active" | "suspended" | "banned"; strikes: number; suspendedUntil: string | null };

/**
 * Suspends an account for 48 hours (one row in public.strikes); the 3rd suspension within 30 days bans it instead.
 * The user gets a notice and an email either way. Returns null when the database refused.
 */
export async function suspendUser(input: {
  userId: string;
  reason: string;
  issuedBy: string | null;
  issuerRole: "admin" | "client" | "system";
  entryId?: string | null;
  contestId?: string | null;
}): Promise<SuspendResult | null> {
  const db = createAdminClient();
  const { data, error } = await db.rpc("give_strike", {
    p_user_id: input.userId,
    p_reason: input.reason.slice(0, 300),
    p_entry_id: input.entryId ?? null,
    p_contest_id: input.contestId ?? null,
    p_issued_by: input.issuedBy,
    p_issuer_role: input.issuerRole,
    p_suspend_days: 0, // the length comes from Settings (timers.suspension_hours)
  });
  if (error || !data) {
    console.error("[suspension] give_strike failed:", error?.message);
    return null;
  }
  const p = data as { status: SuspendResult["status"]; strikes: number; suspended_until: string | null };
  await tellUser(input.userId, p.status === "banned" ? "banned" : "suspended", input.reason, p.suspended_until, input.issuedBy ?? undefined);
  return { status: p.status, strikes: p.strikes, suspendedUntil: p.suspended_until };
}

/** The in-app notice and the email for a suspension, a ban or a lifted one. */
export async function tellUser(userId: string, kind: MailKind, reason: string, until: string | null, actorId?: string) {
  const s = await getSettings(["timers.suspension_hours", "timers.strike_expiry_days", "limits.strikes_for_ban"]);
  const type = kind === "banned" ? "account_banned" : kind === "suspended" ? "account_suspended" : "account_reactivated";
  const data = { reason, hours: s["timers.suspension_hours"], days: s["timers.strike_expiry_days"], ban: s["limits.strikes_for_ban"] };
  await notify([userId], type, data, kind === "banned" ? null : "/legal/designer-rules", actorId);
  await emailUser(userId, kind, { reason, until });
}

/**
 * A designer tried to post a comment with contact details or bad words (owner, 2026-10-12): the comment is not
 * posted and the designer is suspended. Clients only see the block. Returns true when the designer was suspended.
 */
export async function suspendForComment(user: { id: string; role: string; locale: "en" | "bn" }, kind: "contact" | "abuse", where: { contestId: string; entryId?: string | null }): Promise<boolean> {
  if (user.role !== "designer") return false;
  const t = await translatorFor(user.locale);
  const res = await suspendUser({
    userId: user.id,
    reason: t(kind === "contact" ? "suspension.reasons.contact" : "suspension.reasons.abuse"),
    issuedBy: null,
    issuerRole: "system",
    contestId: where.contestId,
    entryId: where.entryId ?? null,
  });
  return res !== null;
}

export type FormError = { key: MessageKey; params?: MessageParams };

/** Why a suspended user can't send a design, comment or like right now, with the end time in their language. */
export function suspendedError(user: Pick<CurrentUser, "status" | "suspendedUntil" | "locale"> | null): FormError | null {
  if (user?.status !== "suspended") return null;
  if (!user.suspendedUntil) return { key: "suspension.blockedNoEnd" };
  const until = new Date(user.suspendedUntil).toLocaleString(user.locale === "bn" ? "bn-BD" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" });
  return { key: "suspension.blocked", params: { until } };
}

/**
 * Checks a comment before it is posted: contact details (and the admin's blocked terms) or bad words block it, and a
 * designer who tries is suspended at once. Returns the error to show, or null when the comment is fine.
 */
export async function checkComment(user: CurrentUser, body: string, where: { contestId: string; entryId?: string | null }): Promise<FormError | null> {
  // Clients are never stopped for contact details (owner, 2026-10-15); bad words still are.
  const contact = user.role === "client" ? null : findContactDetails(body, await blockedTerms());
  const bad = contact ? null : findBadWord(body);
  if (!contact && !bad) return null;
  if (await suspendForComment(user, contact ? "contact" : "abuse", where)) return { key: "suspension.commentBlocked", params: { hours: await getSetting("timers.suspension_hours") } };
  return { key: contact ? "contest.comments.contact" : "contest.comments.abuse" };
}
