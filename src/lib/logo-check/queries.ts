import "server-only";
import { hasPermission } from "@/lib/admin/permissions";
import type { CurrentUser } from "@/lib/auth/policies";
import { isSupabaseConfigured } from "@/lib/env";
import { getFileStorage } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Reading } from "./ai";
import { accessFor, CHECKABLE_STATUSES, checksLeft, isCheckable, limitFor, type CheckAccess, type CheckLimits, type CheckStatus, type MatchSource, type Verdict } from "./rules";
import { checkLimits, LOGO_CHECKS_BUCKET, type Sources } from "./run";

/** Reading checks back (owner, 2026-10-10). Only the contest's client and admins with copyright.view see a check. */

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

export type CheckListItem = {
  id: string;
  number: number;
  status: CheckStatus;
  step: number;
  verdict: Verdict | null;
  entryId: string | null;
  entryNumber: number | null;
  overall: number | null;
  error: string | null;
  createdAt: string;
};

export type ContestChecks = {
  access: CheckAccess;
  limits: CheckLimits;
  /** Checks this contest gets (free or paid number). */
  limit: number;
  /** Checks that count (not failed). */
  used: number;
  left: number;
  /** Open or judging, so new checks may start. */
  checkable: boolean;
  checks: CheckListItem[];
};

const LIST_COLUMNS = "id, number, status, step, verdict, entry_id, scores, error, created_at, entry:entries!entry_id(number)";

const toItem = (r: Record<string, unknown>): CheckListItem => ({
  id: r.id as string,
  number: r.number as number,
  status: r.status as CheckStatus,
  step: r.step as number,
  verdict: (r.verdict as Verdict | null) ?? null,
  entryId: (r.entry_id as string | null) ?? null,
  entryNumber: one(r.entry as { number: number } | null)?.number ?? null,
  overall: (r.scores as { overall?: { score: number } } | null)?.overall?.score ?? null,
  error: (r.error as string | null) ?? null,
  createdAt: r.created_at as string,
});

/** The side box on the client's contest page: access, how many checks are left, and the checks so far. */
export async function contestChecks(contest: { id: string; prize: number; logoScan: boolean; status: string }): Promise<ContestChecks> {
  const limits = await checkLimits();
  const access = accessFor(contest.prize, contest.logoScan, limits);
  const limit = limitFor(contest.logoScan, limits);
  if (!isSupabaseConfigured()) return { access, limits, limit, used: 0, left: limit, checkable: false, checks: [] };
  // Designers' contest checks (owner, 2026-10-14) are on their entries, not in the client's checks.
  const { data } = await createAdminClient().from("logo_checks").select(LIST_COLUMNS).eq("contest_id", contest.id).neq("source", "pre_submit").order("created_at", { ascending: true });
  const checks = (data ?? []).map((r) => toItem(r as Record<string, unknown>));
  const used = checks.filter((c) => c.status !== "failed").length;
  // Shown as at most the limit: a contest that checked more before the limit was lowered (owner, 2026-10-29) reads
  // "10 of 10", not "30 of 10".
  return { access, limits, limit, used: Math.min(used, limit), left: checksLeft(used, limit), checkable: isCheckable(contest.status), checks };
}

export type CheckMatch = {
  position: number;
  foundBy: MatchSource;
  imageUrl: string | null;
  pageUrl: string | null;
  title: string | null;
  site: string | null;
  entryId: string | null;
  similarity: number;
  same: string[];
  different: string[];
  isClose: boolean;
};

export type Score = { score: number; line: string };

export type CheckView = CheckListItem & {
  contest: { id: string; slug: string; brand: string; number: number | null; clientId: string };
  entry: { id: string; number: number; designer: { id: string; name: string; username: string | null } | null } | null;
  requestedBy: { id: string; name: string };
  logoUrl: string | null;
  reading: Reading | null;
  matches: CheckMatch[];
  scores: { uniqueness: Score; legibility: Score; colour: Score; overall: Score } | null;
  advice: string | null;
  sources: Sources | null;
  paid: boolean;
  amount: number;
  /** picture: the stored certificate picture (JPEG since 2026-10-27, PNG before). */
  certificate: { pdf: boolean; png: boolean; picture: string | null };
  finishedAt: string | null;
  /** True while no runner holds a check that isn't finished (a status poll then starts it again). */
  stale: boolean;
  costUsd: number;
  /** Checks left in this contest. */
  left: number;
  /** Who is looking (owner, 2026-10-16: the designer sees the full report too, without the client's buttons). */
  viewer: "client" | "designer" | "admin";
};

