import "server-only";
import { ENTRY_FILES_BUCKET } from "@/lib/entries/queries";
import { getFileStorage } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";

/** High matches from designers' logo checks (owner, 2026-10-14): Admin › Copyright checker, keep or remove. */

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

export type CheckFlag = {
  id: string;
  status: "open" | "kept" | "removed";
  score: number;
  reportId: string;
  createdAt: string;
  reviewedAt: string | null;
  reviewer: string | null;
  entry: { id: string; number: number; status: string; coverUrl: string | null };
  contest: { slug: string; brand: string };
  designer: { id: string; name: string; username: string | null };
};

export async function checkFlags(limit = 100): Promise<CheckFlag[]> {
  const { data } = await createAdminClient()
    .from("logo_check_flags")
    .select(
      "id, status, score, created_at, reviewed_at, reviewer:profiles!reviewed_by(name), check:logo_checks!check_id(report_id), contest:contests!contest_id(slug, brand_name), entry:entries!entry_id(id, number, status, designer:profiles!designer_id(id, name, username), images:entry_images!entry_id(position, preview_path))",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  const rows = (data ?? []) as unknown as Record<string, unknown>[];
  const cover = (r: Record<string, unknown>) => {
    const imgs = ((one<Record<string, unknown>>(r.entry as Record<string, unknown> | null)?.images as { position: number; preview_path: string }[] | null) ?? []).sort((a, b) => a.position - b.position);
    return imgs[0]?.preview_path ?? null;
  };
  const urls = await getFileStorage()
    .createReadUrls(ENTRY_FILES_BUCKET, rows.map(cover).filter((p): p is string => !!p), 3600)
    .catch(() => new Map<string, string>());
  // Open ones first, newest first inside each group.
  return rows
    .map((r) => {
      const e = one<Record<string, unknown>>(r.entry as Record<string, unknown> | null);
      const c = one(r.contest as { slug: string; brand_name: string } | null);
      const d = one(e?.designer as { id: string; name: string; username: string | null } | null);
      const p = cover(r);
      return {
        id: r.id as string,
        status: r.status as CheckFlag["status"],
        score: r.score as number,
        reportId: one(r.check as { report_id: string } | null)?.report_id ?? "",
        createdAt: r.created_at as string,
        reviewedAt: (r.reviewed_at as string | null) ?? null,
        reviewer: one(r.reviewer as { name: string } | null)?.name ?? null,
        entry: { id: (e?.id as string) ?? "", number: (e?.number as number) ?? 0, status: (e?.status as string) ?? "", coverUrl: p ? (urls.get(p) ?? null) : null },
        contest: { slug: c?.slug ?? "", brand: c?.brand_name ?? "" },
        designer: d ?? { id: "", name: "—", username: null },
      };
    })
    .sort((a, b) => Number(b.status === "open") - Number(a.status === "open"));
}
