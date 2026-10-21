import "server-only";
import type { EntryStatus } from "@/lib/entries/rules";
import { siteUrl } from "@/lib/seo";
import { getSettings } from "@/lib/settings";
import { designPath, designPinPath } from "@/lib/share/links";
import { createAdminClient } from "@/lib/supabase/admin";
import { backupLinksOn } from "@/lib/site-origin";
import { createPin, PinterestError, pinterestConfigured } from "./api";
import { dueForPin, pinKindFor, PINS_PER_RUN, pinText, type PinKind, type PinterestRule } from "./rules";
import { accessToken, noteError } from "./store";

/**
 * The Pinterest step of the 15-minute job (owner, 2026-10-19): pins the next few designs the admin's rule allows,
 * winners first. Each design is pinned once per kind; a failed one is tried again later, at most three times.
 */

export type Candidate = { entryId: string; kind: PinKind; slug: string; brand: string; number: number; designer: string | null; service: string | null; prevAttempts: number };
export type PinRunResult = { status: "off" | "not_set_up" | "not_connected" | "no_board" | "paused" | "ran"; posted: number; failed: number; waiting: number; errors: string[] };

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

type Row = {
  id: string;
  number: number;
  status: EntryStatus;
  is_hidden: boolean | null;
  designer: { username: string | null } | { username: string | null }[] | null;
  contest: { slug: string; brand_name: string; status: string; is_private: boolean; is_nda: boolean; is_blind: boolean; winner_is_public: boolean; service: string | null } | null;
};

/** Designs waiting for a pin under this rule, winners first, then newest. */
export async function pinCandidates(rule: PinterestRule, now: Date): Promise<Candidate[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("entries")
    .select("id, number, status, is_hidden, created_at, designer:profiles!designer_id(username), contest:contests!contest_id!inner(slug, brand_name, status, is_private, is_nda, is_blind, winner_is_public, service)")
    .in("status", rule === "winners" ? ["winner"] : ["winner", "active"])
    .eq("contest.is_private", false)
    .eq("contest.is_nda", false)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as Row[];
  const { data: pins } = rows.length ? await db.from("pinterest_pins").select("entry_id, kind, status, attempts, created_at, tried_at").in("entry_id", rows.map((r) => r.id)) : { data: [] };
  const prev = new Map((pins ?? []).map((p) => [`${p.entry_id}:${p.kind}`, p]));
  const out: Candidate[] = [];
  for (const r of rows) {
    const c = one(r.contest);
    if (!c) continue;
    const kind = pinKindFor(rule, { status: r.status, isHidden: r.is_hidden }, { status: c.status, isPrivate: c.is_private, isNda: c.is_nda, isBlind: c.is_blind, winnerIsPublic: c.winner_is_public });
    if (!kind) continue;
    const p = prev.get(`${r.id}:${kind}`);
    const before = p ? { status: p.status as "queued" | "posted" | "failed", attempts: p.attempts as number, createdAt: new Date(p.created_at as string), lastTryAt: p.tried_at ? new Date(p.tried_at as string) : null } : null;
    if (!dueForPin(before, now)) continue;
    const username = one(r.designer)?.username ?? null;
    // Blind contests never name the designer.
    out.push({ entryId: r.id, kind, slug: c.slug, brand: c.brand_name, number: r.number, designer: !c.is_blind && username ? `@${username}` : null, service: c.service, prevAttempts: before?.attempts ?? 0 });
  }
  return out.sort((a, b) => Number(b.kind === "winner") - Number(a.kind === "winner"));
}

/** One run. `force` (Admin › Pin now) works while auto-posting is off; `limit` caps the pins. */
export async function runPinterest(now = new Date(), opts: { force?: boolean; limit?: number; kinds?: PinKind[] } = {}): Promise<PinRunResult> {
  const result: PinRunResult = { status: "ran", posted: 0, failed: 0, waiting: 0, errors: [] };
  if (!pinterestConfigured()) return { ...result, status: "not_set_up" };
  const s = await getSettings(["pinterest.on", "pinterest.rule"]);
  if (!s["pinterest.on"] && !opts.force) return { ...result, status: "off" };
  // While Backup links is on, logocontest.bd may be down and Pinterest can't fetch the pictures; waiting keeps each
  // pin's few tries for later (owner, 2026-10-21).
  if (await backupLinksOn()) return { ...result, status: "paused" };
  const db = createAdminClient();
  const { data: conn, error } = await db.from("pinterest_connection").select("board_id").maybeSingle();
  if (error || !conn) return { ...result, status: "not_connected" };
  if (!conn.board_id) return { ...result, status: "no_board" };

  let token: string;
  try {
    token = await accessToken(now);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await noteError(msg);
    return { ...result, errors: [msg] };
  }

  const all = (await pinCandidates(s["pinterest.rule"], now)).filter((c) => !opts.kinds || opts.kinds.includes(c.kind));
  const batch = all.slice(0, opts.limit ?? PINS_PER_RUN);
  result.waiting = all.length - batch.length;
  const base = siteUrl();
  for (const c of batch) {
    const tried = now.toISOString();
    await db.from("pinterest_pins").upsert({ entry_id: c.entryId, kind: c.kind, status: "queued", attempts: c.prevAttempts + 1, tried_at: tried }, { onConflict: "entry_id,kind" });
    try {
      const text = pinText({ brand: c.brand, number: c.number, designer: c.designer, kind: c.kind, service: c.service });
      const pin = await createPin(token, { boardId: conn.board_id as string, ...text, link: `${base}${designPath(c.slug, c.number)}`, imageUrl: `${base}${designPinPath(c.slug, c.number)}` });
      await db.from("pinterest_pins").update({ status: "posted", pin_id: pin.id, posted_at: new Date().toISOString(), last_error: null }).eq("entry_id", c.entryId).eq("kind", c.kind);
      result.posted++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await db.from("pinterest_pins").update({ status: "failed", last_error: msg.slice(0, 300) }).eq("entry_id", c.entryId).eq("kind", c.kind);
      result.failed++;
      result.errors.push(`${c.slug} #${c.number}: ${msg}`);
      // The login itself stopped working: stop here and show it in Admin › Pinterest.
      if (e instanceof PinterestError && (e.status === 401 || e.status === 403)) {
        await noteError(msg);
        break;
      }
    }
  }
  if (result.posted > 0) await noteError(null);
  return result;
}
