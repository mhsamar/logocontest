import "server-only";
import { getFileStorage } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { PRO_FILES_BUCKET } from "./chat";
import { getProSettings } from "./settings";
import { getSubscription, proKind } from "./status";
import { proPrefs, type ProPrefs } from "./workspace";

export type ProReview = { stars: number; text: string | null; brand: string | null; client: string; at: string };

export type ProProfileExtras = {
  /** On the free Pro Trial (owner, 2026-10-14): the badge reads "PRO TRIAL" and there is no "Pro since". */
  trial: boolean;
  prefs: ProPrefs;
  proSince: Date | null;
  /** Up to 16 picture links for the moving cover (designer's picks first, then their public designs). */
  cover: string[];
  portfolio: { id: string; title: string; url: string | null }[];
  reviews: ProReview[];
  contact: { email: string | null; mobile: string | null } | null;
};

const db = () => createAdminClient();

/**
 * What the Pro profile adds to the normal designer profile data (owner, 2026-10-13): the cover the designer picked,
 * their own portfolio uploads, client reviews from approved wins, and contact details only when both the admin switch
 * and the designer's privacy setting allow it. Only designs from public contests are ever used.
 */
export async function proProfileExtras(designerId: string, publicDesignIds: string[], firstPageUrls: Map<string, string>): Promise<ProProfileExtras> {
  const [{ settings }, prefs, sub, kind, { data: items }, { data: reviews }] = await Promise.all([
    getProSettings(),
    proPrefs(designerId),
    getSubscription(designerId),
    proKind(designerId),
    db().from("portfolio_items").select("id, title, preview_path").eq("designer_id", designerId).order("position").limit(200),
    db()
      .from("handovers")
      .select("client_rating, client_feedback, approved_at, contest:contests!contest_id(brand_name, is_private, is_nda, client:profiles!client_id(name))")
      .eq("designer_id", designerId)
      .eq("status", "approved")
      .not("client_rating", "is", null)
      .order("approved_at", { ascending: false })
      .limit(30),
  ]);
  const store = getFileStorage();
  const allowed = new Set(publicDesignIds);
  // Cover: the designer's picks (public designs only), then the newest public designs, up to 16 pictures.
  const picks = prefs.coverEntryIds.filter((id) => allowed.has(id));
  const order = [...picks, ...publicDesignIds.filter((id) => !picks.includes(id))].slice(0, 16);
  const missing = order.filter((id) => !firstPageUrls.has(id));
  const { data: imgs } = missing.length ? await db().from("entry_images").select("entry_id, preview_path, position").in("entry_id", missing).order("position") : { data: [] };
  const first = new Map<string, string>();
  for (const i of imgs ?? []) if (!first.has(i.entry_id as string)) first.set(i.entry_id as string, i.preview_path as string);
  const [signed, itemUrls] = await Promise.all([
    first.size ? store.createReadUrls("entry-files", [...first.values()], 3600).catch(() => new Map<string, string>()) : Promise.resolve(new Map<string, string>()),
    (items ?? []).length ? store.createReadUrls(PRO_FILES_BUCKET, (items ?? []).map((i) => i.preview_path as string), 3600).catch(() => new Map<string, string>()) : Promise.resolve(new Map<string, string>()),
  ]);
  const cover = order.map((id) => firstPageUrls.get(id) ?? signed.get(first.get(id) ?? "") ?? null).filter((u): u is string => Boolean(u));

  let contact: ProProfileExtras["contact"] = null;
  if (settings.features.show_contact_on_profile && prefs.showContact) {
    const { data: p } = await db().from("profiles").select("email, mobile").eq("id", designerId).maybeSingle();
    contact = { email: (p?.email as string | null) ?? null, mobile: (p?.mobile as string | null) ?? null };
  }

  return {
    prefs,
    trial: kind === "trial",
    proSince: kind === "pro" ? (sub?.firstStartedAt ?? null) : null,
    cover,
    portfolio: (items ?? []).map((i) => ({ id: i.id as string, title: (i.title as string) ?? "", url: itemUrls.get(i.preview_path as string) ?? null })),
    reviews: (reviews ?? []).map((r) => {
      const c = (Array.isArray(r.contest) ? r.contest[0] : r.contest) as { brand_name: string; is_private: boolean; is_nda: boolean; client: unknown } | null;
      const client = (Array.isArray(c?.client) ? c?.client[0] : c?.client) as { name: string } | null;
      return {
        stars: r.client_rating as number,
        text: ((r.client_feedback as string | null) ?? "").trim() || null,
        brand: c && !c.is_private && !c.is_nda ? c.brand_name : null,
        // First name only: reviews never show a client's full name.
        client: ((client?.name ?? "").trim().split(/\s+/)[0] ?? "") || "—",
        at: (r.approved_at as string) ?? "",
      };
    }),
    contact,
  };
}
