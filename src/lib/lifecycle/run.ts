import "server-only";
import { contestHref } from "@/lib/client/rules";
import { PAGE_VIEW_DAYS } from "@/lib/analytics/rules";
import { isSupabaseConfigured } from "@/lib/env";
import { adminIdsWith } from "@/lib/admin/recipients";
import { emailUser, tellUser } from "@/lib/moderation/suspension";
import { contestDesignerIds, notify } from "@/lib/notifications";
import { getSettings } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { announceContest } from "@/lib/contests/announce";
import { tellClient, tellTeam } from "@/lib/guarantee/notices";
import { contestGuarantee, pendingClaimContestIds } from "@/lib/guarantee/queries";
import { emailContestEnding, emailPickWinner, sendClientDigests } from "@/lib/email/events";
import { runProJobs, type ProJobReport } from "@/lib/pro/jobs";
import { releaseStalePromos } from "@/lib/promos/promos";
import { purgeExpiredTrash, trashUnpaidContests } from "@/lib/admin/trash";
import { alertNewLeads } from "@/lib/admin/lead-alerts";
import { broadcastToDesigners } from "@/lib/notifications/broadcast";
import { remindUnclaimed } from "@/lib/rewards/claims";
import { closeMonth, jobOrigin, sendMonthRewards } from "@/lib/rewards/month-close";
import { missedMonth } from "@/lib/rewards/race-rules";
import { designerEndingKind, designerNoticesDue, dueReminders, ENDING_SOON, endingSoonDue, reminderKind, splitPrize, type SplitEntry } from "./rules";
import { testContestIds } from "@/lib/seo/test-accounts";

/**
 * The 15-minute lifecycle job (BLUEPRINT §6). Every step is safe to run again: the database functions
 * check the state first, and notices are recorded in lifecycle_events so each goes out once.
 */
export type LifecycleReport = { pro?: ProJobReport; endingSoon: number; judging: number; reminders: number; forfeited: number; noResult: number; released: number; unsuspended: number; monthClosed: string | null; claimReminders: number; announced: number; designerReminders: number; filesDue: number; lateStrikes: number; trashed?: number; erased?: number; digests?: number; leadAlerts?: number; errors: string[] };

type ContestRow = { id: string; slug: string; brand_name: string; client_id: string; status: string; ends_at: string | null; judging_ends_at: string | null; prize_amount: number };

const DAY = 86_400_000;

