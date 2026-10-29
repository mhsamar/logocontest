import "server-only";
import { unstable_cache } from "next/cache";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProSettings, PRO_SETTINGS_TAG } from "./settings";

/**
 * Whether a real client can invite Pro designers right now, for the home page's "Invite Pro designers" lines (owner,
 * 2026-10-29): invitations on, a number per contest, and at least one designer the invite step would really list for
 * a real client (inviteCandidates: Pro by plan or free trial, an active designer, not a test account). Shared by every
 * visitor; kept 10 minutes and cleared with every Admin › Pro plan save. Any failed read throws, so it is never kept
 * (the callers then leave the line out for that one view).
 */
export const invitesOpenForClients = unstable_cache(
  async (): Promise<boolean> => {
    if (!isSupabaseConfigured()) return false;
    const { settings, ready } = await getProSettings();
    // The Pro plan has been set up for a long time, so "not ready" means its settings couldn't be read just now.
    if (!ready) throw new Error("pro settings unavailable");
    if (!settings.features.invitations || settings.invitesPerContest <= 0) return false;
    const db = createAdminClient();
    const now = new Date().toISOString();
    // One real, active designer with a plan or a trial is enough: counted by the database, no list of ids sent.
    const [plans, trials] = await Promise.all([
      db.from("pro_subscriptions").select("designer_id, p:profiles!designer_id!inner(id)", { count: "exact", head: true }).neq("status", "expired").gt("current_period_end", now).eq("p.role", "designer").eq("p.status", "active").eq("p.is_test", false),
      db.from("pro_trials").select("designer_id, p:profiles!designer_id!inner(id)", { count: "exact", head: true }).eq("status", "active").gt("ends_at", now).eq("p.role", "designer").eq("p.status", "active").eq("p.is_test", false),
    ]);
    if (plans.error) throw plans.error;
    if (trials.error) throw trials.error;
    return (plans.count ?? 0) + (trials.count ?? 0) > 0;
  },
  ["pro-invites-open-v2"],
  { revalidate: 600, tags: [PRO_SETTINGS_TAG] },
);
