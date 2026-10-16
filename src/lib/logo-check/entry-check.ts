import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { hasPermission } from "@/lib/admin/permissions";
import { can, type CurrentUser } from "@/lib/auth/policies";
import { passesNda } from "@/lib/contests/nda";
import { ENTRY_FILES_BUCKET } from "@/lib/entries/queries";
import { suspendedError } from "@/lib/moderation/suspension";
import { contestVisibleTo } from "@/lib/pro/limits";
import { checkWindowFor, designerCheckUsage, type CheckUsage } from "@/lib/pro/logo-checks";
import { getProSettings } from "@/lib/pro/settings";
import { isPro } from "@/lib/pro/status";
import { getFileStorage } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { BADGE_COLUMNS, sha256Hex, toBadgeCheck } from "./entry-links";
import { badgeFor, isReportId, reportIdFrom, verifyState, type ClosestResult, type MatchLevel } from "./entry-rules";
import { normalizeLogo } from "./images";
import { LOGO_CHECKS_BUCKET } from "./run";
import { checkerReady } from "./start";

/**
 * Logo check inside contests (owner, 2026-10-14; Design/logo-check). The designer uploads the cover of a design,
 * then checks it here before sending: one of their monthly checks (Basic 2, Pro 100). The server makes the
 * fingerprint of the exact stored file and runs the existing Logo Checker. The browser never sends a score.
 */

const db = () => createAdminClient();
const UUID = /^[0-9a-f-]{36}$/i;
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

export type EntryCheckError = "not_set_up" | "invalid" | "closed" | "not_found" | "bad_file" | "limit" | "suspended";

/** Designers may check before sending only where they may send: open contest, early access, NDA signed. */
async function sendableContest(contestId: string, user: CurrentUser) {
  const { data: c } = await db().from("contests").select("id, slug, status, starts_at, ends_at, is_nda, brand_name, client_id").eq("id", contestId).maybeSingle();
  if (!c || c.status !== "open" || (c.ends_at && new Date(c.ends_at as string) <= new Date())) return null;
  if (!(await contestVisibleTo(c.starts_at ? new Date(c.starts_at as string) : null, user))) return null;
  if (c.is_nda && !(await passesNda({ id: c.id as string, isNda: true, ownerId: c.client_id as string }, user))) return null;
  return c;
}

export async function startEntryCheck(user: CurrentUser, input: { contestId: string; requestKey: string; path: string }): Promise<{ ok: true; id: string; reportId: string } | { ok: false; error: EntryCheckError }> {
  const { ready } = await getProSettings();
  if (!ready || !checkerReady()) return { ok: false, error: "not_set_up" };
  if (suspendedError(user)) return { ok: false, error: "suspended" };
  if (!can(user, "entry.submit")) return { ok: false, error: "invalid" };
  if (!UUID.test(input.contestId) || !UUID.test(input.requestKey)) return { ok: false, error: "invalid" };
  // Only a design this designer uploaded for this contest (the same place the send form uploads to).
  if (!new RegExp(`^originals/${input.contestId}/${user.id}/[0-9a-f-]{36}\\.(jpg|png|webp)$`).test(input.path)) return { ok: false, error: "invalid" };

  // A double click: the first request already started the check.
  const { data: same } = await db().from("logo_checks").select("id, requested_by, report_id").eq("request_key", input.requestKey).maybeSingle();
  if (same) return same.requested_by === user.id && same.report_id ? { ok: true, id: same.id as string, reportId: same.report_id as string } : { ok: false, error: "invalid" };

  if (!(await sendableContest(input.contestId, user))) return { ok: false, error: "closed" };
  const usage = await designerCheckUsage(user.id);
  if (usage.left <= 0) return { ok: false, error: "limit" };

  const store = getFileStorage();
  const bytes = await store.download(ENTRY_FILES_BUCKET, input.path).catch(() => null);
  if (!bytes) return { ok: false, error: "not_found" };
  const sha = sha256Hex(bytes);
  const png = await normalizeLogo(bytes);
  if (!png) return { ok: false, error: "bad_file" };

  const id = randomUUID();
  const imagePath = `${id}/logo.png`;
  await store.upload(LOGO_CHECKS_BUCKET, imagePath, png, "image/png");
  // The month (Pro, Basic) or the whole free trial (owner, 2026-10-14).
  const w = await checkWindowFor(user.id);
  // A report ID clash is very unlikely (32^8); try again once with a new one.
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, error } = await db().rpc("start_entry_logo_check", {
      p_id: id,
      p_request_key: input.requestKey,
      p_user_id: user.id,
      p_contest_id: input.contestId,
      p_image_path: imagePath,
      p_report_id: reportIdFrom(randomBytes(8)),
      p_sha256: sha,
      p_month: w.monthKey,
      p_from: w.from.toISOString(),
      p_to: w.to.toISOString(),
      p_limit: w.limit,
    });
    const started = data as { id: string; report_id: string } | null;
    if (!error && started?.id) {
      if (started.id !== id) await store.remove(LOGO_CHECKS_BUCKET, [imagePath]).catch(() => undefined);
      return { ok: true, id: started.id, reportId: started.report_id };
    }
    if (error?.message?.includes("report_id")) continue;
    await store.remove(LOGO_CHECKS_BUCKET, [imagePath]).catch(() => undefined);
    const code = error?.message?.includes("limit") ? "limit" : error?.message?.includes("closed") ? "closed" : "invalid";
    return { ok: false, error: code };
  }
  await store.remove(LOGO_CHECKS_BUCKET, [imagePath]).catch(() => undefined);
  return { ok: false, error: "invalid" };
}

