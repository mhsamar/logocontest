import "server-only";
import { randomUUID } from "node:crypto";
import type { CurrentUser } from "@/lib/auth/policies";
import { checkerReady } from "@/lib/logo-check/start";
import { CHECK_UPLOAD_MAX, CHECK_UPLOAD_TYPES, normalizeLogo } from "@/lib/logo-check/images";
import type { CheckStatus, Verdict } from "@/lib/logo-check/rules";
import { LOGO_CHECKS_BUCKET } from "@/lib/logo-check/run";
import { getFileStorage } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { dhakaMonth, isProActive } from "./rules";
import { getProSettings } from "./settings";
import { getSubscription, getTrial } from "./status";
import { checkWindow, type CheckWindow } from "./trial-rules";

const db = () => createAdminClient();
const UUID = /^[0-9a-f-]{36}$/i;

export type CheckUsage = { ready: boolean; pro: boolean; /** On the free Pro Trial (the limit is for the whole trial). */ trial: boolean; used: number; limit: number; left: number; resetsOn: Date };

/**
 * The checks this designer may use now and the time they count in (owner, 2026-10-14): Pro and Basic per Bangladesh
 * month, the free Pro Trial for the whole trial. monthKey only names the usage row that is locked while starting.
 */
export async function checkWindowFor(designerId: string, now: Date = new Date()): Promise<CheckWindow & { monthKey: string }> {
  const { settings } = await getProSettings();
  const [sub, trial] = await Promise.all([getSubscription(designerId), getTrial(designerId)]);
  const m = dhakaMonth(now);
  const w = checkWindow({ trial, paidPro: isProActive(sub, now), month: m, limits: { pro: settings.proLogoChecks, basic: settings.basicLogoChecks, trial: settings.trialLogoChecks } }, now);
  return { ...w, monthKey: m.key };
}

/** A designer's own logo checks: Basic 2 and Pro 20 a month (they start again on the 1st), the trial 5 in all (owner, 2026-10-29). */
export async function designerCheckUsage(designerId: string, now: Date = new Date()): Promise<CheckUsage> {
  const { ready } = await getProSettings();
  const w = await checkWindowFor(designerId, now);
  const pro = w.kind !== "basic";
  const trial = w.kind === "trial";
  const limit = w.limit;
  if (!ready) return { ready, pro, trial, used: 0, limit, left: 0, resetsOn: w.to };
  const { count } = await db()
    .from("logo_checks")
    .select("id", { count: "exact", head: true })
    .eq("requested_by", designerId)
    // Own checks and checks before sending a design to a contest (owner, 2026-10-14) share the monthly number.
    .in("source", ["designer", "pre_submit"])
    .neq("status", "failed")
    .gte("created_at", w.from.toISOString())
    .lt("created_at", w.to.toISOString());
  const used = count ?? 0;
  return { ready, pro, trial, used, limit, left: Math.max(0, limit - used), resetsOn: w.to };
}

export type DesignerStartError = "not_set_up" | "invalid" | "bad_file" | "too_big" | "limit";

/** A designer checks one of their own logos before sending it. The image is stored, then the check is counted. */
export async function startDesignerCheck(user: CurrentUser, input: { requestKey: string; file: File | null }): Promise<{ ok: true; id: string } | { ok: false; error: DesignerStartError }> {
  const { ready } = await getProSettings();
  if (!ready || !checkerReady()) return { ok: false, error: "not_set_up" };
  if (!UUID.test(input.requestKey) || !input.file) return { ok: false, error: "invalid" };
  const { data: same } = await db().from("logo_checks").select("id, requested_by").eq("request_key", input.requestKey).maybeSingle();
  if (same) return same.requested_by === user.id ? { ok: true, id: same.id as string } : { ok: false, error: "invalid" };
  const usage = await designerCheckUsage(user.id);
  if (usage.left <= 0) return { ok: false, error: "limit" };
  if (input.file.size > CHECK_UPLOAD_MAX) return { ok: false, error: "too_big" };
  if (!(CHECK_UPLOAD_TYPES as readonly string[]).includes(input.file.type)) return { ok: false, error: "bad_file" };
  const png = await normalizeLogo(new Uint8Array(await input.file.arrayBuffer()));
  if (!png) return { ok: false, error: "bad_file" };

  const id = randomUUID();
  const path = `designer/${user.id}/${id}.png`;
  const store = getFileStorage();
  await store.upload(LOGO_CHECKS_BUCKET, path, png, "image/png");
  const w = await checkWindowFor(user.id);
  const { data, error } = await db().rpc("start_designer_logo_check", {
    p_id: id,
    p_request_key: input.requestKey,
    p_user_id: user.id,
    p_image_path: path,
    p_month: w.monthKey,
    p_from: w.from.toISOString(),
    p_to: w.to.toISOString(),
    p_limit: w.limit,
  });
  const started = data as { id: string } | null;
  if (error || !started?.id) {
    await store.remove(LOGO_CHECKS_BUCKET, [path]).catch(() => undefined);
    return { ok: false, error: error?.message?.includes("limit") ? "limit" : "invalid" };
  }
  if (started.id !== id) await store.remove(LOGO_CHECKS_BUCKET, [path]).catch(() => undefined);
  return { ok: true, id: started.id };
}

