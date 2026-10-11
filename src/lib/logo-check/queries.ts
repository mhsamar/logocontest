import "server-only";
import { hasPermission } from "@/lib/admin/permissions";
import type { CurrentUser } from "@/lib/auth/policies";
import { isSupabaseConfigured } from "@/lib/env";
import { getFileStorage } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Reading } from "./ai";
import { accessFor, CHECKABLE_STATUSES, checksLeft, isCheckable, type CheckAccess, type CheckLimits, type CheckStatus, type MatchSource, type Verdict } from "./rules";
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
  if (!isSupabaseConfigured()) return { access, limits, used: 0, left: limits.perContest, checkable: false, checks: [] };
  const { data } = await createAdminClient().from("logo_checks").select(LIST_COLUMNS).eq("contest_id", contest.id).order("created_at", { ascending: true });
  const checks = (data ?? []).map((r) => toItem(r as Record<string, unknown>));
  const used = checks.filter((c) => c.status !== "failed").length;
  return { access, limits, used, left: checksLeft(used, limits), checkable: isCheckable(contest.status), checks };
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
  certificate: { pdf: boolean; png: boolean };
  finishedAt: string | null;
  /** True while no runner holds a check that isn't finished (a status poll then starts it again). */
  stale: boolean;
  costUsd: number;
  /** Checks left in this contest. */
  left: number;
};

const VIEW_COLUMNS =
  "id, number, status, step, verdict, entry_id, scores, error, created_at, finished_at, image_path, reading, advice, sources, paid, amount, certificate_pdf_path, certificate_png_path, locked_until, cost_usd, " +
  "contest:contests!contest_id(id, slug, brand_name, contest_number, client_id), entry:entries!entry_id(id, number, designer:profiles!designer_id(id, name, username)), requester:profiles!requested_by(id, name), " +
  "matches:logo_check_matches(position, found_by, image_path, image_url, page_url, title, site, entry_id, similarity, same, different, is_close)";

/** May this person see checks of a contest owned by `clientId`? */
export const canSeeChecks = (viewer: CurrentUser | null, clientId: string) => !!viewer && (viewer.id === clientId || hasPermission(viewer, "copyright.view"));

