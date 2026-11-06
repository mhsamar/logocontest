import "server-only";
import { contestHref } from "@/lib/client/rules";
import { tellClient } from "@/lib/guarantee/notices";
import { contestGuarantee } from "@/lib/guarantee/queries";
import { notify } from "@/lib/notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import { splitPrize, type SplitEntry } from "./rules";

export type NoResultContest = { id: string; slug: string; brand_name: string; client_id: string; prize_amount: number };
type Tiers = Parameters<typeof splitPrize>[3];

/** The prize shared equally among the designers who took part (§2, §7.5), as the rules work it out. */
export async function noResultShares(contestId: string, prize: number, tiers: Tiers) {
  const db = createAdminClient();
  const { data: entries } = await db.from("entries").select("designer_id, status, created_at").eq("contest_id", contestId);
  const list: SplitEntry[] = (entries ?? []).map((e) => ({ designerId: e.designer_id as string, status: e.status as string, createdAt: new Date(e.created_at as string) }));
  const ids = [...new Set(list.map((e) => e.designerId))];
  const { data: profiles } = ids.length ? await db.from("profiles").select("id, counted_wins_count").in("id", ids) : { data: [] };
  const wins = new Map((profiles ?? []).map((p) => [p.id as string, (p.counted_wins_count as number) ?? 0]));
  return splitPrize(prize, list, (id) => wins.get(id) ?? 0, tiers);
}

/**
 * Ends a contest with no result: shares the prize (one credit per designer) and tells the client and the designers.
 * Used by the daily run, and since 2026-11-06 by the team's "Share among everyone" (owner). `once` records a notice.
 * False when it was already finished.
 */
export async function finishNoResult(c: NoResultContest, tiers: Tiers, now: Date, once: (contestId: string, kind: string) => Promise<boolean>): Promise<boolean> {
  const db = createAdminClient();
  const shares = await noResultShares(c.id, c.prize_amount, tiers);
  const { data: done, error } = await db.rpc("finish_no_result", {
    p_contest_id: c.id,
    p_shares: shares.map((x) => ({ designer_id: x.designerId, share: x.share, fee_rate: x.feeRate })),
  });
  if (error) throw new Error(error.message);
  if (!done || !(done as { id?: string }).id) return false;
  // Nobody got a share and the guarantee still applies (owner, 2026-10-21): the client hears they can claim, not that
  // the prize was shared.
  const late = shares.length === 0 ? await contestGuarantee(c.id, now) : null;
  if (late?.state.kind === "available" && late.state.late) {
    if (await once(c.id, "guarantee_available_late")) await tellClient("available", { clientId: c.client_id, slug: c.slug, brand: c.brand_name }, { min: late.state.min, designers: late.state.designers, until: late.state.until, late: true });
  } else await notify([c.client_id], "no_result_client", { brand: c.brand_name }, contestHref(c.slug));
  for (const x of shares) await notify([x.designerId], "no_result_share", { brand: c.brand_name, amount: x.credit }, "/dashboard/wallet");
  return true;
}
