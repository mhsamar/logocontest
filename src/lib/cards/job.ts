import "server-only";
import { getSettings } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { FacebookError, facebookConfigured, postPhoto } from "./facebook";
import { autoPostTime, cardEligibility, MAIN_SIZE, MAX_ATTEMPTS, pickStyle, retryDue, type CardKind, type CardStyle } from "./rules";
import { cardsReady, CONTEST_COLUMNS, contestForCard, drawCard, imageUrl, makeCaption, updateCard, type CardContestRow, type CardRow } from "./store";
import { CARD_TEMPLATE_VERSION } from "./template";
import { isTestContest, testContestIds } from "@/lib/seo/test-accounts";

/**
 * Contest cards in the 15-minute job (owner, 2026-10-19). New live contests get a card (one per contest: the row is
 * claimed first, so a second run can't make another); waiting cards are posted when the admin lets them; failed posts
 * are tried again 3 times; the optional "Last 24 hours" card. Payments and contests are only read, never changed.
 */

const db = () => createAdminClient();
const DAY = 86_400_000;

export type CardRunResult = { status: "not_ready" | "ran"; made: number; skipped: number; posted: number; failed: number; errors: string[] };

const eligibility = (c: CardContestRow, now: Date, isTest = false) =>
  cardEligibility({ status: c.status, isPrivate: c.is_private, isNda: c.is_nda, shareOnFacebook: c.share_on_facebook !== false, endsAt: c.ends_at ? new Date(c.ends_at) : null, isTest }, now);

/** The last Maroon night / Clean light card, so Auto takes turns. */
async function lastTurn(): Promise<"maroon" | "light" | null> {
  const { data } = await db().from("contest_cards").select("style").in("style", ["maroon", "light"]).order("created_at", { ascending: false }).limit(1);
  return (data?.[0]?.style as "maroon" | "light" | undefined) ?? null;
}

/**
 * Claims the card row, then draws it. Returns null when the contest already has this card. A contest that may not
 * be shared gets a "skipped" row without pictures, so the list shows why.
 */
export async function createCard(c: CardContestRow, kind: CardKind, now: Date, opts: { style?: CardStyle; test?: boolean } = {}): Promise<CardRow | null> {
  const s = await getSettings(["cards.style", "cards.big_prize_from"]);
  const elig = eligibility(c, now, opts.test ?? (await isTestContest(c.id)));
  const style = opts.style ?? pickStyle({ prize: c.prize_amount, bigFrom: s["cards.big_prize_from"], setting: s["cards.style"], lastTurn: await lastTurn() });
  const skipped = elig === "private" || elig === "client_off" || elig === "test";
  const { data, error } = await db()
    .from("contest_cards")
    .insert({ contest_id: c.id, kind, style, status: skipped ? "skipped" : "waiting", skip_reason: skipped ? elig : null, caption: skipped ? null : await makeCaption(c, now) })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") return null;
    throw new Error(error.message);
  }
  const row = data as CardRow;
  if (skipped) return row;
  try {
    const images = await drawCard(c, kind, style, null, now);
    await updateCard(row.id, { images });
    return { ...row, images };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await updateCard(row.id, { status: "failed", error: `The card picture couldn't be made: ${msg}`.slice(0, 300) });
    return { ...row, status: "failed", error: msg };
  }
}

/**
 * Posts (or schedules) one card on the Facebook page. `by` is the admin who pressed the button; null for the job.
 * A contest that stopped being shareable (private now, ended, client said no) is skipped instead.
 */
export async function postCard(card: CardRow, opts: { at?: Date | null; by?: string | null } = {}, now = new Date()): Promise<CardRow> {
  const c = await contestForCard(card.contest_id);
  const elig = c ? eligibility(c, now, await isTestContest(c.id)) : "not_live";
  if (!c || elig !== "ok") {
    const patch = { status: "skipped" as const, skip_reason: elig };
    await updateCard(card.id, patch);
    return { ...card, ...patch };
  }
  const url = imageUrl(card.images, MAIN_SIZE);
  if (!url) {
    const patch = { status: "failed" as const, error: "The card has no picture yet. Press Make again." };
    await updateCard(card.id, patch);
    return { ...card, ...patch };
  }
  const tried = { attempts: card.attempts + 1, tried_at: now.toISOString() };
  try {
    const post = await postPhoto({ imageUrl: url, caption: card.caption ?? (await makeCaption(c, now)), at: opts.at ?? null });
    const patch = opts.at
      ? { ...tried, status: "scheduled" as const, scheduled_at: opts.at.toISOString(), fb_post_id: post.postId, fb_post_url: post.url, posted_by: opts.by ?? null, error: null }
      : { ...tried, status: "posted" as const, posted_at: now.toISOString(), fb_post_id: post.postId, fb_post_url: post.url, posted_by: opts.by ?? null, error: null };
    await updateCard(card.id, patch);
    return { ...card, ...patch };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const permission = e instanceof FacebookError && e.permission;
    // A missing permission won't fix itself: no more automatic tries until the admin sends it again.
    const patch = { ...tried, attempts: permission ? MAX_ATTEMPTS : tried.attempts, status: "failed" as const, error: (permission ? `PERMISSION ${msg}` : msg).slice(0, 300) };
    await updateCard(card.id, patch);
    return { ...card, ...patch };
  }
}

