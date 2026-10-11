import "server-only";
import type { CurrentUser } from "@/lib/auth/policies";
import { isSupabaseConfigured } from "@/lib/env";
import { BRIEF_FILES_BUCKET, getFileStorage } from "@/lib/storage";
import { countDesigners, countShownEntries, designerFaces, leadingDesigns, type ContestCover, type ContestDesigner } from "@/lib/entries/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasAcceptedNda } from "./nda";
import type { BusinessType, Deliverable, LogoStyle, PackageKey, Requirement, StyleSlider, UsedOn } from "./brief";
import { GONE_STATUSES } from "@/lib/entries/rules";
import { MESSAGES } from "@/lib/i18n/messages";
import { addonRank } from "./addon-order";
import { BROWSE_PAGE_SIZE, BROWSE_TABS, DESIGNER_TABS, ENDING_SOON_DAYS, TAB_STATUSES, type BrowseQuery, type BrowseTab } from "./browse-query";

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

// ---------------------------------------------------------------------------
// Browse Contests redesign (owner, 2026-10-11; Design/contest-pages)
// ---------------------------------------------------------------------------

type Light = {
  id: string;
  status: string;
  brand_name: string;
  business_type: string;
  is_private: boolean;
  is_nda: boolean;
  is_promoted: boolean;
  is_urgent: boolean;
  is_highlighted: boolean;
  prize_amount: number;
  starts_at: string | null;
  ends_at: string | null;
};
const LIGHT_COLUMNS = "id, status, brand_name, business_type, is_private, is_nda, is_promoted, is_urgent, is_highlighted, prize_amount, starts_at, ends_at";

export type BrowseResult = { rows: ContestRow[]; total: number; counts: Record<BrowseTab, number>; openNow: number; featuredOpen: number };

/** Contests this designer sent a design to (and didn't withdraw or have removed). */
async function joinedContestIds(designerId: string): Promise<Set<string>> {
  const { data } = await createAdminClient().from("entries").select("contest_id").eq("designer_id", designerId).not("status", "in", `(${GONE_STATUSES.join(",")})`);
  return new Set((data ?? []).map((r) => r.contest_id as string));
}

/** Business types whose English or Bangla name contains the search words. */
function typesMatching(words: string): Set<string> {
  const out = new Set<string>();
  for (const msgs of Object.values(MESSAGES)) {
    const names = (msgs as unknown as { wizard: { businessTypes: Record<string, string> } }).wizard.businessTypes;
    for (const [key, name] of Object.entries(names)) if (name.toLowerCase().includes(words) || key.includes(words)) out.add(key);
  }
  return out;
}

/**
 * P-02 list: every public contest's light facts are read once, then the search, the quick filters, the tab counts,
 * the add-on order (open tab only) and the visitor's sort are worked out here; only the shown cards are read in full.
 * Search matches the business type and the name of contests that aren't private or NDA, so it never reveals a
 * hidden name. "Joined by me" exists only for a signed-in designer.
 */
