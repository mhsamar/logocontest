import "server-only";
import { unstable_cache } from "next/cache";
import { isSupabaseConfigured } from "@/lib/env";
import { avatarUrl } from "@/lib/profile/avatar";
import { getSettings } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The live designers tag in the home hero (owner, 2026-10-11). Real numbers only: "joined" is every active designer
 * account (no admins or staff, test, suspended, banned or deleted accounts), "online" is those seen in the last
 * 5 minutes (profiles.last_seen_at, migration 0037). Only the two numbers and three faces leave this file: never a
 * name, an id or a list of users. A face is a photo, or two initials when fewer than three designers have one.
 */

export type LiveFace = { src: string } | { initials: string };
export type LiveDesigners = { joined: number; online: number | null; faces: LiveFace[] };

const ONLINE_MS = 5 * 60_000;

const initials = (name: string | null) =>
  (name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => Array.from(w)[0]!.toUpperCase())
    .join("") || "•";

/** The raw numbers, worked out at most once a minute. Null when the database can't answer (e.g. before 0037). */
export const liveDesignerCounts = unstable_cache(
  async (): Promise<{ joined: number; online: number; faces: LiveFace[] } | null> => {
    if (!isSupabaseConfigured()) return null;
    const db = createAdminClient();
    const designers = (columns: string, head = false) =>
      db.from("profiles").select(columns, head ? { count: "exact", head: true } : undefined).eq("role", "designer").eq("status", "active").eq("is_test", false);
    const since = new Date(Date.now() - ONLINE_MS).toISOString();
    const [joined, online, photos, others] = await Promise.all([
      designers("id", true),
      designers("id", true).gte("last_seen_at", since),
      designers("avatar_path").not("avatar_path", "is", null).order("last_seen_at", { ascending: false, nullsFirst: false }).limit(3),
      designers("name").is("avatar_path", null).order("last_seen_at", { ascending: false, nullsFirst: false }).limit(3),
    ]);
    if (joined.error || online.error || photos.error || others.error) return null;
    const faces: LiveFace[] = (photos.data ?? []).flatMap((p) => {
      const src = avatarUrl((p as { avatar_path?: string | null }).avatar_path);
      return src ? [{ src }] : [];
    });
    for (const p of others.data ?? []) if (faces.length < 3) faces.push({ initials: initials((p as { name?: string | null }).name ?? null) });
    return { joined: joined.count ?? 0, online: online.count ?? 0, faces };
  },
  ["live-designers-v1"],
  { revalidate: 60, tags: ["live-designers"] },
);

/**
 * What the home page may show, with the limits from Settings applied: null (no tag) below the "joined" limit, and no
 * online number below the "online" limit.
 */
export async function liveDesigners(): Promise<LiveDesigners | null> {
  const [counts, s] = await Promise.all([liveDesignerCounts(), getSettings(["home.live_joined_min", "home.live_online_min"])]);
  if (!counts || counts.joined < Math.max(1, s["home.live_joined_min"])) return null;
  return { joined: counts.joined, online: counts.online >= Math.max(1, s["home.live_online_min"]) ? counts.online : null, faces: counts.faces };
}