export async function runContestCards(now = new Date(), budgetMs = 40_000): Promise<CardRunResult> {
  const result: CardRunResult = { status: "ran", made: 0, skipped: 0, posted: 0, failed: 0, errors: [] };
  if (!(await cardsReady()).table) return { ...result, status: "not_ready" };
  const started = Date.now();
  const left = () => budgetMs - (Date.now() - started);
  const s = await getSettings(["cards.auto_post", "cards.check_first", "cards.last24", "cards.post_when", "cards.custom_time"]);
  const auto = s["cards.auto_post"] && !s["cards.check_first"] && facebookConfigured();
  const note = (step: string, e: unknown) => result.errors.push(`${step}: ${e instanceof Error ? e.message : String(e)}`.slice(0, 300));

  // 1. New live contests (and, when it's on, the last day of each) without their card yet. Two drawings per run at most.
  const { data: live } = await db().from("contests").select(CONTEST_COLUMNS).eq("status", "open").gt("ends_at", now.toISOString()).order("starts_at", { ascending: true }).limit(200);
  const contests = (live ?? []) as CardContestRow[];
  const { data: have } = contests.length ? await db().from("contest_cards").select("contest_id, kind, status, style").in("contest_id", contests.map((c) => c.id)) : { data: [] };
  const done = new Set((have ?? []).map((h) => `${h.contest_id}:${h.kind}`));
  const firstCard = new Map((have ?? []).filter((h) => h.kind === "new").map((h) => [h.contest_id as string, h]));
  const tests = await testContestIds(contests.map((c) => c.id));
  let drawings = 0;
  for (const c of contests) {
    const kinds: CardKind[] = [];
    if (!done.has(`${c.id}:new`)) kinds.push("new");
    const endsIn = c.ends_at ? new Date(c.ends_at).getTime() - now.getTime() : Infinity;
    const first = firstCard.get(c.id);
    if (s["cards.last24"] && endsIn <= DAY && first && first.status === "posted" && !done.has(`${c.id}:last24`)) kinds.push("last24");
    for (const kind of kinds) {
      if (drawings >= 2 || left() < 15_000) break;
      try {
        const card = await createCard(c, kind, now, { ...(kind === "last24" && first ? { style: first.style as CardStyle } : {}), test: tests.has(c.id) });
        if (!card) continue;
        if (card.status === "skipped") result.skipped++;
        else {
          drawings++;
          result.made++;
        }
      } catch (e) {
        note(`card ${c.slug}`, e);
      }
    }
  }

  // 1b. Cards not posted yet that miss a picture (a run that stopped half-way) or were drawn with an older look get
  // drawn again, within the same two drawings per run.
  if (drawings < 2) {
    const { data: stale } = await db().from("contest_cards").select("*").in("status", ["waiting", "failed"]).lt("created_at", new Date(now.getTime() - 3 * 60_000).toISOString()).order("created_at", { ascending: true }).limit(20);
    for (const card of (stale ?? []) as CardRow[]) {
      if (drawings >= 2 || left() < 15_000) break;
      const fresh = (card.images.t ?? 1) >= CARD_TEMPLATE_VERSION && Boolean(card.images[MAIN_SIZE]);
      if (fresh || (card.status === "failed" && card.attempts > 0)) continue;
      const c = await contestForCard(card.contest_id);
      if (!c || eligibility(c, now, await isTestContest(c.id)) !== "ok") continue;
      try {
        const images = await drawCard(c, card.kind, card.style, card.line_bn, now);
        await updateCard(card.id, card.status === "failed" ? { images, status: "waiting", error: null } : { images });
        drawings++;
      } catch (e) {
        note(`redraw ${c.slug}`, e);
      }
    }
  }

  // 2. Waiting cards go out by themselves when automatic posting is on and nobody has to check them first.
  if (auto) {
    const { data: waiting } = await db().from("contest_cards").select("*").eq("status", "waiting").order("created_at", { ascending: true }).limit(5);
    for (const card of (waiting ?? []) as CardRow[]) {
      if (left() < 5_000) break;
      const at = autoPostTime(s["cards.post_when"], s["cards.custom_time"], now);
      const out = await postCard(card, { at }, now);
      if (out.status === "posted" || out.status === "scheduled") result.posted++;
      else if (out.status === "failed") result.failed++;
    }
  }

  // 3. Failed posts: 3 tries, waiting 15, 30, then 60 minutes.
  if (facebookConfigured()) {
    const { data: failed } = await db().from("contest_cards").select("*").eq("status", "failed").lt("attempts", MAX_ATTEMPTS).order("tried_at", { ascending: true }).limit(5);
    for (const card of (failed ?? []) as CardRow[]) {
      if (left() < 5_000) break;
      if (card.attempts === 0 || !retryDue(card.attempts, card.tried_at ? new Date(card.tried_at) : null, now)) continue;
      const out = await postCard(card, { by: card.posted_by }, now);
      if (out.status === "posted") result.posted++;
      else if (out.status === "failed") result.failed++;
    }
  }

  // 4. Facebook publishes scheduled posts itself; once the time has passed they count as posted.
  const { data: due } = await db().from("contest_cards").select("id, scheduled_at").eq("status", "scheduled").lte("scheduled_at", now.toISOString()).limit(50);
  for (const d of due ?? []) await updateCard(d.id as string, { status: "posted", posted_at: d.scheduled_at as string });

  return result;
}