export async function browseContests(q: BrowseQuery, opts: { designerId: string | null; bigPrize: number; now: Date }): Promise<BrowseResult> {
  const tabs: readonly BrowseTab[] = opts.designerId ? DESIGNER_TABS : BROWSE_TABS;
  const counts = { open: 0, joined: 0, judging: 0, completed: 0 } as Record<BrowseTab, number>;
  if (!isSupabaseConfigured()) return { rows: [], total: 0, counts, openNow: 0, featuredOpen: 0 };
  const db = createAdminClient();
  let base = db.from("contests").select(LIGHT_COLUMNS).in("status", [...PUBLIC_STATUSES]).limit(5000);
  if (q.type) base = base.eq("business_type", q.type);
  const [{ data, error }, joined] = await Promise.all([base, opts.designerId ? joinedContestIds(opts.designerId) : Promise.resolve(new Set<string>())]);
  if (error) throw new Error(error.message);
  const all = (data ?? []) as Light[];

  const words = q.q.toLowerCase();
  const types = words ? typesMatching(words) : null;
  const soon = opts.now.getTime() + ENDING_SOON_DAYS * 86_400_000;
  const keep = (r: Light) => {
    if (types && !(types.has(r.business_type) || (!r.is_private && !r.is_nda && r.brand_name.toLowerCase().includes(words)))) return false;
    for (const f of q.quick) {
      if (f === "featured" && !r.is_promoted) return false;
      if (f === "urgent" && !r.is_urgent) return false;
      if (f === "big" && r.prize_amount < opts.bigPrize) return false;
      if (f === "ending") {
        const ends = r.ends_at ? new Date(r.ends_at).getTime() : null;
        if (r.status !== "open" || ends === null || ends < opts.now.getTime() || ends > soon) return false;
      }
    }
    return true;
  };
  const inTab = (r: Light, tab: BrowseTab) => (tab === "joined" ? joined.has(r.id) : TAB_STATUSES[tab].includes(r.status));
  const shown = all.filter(keep);
  for (const tab of tabs) counts[tab] = shown.filter((r) => inTab(r, tab)).length;

  const time = (v: string | null) => (v ? new Date(v).getTime() : null);
  const bySort = (a: Light, b: Light) => {
    if (q.sort === "prize") return b.prize_amount - a.prize_amount || (time(b.starts_at) ?? 0) - (time(a.starts_at) ?? 0);
    const [x, y] = q.sort === "ending" ? [time(a.ends_at), time(b.ends_at)] : [time(b.starts_at), time(a.starts_at)];
    if (x === null || y === null) return x === null ? (y === null ? 0 : 1) : -1;
    return x - y;
  };
  const flags = (r: Light) => ({ isPromoted: r.is_promoted, isUrgent: r.is_urgent, isHighlighted: r.is_highlighted, isPrivate: r.is_private, isNda: r.is_nda });
  // Paid add-ons stay ahead in the open list, whatever the sort (addon-order.ts).
  const list = shown
    .filter((r) => tabs.includes(q.tab) && inTab(r, q.tab))
    .sort((a, b) => (q.tab === "open" ? addonRank(flags(a)) - addonRank(flags(b)) : 0) || bySort(a, b));

  const ids = list.slice(0, q.page * BROWSE_PAGE_SIZE).map((r) => r.id);
  let rows: ContestRow[] = [];
  if (ids.length) {
    const { data: full, error: fullError } = await db.from("contests").select(ROW_COLUMNS).in("id", ids);
    if (fullError) throw new Error(fullError.message);
    const byId = new Map((await toRows((full ?? []) as DbRow[])).map((r) => [r.id, r]));
    rows = ids.map((id) => byId.get(id)).filter((r): r is ContestRow => Boolean(r));
  }
  const open = all.filter((r) => r.status === "open");
  return { rows, total: list.length, counts, openNow: open.length, featuredOpen: open.filter((r) => r.is_promoted).length };
}

/** The four extra facts on a designer's card (owner, 2026-10-11). */
export type DesignerFacts = {
  /** False for an NDA contest this designer hasn't accepted: style and colours stay hidden. */
  unlocked: boolean;
  styles: LogoStyle[];
  colors: string[];
  clientSeen: Date | null;
  mine: number;
  best: number | null;
};

export async function designerFacts(ids: string[], designerId: string): Promise<Map<string, DesignerFacts>> {
  const out = new Map<string, DesignerFacts>();
  if (!isSupabaseConfigured() || ids.length === 0) return out;
  const db = createAdminClient();
  const [{ data: contests }, { data: ndas }, { data: mine }] = await Promise.all([
    db.from("contests").select("id, client_id, is_nda, styles, colors").in("id", ids),
    db.from("nda_acceptances").select("contest_id").eq("user_id", designerId).in("contest_id", ids),
    db.from("entries").select("contest_id, rating").eq("designer_id", designerId).in("contest_id", ids).not("status", "in", `(${GONE_STATUSES.join(",")})`),
  ]);
  const clientIds = [...new Set((contests ?? []).map((c) => c.client_id as string))];
  // profiles.last_seen_at (migration 0037); a missing column just leaves "not yet".
  const { data: seen } = clientIds.length ? await db.from("profiles").select("id, last_seen_at").in("id", clientIds) : { data: [] };
  const seenBy = new Map((seen ?? []).map((p) => [p.id as string, (p as { last_seen_at?: string | null }).last_seen_at ?? null]));
  const accepted = new Set((ndas ?? []).map((n) => n.contest_id as string));
  for (const c of contests ?? []) {
    const own = (mine ?? []).filter((e) => e.contest_id === c.id);
    const ratings = own.map((e) => e.rating as number | null).filter((r): r is number => r != null);
    const unlocked = !c.is_nda || accepted.has(c.id as string);
    const lastSeen = seenBy.get(c.client_id as string);
    out.set(c.id as string, {
      unlocked,
      styles: unlocked ? ((c.styles ?? []) as LogoStyle[]) : [],
      colors: unlocked ? ((c.colors ?? []) as string[]) : [],
      clientSeen: lastSeen ? new Date(lastSeen) : null,
      mine: own.length,
      best: ratings.length ? Math.max(...ratings) : null,
    });
  }
  return out;
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
       let_designers_choose_colors, used_on, short_name, target_audience, deliverables, requirements, requirements_note, winner_is_public, logo_scan, extensions_count, client:profiles!client_id(name, username)`,
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
