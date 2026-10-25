import "server-only";
import { hiddenUnpaidIds, notIn } from "./unpaid-hidden";
import { cache } from "react";
import type { CurrentUser } from "@/lib/auth/policies";
import { facebookConfigured } from "@/lib/cards/facebook";
import { isSupabaseConfigured } from "@/lib/env";
import { getSetting, getSettings } from "@/lib/settings";
import { wizardLeads } from "./leads";
import { monthKey, previousMonth } from "@/lib/rewards/rules";
import { startOfDhakaDay } from "@/lib/studio/options";
import { createAdminClient } from "@/lib/supabase/admin";
import { ADMIN_NEW, canSeeItem, freshItem, type AdminBadge, type AdminNew } from "./nav";
import { hasPermission } from "./permissions";

/**
 * Menu counts (owner, 2026-10-23). Red: work waiting for the team. Gold: what is new since this admin last looked at
 * the section's page (admin_seen, migration 0073); before the first visit, since the start of today (Dhaka). Each gold
 * count counts the same kind of rows its page tags "New" (Activity shows the latest 80 in its period, so a big backlog
 * can be counted beyond what is on screen).
 */
export type AdminCounts = { todo: Record<AdminBadge, number>; fresh: Record<AdminNew, number> };

const TODO_ZERO: Record<AdminBadge, number> = { reports: 0, claims: 0, withdrawals: 0, support: 0, approvals: 0, designs: 0, refunds: 0, copyright: 0, agreements: 0, cards: 0, monthly: 0 };
const FRESH_ZERO = Object.fromEntries(ADMIN_NEW.map((k) => [k, 0])) as Record<AdminNew, number>;
const head = { count: "exact" as const, head: true };
const n = (r: { count: number | null } | null) => r?.count ?? 0;

/** Red counts, only for the queues this admin may see. */
async function todoCounts(user: CurrentUser): Promise<Record<AdminBadge, number>> {
  if (!isSupabaseConfigured()) return { ...TODO_ZERO };
  const db = createAdminClient();
  const may = (p: Parameters<typeof hasPermission>[1]) => hasPermission(user, p);
  // Contest cards wait for the team only when they don't go out by themselves.
  const cards = may("autoshare.view") ? await getSettings(["cards.auto_post", "cards.check_first"]) : null;
  const cardsByHand = cards ? !(cards["cards.auto_post"] && !cards["cards.check_first"] && facebookConfigured()) : false;
  // The months the Monthly winner page can approve: this one and last one.
  const thisMonth = monthKey(new Date());
  const [r, c, w, s, a, d, g, f, ag, cw, mw, mc] = await Promise.all([
    may("reports.view") ? db.from("reports").select("id", head).eq("status", "open") : null,
    may("claims.view") ? db.from("copy_claims").select("id", head).eq("status", "open") : null,
    may("withdrawals.view") ? db.from("withdrawals").select("id", head).eq("status", "requested") : null,
    may("support.view") ? db.from("support_threads").select("id", head).eq("status", "open").gt("unread_by_admin", 0) : null,
    may("payments.view") ? db.from("manual_payments").select("id", head).eq("status", "pending") : null,
    // Designs the design check held (owner, 2026-10-15; migration 0061).
    may("designs.view") ? db.from("entries").select("id", head).eq("status", "held") : null,
    // Money-back claims (owner, 2026-10-21): waiting for a decision, or approved and not paid yet.
    may("refunds.view") ? db.from("guarantee_claims").select("id", head).in("status", ["pending", "approved"]) : null,
    // High copyright matches waiting for keep or remove.
    may("copyright.view") ? db.from("logo_check_flags").select("id", head).eq("status", "open") : null,
    may("agreements.view") ? db.from("designer_agreements").select("designer_id", head).eq("review_status", "needs_review") : null,
    cardsByHand ? db.from("contest_cards").select("id", head).eq("status", "waiting") : null,
    // A month waiting for the owner's OK, and winners who claimed a prize nobody has contacted them about yet.
    may("monthly.view") ? db.from("reward_months").select("month", head).eq("status", "waiting_approval").eq("is_test", false).in("month", [thisMonth, previousMonth(thisMonth)]) : null,
    may("monthly.view") ? db.from("monthly_rewards").select("id", head).eq("status", "claimed").eq("is_test", false) : null,
  ]);
  return {
    reports: n(r),
    claims: n(c),
    withdrawals: n(w),
    support: n(s),
    approvals: n(a),
    designs: n(d),
    refunds: n(g),
    copyright: n(f),
    agreements: n(ag),
    cards: n(cw),
    monthly: n(mw) + n(mc),
  };
}

/** When this admin last opened each section; null when the table isn't there yet (before migration 0073). */
const seenTimes = cache(async (adminId: string): Promise<Partial<Record<AdminNew, string>> | null> => {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await createAdminClient().from("admin_seen").select("section, seen_at").eq("admin_id", adminId);
  if (error) return null;
  return Object.fromEntries((data ?? []).map((r) => [r.section as string, r.seen_at as string]));
});

/**
 * This admin opened a section's own page (owner, 2026-10-23): rows after `since` get a "New" tag, and the look is
 * recorded, which clears the section's gold count. Pages opened again within timers.admin_visit_minutes are the same
 * visit, so filters, reloads, a row opened and back, or page 2 keep the same tags. One database call
 * (admin_seen_visit, migration 0073); before the migration, no tags and nothing recorded.
 */