const VIEW_COLUMNS =
  "id, number, status, step, verdict, entry_id, scores, error, created_at, finished_at, image_path, reading, advice, sources, paid, amount, certificate_pdf_path, certificate_png_path, locked_until, cost_usd, " +
  "contest:contests!contest_id(id, slug, brand_name, contest_number, client_id, prize_amount, logo_scan, status), entry:entries!entry_id(id, number, designer:profiles!designer_id(id, name, username)), requester:profiles!requested_by(id, name), " +
  "matches:logo_check_matches(position, found_by, image_path, image_url, page_url, title, site, entry_id, similarity, same, different, is_close)";

/** May this person see checks of a contest owned by `clientId`? */
export const canSeeChecks = (viewer: CurrentUser | null, clientId: string) => !!viewer && (viewer.id === clientId || hasPermission(viewer, "copyright.view"));

/** One check with short signed links to the logo and the found images, or null when the viewer may not see it. */
export async function checkView(id: string, viewer: CurrentUser | null): Promise<CheckView | null> {
  if (!isSupabaseConfigured() || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await createAdminClient().from("logo_checks").select(VIEW_COLUMNS).eq("id", id).maybeSingle();
  if (!data) return null;
  const r = data as unknown as Record<string, unknown>;
  const contest = one(r.contest as { id: string; slug: string; brand_name: string; contest_number: number | null; client_id: string; prize_amount: number; logo_scan: boolean; status: string } | null);
  if (!contest) return null;
  // A cancelled contest (money back, or cancelled by the team): its client no longer sees the designs' checks (owner, 2026-10-21).
  if (contest.status === "cancelled" && viewer?.id === contest.client_id && viewer.role !== "admin") return null;
  const entry = one(r.entry as { id: string; number: number; designer: unknown } | null);
  const designer = entry ? one(entry.designer as { id: string; name: string; username: string | null } | null) : null;
  const requester = one(r.requester as { id: string; name: string } | null);
  // Owner, 2026-10-16: the designer who ran the check, or whose design the client checked, sees the full report too.
  const isDesigner = !!viewer && (viewer.id === requester?.id || viewer.id === designer?.id) && viewer.id !== contest.client_id;
  if (!canSeeChecks(viewer, contest.client_id) && !isDesigner) return null;
  const rawMatches = [...((r.matches as Record<string, unknown>[] | null) ?? [])].sort((a, b) => (a.position as number) - (b.position as number));
  const paths = [r.image_path as string, ...rawMatches.map((m) => m.image_path as string).filter(Boolean)];
  const urls = await getFileStorage()
    .createReadUrls(LOGO_CHECKS_BUCKET, paths, 3600, { width: 640 })
    .catch(() => new Map<string, string>());
  const { count } = await createAdminClient().from("logo_checks").select("id", { count: "exact", head: true }).eq("contest_id", contest.id).neq("status", "failed").neq("source", "pre_submit");
  const limits = await checkLimits();
  const lockedUntil = r.locked_until ? new Date(r.locked_until as string).getTime() : 0;
  return {
    ...toItem(r),
    contest: { id: contest.id, slug: contest.slug, brand: contest.brand_name, number: contest.contest_number, clientId: contest.client_id },
    entry: entry ? { id: entry.id, number: entry.number, designer } : null,
    requestedBy: requester ?? { id: "", name: "" },
    logoUrl: urls.get(r.image_path as string) ?? null,
    reading: (r.reading as Reading | null) ?? null,
    matches: rawMatches.map((m) => ({
      position: m.position as number,
      foundBy: m.found_by as MatchSource,
      imageUrl: urls.get(m.image_path as string) ?? null,
      pageUrl: (m.page_url as string | null) ?? null,
      title: (m.title as string | null) ?? null,
      site: (m.site as string | null) ?? null,
      entryId: (m.entry_id as string | null) ?? null,
      similarity: m.similarity as number,
      same: (m.same as string[]) ?? [],
      different: (m.different as string[]) ?? [],
      isClose: Boolean(m.is_close),
    })),
    scores: (r.scores as CheckView["scores"]) ?? null,
    advice: (r.advice as string | null) ?? null,
    sources: (r.sources as Sources | null) ?? null,
    paid: Boolean(r.paid),
    amount: (r.amount as number) ?? 0,
    certificate: { pdf: Boolean(r.certificate_pdf_path), png: Boolean(r.certificate_png_path), picture: (r.certificate_png_path as string | null) ?? null },
    finishedAt: (r.finished_at as string | null) ?? null,
    stale: (r.status === "queued" || r.status === "running") && lockedUntil < Date.now(),
    costUsd: Number(r.cost_usd) || 0,
    left: checksLeft(count ?? 0, limitFor(Boolean(contest.logo_scan), limits)),
    viewer: viewer && viewer.id === contest.client_id ? "client" : isDesigner ? "designer" : "admin",
  };
}

/**
 * The finished check to show for one design (owner, 2026-10-16): the designer's own check while the design still uses
 * that file, otherwise the newest finished check of it (the client's). Null when there is none.
 */
export async function entryCheckId(entry: { id: string; checkId: string | null }): Promise<{ id: string; verdict: Verdict | null } | null> {
  if (!isSupabaseConfigured()) return null;
  const { data } = await createAdminClient()
    .from("logo_checks")
    .select("id, verdict, finished_at")
    .eq("entry_id", entry.id)
    .eq("status", "done")
    .order("finished_at", { ascending: false })
    .limit(10);
  const rows = data ?? [];
  const row = (entry.checkId ? rows.find((r) => r.id === entry.checkId) : undefined) ?? rows[0];
  // The result goes on the report card (owner, 2026-10-18).
  return row ? { id: row.id as string, verdict: (row.verdict as Verdict | null) ?? null } : null;
}

/** For the public /verify page: only the number, date, checked logo and result. */
export async function verifyView(number: number): Promise<{ number: number; finishedAt: string; verdict: Verdict; logoUrl: string | null; closest: number } | null> {
  if (!isSupabaseConfigured()) return null;
  const { data } = await createAdminClient().from("logo_checks").select("number, status, verdict, finished_at, image_path, sources")
    .eq("number", number)
    // Only certificates a client can have: their own checks, or a designer's contest check once it is on a sent entry
    // (the client got it as a reused report). A designer's own checks and unsent contest checks stay private.
    .or("source.in.(entry,upload),and(source.eq.pre_submit,entry_id.not.is.null)")
    .maybeSingle();
  if (!data || data.status !== "done" || !data.verdict || !data.finished_at) return null;
  const urls = await getFileStorage()
    .createReadUrls(LOGO_CHECKS_BUCKET, [data.image_path as string], 600)
    .catch(() => new Map<string, string>());
  return {
    number: data.number as number,
    finishedAt: data.finished_at as string,
    verdict: data.verdict as Verdict,
    logoUrl: urls.get(data.image_path as string) ?? null,
    closest: (data.sources as Sources | null)?.shape.closest ?? 0,
  };
}


export type MyCheck = CheckListItem & {
  logoUrl: string | null;
  contest: { id: string; slug: string; brand: string; number: number | null; prize: number; logoScan: boolean };
  paid: boolean;
  closest: number;
  close: number;
  hasCertificate: boolean;
  stale: boolean;
};

export type ContestCheckCount = { id: string; slug: string; brand: string; number: number | null; used: number; limit: number; left: number; access: CheckAccess; checkable: boolean; prize: number };

/** My logo checks (owner, 2026-10-10): every check this client asked for, newest first, and the checks left per contest. */
export async function myChecks(userId: string): Promise<{ checks: MyCheck[]; contests: ContestCheckCount[]; limits: CheckLimits }> {
  const limits = await checkLimits();
  if (!isSupabaseConfigured()) return { checks: [], contests: [], limits };
  const db = createAdminClient();
  const [{ data: rows }, { data: own }] = await Promise.all([
    db
      .from("logo_checks")
      .select(`${LIST_COLUMNS}, image_path, paid, sources, certificate_pdf_path, locked_until, contest:contests!contest_id(id, slug, brand_name, contest_number, prize_amount, logo_scan, status)`)
      .eq("requested_by", userId)
      .in("source", ["entry", "upload"])
      .order("created_at", { ascending: false })
      .limit(200),
    db.from("contests").select("id, slug, brand_name, contest_number, status, prize_amount, logo_scan").eq("client_id", userId).in("status", [...CHECKABLE_STATUSES]),
  ]);
  // Not the checks of a cancelled contest (money back, or cancelled by the team; owner, 2026-10-21).
  const list = ((rows ?? []) as unknown as Record<string, unknown>[]).filter((r) => one(r.contest as { status: string } | { status: string }[] | null)?.status !== "cancelled");
  const urls = await getFileStorage()
    .createReadUrls(LOGO_CHECKS_BUCKET, list.map((r) => r.image_path as string), 3600, { width: 240 })
    .catch(() => new Map<string, string>());
  const checks: MyCheck[] = list.map((r) => {
    const c = one(r.contest as { id: string; slug: string; brand_name: string; contest_number: number | null; prize_amount: number; logo_scan: boolean } | null);
    const src = r.sources as Sources | null;
    const lockedUntil = r.locked_until ? new Date(r.locked_until as string).getTime() : 0;
    return {
      ...toItem(r),
      logoUrl: urls.get(r.image_path as string) ?? null,
      contest: { id: c?.id ?? "", slug: c?.slug ?? "", brand: c?.brand_name ?? "", number: c?.contest_number ?? null, prize: c?.prize_amount ?? 0, logoScan: Boolean(c?.logo_scan) },
      paid: Boolean(r.paid),
      closest: src?.shape.closest ?? 0,
      close: src?.shape.close ?? 0,
      hasCertificate: Boolean(r.certificate_pdf_path),
      stale: (r.status === "queued" || r.status === "running") && lockedUntil < Date.now(),
    };
  });

  // Checks left: every contest with checks, plus the client's open or judging contests.
  const byContest = new Map<string, ContestCheckCount>();
  for (const c of own ?? []) {
    const access = accessFor(c.prize_amount as number, Boolean(c.logo_scan), limits);
    const limit = limitFor(Boolean(c.logo_scan), limits);
    byContest.set(c.id as string, { id: c.id as string, slug: c.slug as string, brand: c.brand_name as string, number: (c.contest_number as number | null) ?? null, used: 0, limit, left: limit, access, checkable: true, prize: c.prize_amount as number });
  }
  for (const k of checks) {
    if (!byContest.has(k.contest.id)) {
      const limit = limitFor(k.contest.logoScan, limits);
      byContest.set(k.contest.id, { id: k.contest.id, slug: k.contest.slug, brand: k.contest.brand, number: k.contest.number, used: 0, limit, left: limit, access: "free", checkable: false, prize: k.contest.prize });
    }
    if (k.status !== "failed") byContest.get(k.contest.id)!.used += 1;
  }
  // At most the limit, as in contestChecks (owner, 2026-10-29).
  const contests = [...byContest.values()].map((c) => ({ ...c, used: Math.min(c.used, c.limit), left: checksLeft(c.used, c.limit) }));
  return { checks, contests, limits };
}

export type AdminCheckRow = CheckListItem & {
  logoUrl: string | null;
  contest: { id: string; slug: string; brand: string; number: number | null; prize: number; logoScan: boolean };
  requester: { id: string; name: string };
  paid: boolean;
  close: number;
  closest: number;
  /** Which of the contest's checks this was (1, 2, 3); failed checks don't count. */
  nth: number | null;
  costUsd: number;
};

/** Admin page (owner, 2026-10-10): every check by every client, newest first (at most 500). */
export async function adminChecks(): Promise<AdminCheckRow[]> {
  if (!isSupabaseConfigured()) return [];
  const { data } = await createAdminClient()
    .from("logo_checks")
    .select(`${LIST_COLUMNS}, image_path, paid, sources, cost_usd, contest_id, contest:contests!contest_id(id, slug, brand_name, contest_number, prize_amount, logo_scan), requester:profiles!requested_by(id, name)`)
    .in("source", ["entry", "upload"])
    .order("created_at", { ascending: false })
    .limit(500);
  const list = (data ?? []) as unknown as Record<string, unknown>[];
  const urls = await getFileStorage()
    .createReadUrls(LOGO_CHECKS_BUCKET, list.map((r) => r.image_path as string), 3600, { width: 240 })
    .catch(() => new Map<string, string>());
  // Number each contest's counted checks in the order they were made.
  const order = new Map<string, string[]>();
  for (const r of [...list].reverse()) if (r.status !== "failed") order.set(r.contest_id as string, [...(order.get(r.contest_id as string) ?? []), r.id as string]);
  return list.map((r) => {
    const c = one(r.contest as { id: string; slug: string; brand_name: string; contest_number: number | null; prize_amount: number; logo_scan: boolean } | null);
    const src = r.sources as Sources | null;
    const n = order.get(r.contest_id as string)?.indexOf(r.id as string) ?? -1;
    return {
      ...toItem(r),
      logoUrl: urls.get(r.image_path as string) ?? null,
      contest: { id: c?.id ?? "", slug: c?.slug ?? "", brand: c?.brand_name ?? "", number: c?.contest_number ?? null, prize: c?.prize_amount ?? 0, logoScan: Boolean(c?.logo_scan) },
      requester: one(r.requester as { id: string; name: string } | null) ?? { id: "", name: "—" },
      paid: Boolean(r.paid),
      close: src?.shape.close ?? 0,
      closest: src?.shape.closest ?? 0,
      nth: n >= 0 ? n + 1 : null,
      costUsd: Number(r.cost_usd) || 0,
    };
  });
}