export type EntryCheckState = {
  id: string;
  reportId: string;
  status: "queued" | "running" | "done" | "failed";
  step: number;
  score: number | null;
  level: MatchLevel | null;
  results: ClosestResult[];
  error: string | null;
  /** No runner holds an unfinished check (a poll starts it again). */
  stale: boolean;
  usage: Pick<CheckUsage, "pro" | "trial" | "used" | "limit" | "left"> & { resetsOn: string };
};

/** The send pop-up follows its check every 2 seconds: only the designer who started it sees it. */
export async function entryCheckState(id: string, user: CurrentUser): Promise<EntryCheckState | null> {
  if (!UUID.test(id)) return null;
  const { data: r } = await db().from("logo_checks").select("id, report_id, status, step, score, level, results, error, locked_until, created_at, requested_by, source").eq("id", id).maybeSingle();
  if (!r || r.source !== "pre_submit" || r.requested_by !== user.id) return null;
  const usage = await designerCheckUsage(user.id);
  const lockedUntil = r.locked_until ? new Date(r.locked_until as string).getTime() : 0;
  const now = new Date().getTime();
  return {
    id: r.id as string,
    reportId: r.report_id as string,
    status: r.status as EntryCheckState["status"],
    step: (r.step as number) ?? 0,
    score: (r.score as number | null) ?? null,
    level: (r.level as MatchLevel | null) ?? null,
    results: (r.results as ClosestResult[] | null) ?? [],
    error: (r.error as string | null) ?? null,
    stale: (r.status === "queued" || r.status === "running") && lockedUntil < now && now - new Date(r.created_at as string).getTime() > 15_000,
    usage: { pro: usage.pro, trial: usage.trial, used: usage.used, limit: usage.limit, left: usage.left, resetsOn: usage.resetsOn.toISOString() },
  };
}

// ---------------------------------------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------------------------------------

export type EntryReport = {
  reportId: string;
  /** The check behind the report, for the full report (owner, 2026-10-16). */
  checkId: string;
  entry: { id: string; number: number; status: string; coverUrl: string | null };
  contest: { id: string; slug: string; brand: string; clientId: string };
  designer: { id: string; name: string; username: string | null; pro: boolean };
  checkedAt: string;
  score: number;
  level: MatchLevel;
  sourcesCount: number;
  results: ClosestResult[];
  fileSha256: string;
  /** The entry still uses the checked file. */
  sameFile: boolean;
};

const REPORT_COLUMNS =
  "id, report_id, status, score, level, results, sources_count, file_sha256, finished_at, created_at, entry_id, source, " +
  "entry:entries!entry_id(id, number, status, check_id, file_sha256, designer:profiles!designer_id(id, name, username), images:entry_images!entry_id(position, preview_path)), " +
  "contest:contests!contest_id(id, slug, brand_name, client_id, is_private, is_nda, is_blind, status)";

type ReportRow = Record<string, unknown>;

async function loadReport(where: { reportId?: string; checkId?: string }): Promise<ReportRow | null> {
  let q = db().from("logo_checks").select(REPORT_COLUMNS).eq("source", "pre_submit").eq("status", "done").not("entry_id", "is", null);
  if (where.reportId) q = q.eq("report_id", where.reportId);
  else if (where.checkId) q = q.eq("id", where.checkId);
  else return null;
  const { data } = await q.maybeSingle();
  return (data as unknown as ReportRow | null) ?? null;
}

async function toReport(r: ReportRow, coverUrl: string | null): Promise<EntryReport> {
  const e = one<Record<string, unknown>>(r.entry as Record<string, unknown> | null)!;
  const c = one<Record<string, unknown>>(r.contest as Record<string, unknown> | null)!;
  const d = one(e.designer as { id: string; name: string; username: string | null } | null) ?? { id: "", name: "—", username: null };
  return {
    reportId: r.report_id as string,
    checkId: r.id as string,
    entry: { id: e.id as string, number: e.number as number, status: e.status as string, coverUrl },
    contest: { id: c.id as string, slug: c.slug as string, brand: c.brand_name as string, clientId: c.client_id as string },
    designer: { ...d, pro: d.id ? await isPro(d.id) : false },
    checkedAt: ((r.finished_at ?? r.created_at) as string) ?? "",
    score: (r.score as number | null) ?? 0,
    level: (r.level as MatchLevel | null) ?? "low",
    sourcesCount: (r.sources_count as number | null) ?? 0,
    results: (r.results as ClosestResult[] | null) ?? [],
    fileSha256: r.file_sha256 as string,
    sameFile: verifyState(r.file_sha256 as string, (e.file_sha256 as string | null) ?? null) === "valid" && e.check_id === r.id,
  };
}