/** One check with short signed links to the logo and the found images, or null when the viewer may not see it. */
export async function checkView(id: string, viewer: CurrentUser | null): Promise<CheckView | null> {
  if (!isSupabaseConfigured() || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await createAdminClient().from("logo_checks").select(VIEW_COLUMNS).eq("id", id).maybeSingle();
  if (!data) return null;
  const r = data as unknown as Record<string, unknown>;
  const contest = one(r.contest as { id: string; slug: string; brand_name: string; contest_number: number | null; client_id: string } | null);
  if (!contest || !canSeeChecks(viewer, contest.client_id)) return null;
  const entry = one(r.entry as { id: string; number: number; designer: unknown } | null);
  const designer = entry ? one(entry.designer as { id: string; name: string; username: string | null } | null) : null;
  const rawMatches = [...((r.matches as Record<string, unknown>[] | null) ?? [])].sort((a, b) => (a.position as number) - (b.position as number));
  const paths = [r.image_path as string, ...rawMatches.map((m) => m.image_path as string).filter(Boolean)];
  const urls = await getFileStorage()
    .createReadUrls(LOGO_CHECKS_BUCKET, paths, 3600)
    .catch(() => new Map<string, string>());
  const { count } = await createAdminClient().from("logo_checks").select("id", { count: "exact", head: true }).eq("contest_id", contest.id).neq("status", "failed");
  const limits = await checkLimits();
  const lockedUntil = r.locked_until ? new Date(r.locked_until as string).getTime() : 0;
  return {
    ...toItem(r),
    contest: { id: contest.id, slug: contest.slug, brand: contest.brand_name, number: contest.contest_number, clientId: contest.client_id },
    entry: entry ? { id: entry.id, number: entry.number, designer } : null,
    requestedBy: one(r.requester as { id: string; name: string } | null) ?? { id: "", name: "" },
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
    certificate: { pdf: Boolean(r.certificate_pdf_path), png: Boolean(r.certificate_png_path) },
    finishedAt: (r.finished_at as string | null) ?? null,
    stale: (r.status === "queued" || r.status === "running") && lockedUntil < Date.now(),
    costUsd: Number(r.cost_usd) || 0,
    left: checksLeft(count ?? 0, limits),
  };
}

/** For the public /verify page: only the number, date, checked logo and result. */
export async function verifyView(number: number): Promise<{ number: number; finishedAt: string; verdict: Verdict; logoUrl: string | null; closest: number } | null> {
  if (!isSupabaseConfigured()) return null;
  const { data } = await createAdminClient().from("logo_checks").select("number, status, verdict, finished_at, image_path, sources").eq("number", number).maybeSingle();
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
  contest: { id: string; slug: string; brand: string; number: number | null };
  paid: boolean;
  closest: number;
  close: number;
  hasCertificate: boolean;
  stale: boolean;
};

export type ContestCheckCount = { id: string; slug: string; brand: string; number: number | null; used: number; left: number; access: CheckAccess; checkable: boolean; prize: number };

/** My logo checks (owner, 2026-10-10): every check this client asked for, newest first, and the checks left per contest. */
export async function myChecks(userId: string): Promise<{ checks: MyCheck[]; contests: ContestCheckCount[]; limits: CheckLimits }> {
  const limits = await checkLimits();
  if (!isSupabaseConfigured()) return { checks: [], contests: [], limits };
  const db = createAdminClient();
  const [{ data: rows }, { data: own }] = await Promise.all([
    db
      .from("logo_checks")
      .select(`${LIST_COLUMNS}, image_path, paid, sources, certificate_pdf_path, locked_until, contest:contests!contest_id(id, slug, brand_name, contest_number)`)
      .eq("requested_by", userId)
      .order("created_at", { ascending: false })
      .limit(200),
    db.from("contests").select("id, slug, brand_name, contest_number, status, prize_amount, logo_scan").eq("client_id", userId).in("status", [...CHECKABLE_STATUSES]),
  ]);
  const list = (rows ?? []) as unknown as Record<string, unknown>[];
  const urls = await getFileStorage()
    .createReadUrls(LOGO_CHECKS_BUCKET, list.map((r) => r.image_path as string), 3600)
    .catch(() => new Map<string, string>());
  const checks: MyCheck[] = list.map((r) => {
    const c = one(r.contest as { id: string; slug: string; brand_name: string; contest_number: number | null } | null);
    const src = r.sources as Sources | null;
    const lockedUntil = r.locked_until ? new Date(r.locked_until as string).getTime() : 0;
    return {
      ...toItem(r),
      logoUrl: urls.get(r.image_path as string) ?? null,
      contest: { id: c?.id ?? "", slug: c?.slug ?? "", brand: c?.brand_name ?? "", number: c?.contest_number ?? null },
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
    byContest.set(c.id as string, { id: c.id as string, slug: c.slug as string, brand: c.brand_name as string, number: (c.contest_number as number | null) ?? null, used: 0, left: limits.perContest, access, checkable: true, prize: c.prize_amount as number });
  }
  for (const k of checks) {
    if (!byContest.has(k.contest.id)) byContest.set(k.contest.id, { id: k.contest.id, slug: k.contest.slug, brand: k.contest.brand, number: k.contest.number, used: 0, left: limits.perContest, access: k.paid ? "paid" : "free", checkable: false, prize: 0 });
    if (k.status !== "failed") byContest.get(k.contest.id)!.used += 1;
  }
  const contests = [...byContest.values()].map((c) => ({ ...c, left: checksLeft(c.used, limits) }));
  return { checks, contests, limits };
}

export type AdminCheckRow = CheckListItem & {
  logoUrl: string | null;
  contest: { id: string; slug: string; brand: string; number: number | null };
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
    .select(`${LIST_COLUMNS}, image_path, paid, sources, cost_usd, contest_id, contest:contests!contest_id(id, slug, brand_name, contest_number), requester:profiles!requested_by(id, name)`)
    .order("created_at", { ascending: false })
    .limit(500);
  const list = (data ?? []) as unknown as Record<string, unknown>[];
  const urls = await getFileStorage()
    .createReadUrls(LOGO_CHECKS_BUCKET, list.map((r) => r.image_path as string), 3600)
    .catch(() => new Map<string, string>());
  // Number each contest's counted checks in the order they were made.
  const order = new Map<string, string[]>();
  for (const r of [...list].reverse()) if (r.status !== "failed") order.set(r.contest_id as string, [...(order.get(r.contest_id as string) ?? []), r.id as string]);
  return list.map((r) => {
    const c = one(r.contest as { id: string; slug: string; brand_name: string; contest_number: number | null } | null);
    const src = r.sources as Sources | null;
    const n = order.get(r.contest_id as string)?.indexOf(r.id as string) ?? -1;
    return {
      ...toItem(r),
      logoUrl: urls.get(r.image_path as string) ?? null,
      contest: { id: c?.id ?? "", slug: c?.slug ?? "", brand: c?.brand_name ?? "", number: c?.contest_number ?? null },
      requester: one(r.requester as { id: string; name: string } | null) ?? { id: "", name: "—" },
      paid: Boolean(r.paid),
      close: src?.shape.close ?? 0,
      closest: src?.shape.closest ?? 0,
      nth: n >= 0 ? n + 1 : null,
      costUsd: Number(r.cost_usd) || 0,
    };
  });
}
