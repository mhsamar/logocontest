import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { maskIdNumber, type IdType } from "@/lib/legal/agreement-rules";
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
};

const COLUMNS = "designer_id, full_name, mobile, address, id_type, id_number, version, signed_at, signed_ip";

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
  };
}

export async function hasSignedAgreement(designerId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return true;
  const { count } = await createAdminClient().from("designer_agreements").select("designer_id", { count: "exact", head: true }).eq("designer_id", designerId);
  return (count ?? 0) > 0;
}

export async function getAgreement(designerId: string): Promise<SignedAgreement | null> {
  if (!isSupabaseConfigured()) return null;
  const { data } = await createAdminClient().from("designer_agreements").select(COLUMNS).eq("designer_id", designerId).maybeSingle();
  return data ? toAgreement(data) : null;
}

/** A-13: every agreement, newest first, with the designer's username. */
export async function listAgreements(limit = 200): Promise<(SignedAgreement & { username: string | null; status: string })[]> {
  if (!isSupabaseConfigured()) return [];
  const { data } = await createAdminClient()
    .from("designer_agreements")
    .select(`${COLUMNS}, profile:profiles!designer_id(username, status)`)
    .order("signed_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((r) => {
    const p = (Array.isArray(r.profile) ? r.profile[0] : r.profile) as { username: string | null; status: string } | null;
    return { ...toAgreement(r), username: p?.username ?? null, status: p?.status ?? "active" };
  });
}
