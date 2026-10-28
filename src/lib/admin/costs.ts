import "server-only";
import { aiConfigured } from "@/lib/logo-check/ai";
import { monthFromKey } from "@/lib/logo-check/cost-report";
import { checkerRates, toBdt } from "@/lib/logo-check/costs";
import { getSetting, getSettings } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { COST_KEYS, costLines, linesTotal, pricesFrom, type CostLine, type CostPrices, type CostSwitches, type MonthCounts } from "./cost-rules";

/**
 * Admin › Costs (owner, 2026-10-27; the rules are in cost-rules.ts): this month and the five before it. Only counts
 * are asked for (no rows), except the checker's kept costs, so the page stays light.
 */

const db = () => createAdminClient();
type Range = { from: Date; to: Date };
const n = (r: { count: number | null }) => r.count ?? 0;

type CheckCost = { cost_usd: number | null; cost_bdt: number | null };

/** The checker's kept costs for the month, in pages of 1,000 (the API's page size). */
async function checkerCosts(from: string, to: string): Promise<CheckCost[]> {
  const rows: CheckCost[] = [];
  for (let at = 0; at < 50_000; at += 1000) {
    const { data, error } = await db().from("logo_checks").select("cost_usd, cost_bdt").gte("created_at", from).lt("created_at", to).order("id").range(at, at + 999);
    if (error || !data) break;
    rows.push(...(data as CheckCost[]));
    if (data.length < 1000) break;
  }
  return rows;
}

async function monthCounts(range: Range, rates: Awaited<ReturnType<typeof checkerRates>>): Promise<MonthCounts> {
  const [from, to] = [range.from.toISOString(), range.to.toISOString()];
  const head = { count: "exact", head: true } as const;
  const [rows, checks, designs, designPictures, pictures, aiReplies, emails, emailsFailed] = await Promise.all([
    checkerCosts(from, to),
    db().from("logo_checks").select("id", head).gte("created_at", from).lt("created_at", to),
    // The design check looks at logo designs only (a contest service with its own pictures skips it).
    db().from("entries").select("id, contest:contests!inner(service)", head).or("service.is.null,service.eq.logo", { referencedTable: "contest" }).gte("created_at", from).lt("created_at", to),
    db().from("entry_images").select("id, entry:entries!entry_id!inner(contest:contests!inner(service))", head).eq("entry.contest.service", "logo").gte("created_at", from).lt("created_at", to),
    db().from("entry_images").select("id", head).gte("created_at", from).lt("created_at", to),
    db().from("support_messages").select("id", head).eq("is_ai", true).gte("created_at", from).lt("created_at", to),
    db().from("email_log").select("id", head).eq("status", "sent").gte("created_at", from).lt("created_at", to),
    db().from("email_log").select("id", head).eq("status", "failed").gte("created_at", from).lt("created_at", to),
  ]);
  return {
    checks: n(checks),
    // Older checks kept only USD: shown in taka at today's rate, like the checker's own report.
    checkerBdt: rows.reduce((a, r) => a + (r.cost_bdt === null ? toBdt(Number(r.cost_usd) || 0, rates) : Number(r.cost_bdt)), 0),
    designs: n(designs),
    designPictures: n(designPictures),
    pictures: n(pictures),
    aiReplies: n(aiReplies),
    emails: n(emails),
    emailsFailed: n(emailsFailed),
  };
}

/** key: the month, "2026-10". */
export type CostMonth = { key: string; lines: CostLine[]; total: number; emailsFailed: number };
export type CostsPage = { month: CostMonth; history: CostMonth[]; prices: CostPrices; on: CostSwitches & { ai: boolean } };

export async function costsPage(monthKey: string | null, now: Date = new Date()): Promise<CostsPage> {
  // This month and the five before it (the 15th of each, so no month comes twice); the chosen one is one of them.
  const current = monthFromKey(null, now);
  const months = Array.from({ length: 6 }, (_, i) => monthFromKey(null, new Date(Date.UTC(Number(current.key.slice(0, 4)), Number(current.key.slice(5, 7)) - 1 - i, 15))));
  const [s, rates, designCheckOn] = await Promise.all([getSettings([...COST_KEYS]), checkerRates(), getSetting("designs.relevance_check").catch(() => true)]);
  const prices = pricesFrom(s);
  const ai = aiConfigured();
  // The nude-photo check calls Google only with MODERATION_DRIVER=google; otherwise it costs nothing.
  const on = { ai, designCheck: ai && designCheckOn, safeSearch: process.env.MODERATION_DRIVER === "google" };
  const all = await Promise.all(
    months.map(async (m) => {
      const c = await monthCounts(m, rates);
      const lines = costLines(c, prices, on);
      return { key: m.key, lines, total: linesTotal(lines), emailsFailed: c.emailsFailed };
    }),
  );
  return { month: all.find((m) => m.key === monthKey) ?? all[0], history: all, prices, on };
}
