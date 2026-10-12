import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { maskIdNumber, type IdType } from "@/lib/legal/agreement-rules";
import { resignSince } from "@/lib/legal/store";
import { avatarUrl } from "@/lib/profile/avatar";
import { createAdminClient } from "@/lib/supabase/admin";

/** A signed originality agreement as shown to its designer or an admin: the ID number is always masked (§9.6). */
export type SignedAgreement = {
  designerId: string;
  fullName: string;
  mobile: string;
  address: string;
  idType: IdType;
  idMasked: string;
  version: string;
  signedAt: Date;
  signedIp: string | null;
  /** ID photos (owner, 2026-10-10): which sides were uploaded. The photos themselves open through an admin link. */
  idPhotos: { front: boolean; back: boolean };
  /** The admin review (owner, 2026-10-12; migration 0040). */
  reviewStatus: ReviewStatus;
  rejectReason: string | null;
  photoRequestedAt: Date | null;
};

export const REVIEW_STATUSES = ["needs_review", "approved", "no_photo", "rejected"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

const COLUMNS =
  "designer_id, full_name, mobile, address, id_type, id_number, version, signed_at, signed_ip, id_front_path, id_back_path, review_status, reject_reason, photo_requested_at";

function toAgreement(r: Record<string, unknown>): SignedAgreement {
  return {
    designerId: r.designer_id as string,
    fullName: r.full_name as string,
    mobile: r.mobile as string,
    address: r.address as string,
    idType: r.id_type as IdType,
    idMasked: maskIdNumber(r.id_number as string),
    version: r.version as string,
    signedAt: new Date(r.signed_at as string),
    signedIp: (r.signed_ip as string | null) ?? null,
    idPhotos: { front: Boolean(r.id_front_path), back: Boolean(r.id_back_path) },
    reviewStatus: ((r.review_status as ReviewStatus | null) ?? (r.id_front_path ? "needs_review" : "no_photo")) as ReviewStatus,
    rejectReason: (r.reject_reason as string | null) ?? null,
    photoRequestedAt: r.photo_requested_at ? new Date(r.photo_requested_at as string) : null,
  };
}

export async function hasSignedAgreement(designerId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return true;
  const [{ data }, since] = await Promise.all([
    createAdminClient().from("designer_agreements").select("signed_at, id_front_path, review_status").eq("designer_id", designerId).maybeSingle(),
    resignSince(),
  ]);
  // Rejected by an admin (owner, 2026-10-12): no new designs until a new photo is uploaded and approved.
  if (data?.review_status === "rejected") return false;
  // Signed, and not before the admin asked everyone to sign a new agreement again (A-16), and with a photo of the
  // ID (owner, 2026-10-11: designers who signed before photos were asked for add one before their next design).
  return !!data && (!since || new Date(data.signed_at as string) >= since) && Boolean(data.id_front_path);
}

export async function getAgreement(designerId: string): Promise<SignedAgreement | null> {
  if (!isSupabaseConfigured()) return null;
  const { data } = await createAdminClient().from("designer_agreements").select(COLUMNS).eq("designer_id", designerId).maybeSingle();
  return data ? toAgreement(data) : null;
}

/** One card on Admin → Agreements (owner, 2026-10-12; Design/agreements). Never the full ID number or a photo path. */
export type AdminAgreement = SignedAgreement & {
  username: string | null;
  accountStatus: string;
  email: string | null;
  avatarUrl: string | null;
  joinedAt: Date | null;
  designs: number;
  userAgent: string | null;
  photoAt: Date | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  adminNote: string;
  hasSignedText: boolean;
};

export async function adminAgreements(limit = 500): Promise<AdminAgreement[]> {
  if (!isSupabaseConfigured()) return [];
  const db = createAdminClient();
  const { data } = await db
    .from("designer_agreements")
    .select(`${COLUMNS}, user_agent, id_photo_at, reviewed_by, reviewed_at, admin_note, signed_text, profile:profiles!designer_id(username, status, email, avatar_path, created_at), reviewer:profiles!reviewed_by(name)`)
    .order("signed_at", { ascending: false })
    .limit(limit);
  const rows = data ?? [];
  const ids = rows.map((r) => r.designer_id as string);
  const { data: entries } = ids.length ? await db.from("entries").select("designer_id").in("designer_id", ids).not("status", "in", "(removed,withdrawn)") : { data: [] };
  const designs = new Map<string, number>();
  for (const e of entries ?? []) designs.set(e.designer_id as string, (designs.get(e.designer_id as string) ?? 0) + 1);
  return rows.map((r) => {
    const p = (Array.isArray(r.profile) ? r.profile[0] : r.profile) as { username: string | null; status: string; email: string | null; avatar_path: string | null; created_at: string } | null;
    const rv = (Array.isArray(r.reviewer) ? r.reviewer[0] : r.reviewer) as { name: string | null } | null;
    return {
      ...toAgreement(r),
      username: p?.username ?? null,
      accountStatus: p?.status ?? "active",
      email: p?.email ?? null,
      avatarUrl: avatarUrl(p?.avatar_path ?? null),
      joinedAt: p?.created_at ? new Date(p.created_at) : null,
      designs: designs.get(r.designer_id as string) ?? 0,
      userAgent: (r.user_agent as string | null) ?? null,
      photoAt: r.id_photo_at ? new Date(r.id_photo_at as string) : null,
      reviewedBy: rv?.name?.trim() || null,
      reviewedAt: r.reviewed_at ? new Date(r.reviewed_at as string) : null,
      adminNote: (r.admin_note as string | null) ?? "",
      hasSignedText: Boolean(r.signed_text),
    };
  });
}

/** The exact agreement text a designer signed, when it was kept (signatures from 2026-10-12 on). */
export async function signedAgreementText(designerId: string): Promise<{ text: { title: string; intro: string; clauses: string[]; closing: string } | null; version: string; signature: string; signedAt: Date } | null> {
  if (!isSupabaseConfigured() || !/^[0-9a-f-]{36}$/i.test(designerId)) return null;
  const { data } = await createAdminClient().from("designer_agreements").select("signed_text, version, signature_name, signed_at").eq("designer_id", designerId).maybeSingle();
  if (!data) return null;
  return {
    text: (data.signed_text as { title: string; intro: string; clauses: string[]; closing: string } | null) ?? null,
    version: data.version as string,
    signature: data.signature_name as string,
    signedAt: new Date(data.signed_at as string),
  };
}
