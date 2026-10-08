import "server-only";
import type { CurrentUser } from "@/lib/auth/policies";
import { isSupabaseConfigured } from "@/lib/env";
import { BRIEF_FILES_BUCKET, getFileStorage } from "@/lib/storage";
import { countDesigners, countShownEntries, designerFaces, leadingDesigns, type ContestCover, type ContestDesigner } from "@/lib/entries/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasAcceptedNda } from "./nda";
import type { BusinessType, Deliverable, LogoStyle, PackageKey, Requirement, StyleSlider, UsedOn } from "./brief";
import { BROWSE_PAGE_SIZE, BROWSE_TABS, TAB_STATUSES, type BrowseQuery, type BrowseTab } from "./browse-query";

import { PUBLIC_STATUSES, type PublicStatus } from "./public-statuses";

export { PUBLIC_STATUSES, type PublicStatus } from "./public-statuses";

export type ContestRow = {
  id: string;
  slug: string;
  status: PublicStatus;
  brandName: string;
  businessType: BusinessType;
  package: PackageKey;
  prize: number;
  startsAt: Date | null;
  endsAt: Date | null;
  judgingEndsAt: Date | null;
  isBlind: boolean;
  isPrivate: boolean;
  isPromoted: boolean;
  /** Running contest number, given when the contest is published (owner, 2026-10-08). */
  number: number | null;
  /** Add-ons from 2026-10-08: gold border + badge, "Urgent" badge, confidentiality agreement. */
  isHighlighted: boolean;
  isUrgent: boolean;
  isNda: boolean;
  entries: number;
  /** The design on the card: winner, else best rated, else newest (never for blind or private contests). */
  cover: ContestCover | null;
  /** Designers who took part: up to three faces (none for blind or private contests) and the total. */
  faces: { total: number; list: ContestDesigner[] };
  /** Business description for list rows; never set for private contests. */
  description: string | null;
};

const ROW_COLUMNS =
  "id, slug, status, brand_name, business_type, business_description, package, prize_amount, starts_at, ends_at, judging_ends_at, is_blind, is_private, is_promoted, is_highlighted, is_urgent, is_nda, contest_number";

type DbRow = {
  id: string;
  slug: string;
  status: string;
  brand_name: string;
  business_type: string;
  business_description: string;
  package: string;
  prize_amount: number;
  starts_at: string | null;
  ends_at: string | null;
  judging_ends_at: string | null;
  is_blind: boolean;
  is_private: boolean;
  is_promoted: boolean;
  is_highlighted: boolean;
  is_urgent: boolean;
  is_nda: boolean;
  contest_number: number | null;
};

const date = (v: string | null) => (v ? new Date(v) : null);

function toRow(r: DbRow, entries: Map<string, number>, covers: Map<string, ContestCover>, faces: Map<string, { total: number; list: ContestDesigner[] }>): ContestRow {
  return {
    id: r.id,
    slug: r.slug,
    status: r.status as PublicStatus,
    brandName: r.brand_name,
    businessType: r.business_type as BusinessType,
    package: r.package as PackageKey,
    prize: r.prize_amount,
    startsAt: date(r.starts_at),
    endsAt: date(r.ends_at),
    judgingEndsAt: date(r.judging_ends_at),
    isBlind: r.is_blind,
    isPrivate: r.is_private,
    isPromoted: r.is_promoted,
    number: r.contest_number ?? null,
    isHighlighted: Boolean(r.is_highlighted),
    isUrgent: Boolean(r.is_urgent),
    isNda: Boolean(r.is_nda),
    entries: entries.get(r.id) ?? 0,
    cover: covers.get(r.id) ?? null,
    faces: faces.get(r.id) ?? { total: 0, list: [] },
    description: r.is_private ? null : r.business_description,
  };
}

/** Shown designs (active and winning) per contest. */
export async function countEntries(contestIds: string[]): Promise<Map<string, number>> {
  return countShownEntries(contestIds);
}