export type DesignerCheck = {
  id: string;
  number: number;
  status: CheckStatus;
  step: number;
  verdict: Verdict | null;
  overall: number | null;
  uniqueness: number | null;
  advice: string | null;
  error: string | null;
  logoUrl: string | null;
  matches: { imageUrl: string | null; similarity: number; site: string | null; pageUrl: string | null; close: boolean }[];
  createdAt: string;
  stale: boolean;
};

const COLUMNS =
  "id, number, status, step, verdict, scores, advice, error, image_path, created_at, locked_until, requested_by, source, matches:logo_check_matches(position, image_path, similarity, is_close, site, page_url)";

function score(scores: unknown, key: string): number | null {
  const v = (scores as Record<string, { score?: number }> | null)?.[key]?.score;
  return typeof v === "number" ? v : null;
}

async function toCheck(r: Record<string, unknown>): Promise<DesignerCheck> {
  const matches = [...((r.matches as Record<string, unknown>[] | null) ?? [])].sort((a, b) => (a.position as number) - (b.position as number)).slice(0, 4);
  const paths = [r.image_path as string, ...matches.map((m) => m.image_path as string).filter(Boolean)];
  const urls = await getFileStorage().createReadUrls(LOGO_CHECKS_BUCKET, paths, 3600, { width: 640 }).catch(() => new Map<string, string>());
  const lockedUntil = r.locked_until ? new Date(r.locked_until as string).getTime() : 0;
  const status = r.status as CheckStatus;
  return {
    id: r.id as string,
    number: r.number as number,
    status,
    step: (r.step as number) ?? 0,
    verdict: (r.verdict as Verdict | null) ?? null,
    overall: score(r.scores, "overall"),
    uniqueness: score(r.scores, "uniqueness"),
    advice: (r.advice as string | null) ?? null,
    error: (r.error as string | null) ?? null,
    logoUrl: urls.get(r.image_path as string) ?? null,
    matches: matches.map((m) => ({ imageUrl: urls.get(m.image_path as string) ?? null, similarity: (m.similarity as number) ?? 0, site: (m.site as string | null) ?? null, pageUrl: (m.page_url as string | null) ?? null, close: Boolean(m.is_close) })),
    createdAt: r.created_at as string,
    stale: (status === "queued" || status === "running") && lockedUntil < Date.now() && Date.now() - new Date(r.created_at as string).getTime() > 15_000,
  };
}

/** One of this designer's own checks (the pop-up asks every 2 seconds while it runs). */
export async function designerCheckView(id: string, viewer: CurrentUser | null): Promise<DesignerCheck | null> {
  if (!viewer || !UUID.test(id)) return null;
  const { data } = await db().from("logo_checks").select(COLUMNS).eq("id", id).eq("source", "designer").maybeSingle();
  if (!data || data.requested_by !== viewer.id) return null;
  return toCheck(data as Record<string, unknown>);
}

/** This designer's own checks, newest first. */
export async function designerChecks(designerId: string, limit = 20): Promise<DesignerCheck[]> {
  const { ready } = await getProSettings();
  if (!ready) return [];
  const { data } = await db().from("logo_checks").select(COLUMNS).eq("requested_by", designerId).eq("source", "designer").order("created_at", { ascending: false }).limit(limit);
  return Promise.all((data ?? []).map((r) => toCheck(r as Record<string, unknown>)));
}