async function coverOf(r: ReportRow): Promise<string | null> {
  const e = one<Record<string, unknown>>(r.entry as Record<string, unknown> | null);
  const imgs = ((e?.images as { position: number; preview_path: string }[] | null) ?? []).sort((a, b) => a.position - b.position);
  if (!imgs[0]) return null;
  const urls = await getFileStorage()
    .createReadUrls(ENTRY_FILES_BUCKET, [imgs[0].preview_path], 3600)
    .catch(() => new Map<string, string>());
  return urls.get(imgs[0].preview_path) ?? null;
}

/** Full report details: the entry's designer, the contest's client and admins with Copyright checker. */
const canSeeReport = (viewer: CurrentUser | null, r: ReportRow) => {
  if (!viewer) return false;
  const e = one(r.entry as { designer: unknown } | null);
  const d = one(e?.designer as { id: string } | null);
  const c = one(r.contest as { client_id: string } | null);
  return viewer.id === c?.client_id || viewer.id === d?.id || hasPermission(viewer, "copyright.view");
};

/** The report on one entry of the client's contest (the report panel), or null when there is no valid badge. */
export async function entryReport(entry: { id: string; checkId: string | null; fileSha256: string | null }, viewer: CurrentUser | null): Promise<EntryReport | null> {
  if (!entry.checkId) return null;
  const { data: k } = await db().from("logo_checks").select(BADGE_COLUMNS).eq("id", entry.checkId).maybeSingle();
  if (badgeFor(entry, k ? toBadgeCheck(k as Record<string, unknown>) : null).kind !== "checked") return null;
  const r = await loadReport({ checkId: entry.checkId });
  if (!r || !canSeeReport(viewer, r)) return null;
  return toReport(r, await coverOf(r));
}

/** For the PDF: the same people as the report panel. */
export async function reportById(reportId: string, viewer: CurrentUser | null): Promise<EntryReport | null> {
  if (!isReportId(reportId)) return null;
  const r = await loadReport({ reportId });
  if (!r || !canSeeReport(viewer, r)) return null;
  return toReport(r, null);
}

export type PublicReport = {
  reportId: string;
  state: "valid" | "changed";
  entryNumber: number;
  /** Null when the contest or the entry isn't public (private, NDA, blind while running, removed). */
  contest: string | null;
  coverUrl: string | null;
  designer: { name: string; username: string | null };
  checkedAt: string;
  score: number;
  level: MatchLevel;
  shortSha: string;
};

/** The public verify page: only the summary (handoff §4), and only for reports on a sent entry. */
export async function publicReport(reportId: string): Promise<PublicReport | null> {
  if (!isReportId(reportId)) return null;
  const r = await loadReport({ reportId });
  if (!r) return null;
  const rep = await toReport(r, null);
  const c = one(r.contest as { is_private: boolean; is_nda: boolean; is_blind: boolean; status: string } | null);
  const shown = !!c && !c.is_private && !c.is_nda && !(c.is_blind && (c.status === "open" || c.status === "judging")) && ["active", "winner", "rejected"].includes(rep.entry.status);
  return {
    reportId: rep.reportId,
    state: rep.sameFile ? "valid" : "changed",
    entryNumber: rep.entry.number,
    contest: shown ? rep.contest.brand : null,
    coverUrl: shown ? await coverOf(r) : null,
    designer: { name: rep.designer.name, username: rep.designer.username },
    checkedAt: rep.checkedAt,
    score: rep.score,
    level: rep.level,
    shortSha: `${rep.fileSha256.slice(0, 4)}…${rep.fileSha256.slice(-4)}`,
  };
}

/** The send pop-up's starting numbers: checks left this month and whether the checker can run. */
export async function sendCheckSetup(user: CurrentUser): Promise<{ ready: boolean; usage: EntryCheckState["usage"]; priceBdt: number; proForSale: boolean }> {
  const [{ settings, ready }, usage] = await Promise.all([getProSettings(), designerCheckUsage(user.id)]);
  return {
    ready: ready && checkerReady(),
    usage: { pro: usage.pro, trial: usage.trial, used: usage.used, limit: usage.limit, left: usage.left, resetsOn: usage.resetsOn.toISOString() },
    priceBdt: settings.priceBdt,
    proForSale: ready && settings.isForSale,
  };
}