/** Rows with their design counts and card covers. */
async function toRows(rows: DbRow[]): Promise<ContestRow[]> {
  const refs = rows.map((r) => ({ id: r.id, isBlind: r.is_blind, isPrivate: r.is_private }));
  const [entries, covers, faces] = await Promise.all([countEntries(rows.map((r) => r.id)), leadingDesigns(refs), designerFaces(refs, 3)]);
  return rows.map((r) => toRow(r, entries, covers, faces));
}

/** P-02: one page of contests for a tab, plus how many contests each tab has. */
export async function listContests(q: BrowseQuery): Promise<{ rows: ContestRow[]; total: number; counts: Record<BrowseTab, number> }> {
  const empty = { rows: [], total: 0, counts: { open: 0, judging: 0, completed: 0 } };
  if (!isSupabaseConfigured()) return empty;
  const db = createAdminClient();

  let query = db.from("contests").select(ROW_COLUMNS, { count: "exact" }).in("status", [...TAB_STATUSES[q.tab]]);
  if (q.type) query = query.eq("business_type", q.type);
  query =
    q.sort === "ending"
      ? query.order("ends_at", { ascending: true })
      : q.sort === "prize"
        ? query.order("prize_amount", { ascending: false }).order("starts_at", { ascending: false })
        : query.order("starts_at", { ascending: false });
  const from = (q.page - 1) * BROWSE_PAGE_SIZE;
  const { data, count, error } = await query.range(from, from + BROWSE_PAGE_SIZE - 1);
  if (error) throw new Error(error.message);

  const counts = Object.fromEntries(
    await Promise.all(
      BROWSE_TABS.map(async (tab) => {
        let c = db.from("contests").select("id", { count: "exact", head: true }).in("status", [...TAB_STATUSES[tab]]);
        if (q.type) c = c.eq("business_type", q.type);
        const { count: n } = await c;
        return [tab, n ?? 0] as const;
      }),
    ),
  ) as Record<BrowseTab, number>;

  return { rows: await toRows((data ?? []) as DbRow[]), total: count ?? 0, counts };
}

