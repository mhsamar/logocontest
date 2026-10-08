import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { avatarUrl } from "@/lib/profile/avatar";
import { getSetting } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";

/** Designer public profile (P-06) and dashboard (D-02) data. */

export type DesignerStats = {
  contestsEntered: number;
  designs: number;
  wins: number;
  /** Public total earned: prize credits, shares and bonuses after fees (BLUEPRINT §8.3). */
  totalEarned: number;
};

export type DesignerProfile = {
  id: string;
  name: string;
  username: string;
  bio: string | null;
  avatarUrl: string | null;
  memberSince: Date;
  isTopDesigner: boolean;
  stats: DesignerStats;
};

/**
 * TODO(milestone 4): count entries and contests from `entries`.
 * TODO(milestone 7): total earned from wallet transactions.
 */
async function statsFor(winsCount: number): Promise<DesignerStats> {
  return { contestsEntered: 0, designs: 0, wins: winsCount, totalEarned: 0 };
}

type Row = { id: string; name: string; username: string | null; bio: string | null; avatar_path: string | null; created_at: string; wins_count: number; counted_wins_count: number };

async function toProfile(r: Row): Promise<DesignerProfile> {
  const topMin = await getSetting("limits.top_designer_min_wins");
  return {
    id: r.id,
    name: r.name,
    username: r.username ?? "",
    bio: r.bio,
    avatarUrl: avatarUrl(r.avatar_path),
    memberSince: new Date(r.created_at),
    isTopDesigner: r.counted_wins_count >= topMin,
    stats: await statsFor(r.wins_count),
  };
}

const COLUMNS = "id, name, username, bio, avatar_path, created_at, wins_count, counted_wins_count";

/** Active designer by username (case-insensitive), or null. */
export async function designerByUsername(username: string): Promise<DesignerProfile | null> {
  if (!isSupabaseConfigured() || !/^[a-z0-9_]{3,20}$/i.test(username)) return null;
  const { data } = await createAdminClient()
    .from("profiles")
    .select(COLUMNS)
    .eq("username", username.toLowerCase())
    .eq("role", "designer")
    .eq("status", "active")
    .maybeSingle<Row>();
  return data ? toProfile(data) : null;
}

export async function designerById(id: string): Promise<DesignerProfile | null> {
  if (!isSupabaseConfigured()) return null;
  const { data } = await createAdminClient().from("profiles").select(COLUMNS).eq("id", id).maybeSingle<Row>();
  return data ? toProfile(data) : null;
}

export type DesignerContest = { slug: string; brandName: string; status: string; myEntries: number; won: boolean; winningLogoUrl: string | null };

/** Contests the designer submitted to. TODO(milestone 4): read from `entries`. */
export async function designerContests(userId: string): Promise<DesignerContest[]> {
  void userId;
  return [];
}
