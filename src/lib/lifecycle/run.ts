import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { contestDesignerIds, notify } from "@/lib/notifications";
import { getSettings } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { dueReminders, ENDING_SOON, endingSoonDue, reminderKind, splitPrize, type SplitEntry } from "./rules";

/**
 * The 15-minute lifecycle job (BLUEPRINT §6). Every step is safe to run again: the database functions
 * check the state first, and notices are recorded in lifecycle_events so each goes out once.
 */
export type LifecycleReport = { endingSoon: number; judging: number; reminders: number; forfeited: number; noResult: number; released: number; errors: string[] };

type ContestRow = { id: string; slug: string; brand_name: string; client_id: string; status: string; ends_at: string | null; judging_ends_at: string | null; prize_amount: number };

const DAY = 86_400_000;

export async function runLifecycle(now = new Date()): Promise<LifecycleReport> {
  const report: LifecycleReport = { endingSoon: 0, judging: 0, reminders: 0, forfeited: 0, noResult: 0, released: 0, errors: [] };
  if (!isSupabaseConfigured()) return report;
  const db = createAdminClient();
  const s = await getSettings([
    "timers.ending_soon_notice_hours",
    "timers.judging_window_days",
    "timers.judging_reminder_days",
    "timers.repick_window_days",
    "limits.low_entry_prompt_threshold",
    "fees.designer_tiers",
    "timers.copy_claim_days",
  ]);
  const iso = now.toISOString();
  const fail = (step: string, id: string, e: unknown) => report.errors.push(`${step} ${id}: ${e instanceof Error ? e.message : String(e)}`);

  /** Records a notice; false when it was already sent. */
  const once = async (contestId: string, kind: string) => {
    const { error } = await db.from("lifecycle_events").insert({ contest_id: contestId, kind });
    return !error;
  };
  const manageLink = (c: ContestRow) => `/dashboard/contests/${c.slug}`;
  const SELECT = "id, slug, brand_name, client_id, status, ends_at, judging_ends_at, prize_amount";

  // 1. Ending soon: client (with Extend when designs are few) and the designers who entered.
  {
    const until = new Date(now.getTime() + s["timers.ending_soon_notice_hours"] * 3_600_000).toISOString();
    const { data } = await db.from("contests").select(SELECT).eq("status", "open").gt("ends_at", iso).lte("ends_at", until);
    for (const c of (data ?? []) as ContestRow[]) {
      try {
        if (!c.ends_at || !endingSoonDue(new Date(c.ends_at), now, s["timers.ending_soon_notice_hours"]) || !(await once(c.id, ENDING_SOON))) continue;
        const { count } = await db.from("entries").select("id", { count: "exact", head: true }).eq("contest_id", c.id).eq("status", "active");
        const few = (count ?? 0) < s["limits.low_entry_prompt_threshold"];
        await notify([c.client_id], few ? "ending_soon_extend" : "ending_soon", { brand: c.brand_name }, manageLink(c));
        await notify(await contestDesignerIds(c.id), "ending_soon_designer", { brand: c.brand_name }, `/contest/${c.slug}`);
        report.endingSoon++;
      } catch (e) {
        fail("ending-soon", c.id, e);
      }
    }
  }

  // 2. Open → judging once ends_at has passed.
  {
    const { data } = await db.from("contests").select(SELECT).eq("status", "open").lte("ends_at", iso);
    for (const c of (data ?? []) as ContestRow[]) {
      try {
        const { data: moved, error } = await db.rpc("start_judging", { p_contest_id: c.id, p_judging_days: s["timers.judging_window_days"] });
        if (error) throw new Error(error.message);
        if (!moved || !(moved as ContestRow).id) continue;
        await notify([c.client_id], "judging_started", { brand: c.brand_name, days: s["timers.judging_window_days"] }, manageLink(c));
        report.judging++;
      } catch (e) {
        fail("judging", c.id, e);
      }
    }
  }

  // 3. Pick-a-winner reminders on judging days 1, 3, 5 (only while no winner is picked).
  {
    const { data } = await db.from("contests").select(SELECT).eq("status", "judging").gt("judging_ends_at", iso);
    const rows = (data ?? []) as ContestRow[];
    const { data: sentRows } = rows.length ? await db.from("lifecycle_events").select("contest_id, kind").in("contest_id", rows.map((c) => c.id)) : { data: [] };
    for (const c of rows) {
      try {
        if (!c.ends_at || !c.judging_ends_at) continue;
        const sent = new Set((sentRows ?? []).filter((r) => r.contest_id === c.id).map((r) => r.kind as string));
        const days = dueReminders(new Date(c.ends_at), now, s["timers.judging_reminder_days"], sent);
        if (days.length === 0) continue;
        // Only the latest due reminder goes out; the earlier ones are recorded so they never come late.
        for (const d of days) await once(c.id, reminderKind(d));
        const left = Math.max(1, Math.ceil((new Date(c.judging_ends_at).getTime() - now.getTime()) / DAY));
        await notify([c.client_id], "judging_reminder", { brand: c.brand_name, days: left }, manageLink(c));
        report.reminders++;
      } catch (e) {
        fail("reminder", c.id, e);
      }
    }
  }

  // 5. Missed file deadline → win cancelled, the client picks again (runs before the no-result step on purpose).
  {
    const { data } = await db
      .from("handovers")
      .select("id, designer_id, contest:contests!contest_id(id, slug, brand_name, client_id)")
      .in("status", ["awaiting_files", "revision_requested"])
      .lte("due_at", iso);
    for (const h of data ?? []) {
      const c = (Array.isArray(h.contest) ? h.contest[0] : h.contest) as { id: string; slug: string; brand_name: string; client_id: string } | null;
      try {
        const { data: done, error } = await db.rpc("forfeit_handover", { p_handover_id: h.id, p_repick_days: s["timers.repick_window_days"] });
        if (error) throw new Error(error.message);
        if (!done || !(done as { id?: string }).id || !c) continue;
        await notify([h.designer_id as string], "win_cancelled", { brand: c.brand_name }, `/contest/${c.slug}`);
        await notify([c.client_id], "repick_winner", { brand: c.brand_name, days: s["timers.repick_window_days"] }, `/dashboard/contests/${c.slug}`);
        report.forfeited++;
      } catch (e) {
        fail("forfeit", h.id as string, e);
      }
    }
  }

  // 4 + 6. No result: judging ran out with no winner, or the client went silent after the files arrived.
  {
    const [{ data: judging }, { data: silent }] = await Promise.all([
      db.from("contests").select(SELECT).eq("status", "judging").lte("judging_ends_at", iso),
      db.from("handovers").select("contest_id").eq("status", "submitted").lte("review_due_at", iso),
    ]);
    const silentIds = (silent ?? []).map((h) => h.contest_id as string);
    const { data: silentContests } = silentIds.length ? await db.from("contests").select(SELECT).in("id", silentIds) : { data: [] };
    const due = [...((judging ?? []) as ContestRow[]), ...((silentContests ?? []) as ContestRow[])];
    for (const c of due) {
      try {
        const { data: entries } = await db.from("entries").select("designer_id, status, created_at").eq("contest_id", c.id);
        const list: SplitEntry[] = (entries ?? []).map((e) => ({ designerId: e.designer_id as string, status: e.status as string, createdAt: new Date(e.created_at as string) }));
        const ids = [...new Set(list.map((e) => e.designerId))];
        const { data: profiles } = ids.length ? await db.from("profiles").select("id, counted_wins_count").in("id", ids) : { data: [] };
        const wins = new Map((profiles ?? []).map((p) => [p.id as string, (p.counted_wins_count as number) ?? 0]));
        const shares = splitPrize(c.prize_amount, list, (id) => wins.get(id) ?? 0, s["fees.designer_tiers"]);
        const { data: done, error } = await db.rpc("finish_no_result", {
          p_contest_id: c.id,
          p_shares: shares.map((x) => ({ designer_id: x.designerId, share: x.share, fee_rate: x.feeRate })),
        });
        if (error) throw new Error(error.message);
        if (!done || !(done as { id?: string }).id) continue;
        await notify([c.client_id], "no_result_client", { brand: c.brand_name }, `/dashboard/contests/${c.slug}`);
        for (const x of shares) await notify([x.designerId], "no_result_share", { brand: c.brand_name, amount: x.credit }, "/dashboard/wallet");
        report.noResult++;
      } catch (e) {
        fail("no-result", c.id, e);
      }
    }
  }

  // 7. Release held prizes: approved, copy-claim days over, no open claim (§7.3). The function re-checks all of it.
  {
    const heldBefore = new Date(now.getTime() - s["timers.copy_claim_days"] * DAY).toISOString();
    const { data } = await db
      .from("handovers")
      .select("id, designer_id, contest:contests!contest_id(brand_name)")
      .eq("status", "approved")
      .is("credited_at", null)
      .lte("created_at", heldBefore);
    for (const h of data ?? []) {
      try {
        const { data: tx, error } = await db.rpc("release_prize_credit", { p_handover_id: h.id });
        if (error) throw new Error(error.message);
        const amount = (tx as { amount?: number } | null)?.amount;
        if (!amount) continue;
        const brand = (Array.isArray(h.contest) ? h.contest[0] : h.contest)?.brand_name as string | undefined;
        await notify([h.designer_id as string], "prize_released", { brand, amount }, "/dashboard/wallet");
        report.released++;
      } catch (e) {
        fail("release", h.id as string, e);
      }
    }
  }

  return report;
}