export async function sectionVisit(user: CurrentUser, key: AdminNew): Promise<{ since: Date | null; at: string | null }> {
  const item = freshItem(key);
  if (!isSupabaseConfigured() || !item || !canSeeItem(user, item)) return { since: null, at: null };
  const gap = await getSetting("timers.admin_visit_minutes").catch(() => 30);
  const { data, error } = await createAdminClient().rpc("admin_seen_visit", { p_admin: user.id, p_section: key, p_gap_minutes: gap, p_first: startOfDhakaDay() });
  // `at`: when the look was recorded, for the menu (SeenNow); none when nothing was recorded.
  return error || !data ? { since: null, at: null } : { since: new Date(data as string), at: new Date().toISOString() };
}

async function freshCount(user: CurrentUser, key: AdminNew, since: string): Promise<number> {
  const db = createAdminClient();
  switch (key) {
    case "contests": {
      // Contests that went live (were paid): starts_at is set when the payment is confirmed.
      const r = await db.from("contests").select("id", head).not("status", "in", "(draft,pending_payment,deleted)").gt("starts_at", since);
      return n(r);
    }
    case "unpaid": {
      // The wizard leads exactly as the page lists them (one per number, not signed up), new ones by first contact.
      // Drafts closed as fake and hidden don't count (owner, 2026-10-25).
      const hidden = notIn(await hiddenUnpaidIds());
      const fresh = db.from("contests").select("id", head).in("status", ["draft", "pending_payment"]).gt("created_at", since);
      const [contests, leads] = await Promise.all([hidden ? fresh.not("id", "in", hidden) : fresh, wizardLeads()]);
      return n(contests) + leads.filter((l) => l.createdAt.getTime() > Date.parse(since)).length;
    }
    case "designs": {
      // As the Designs page: winning, held and removed designs show their own status instead of "New".
      const r = await db.from("entries").select("id", head).not("status", "in", "(removed,held,winner)").gt("created_at", since);
      return n(r);
    }
    case "users": {
      const r = await db.from("profiles").select("id", head).neq("status", "deleted").gt("created_at", since);
      return n(r);
    }
    case "payments": {
      const r = await db.from("payments").select("id", head).eq("status", "paid").gt("paid_at", since);
      return n(r);
    }
    case "pro": {
      // Payments as the Pro page logs them (paid, renewed), and new trials.
      const [paid, trials] = await Promise.all([
        db.from("pro_activity_log").select("id", head).in("action", ["paid", "renewed"]).gt("created_at", since),
        db.from("pro_trials").select("designer_id", head).gt("started_at", since),
      ]);
      return n(paid) + n(trials);
    }
    case "trash": {
      // Moved to the Trash by someone else, or by the site itself (unpaid contests after a few days). Accounts only for
      // admins who see them there (Users).
      const byOthers = `deleted_by.is.null,deleted_by.neq.${user.id}`;
      const [contests, people] = await Promise.all([
        db.from("contests").select("id", head).eq("status", "deleted").gt("deleted_at", since).or(byOthers),
        hasPermission(user, "users.view") ? db.from("profiles").select("id", head).eq("status", "deleted").gt("deleted_at", since).or(byOthers) : null,
      ]);
      return n(contests) + n(people);
    }
    case "activity": {
      // The same events as the Activity feed.
      const rows = await Promise.all([
        db.from("profiles").select("id", head).in("role", ["client", "designer"]).gt("created_at", since),
        db.from("contests").select("id", head).gt("created_at", since),
        db.from("payments").select("id", head).eq("purpose", "contest").eq("status", "paid").gt("paid_at", since),
        db.from("entries").select("id", head).gt("created_at", since),
        db.from("entry_comments").select("id", head).gt("created_at", since),
        db.from("contest_comments").select("id", head).gt("created_at", since),
        db.from("handovers").select("id", head).gt("approved_at", since),
        db.from("withdrawals").select("id", head).gt("created_at", since),
      ]);
      return rows.reduce((sum, r) => sum + n(r), 0);
    }
    case "audit": {
      // What the rest of the team did (this admin's own actions and the site's jobs are left out).
      const r = await db.from("audit_logs").select("id", head).gt("created_at", since).not("admin_id", "is", null).neq("admin_id", user.id);
      return n(r);
    }
  }
}

/** Gold counts for the sections this admin may see. */
async function freshCounts(user: CurrentUser): Promise<Record<AdminNew, number>> {
  if (!isSupabaseConfigured()) return { ...FRESH_ZERO };
  const seen = await seenTimes(user.id);
  if (!seen) return { ...FRESH_ZERO };
  const today = startOfDhakaDay();
  const keys = ADMIN_NEW.filter((k) => {
    const item = freshItem(k);
    return item ? canSeeItem(user, item) : false;
  });
  const counts = await Promise.all(keys.map((k) => freshCount(user, k, seen[k] ?? today).catch(() => 0)));
  return { ...FRESH_ZERO, ...Object.fromEntries(keys.map((k, i) => [k, counts[i]])) };
}

/**
 * The red counts, for the layout. Only these run on every server render (router.refresh() included); the gold ones
 * load in the browser once a minute (/api/admin/counts).
 */
export const menuTodoCounts = cache((user: CurrentUser) => todoCounts(user).catch(() => ({ ...TODO_ZERO })));

/** Both kinds of count: the Dashboard card and the once-a-minute update. */
export const adminCounts = cache(async (user: CurrentUser): Promise<AdminCounts> => {
  const [todo, fresh] = await Promise.all([menuTodoCounts(user), freshCounts(user).catch(() => ({ ...FRESH_ZERO }))]);
  return { todo, fresh };
});
