import "server-only";
import { GONE_STATUSES } from "@/lib/entries/rules";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Admin › Pro plan › Invitations (owner, 2026-10-14): every invitation clients sent to Pro designers, how the designer
 * answered and when, and whether they took part (sent a design). Real data only.
 */

const db = () => createAdminClient();
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

export type AdminInviteStatus = "unsent" | "pending" | "accepted" | "declined" | "removed";

export type AdminInvite = {
  contest: { id: string; slug: string; brand: string; number: number | null; status: string };
  client: { id: string; name: string };
  designer: { id: string; name: string; username: string | null };
  status: AdminInviteStatus;
  createdAt: string;
  notifiedAt: string | null;
  respondedAt: string | null;
  removedAt: string | null;
  designs: number;
};

export type InviteOverview = { rows: AdminInvite[]; sent: number; accepted: number; declined: number; joined: number; counts: Record<AdminInviteStatus | "all", number> };

export async function inviteOverview(limit = 500): Promise<InviteOverview> {
  const { data, error } = await db()
    .from("contest_invites")
    .select(
      "contest_id, designer_id, status, created_at, notified_at, responded_at, removed_at, contest:contests!contest_id(id, slug, brand_name, contest_number, status), designer:profiles!designer_id(id, name, username), client:profiles!invited_by(id, name)",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  const raw = error ? [] : ((data ?? []) as unknown as Record<string, unknown>[]);
  const contestIds = [...new Set(raw.map((r) => r.contest_id as string))];
  const designerIds = [...new Set(raw.map((r) => r.designer_id as string))];
  const { data: entries } = contestIds.length
    ? await db().from("entries").select("contest_id, designer_id").in("contest_id", contestIds).in("designer_id", designerIds).not("status", "in", `(${GONE_STATUSES.join(",")})`)
    : { data: [] };
  const designs = new Map<string, number>();
  for (const e of entries ?? []) designs.set(`${e.contest_id}:${e.designer_id}`, (designs.get(`${e.contest_id}:${e.designer_id}`) ?? 0) + 1);

  const rows: AdminInvite[] = raw.map((r) => {
    const c = one(r.contest as { id: string; slug: string; brand_name: string; contest_number: number | null; status: string } | null);
    const d = one(r.designer as { id: string; name: string; username: string | null } | null);
    const cl = one(r.client as { id: string; name: string } | null);
    const status = r.status as Exclude<AdminInviteStatus, "unsent">;
    return {
      contest: { id: c?.id ?? "", slug: c?.slug ?? "", brand: c?.brand_name ?? "—", number: c?.contest_number ?? null, status: c?.status ?? "" },
      client: cl ?? { id: "", name: "—" },
      designer: d ?? { id: r.designer_id as string, name: "—", username: null },
      status: status !== "removed" && !r.notified_at ? "unsent" : status,
      createdAt: r.created_at as string,
      notifiedAt: (r.notified_at as string | null) ?? null,
      respondedAt: (r.responded_at as string | null) ?? null,
      removedAt: (r.removed_at as string | null) ?? null,
      designs: designs.get(`${r.contest_id}:${r.designer_id}`) ?? 0,
    };
  });
  const counts = { all: rows.length, unsent: 0, pending: 0, accepted: 0, declined: 0, removed: 0 } as InviteOverview["counts"];
  for (const r of rows) counts[r.status] += 1;
  const sentRows = rows.filter((r) => r.notifiedAt);
  return { rows, sent: sentRows.length, accepted: counts.accepted, declined: counts.declined, joined: sentRows.filter((r) => r.designs > 0).length, counts };
}
