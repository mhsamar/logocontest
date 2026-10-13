import "server-only";
import { notifyWithPush } from "@/lib/notifications/broadcast";
import { avatarUrl } from "@/lib/profile/avatar";
import { createAdminClient } from "@/lib/supabase/admin";
import { matchScore } from "./rules";
import { getProSettings } from "./settings";
import { allProIds, proIdsAmong } from "./status";
import { designerStatsBulk } from "./stats";

const db = () => createAdminClient();

/** Skills a contest asks for, in the designer profile's skill keys (portfolio-options.ts). */
export function wantedSkills(c: { service: string | null; styles: string[] }): string[] {
  const svc = c.service ?? "logo";
  if (svc === "logo") return ["logo", "brand", ...(c.styles.includes("mascot") ? ["mascot"] : []), ...(c.styles.includes("calligraphy") ? ["calligraphy", "banglaLettering"] : [])];
  if (["business_card", "flyer", "tshirt"].includes(svc)) return ["print", "brand"];
  return ["social", "brand"];
}

export type InviteCandidate = {
  id: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  proSince: string;
  score: number;
  rating: number | null;
  winRate: number;
  wins: number;
  winsInType: number;
  skills: string[];
  types: string[];
  replyMinutes: number | null;
  activeThisWeek: boolean;
  invited: boolean;
};

/**
 * Pro designers a client can invite to this contest, ranked by "Best match" (client rating, win ratio, wins in this
 * design type, matching skills, reply time and activity). Only Pro designers; real numbers only.
 */
export async function inviteCandidates(contestId: string): Promise<{ contest: { id: string; slug: string; brand: string; prize: number; days: number; service: string; type: string; status: string; clientId: string }; list: InviteCandidate[]; invited: string[] } | null> {
  const { data: c } = await db().from("contests").select("id, slug, brand_name, prize_amount, duration_days, service, business_type, styles, status, client_id").eq("id", contestId).maybeSingle();
  if (!c) return null;
  const { data: inv } = await db().from("contest_invites").select("designer_id").eq("contest_id", contestId);
  const invited = (inv ?? []).map((r) => r.designer_id as string);
  const ids = await allProIds();
  if (!ids.length) return { contest: shape(c), list: [], invited };
  const [{ data: people }, { data: subs }, stats] = await Promise.all([
    db().from("profiles").select("id, name, username, avatar_path, skills, last_seen_at, status").in("id", ids).eq("role", "designer").eq("status", "active"),
    db().from("pro_subscriptions").select("designer_id, first_started_at").in("designer_id", ids),
    designerStatsBulk(ids),
  ]);
  const since = new Map((subs ?? []).map((s) => [s.designer_id as string, s.first_started_at as string]));
  const type = (c.service as string | null) && c.service !== "logo" ? (c.service as string) : (c.business_type as string);
  const want = wantedSkills({ service: c.service as string | null, styles: (c.styles as string[] | null) ?? [] });
  const week = Date.now() - 7 * 86_400_000;
  const list = (people ?? [])
    .filter((p) => p.id !== c.client_id)
    .map((p): InviteCandidate => {
      const s = stats.get(p.id as string)!;
      const skills = (p.skills as string[] | null) ?? [];
      const active = Boolean(p.last_seen_at && new Date(p.last_seen_at as string).getTime() > week);
      const winsInType = s.winsByType.get(type) ?? 0;
      return {
        id: p.id as string,
        name: p.name as string,
        username: (p.username as string | null) ?? null,
        avatarUrl: avatarUrl(p.avatar_path as string | null),
        proSince: since.get(p.id as string) ?? new Date().toISOString(),
        score: matchScore({ rating: s.rating, winRate: s.winRate, winsInType, skills, replyMinutes: s.replyMinutes, activeThisWeek: active }, want),
        rating: s.rating,
        winRate: s.winRate,
        wins: s.wins,
        winsInType,
        skills,
        types: s.types.slice(0, 4),
        replyMinutes: s.replyMinutes,
        activeThisWeek: active,
        invited: invited.includes(p.id as string),
      };
    })
    .sort((a, b) => b.score - a.score || b.wins - a.wins);
  return { contest: shape(c), list, invited };
}

