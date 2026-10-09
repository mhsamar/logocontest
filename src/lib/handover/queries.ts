import "server-only";
import type { Deliverable } from "@/lib/contests/brief";
import { isSupabaseConfigured } from "@/lib/env";
import { getFileStorage } from "@/lib/storage";
import { HANDOVER_FILES_BUCKET } from "./options";
import { createAdminClient } from "@/lib/supabase/admin";
import { payoutFor } from "@/lib/wallet/fees";
import type { HandoverFileType, HandoverStatus } from "./options";

/** A handover as the winner, the client or an admin sees it (UI-JOURNEY C-17, D-08, D-09). */
export type HandoverView = {
  id: string;
  contestId: string;
  contestSlug: string;
  brandName: string;
  clientId: string;
  entryId: string;
  entryNumber: number;
  designerId: string;
  designer: { name: string; username: string | null };
  status: HandoverStatus;
  prize: number;
  feeRate: number;
  fee: number;
  credit: number;
  revisionCount: number;
  revisionNote: string | null;
  fontsNote: string | null;
  dueAt: Date;
  submittedAt: Date | null;
  reviewDueAt: Date | null;
  approvedAt: Date | null;
  /** When the winner was picked (the handover is made then): the copy-claim days count from here (§7.6). */
  pickedAt: Date;
  creditedAt: Date | null;
  rating: number | null;
  feedback: string | null;
  deliverables: Deliverable[];
  files: { id: string; type: HandoverFileType; name: string; size: number; url: string | null }[];
};

const SELECT =
  "id, contest_id, entry_id, designer_id, status, created_at, credited_at, prize, fee_rate, revision_count, revision_note, fonts_note, due_at, submitted_at, review_due_at, approved_at, client_rating, client_feedback, " +
  "contest:contests!contest_id(slug, brand_name, client_id, deliverables), entry:entries!entry_id(number), designer:profiles!designer_id(name, username), " +
  "files:handover_files!handover_id(id, file_type, path, original_name, size_bytes, created_at)";

type Row = {
  id: string;
  contest_id: string;
  entry_id: string;
  designer_id: string;
  status: HandoverStatus;
  created_at: string;
  credited_at: string | null;
  prize: number;
  fee_rate: number;
  revision_count: number;
  revision_note: string | null;
  fonts_note: string | null;
  due_at: string;
  submitted_at: string | null;
  review_due_at: string | null;
  approved_at: string | null;
  client_rating: number | null;
  client_feedback: string | null;
  contest: { slug: string; brand_name: string; client_id: string; deliverables: Deliverable[] | null } | null;
  entry: { number: number } | null;
  designer: { name: string; username: string | null } | null;
  files: { id: string; file_type: HandoverFileType; path: string; original_name: string; size_bytes: number; created_at: string }[] | null;
};

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
const date = (v: string | null) => (v ? new Date(v) : null);

async function toView(r: Row): Promise<HandoverView> {
  const files = [...(r.files ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const urls = await getFileStorage()
    .createReadUrls(HANDOVER_FILES_BUCKET, files.map((f) => f.path), 3600)
    .catch(() => new Map<string, string>());
  const contest = one(r.contest);
  const { fee, credit } = payoutFor(r.prize, r.fee_rate);
  return {
    id: r.id,
    contestId: r.contest_id,
    contestSlug: contest?.slug ?? "",
    brandName: contest?.brand_name ?? "",
    clientId: contest?.client_id ?? "",
    entryId: r.entry_id,
    entryNumber: one(r.entry)?.number ?? 0,
    designerId: r.designer_id,
    designer: one(r.designer) ?? { name: "—", username: null },
    status: r.status,
    prize: r.prize,
    feeRate: r.fee_rate,
    fee,
    credit,
    revisionCount: r.revision_count,
    revisionNote: r.revision_note,
    fontsNote: r.fonts_note,
    dueAt: new Date(r.due_at),
    submittedAt: date(r.submitted_at),
    reviewDueAt: date(r.review_due_at),
    approvedAt: date(r.approved_at),
    pickedAt: new Date(r.created_at),
    creditedAt: date(r.credited_at),
    rating: r.client_rating,
    feedback: r.client_feedback,
    deliverables: contest?.deliverables ?? [],
    files: files.map((f) => ({ id: f.id, type: f.file_type, name: f.original_name, size: f.size_bytes, url: urls.get(f.path) ?? null })),
  };
}

/** The contest's live handover (not a cancelled one), or null. */
export async function getHandoverByContest(contestId: string): Promise<HandoverView | null> {
  if (!isSupabaseConfigured()) return null;
  const { data } = await createAdminClient().from("handovers").select(SELECT).eq("contest_id", contestId).neq("status", "cancelled").order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data ? toView(data as unknown as Row) : null;
}

/** The winner's handover for a contest slug, or null when this designer didn't win it. */
export async function getDesignerHandover(slug: string, designerId: string): Promise<HandoverView | null> {
  if (!isSupabaseConfigured() || !/^[a-z0-9-]{1,120}$/.test(slug)) return null;
  const db = createAdminClient();
  const { data: contest } = await db.from("contests").select("id").eq("slug", slug).maybeSingle();
  if (!contest) return null;
  const h = await getHandoverByContest(contest.id as string);
  return h && h.designerId === designerId ? h : null;
}

/** Handovers this designer still has to finish (for the dashboard "You won" card). */
export async function openHandovers(designerId: string): Promise<{ slug: string; brand: string; status: HandoverStatus; dueAt: Date; credit: number }[]> {
  if (!isSupabaseConfigured()) return [];
  const { data } = await createAdminClient()
    .from("handovers")
    .select("status, due_at, prize, fee_rate, contest:contests!contest_id(slug, brand_name)")
    .eq("designer_id", designerId)
    .in("status", ["awaiting_files", "submitted", "revision_requested"])
    .order("created_at", { ascending: false });
  return (data ?? []).map((r) => {
    const c = one(r.contest as { slug: string; brand_name: string } | { slug: string; brand_name: string }[] | null);
    return { slug: c?.slug ?? "", brand: c?.brand_name ?? "", status: r.status as HandoverStatus, dueAt: new Date(r.due_at as string), credit: payoutFor(r.prize as number, r.fee_rate as number).credit };
  });
}
