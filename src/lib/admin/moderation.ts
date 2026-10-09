import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { ENTRY_FILES_BUCKET } from "@/lib/entries/queries";
import { getFileStorage } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { one } from "./core";

/** A-03 Entries and A-04 Reports (BLUEPRINT §13.4, §13.5). */
export type AdminEntry = {
  id: string;
  number: number;
  status: string;
  coverUrl: string | null;
  contest: { slug: string; brand: string };
  designer: { id: string; name: string; username: string | null };
  createdAt: Date;
};

const ENTRY_SELECT = "id, number, status, created_at, contest:contests!contest_id(slug, brand_name), designer:profiles!designer_id(id, name, username), images:entry_images!entry_id(position, preview_path)";

type EntryRow = {
  id: string;
  number: number;
  status: string;
  created_at: string;
  contest: unknown;
  designer: unknown;
  images: { position: number; preview_path: string }[] | null;
};

const coverPath = (r: EntryRow) => [...(r.images ?? [])].sort((a, b) => a.position - b.position)[0]?.preview_path ?? null;

async function toEntries(rows: EntryRow[]): Promise<AdminEntry[]> {
  const paths = rows.map(coverPath).filter((p): p is string => Boolean(p));
  const urls = await getFileStorage()
    .createReadUrls(ENTRY_FILES_BUCKET, paths, 3600)
    .catch(() => new Map<string, string>());
  return rows.map((r) => {
    const c = one(r.contest as { slug: string; brand_name: string } | null);
    const d = one(r.designer as { id: string; name: string; username: string | null } | null);
    const p = coverPath(r);
    return {
      id: r.id,
      number: r.number,
      status: r.status,
      coverUrl: p ? (urls.get(p) ?? null) : null,
      contest: { slug: c?.slug ?? "", brand: c?.brand_name ?? "" },
      designer: d ?? { id: "", name: "—", username: null },
      createdAt: new Date(r.created_at),
    };
  });
}

/** Near-duplicates found on upload: the new design next to the older one it looks like. */
export async function duplicatePairs(): Promise<{ entry: AdminEntry; original: AdminEntry }[]> {
  if (!isSupabaseConfigured()) return [];
  const db = createAdminClient();
  const { data } = await db.from("entry_images").select("entry_id, duplicate_of_entry_id").not("duplicate_of_entry_id", "is", null).limit(200);
  const pairs = [...new Map((data ?? []).map((r) => [`${r.entry_id}:${r.duplicate_of_entry_id}`, { a: r.entry_id as string, b: r.duplicate_of_entry_id as string }])).values()];
  if (!pairs.length) return [];
  const ids = [...new Set(pairs.flatMap((p) => [p.a, p.b]))];
  const { data: rows } = await db.from("entries").select(ENTRY_SELECT).in("id", ids);
  const byId = new Map((await toEntries((rows ?? []) as unknown as EntryRow[])).map((e) => [e.id, e]));
  return pairs
    .map((p) => ({ entry: byId.get(p.a)!, original: byId.get(p.b)! }))
    .filter((p) => p.entry && p.original && p.entry.status !== "removed")
    .sort((x, y) => y.entry.createdAt.getTime() - x.entry.createdAt.getTime());
}

export async function recentEntries(limit = 40): Promise<AdminEntry[]> {
  if (!isSupabaseConfigured()) return [];
  const { data } = await createAdminClient().from("entries").select(ENTRY_SELECT).order("created_at", { ascending: false }).limit(limit);
  return toEntries((data ?? []) as unknown as EntryRow[]);
}

export type AdminReport = {
  id: string;
  reason: string;
  note: string | null;
  links: string[];
  evidenceUrl: string | null;
  status: string;
  createdAt: Date;
  resolvedAt: Date | null;
  reporter: { id: string; name: string; username: string | null; role: string; warnings: number };
  entry: AdminEntry;
};

export async function listReports(status: "open" | "closed"): Promise<AdminReport[]> {
  if (!isSupabaseConfigured()) return [];
  const db = createAdminClient();
  let q = db.from("reports").select("id, entry_id, reason, note, evidence_urls, evidence_image_path, status, created_at, resolved_at, reporter:profiles!reporter_id(id, name, username, role, flag_warnings)");
  q = status === "open" ? q.eq("status", "open").order("created_at", { ascending: true }) : q.neq("status", "open").order("resolved_at", { ascending: false });
  const { data } = await q.limit(status === "open" ? 200 : 30);
  const rows = data ?? [];
  if (!rows.length) return [];
  const [{ data: entryRows }, evidence] = await Promise.all([
    db.from("entries").select(ENTRY_SELECT).in("id", [...new Set(rows.map((r) => r.entry_id as string))]),
    getFileStorage()
      .createReadUrls(ENTRY_FILES_BUCKET, rows.map((r) => r.evidence_image_path as string | null).filter((p): p is string => Boolean(p)), 3600)
      .catch(() => new Map<string, string>()),
  ]);
  const entries = new Map((await toEntries((entryRows ?? []) as unknown as EntryRow[])).map((e) => [e.id, e]));
  return rows
    .filter((r) => entries.has(r.entry_id as string))
    .map((r) => {
      const rep = one(r.reporter as unknown as { id: string; name: string; username: string | null; role: string; flag_warnings: number } | null);
      return {
        id: r.id as string,
        reason: r.reason as string,
        note: (r.note as string | null) ?? null,
        links: (r.evidence_urls as string[] | null) ?? [],
        evidenceUrl: r.evidence_image_path ? (evidence.get(r.evidence_image_path as string) ?? null) : null,
        status: r.status as string,
        createdAt: new Date(r.created_at as string),
        resolvedAt: r.resolved_at ? new Date(r.resolved_at as string) : null,
        reporter: { id: rep?.id ?? "", name: rep?.name ?? "—", username: rep?.username ?? null, role: rep?.role ?? "", warnings: rep?.flag_warnings ?? 0 },
        entry: entries.get(r.entry_id as string)!,
      };
    });
}

/** Designs by id, in the order given. */
export async function entriesByIds(ids: string[]): Promise<AdminEntry[]> {
  if (!isSupabaseConfigured() || !ids.length) return [];
  const { data } = await createAdminClient().from("entries").select(ENTRY_SELECT).in("id", ids);
  const byId = new Map((await toEntries((data ?? []) as unknown as EntryRow[])).map((e) => [e.id, e]));
  return ids.map((id) => byId.get(id)).filter((e): e is AdminEntry => Boolean(e));
}