function shape(c: Record<string, unknown>) {
  return {
    id: c.id as string,
    slug: c.slug as string,
    brand: c.brand_name as string,
    prize: (c.prize_amount as number) ?? 0,
    days: (c.duration_days as number) ?? 0,
    service: ((c.service as string | null) ?? "logo") as string,
    type: c.business_type as string,
    status: c.status as string,
    clientId: c.client_id as string,
  };
}

/**
 * The invitation itself, when the contest is open: a notification (and push) to each invited designer who is still
 * Pro, once. Called when the contest opens and when a client invites to an open contest.
 */
export async function notifyInvited(contestId: string): Promise<number> {
  const { ready, settings } = await getProSettings();
  if (!ready || !settings.features.invitations) return 0;
  const { data: c } = await db().from("contests").select("slug, brand_name, prize_amount, status, is_private, is_nda").eq("id", contestId).maybeSingle();
  if (!c || c.status !== "open") return 0;
  const { data: rows } = await db().from("contest_invites").select("designer_id").eq("contest_id", contestId).is("notified_at", null);
  const ids = [...(await proIdsAmong((rows ?? []).map((r) => r.designer_id as string)))];
  if (!ids.length) return 0;
  const { data: claimed } = await db().from("contest_invites").update({ notified_at: new Date().toISOString() }).eq("contest_id", contestId).in("designer_id", ids).is("notified_at", null).select("designer_id");
  const sendTo = (claimed ?? []).map((r) => r.designer_id as string);
  // Private and NDA contests: the invitation carries the prize, never the name.
  const brand = c.is_private || c.is_nda ? undefined : (c.brand_name as string);
  if (sendTo.length) await notifyWithPush(sendTo, brand ? "pro_invited" : "pro_invited_private", { brand, amount: c.prize_amount as number }, `/contest/${c.slug}?tab=brief`);
  return sendTo.length;
}

/** Designers invited to these contests (for the "Invited" badge on their designs). */
export async function invitedPairs(contestIds: string[]): Promise<Set<string>> {
  const { ready } = await getProSettings();
  if (!ready || !contestIds.length) return new Set();
  const { data } = await db().from("contest_invites").select("contest_id, designer_id").in("contest_id", contestIds);
  return new Set((data ?? []).map((r) => `${r.contest_id}:${r.designer_id}`));
}

/** Lifecycle job: "your invited contest ends soon" once, to invited designers who haven't sent a design. */
export async function remindInvited(now: Date = new Date()): Promise<number> {
  const { ready, settings } = await getProSettings();
  if (!ready || !settings.features.invitations) return 0;
  const until = new Date(now.getTime() + 24 * 3_600_000).toISOString();
  const { data: contests } = await db().from("contests").select("id, slug, brand_name, ends_at, is_private, is_nda").eq("status", "open").gt("ends_at", now.toISOString()).lte("ends_at", until);
  let n = 0;
  for (const c of contests ?? []) {
    const { data: rows } = await db().from("contest_invites").select("designer_id").eq("contest_id", c.id).is("reminded_at", null);
    const ids = (rows ?? []).map((r) => r.designer_id as string);
    if (!ids.length) continue;
    const { data: sent } = await db().from("entries").select("designer_id").eq("contest_id", c.id).in("designer_id", ids);
    const done = new Set((sent ?? []).map((r) => r.designer_id as string));
    const todo = ids.filter((id) => !done.has(id));
    const { data: claimed } = await db().from("contest_invites").update({ reminded_at: now.toISOString() }).eq("contest_id", c.id).in("designer_id", ids).is("reminded_at", null).select("designer_id");
    const claimedIds = new Set((claimed ?? []).map((r) => r.designer_id as string));
    const sendTo = todo.filter((id) => claimedIds.has(id));
    if (!sendTo.length) continue;
    const hours = Math.max(1, Math.round((new Date(c.ends_at as string).getTime() - now.getTime()) / 3_600_000));
    const brand = c.is_private || c.is_nda ? undefined : (c.brand_name as string);
    await notifyWithPush(sendTo, "pro_invite_reminder", { brand, hours }, `/contest/${c.slug}/submit`);
    n += sendTo.length;
  }
  return n;
}