/** P-02 "Featured contests": open contests with the Promoted upgrade, ending soonest first. */
export async function featuredContests(limit: number): Promise<ContestRow[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await createAdminClient()
    .from("contests")
    .select(ROW_COLUMNS)
    .eq("status", "open")
    .eq("is_promoted", true)
    .order("ends_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  return toRows((data ?? []) as DbRow[]);
}

/** Saved contests page: these contests in the given order, leaving out ones that are no longer public. */
export async function contestsByIds(ids: string[]): Promise<ContestRow[]> {
  if (!isSupabaseConfigured() || ids.length === 0) return [];
  const { data, error } = await createAdminClient().from("contests").select(ROW_COLUMNS).in("id", ids).in("status", [...PUBLIC_STATUSES]);
  if (error) throw new Error(error.message);
  const byId = new Map((await toRows((data ?? []) as DbRow[])).map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter((r): r is ContestRow => Boolean(r));
}

/** Home page section 2: open contests, Promoted first, then the newest. */
export async function liveContests(limit: number): Promise<ContestRow[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await createAdminClient()
    .from("contests")
    .select(ROW_COLUMNS)
    .eq("status", "open")
    .order("is_promoted", { ascending: false })
    .order("starts_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return toRows((data ?? []) as DbRow[]);
}

export type ContestFileView = { name: string; mime: string; url: string | null; isImage: boolean };

export type ContestDetail = ContestRow & {
  rawStatus: string;
  ownerId: string;
  isOwner: boolean;
  /** Private contests: only signed-in users may read the brief (BLUEPRINT §7.3); NDA contests: only the
   * client, admins and designers who accepted the confidentiality agreement (§7.4, owner 2026-10-08). */
  canSeeBrief: boolean;
  /** NDA contest whose agreement this viewer has accepted. */
  ndaAccepted: boolean;
  client: { name: string; username: string | null } | null;
  designers: number;
  /** Blind contests: the client made the winning logo public after completion. */
  winnerIsPublic: boolean;
  /** Logo Scan add-on bought (owner, 2026-10-08). */
  logoScan: boolean;
  extensionsCount: number;
  brief: {
    description: string;
    logoText: string | null;
    slogan: string | null;
    websiteUrl: string | null;
    styles: LogoStyle[];
    sliders: Partial<Record<StyleSlider, number>>;
    colors: string[];
    letDesignersChoose: boolean;
    usedOn: UsedOn[];
    likes: string;
    dislikes: string | null;
    shortName: string | null;
    targetAudience: string | null;
    deliverables: Deliverable[];
    requirements: Requirement[];
    requirementsNote: string | null;
    files: ContestFileView[];
  } | null;
};

/**
 * P-03. Returns null when the viewer may not see the contest at all (unknown
 * slug, or a draft/unpaid/cancelled contest that isn't theirs).
 */
export async function getContestBySlug(slug: string, viewer: CurrentUser | null): Promise<ContestDetail | null> {
  if (!isSupabaseConfigured() || !/^[a-z0-9-]{1,120}$/.test(slug)) return null;
  const db = createAdminClient();
  const { data, error } = await db
    .from("contests")
    .select(
      `${ROW_COLUMNS}, client_id, business_description, logo_text, slogan, website_url, styles, style_sliders, colors,
       let_designers_choose_colors, used_on, likes_text, dislikes_text, short_name, target_audience, deliverables, requirements, requirements_note, winner_is_public, logo_scan, extensions_count, client:profiles!client_id(name, username)`,
    )
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const isOwner = viewer?.id === data.client_id;
  const isAdmin = viewer?.role === "admin";
  const isPublic = (PUBLIC_STATUSES as readonly string[]).includes(data.status);
  if (!isPublic && !isOwner && !isAdmin) return null;

  const ndaAccepted = Boolean(data.is_nda) && Boolean(viewer) && (await hasAcceptedNda(data.id, viewer!.id));
  const canSeeBrief = (!data.is_private || Boolean(viewer)) && (!data.is_nda || isOwner || isAdmin || ndaAccepted);
  const [[row], designers] = await Promise.all([toRows([data as DbRow]), countDesigners(data.id)]);
  const client = (Array.isArray(data.client) ? data.client[0] : data.client) as { name: string; username: string | null } | null;

  let files: ContestFileView[] = [];
  if (canSeeBrief) {
    const { data: fileRows } = await db
      .from("contest_files")
      .select("path, original_name, mime_type")
      .eq("contest_id", data.id)
      .order("created_at");
    const rows = fileRows ?? [];
    const urls = await getFileStorage()
      .createReadUrls(BRIEF_FILES_BUCKET, rows.map((f) => f.path as string), 3600)
      .catch(() => new Map<string, string>());
    files = rows.map((f) => ({
      name: f.original_name as string,
      mime: f.mime_type as string,
      url: urls.get(f.path as string) ?? null,
      isImage: String(f.mime_type).startsWith("image/"),
    }));
  }

  return {
    ...row,
    rawStatus: data.status,
    ownerId: data.client_id,
    isOwner,
    canSeeBrief,
    ndaAccepted,
    // A private contest doesn't show who is behind it to guests.
    client: canSeeBrief ? client : null,
    designers,
    winnerIsPublic: Boolean(data.winner_is_public),
    logoScan: Boolean(data.logo_scan),
    extensionsCount: (data.extensions_count as number) ?? 0,
    brief: canSeeBrief
      ? {
          description: data.business_description,
          logoText: data.logo_text,
          slogan: data.slogan,
          websiteUrl: data.website_url,
          styles: (data.styles ?? []) as LogoStyle[],
          sliders: (data.style_sliders ?? {}) as Partial<Record<StyleSlider, number>>,
          colors: (data.colors ?? []) as string[],
          letDesignersChoose: data.let_designers_choose_colors,
          usedOn: (data.used_on ?? []) as UsedOn[],
          likes: data.likes_text,
          dislikes: data.dislikes_text,
          shortName: data.short_name,
          targetAudience: data.target_audience,
          deliverables: (data.deliverables ?? []) as Deliverable[],
          requirements: (data.requirements ?? []) as Requirement[],
          requirementsNote: data.requirements_note,
          files,
        }
      : null,
  };
}
