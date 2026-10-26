import "server-only";
import { leadRow } from "@/lib/admin/unpaid-leads";
import { requireEnv } from "@/lib/env";
import { awaitingApproval } from "@/lib/payments/manual";
import { isLogo } from "@/lib/services/types";
import { getSetting } from "@/lib/settings";
import { linkOrigin } from "@/lib/site-origin";
import { createAdminClient } from "@/lib/supabase/admin";
import { resumeToken, resumeUntil } from "./resume-token";

/**
 * The client's "resume contest" link (owner, 2026-10-26; see resume-token.ts): where it goes, and whether it still
 * works. Checked every time it is opened, so it stops as soon as the contest is paid, deleted or closed on the Unpaid
 * page (closed, hidden or blocked), and it only ever signs in an active client, never staff or a designer.
 */

export const resumeSecret = () => requireEnv("OTP_SECRET");

export type ResumeTarget = { contestId: string; clientId: string; brand: string; href: string; locale: "en" | "bn" };

export async function resumeTarget(contestId: string): Promise<ResumeTarget | null> {
  const db = createAdminClient();
  const { data: c } = await db.from("contests").select("id, client_id, status, brand_name, service").eq("id", contestId).maybeSingle();
  if (!c?.client_id || (c.status !== "draft" && c.status !== "pending_payment")) return null;
  const { data: p } = await db.from("profiles").select("role, status, suspended_until, deleted_at, locale").eq("id", c.client_id).maybeSingle();
  // An active client (a suspension that has run out counts as active, as everywhere else).
  const active = p?.status === "active" || (p?.status === "suspended" && p.suspended_until !== null && new Date(p.suspended_until as string).getTime() <= Date.now());
  if (!p || p.role !== "client" || !active || p.deleted_at) return null;
  // Closed on the Unpaid page (not interested, paid another way, fake), hidden or blocked: the link is dead. Before
  // migration 0076 there is no such row.
  const { data: lead, error } = await db.from("unpaid_leads").select("status, hidden, blocked").eq("contest_id", c.id).maybeSingle();
  if (error && !/PGRST205|42P01|schema cache|does not exist/.test(`${error.code} ${error.message}`)) return null;
  if (lead && (lead.status === "closed" || lead.hidden || lead.blocked)) return null;
  const id = c.id as string;
  // A bKash payment waiting for approval: its page, never a second payment.
  const waiting = (await awaitingApproval([id])).get(id);
  const href = waiting ? `/pay/contest/${waiting}` : isLogo(c.service as string | null) ? `/start?draft=${id}&step=8` : `/start?draft=${id}&step=pay`;
  return { contestId: id, clientId: c.client_id as string, brand: (c.brand_name as string | null) ?? "", href, locale: p.locale === "bn" ? "bn" : "en" };
}

/**
 * A fresh link for this contest, on the site's own address (emails only make own-site links into buttons), in the
 * client's language (?lang=bn also sets the wizard's).
 */
export async function resumeLink(contestId: string, now = new Date(), locale: "en" | "bn" = "en"): Promise<string> {
  const days = await getSetting("security.resume_link_days");
  return `${await linkOrigin()}/r/${resumeToken(resumeSecret(), contestId, resumeUntil(now, days))}${locale === "bn" ? "?lang=bn" : ""}`;
}

/** "Copied the resume link" (an admin) or "Opened the resume link" (the client) in the lead's History. Never throws. */
export async function noteResume(contestId: string, event: "resume_link" | "resume_opened", adminId: string | null): Promise<void> {
  try {
    const lead = await leadRow(`c:${contestId}`);
    if (!lead || lead === "missing") return;
    await createAdminClient().from("lead_activities").insert({ lead_id: lead.row.id, admin_id: adminId, kind: "system", event });
  } catch (e) {
    console.error("[resume] note:", e instanceof Error ? e.message : e);
  }
}
