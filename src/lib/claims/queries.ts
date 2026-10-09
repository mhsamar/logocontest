import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { ENTRY_FILES_BUCKET } from "@/lib/entries/queries";
import { getFileStorage } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ClaimDecision } from "./rules";

/** Copy claims (BLUEPRINT §7.6, owner 2026-10-09). */
export type CopyClaim = {
  id: string;
  status: "open" | "upheld" | "rejected";
  outcome: Exclude<ClaimDecision, "rejected"> | null;
  note: string;
  links: string[];
  adminNote: string | null;
  fineAmount: number | null;
  createdAt: Date;
  resolvedAt: Date | null;
};

const COLUMNS = "id, status, outcome, note, evidence_urls, admin_note, fine_amount, created_at, resolved_at";

const toClaim = (r: Record<string, unknown>): CopyClaim => ({
  id: r.id as string,
  status: r.status as CopyClaim["status"],
  outcome: (r.outcome as CopyClaim["outcome"]) ?? null,
  note: r.note as string,
  links: (r.evidence_urls as string[] | null) ?? [],
  adminNote: (r.admin_note as string | null) ?? null,
  fineAmount: (r.fine_amount as number | null) ?? null,
  createdAt: new Date(r.created_at as string),
  resolvedAt: r.resolved_at ? new Date(r.resolved_at as string) : null,
});

/** The newest claim on a handover, if any. */
export async function latestClaim(handoverId: string): Promise<CopyClaim | null> {
  if (!isSupabaseConfigured()) return null;
  const { data } = await createAdminClient().from("copy_claims").select(COLUMNS).eq("handover_id", handoverId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data ? toClaim(data) : null;
}

/** Handover ids (of this designer) with an open claim, for the wallet's "on hold" line. */
export async function openClaimHandoverIds(designerId: string): Promise<Set<string>> {
  if (!isSupabaseConfigured()) return new Set();
  const { data } = await createAdminClient().from("copy_claims").select("handover_id").eq("designer_id", designerId).eq("status", "open");
  return new Set((data ?? []).map((r) => r.handover_id as string));
}

export type AdminClaim = CopyClaim & {
  contest: { slug: string; brand: string; number: number | null };
  entryNumber: number;
  coverUrl: string | null;
  designer: { id: string; name: string; username: string | null; balance: number };
  client: { name: string };
  handoverStatus: string;
};

const one = <T>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

/** A-13: open claims, oldest first, with the winning design and both people. */
export async function listOpenClaims(): Promise<AdminClaim[]> {
  if (!isSupabaseConfigured()) return [];
  const db = createAdminClient();
  const { data } = await db
    .from("copy_claims")
    .select(
      `${COLUMNS}, designer_id, contest:contests!contest_id(slug, brand_name, contest_number), entry:entries!entry_id(number, images:entry_images!entry_id(position, preview_path)), ` +
        "designer:profiles!designer_id(name, username), client:profiles!client_id(name), handover:handovers!handover_id(status)",
    )
    .eq("status", "open")
    .order("created_at", { ascending: true });
  const rows = (data ?? []) as unknown as (Record<string, unknown> & {
    designer_id: string;
    contest: { slug: string; brand_name: string; contest_number: number | null } | null;
    entry: { number: number; images: { position: number; preview_path: string }[] | null } | null;
    designer: { name: string; username: string | null } | null;
    client: { name: string } | null;
    handover: { status: string } | null;
  })[];
  const covers = rows.map((r) => [...(one(r.entry)?.images ?? [])].sort((a, b) => a.position - b.position)[0]?.preview_path ?? null);
  const [urls, balances] = await Promise.all([
    getFileStorage()
      .createReadUrls(
        ENTRY_FILES_BUCKET,
        covers.filter((p): p is string => Boolean(p)),
        3600,
      )
      .catch(() => new Map<string, string>()),
    Promise.all(rows.map((r) => db.rpc("wallet_balance", { p_designer_id: r.designer_id }).then((x) => (x.data as number | null) ?? 0))),
  ]);
  return rows.map((r, i) => {
    const c = one(r.contest);
    const d = one(r.designer);
    return {
      ...toClaim(r),
      contest: { slug: c?.slug ?? "", brand: c?.brand_name ?? "", number: c?.contest_number ?? null },
      entryNumber: one(r.entry)?.number ?? 0,
      coverUrl: covers[i] ? (urls.get(covers[i]!) ?? null) : null,
      designer: { id: r.designer_id, name: d?.name ?? "—", username: d?.username ?? null, balance: balances[i] },
      client: { name: one(r.client)?.name ?? "—" },
      handoverStatus: one(r.handover)?.status ?? "",
    };
  });
}