export async function runLifecycle(now = new Date()): Promise<LifecycleReport> {
  const report: LifecycleReport = { endingSoon: 0, judging: 0, reminders: 0, forfeited: 0, noResult: 0, released: 0, unsuspended: 0, monthClosed: null, claimReminders: 0, announced: 0, designerReminders: 0, filesDue: 0, lateStrikes: 0, errors: [] };
  if (!isSupabaseConfigured()) return report;
  const db = createAdminClient();
  const s = await getSettings([
    "timers.ending_soon_notice_hours",
    "timers.judging_window_days",
    "timers.judging_reminder_days",
    "timers.repick_window_days",
    "limits.low_entry_prompt_threshold",
    "fees.designer_tiers",
    "timers.payout_hold_days",
    "timers.designer_ending_notice_hours",
    "timers.files_due_notice_hours",
    "timers.files_strike_hours",
    "timers.strike_expiry_days",
    "timers.suspension_hours",
  ]);
  const iso = now.toISOString();
  const fail = (step: string, id: string, e: unknown) => report.errors.push(`${step} ${id}: ${e instanceof Error ? e.message : String(e)}`);

  /** Records a notice; false when it was already sent. */
  const once = async (contestId: string, kind: string) => {
    const { error } = await db.from("lifecycle_events").insert({ contest_id: contestId, kind });
    return !error;
  };
  // The client's contest in the client workspace (owner, 2026-10-17).
  const manageLink = (c: ContestRow) => contestHref(c.slug);
  // Money-back claims still being checked (owner, 2026-10-21): their contest is frozen, so no reminders and no split.
  const frozen = await pendingClaimContestIds();
  const SELECT = "id, slug, brand_name, client_id, status, ends_at, judging_ends_at, prize_amount";

  // 0. New contests every designer hasn't heard about yet (the payment usually announces them at once).
  {
    const { data } = await db.from("contests").select("id").eq("status", "open").gt("ends_at", iso).gte("starts_at", new Date(now.getTime() - 2 * DAY).toISOString());
    const ids = (data ?? []).map((c) => c.id as string);
    const { data: done } = ids.length ? await db.from("lifecycle_events").select("contest_id").in("contest_id", ids).eq("kind", "announced") : { data: [] };
    const announced = new Set((done ?? []).map((r) => r.contest_id as string));
    for (const id of ids.filter((x) => !announced.has(x))) {
      try {
        if (await announceContest(id)) report.announced++;
      } catch (e) {
        fail("announce", id, e);
      }
    }
  }

  // 1b. Every designer: "ends in 12 hours" and "6 hours left, quickly submit" (owner, 2026-10-09).
  {
    const hours = s["timers.designer_ending_notice_hours"];
    const until = new Date(now.getTime() + Math.max(...hours) * 3_600_000).toISOString();
    const { data } = await db.from("contests").select("id, slug, brand_name, prize_amount, is_private, is_nda, ends_at").eq("status", "open").gt("ends_at", iso).lte("ends_at", until);
    const rows = data ?? [];
    const { data: sentRows } = rows.length ? await db.from("lifecycle_events").select("contest_id, kind").in("contest_id", rows.map((c) => c.id as string)) : { data: [] };
    // A test client's contest reminds test designers only (owner, 2026-10-22).
    const tests = await testContestIds(rows.map((c) => c.id as string));
    for (const c of rows) {
      try {
        const sent = new Set((sentRows ?? []).filter((r) => r.contest_id === c.id).map((r) => r.kind as string));
        const due = designerNoticesDue(new Date(c.ends_at as string), now, hours, sent);
        if (!due.length) continue;
        for (const h of due) await once(c.id as string, designerEndingKind(h));
        const brand = c.is_private || c.is_nda ? undefined : (c.brand_name as string);
        await broadcastToDesigners(brand ? "contest_ending" : "contest_ending_private", { brand, hours: due[0], amount: c.prize_amount as number }, `/contest/${c.slug}`, [], { onlyTest: tests.has(c.id as string) });
        // contest-ending.html (owner, 2026-10-15) to the designers who sent a design or saved the contest.
        await emailContestEnding(c.id as string, due[0]);
        report.designerReminders++;
      } catch (e) {
        fail("designer-ending", c.id as string, e);
      }
    }
  }

  // 1. Ending soon: the client (with Extend when designs are few).
  {
    const until = new Date(now.getTime() + s["timers.ending_soon_notice_hours"] * 3_600_000).toISOString();
    const { data } = await db.from("contests").select(SELECT).eq("status", "open").gt("ends_at", iso).lte("ends_at", until);
    for (const c of (data ?? []) as ContestRow[]) {
      try {
        if (!c.ends_at || !endingSoonDue(new Date(c.ends_at), now, s["timers.ending_soon_notice_hours"]) || !(await once(c.id, ENDING_SOON))) continue;
        const { count } = await db.from("entries").select("id", { count: "exact", head: true }).eq("contest_id", c.id).eq("status", "active");
        const few = (count ?? 0) < s["limits.low_entry_prompt_threshold"];
        await notify([c.client_id], few ? "ending_soon_extend" : "ending_soon", { brand: c.brand_name }, manageLink(c));
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
        await emailPickWinner(c.id, s["timers.judging_window_days"]);
        // Designers who entered hear it ended and the client is choosing (owner, 2026-10-09).
        await notify(await contestDesignerIds(c.id), "contest_ended_entered", { brand: c.brand_name }, `/contest/${c.slug}`);
        // Fewer designers than the guarantee promised (owner, 2026-10-21): pick a winner or claim the money back.
        const g = await contestGuarantee(c.id, now);
        if (g.state.kind === "available" && (await once(c.id, "guarantee_available"))) {
          await tellClient("available", { clientId: c.client_id, slug: c.slug, brand: c.brand_name }, { min: g.state.min, designers: g.state.designers, days: s["timers.judging_window_days"], until: g.state.until, late: false });
        }
        report.judging++;
      } catch (e) {
        fail("judging", c.id, e);
      }
    }
  }

  // 2b. New designs: each client gets at most one email a day per contest (owner, 2026-10-15; client-new-entries.html).
  try {
    report.digests = await sendClientDigests(now);
  } catch (e) {
    fail("digests", "-", e);
  }

  // 3. Pick-a-winner reminders on judging days 1, 3, 5 (only while no winner is picked).
  {
    const { data } = await db.from("contests").select(SELECT).eq("status", "judging").gt("judging_ends_at", iso);
    const rows = (data ?? []) as ContestRow[];
    const { data: sentRows } = rows.length ? await db.from("lifecycle_events").select("contest_id, kind").in("contest_id", rows.map((c) => c.id)) : { data: [] };
    for (const c of rows) {
      try {
        if (!c.ends_at || !c.judging_ends_at || frozen.has(c.id)) continue;
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

  // 4b. The winner hasn't sent the final files and the deadline is near (owner, 2026-10-09).
  {
    const before = new Date(now.getTime() + s["timers.files_due_notice_hours"] * 3_600_000).toISOString();
    const { data } = await db
      .from("handovers")
      .select("id, designer_id, due_at, contest:contests!contest_id(id, slug, brand_name)")
      .eq("status", "awaiting_files")
      .gt("due_at", iso)
      .lte("due_at", before);
    for (const h of data ?? []) {
      const c = (Array.isArray(h.contest) ? h.contest[0] : h.contest) as { id: string; slug: string; brand_name: string } | null;
      try {
        if (!c || !(await once(c.id, `files_due_${h.id}`))) continue;
        const hours = Math.max(1, Math.round((new Date(h.due_at as string).getTime() - now.getTime()) / 3_600_000));
        await notify([h.designer_id as string], "files_due", { brand: c.brand_name, hours }, `/dashboard/handover/${c.slug}`);
        report.filesDue++;
      } catch (e) {
        fail("files-due", h.id as string, e);
      }
    }
  }

  // The winner's name and mobile for the admins' notice, so they can call (owner, 2026-10-12).
  const designerContact = async (id: string) => {
    const { data } = await db.from("profiles").select("name, mobile").eq("id", id).maybeSingle();
    return { name: ((data?.name as string | null) ?? "").trim() || "—", phone: ((data?.mobile as string | null) ?? "").replace(/^\+88/, "") || "—" };
  };

  // 4c. No first files 24 hours after the win (Settings): a 48-hour suspension, once per win (they can still send
  //     the files); the admins hear with the phone number so they can call. The 3rd suspension within 30 days bans
  //     the account (owner, 2026-10-12; migrations 0039, 0041).
  {
    const hours = s["timers.files_strike_hours"];
    const { data } = await db
      .from("handovers")
      .select("id, designer_id, contest:contests!contest_id(id, slug, brand_name)")
      .eq("status", "awaiting_files")
      .is("submitted_at", null)
      .is("late_strike_at", null)
      .lte("created_at", new Date(now.getTime() - hours * 3_600_000).toISOString());
    for (const h of data ?? []) {
      const c = (Array.isArray(h.contest) ? h.contest[0] : h.contest) as { id: string; slug: string; brand_name: string } | null;
      try {
        const { data: p, error } = await db.rpc("strike_late_files", { p_handover_id: h.id });
        if (error) throw new Error(error.message);
        if (!p || !c) continue;
        const profile = p as { status: string; suspended_until: string | null };
        const reason = `${c.brand_name}: final files not sent within ${hours} hours of winning`;
        if (profile.status === "banned") await tellUser(h.designer_id as string, "banned", reason, null);
        else {
          await notify([h.designer_id as string], "late_files_strike", { brand: c.brand_name, hours, suspend: s["timers.suspension_hours"], days: s["timers.strike_expiry_days"] }, `/dashboard/handover/${c.slug}`);
          await emailUser(h.designer_id as string, "suspended", { reason, until: profile.suspended_until });
        }
        await notify(await adminIdsWith("users.view"), "late_files_admin", { ...(await designerContact(h.designer_id as string)), brand: c.brand_name, hours }, `/admin/users/${h.designer_id}`);
        report.lateStrikes++;
      } catch (e) {
        fail("late-files", h.id as string, e);
      }
    }
  }

  // 5. No first files by the deadline → win cancelled, the client picks again, and the designer is banned for good
  //    (owner, 2026-10-12). Only the first delivery has a deadline. Runs before the no-result step on purpose.
  {
    const { data } = await db
      .from("handovers")
      .select("id, designer_id, contest:contests!contest_id(id, slug, brand_name, client_id)")
      .eq("status", "awaiting_files")
      .lte("due_at", iso);
    for (const h of data ?? []) {
      const c = (Array.isArray(h.contest) ? h.contest[0] : h.contest) as { id: string; slug: string; brand_name: string; client_id: string } | null;
      try {
        const { data: done, error } = await db.rpc("forfeit_handover", { p_handover_id: h.id, p_repick_days: s["timers.repick_window_days"] });
        if (error) throw new Error(error.message);
        if (!done || !(done as { id?: string }).id || !c) continue;
        await notify([h.designer_id as string], "files_missed_banned", { brand: c.brand_name }, null);
        await notify(await adminIdsWith("users.view"), "files_missed_admin", { ...(await designerContact(h.designer_id as string)), brand: c.brand_name }, `/admin/users/${h.designer_id}`);
        await notify([c.client_id], "repick_winner", { brand: c.brand_name, days: s["timers.repick_window_days"] }, contestHref(c.slug, "designs"));
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
    const due = [...((judging ?? []) as ContestRow[]), ...((silentContests ?? []) as ContestRow[])].filter((c) => !frozen.has(c.id));
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
        // Nobody got a share and the guarantee still applies (owner, 2026-10-21): the client hears they can claim, not
        // that the prize was shared.
        const late = shares.length === 0 ? await contestGuarantee(c.id, now) : null;
        if (late?.state.kind === "available" && late.state.late) {
          if (await once(c.id, "guarantee_available_late")) await tellClient("available", { clientId: c.client_id, slug: c.slug, brand: c.brand_name }, { min: late.state.min, designers: late.state.designers, until: late.state.until, late: true });
        } else await notify([c.client_id], "no_result_client", { brand: c.brand_name }, contestHref(c.slug));
        for (const x of shares) await notify([x.designerId], "no_result_share", { brand: c.brand_name, amount: x.credit }, "/dashboard/wallet");
        report.noResult++;
      } catch (e) {
        fail("no-result", c.id, e);
      }
    }
  }

  // 6b. Money-back claims the team hasn't acted on (owner, 2026-10-21): waiting a day for a decision, or approved
  //     3 days ago and the money not sent yet. Once per claim and stage.
  try {
    const [{ data: waiting }, { data: unpaid }] = await Promise.all([
      db.from("guarantee_claims").select("id, contest_id, brand_name").eq("status", "pending").lte("created_at", new Date(now.getTime() - DAY).toISOString()),
      db.from("guarantee_claims").select("id, contest_id, brand_name").eq("status", "approved").lte("decided_at", new Date(now.getTime() - 3 * DAY).toISOString()),
    ]);
    for (const [stage, list] of [["wait", waiting], ["unpaid", unpaid]] as const) {
      for (const r of list ?? []) {
        if (r.contest_id && (await once(r.contest_id as string, `guarantee_${stage}_${r.id}`))) await tellTeam("overdue", r.brand_name as string);
      }
    }
  } catch (e) {
    fail("guarantee", "-", e);
  }

  // 7. Release held prizes: approved at least the hold days ago (owner, 2026-10-12: counted from the approval), no
  //    open copy claim (§7.3). The function re-checks all of it.
  {
    const heldBefore = new Date(now.getTime() - s["timers.payout_hold_days"] * DAY).toISOString();
    const { data } = await db
      .from("handovers")
      .select("id, designer_id, contest:contests!contest_id(brand_name)")
      .eq("status", "approved")
      .is("credited_at", null)
      .lte("approved_at", heldBefore);
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

  // 8. Suspensions whose 48 hours are up end on their own, and suspensions older than 30 days stop counting toward a
  //    ban (owner, 2026-10-12).
  {
    const { error: recountError } = await db.rpc("recount_strikes");
    if (recountError) fail("strikes", "-", recountError.message);
    const { data, error } = await db.rpc("lift_expired_suspensions");
    if (error) fail("unsuspend", "-", error.message);
    else report.unsuspended = (data as number) ?? 0;
  }

  // 9. Monthly prizes (owner, 2026-10-11): the month closes at 23:59 on its last day (/api/cron/month-close). On the
  //    1st this closes last month if that run was missed, and sends any reward a stopped run left unsent.
  try {
    const month = missedMonth(now);
    if (month) {
      const origin = await jobOrigin();
      const done = await closeMonth(month, { origin });
      if (done.status === "already") {
        const { data: m } = await db.from("reward_months").select("status").eq("month", month).eq("is_test", false).maybeSingle();
        if (m?.status === "sent") await sendMonthRewards(month, false, origin);
      } else report.monthClosed = month;
    }
  } catch (e) {
    fail("month_close", "-", e);
  }
  // Winners who haven't claimed their monthly prize get a reminder every few days (Settings → Rewards).
  try {
    report.claimReminders = await remindUnclaimed(await jobOrigin(), now);
  } catch (e) {
    fail("claim_reminders", "-", e);
  }

  // 10. Visit data: page views are kept 180 days, "online now" rows a day (BLUEPRINT §13.2 item 3).
  {
    const day = 86_400_000;
    const [views, online] = await Promise.all([
      db.from("page_views").delete().lt("created_at", new Date(now.getTime() - PAGE_VIEW_DAYS * day).toISOString()),
      db.from("presence").delete().lt("updated_at", new Date(now.getTime() - day).toISOString()),
    ]);
    if (views.error) fail("page_views", "-", views.error.message);
    // Wizard mobile numbers (owner, 2026-10-14) are kept 90 days. Before migration 0052 there is no table: ignored.
    await db.from("wizard_leads").delete().lt("created_at", new Date(now.getTime() - 90 * day).toISOString());
    // Their alerts in the team's bells name the person, so they go with them (an alert comes at most two days after).
    await db.from("notifications").delete().eq("type", "lead_new_admin").lt("created_at", new Date(now.getTime() - 88 * day).toISOString());
    // Start a contest's live answers (owner, 2026-10-25) are kept a day, help chats 90 days. Before migration 0077: ignored.
    await db.from("wizard_live").delete().lt("updated_at", new Date(now.getTime() - day).toISOString());
    await db.from("help_offers").delete().lt("created_at", new Date(now.getTime() - 90 * day).toISOString());
    if (online.error) fail("presence", "-", online.error.message);
  }

  // Promo codes (owner, 2026-10-14): a code kept at a checkout that was never paid goes back after a week.
  try {
    await releaseStalePromos(now);
  } catch (e) {
    fail("promos", "-", e);
  }

  // Trash (owner, 2026-10-14): a contest still unpaid 72 hours after it was started goes to the Trash; what has been
  // in the Trash for 90 days is erased for good (Settings → Trash).
  try {
    const t = await getSettings(["trash.unpaid_hours", "trash.keep_days"]);
    report.trashed = await trashUnpaidContests(now, t["trash.unpaid_hours"]);
    const erased = await purgeExpiredTrash(now, t["trash.keep_days"]);
    report.erased = erased.contests + erased.users;
    for (const e of erased.errors) report.errors.push(`trash ${e}`);
  } catch (e) {
    fail("trash", "-", e);
  }

  // Logins (owner, 2026-10-14): staff who went idle or closed every admin tab are signed out even if they never come
  // back; "Log in as" ends after its time; old login records go after 180 days. Before migration 0055 this does nothing.
  {
    const { error } = await db.rpc("end_stale_sessions");
    if (error && !/function|schema cache/i.test(error.message)) fail("sessions", "-", error);
  }

  // Designer Pro plan (owner, 2026-10-13): expiry, renewal and invite/saved reminders, quality scores.
  report.pro = await runProJobs(now);
  for (const e of report.pro.errors) report.errors.push(`pro ${e}`);

  // New clients who gave their mobile number but haven't signed up (owner, 2026-10-25): the team hears about each
  // person once, a few minutes later, so they can call while it's fresh. Last, so slow alert emails never hold up
  // prizes or suspensions.
  try {
    report.leadAlerts = await alertNewLeads(now);
  } catch (e) {
    fail("leads", "-", e);
  }

  return report;
}
