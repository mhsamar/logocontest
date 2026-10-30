import "server-only";
import { unstable_cache } from "next/cache";
import { isSupabaseConfigured } from "@/lib/env";
import { winningDesigns, type WinningDesign } from "@/lib/rewards/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { HOME_LOGOS_TAG } from "./logos";

/**
 * "Meet the designers who won" on the new home page (owner, 2026-10-29; Design/logocontest-site/index.html #winners):
 * each card is a winning logo, its designer and the contest prize. Built on winningDesigns(), so the same designs as
 * the winners gallery: completed public contests only, never private or NDA, never a test client's, and a blind
 * contest's winner only when the client made it public, without the designer's name. On top of that: logo contests
 * only (the card says "Winning logo"), and only an active, real designer, as on the designers wall (never a test,
 * suspended, banned or deleted one). No client data leaves this file.
 */

export type HomeWinner = {
  entryId: string;
  /** The winning logo through /api/img, which the CDN keeps (owner, 2026-10-27). */
  logoUrl: string;
  brandName: string;
  /** The contest prize in taka; the page shows it through price(). */
  prize: number;
  /** Null for a blind contest's winner: the name stays off. */
  designer: { name: string; initials: string; username: string | null; avatarUrl: string | null } | null;
};

/** Four cards are the least that fill a wide screen's marquee; with fewer the cards stand still, centred (owner,
 * 2026-10-30: the section hid until the fourth winner, so the site's first winner never showed). */
export const MARQUEE_WINNERS = 4;

/** What winningDesigns() doesn't select: the prize, the kind of contest and the designer's account state. */
export type WinnerFacts = { prize: number; service: string; designerIsTest: boolean; designerStatus: string | null };

type Candidate = Pick<WinningDesign, "entryId" | "designerId" | "brandName" | "coverUrl" | "designer">;

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => Array.from(w)[0]!.toUpperCase())
    .join("") || "•";

const shown = (f: WinnerFacts | undefined): f is WinnerFacts =>
  !!f && f.service === "logo" && f.prize > 0 && !f.designerIsTest && f.designerStatus === "active";

/**
 * Pure part of homeWinners(): the admin's featured logos (Admin › Homepage) first, in their order; then the newest,
 * one card per designer not shown yet, as the section is about the designers; any room left goes to those designers'
 * other wins, newest first. Never the same design twice, never one without a picture or that the rules above hide.
 */
export function pickWinners(featuredIds: string[], featured: Candidate[], newest: Candidate[], facts: Map<string, WinnerFacts>, limit: number): HomeWinner[] {
  const byId = new Map(featured.map((d) => [d.entryId, d]));
  const picked: { d: Candidate; f: WinnerFacts }[] = [];
  const seen = new Set<string>();
  const designers = new Set<string>();
  const take = (d: Candidate | undefined, oncePerDesigner: boolean) => {
    if (!d || !d.coverUrl || seen.has(d.entryId) || (oncePerDesigner && designers.has(d.designerId))) return;
    const f = facts.get(d.entryId);
    if (!shown(f)) return;
    seen.add(d.entryId);
    designers.add(d.designerId);
    picked.push({ d, f });
  };
  for (const id of featuredIds) take(byId.get(id), false);
  for (const d of newest) take(d, true);
  for (const d of newest) take(d, false);
  return picked.slice(0, Math.max(0, limit)).map(({ d, f }) => ({
    entryId: d.entryId,
    logoUrl: d.coverUrl!,
    brandName: d.brandName,
    prize: f.prize,
    designer: d.designer ? { name: d.designer.name, initials: initials(d.designer.name), username: d.designer.username, avatarUrl: d.designer.avatarUrl } : null,
  }));
}

/** The winners for the home page marquee; [] when there are none or the database can't answer (the section hides). */
export async function homeWinners(limit = 12): Promise<HomeWinner[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    return await cachedWinners(limit);
  } catch {
    return [];
  }
}

// The same for every visitor, so kept for 5 minutes like the home logos, and cleared with them when an admin changes
// the featured logos. A failed load throws, so it is not kept. The picture links inside last 12 to 24 hours.
const cachedWinners = unstable_cache((limit: number) => loadWinners(limit), ["home-winners-v1"], { tags: [HOME_LOGOS_TAG], revalidate: 300 });

async function loadWinners(limit: number): Promise<HomeWinner[]> {
  const db = createAdminClient();
  // The same featured list as homeLogos() (logos.ts).
  const { data, error } = await db.from("featured_logos").select("entry_id").order("position").limit(limit);
  if (error) throw new Error(error.message);
  const featuredIds = (data ?? []).map((r) => r.entry_id as string);
  // Three times the newest needed: repeats, other design types and hidden designers drop out below.
  // Strict: a failed read throws instead of coming back empty, so an outage never hides the section for 5 minutes.
  const [featured, newest] = await Promise.all([featuredIds.length ? winningDesigns({ entryIds: featuredIds, limit, strict: true }) : Promise.resolve([]), winningDesigns({ limit: limit * 3, strict: true })]);
  const ids = [...new Set([...featured, ...newest].map((d) => d.entryId))];
  if (!ids.length) return [];
  // Not one picture link could be made: storage failed, so don't keep the empty list either.
  if ([...featured, ...newest].every((d) => !d.coverUrl)) throw new Error("winner pictures unavailable");
  const facts = await winnerFacts(ids);
  return pickWinners(featuredIds, featured, newest, facts, limit);
}

async function winnerFacts(entryIds: string[]): Promise<Map<string, WinnerFacts>> {
  const { data, error } = await createAdminClient()
    .from("entries")
    .select("id, contest:contests!contest_id(prize_amount, service), designer:profiles!designer_id(is_test, status)")
    .in("id", entryIds);
  if (error) throw new Error(error.message);
  const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));
  type Row = { id: string; contest: unknown; designer: unknown };
  const out = new Map<string, WinnerFacts>();
  for (const r of (data ?? []) as unknown as Row[]) {
    const c = one(r.contest as { prize_amount: number | null; service: string | null } | null);
    const p = one(r.designer as { is_test: boolean | null; status: string | null } | null);
    if (!c || !p) continue;
    out.set(r.id, { prize: c.prize_amount ?? 0, service: c.service ?? "logo", designerIsTest: p.is_test !== false, designerStatus: p.status });
  }
  return out;
}
