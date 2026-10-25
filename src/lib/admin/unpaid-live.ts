import "server-only";
import type { CurrentUser } from "@/lib/auth/policies";
import { isRealEmail } from "@/lib/admin/reminder-rules";
import { isSupabaseConfigured } from "@/lib/env";
import { formatMobile, maskBdMobile } from "@/lib/phone";
import { serviceNames } from "@/lib/pro/workspace";
import { createAdminClient } from "@/lib/supabase/admin";
import { cleanLiveAnswers, isLive, LIVE_FRESH_MS, TYPING_MS, type LiveAnswers } from "@/lib/wizard-live-rules";
import { audit } from "./core";
import { hasPermission } from "./permissions";

/**
 * "Creating a contest right now" (owner, 2026-10-25; Design/unpaid-contests, phase 2): the people on Start a contest
 * this minute, with their step, the form answers of the one being watched (each Watch in the audit log), and the help
 * chat of one of them. Real visitors only (the team, designers and "Log in as" never ping). Phone and email only for
 * Unpaid · Manage, masked; the full number only through the logged "Call" (reachLead).
 */

type Row = Record<string, unknown>;
const MISSING = /PGRST205|PGRST204|42P01|42703/;

export type LiveCard = {
  visit: string;
  /** Their name once known: a client's account, or the name a guest gave on step 1. Null shows "Guest". */
  name: string | null;
  signedIn: boolean;
  isTest: boolean;
  city: string | null;
  country: string | null;
  device: string | null;
  /** A service contest's name; null for a logo contest. */
  service: string | null;
  stage: number;
  pos: number | null;
  of: number | null;
  startedAt: string;
  stepSince: string;
  updatedAt: string;
  doing: string | null;
  away: boolean;
  /** On the list only what the activity line needs (business, package); every answer when watched. */
  answers: LiveAnswers;
  total: number | null;
  locale: string | null;
  /** Watched: they left Start a contest (or went to payment); this is what they had filled in. */
  gone?: boolean;
  /** Masked for Unpaid · Manage; "hidden" for everyone else; null when none is known yet. */
  contact: { mobile: string | null; email: boolean } | "hidden" | null;
  /** Their lead on this page (c:<draft> or g:<visit>), once they have one. */
  leadKey: string | null;
  hasNumber: boolean;
  offer: { status: string; unread: number; by: string | null } | null;
};

const maskMobile = (m: string) => (m.startsWith("+880") ? maskBdMobile(m) : `${formatMobile(m).slice(0, 4)} •••• ${m.slice(-3)}`);
const COLUMNS = "visit_id, user_id, contest_id, service, stage, pos, steps_total, doing, answers, total, device, country, city, locale, away, started_at, step_since, updated_at, ended_at";
/** One Watch in the audit log per admin and person every 10 minutes (the panel asks every few seconds). */
const WATCH_LOG_MS = 10 * 60_000;

/** Everyone on Start a contest now, furthest along first. `ready` is false before migration 0077. */
export async function liveCards(admin: CurrentUser, now = new Date()): Promise<{ ready: boolean; cards: LiveCard[] }> {
  if (!isSupabaseConfigured()) return { ready: true, cards: [] };
  const db = createAdminClient();
  const { data, error } = await db
    .from("wizard_live")
    .select(COLUMNS)
    .is("ended_at", null)
    .gt("updated_at", new Date(now.getTime() - LIVE_FRESH_MS).toISOString())
    .order("updated_at", { ascending: false })
    .limit(40);
  if (error) return { ready: !MISSING.test(`${error.code}`), cards: [] };
  const rows = (data ?? []).filter((r) => isLive({ stage: Number(r.stage), updatedAt: new Date(r.updated_at as string), endedAt: null }, now));
  const cards = await toCards(admin, rows as Row[], false);
  // On Review first (about to pay), then the furthest along, then the longest on the page.
  cards.sort((a, b) => b.stage - a.stage || Date.parse(a.startedAt) - Date.parse(b.startedAt));
  return { ready: true, cards };
}

/** One person's card with every form answer (Watch), also after they left; logged. */
export async function watchCard(admin: CurrentUser, visitId: string, now = new Date()): Promise<LiveCard | null> {
  if (!isSupabaseConfigured()) return null;
  const db = createAdminClient();
  const { data: row } = await db.from("wizard_live").select(COLUMNS).eq("visit_id", visitId).maybeSingle();
  if (!row) return null;
  const { data: logged } = await db.from("audit_logs").select("id").eq("admin_id", admin.id).eq("action", "unpaid_watch").eq("subject_id", visitId).gt("created_at", new Date(now.getTime() - WATCH_LOG_MS).toISOString()).limit(1);
  if (!logged?.length) await audit(admin.id, "unpaid_watch", "visit", visitId);
  const [card] = await toCards(admin, [row as Row], true);
  return card ? { ...card, gone: !isLive({ stage: card.stage, updatedAt: new Date(card.updatedAt), endedAt: row.ended_at ? new Date(row.ended_at as string) : null }, now) } : null;
}

async function toCards(admin: CurrentUser, rows: Row[], full: boolean): Promise<LiveCard[]> {
  if (!rows.length) return [];
  const db = createAdminClient();
  const visits = rows.map((r) => r.visit_id as string);
  const userIds = [...new Set(rows.map((r) => r.user_id as string | null).filter((v): v is string => Boolean(v)))];
  const [people, guests, offers, services] = await Promise.all([
    userIds.length ? db.from("profiles").select("id, name, business_name, mobile, email, is_test").in("id", userIds) : Promise.resolve({ data: [] as Row[] }),
    db.from("wizard_leads").select("visit_id, name, mobile, email").in("visit_id", visits),
    db.from("help_offers").select("visit_id, status, unread_by_admin, admin_id").in("visit_id", visits),
    rows.some((r) => r.service !== "logo") ? serviceNames(admin.locale) : Promise.resolve(new Map<string, string>()),
  ]);
  const person = new Map((people.data ?? []).map((p) => [p.id as string, p]));
  const guest = new Map((guests.data ?? []).map((g) => [g.visit_id as string, g]));
  const offer = new Map((offers.data ?? []).map((o) => [o.visit_id as string, o]));
  const adminIds = [...new Set((offers.data ?? []).map((o) => o.admin_id as string | null).filter((v): v is string => Boolean(v)))];
  const { data: admins } = adminIds.length ? await db.from("profiles").select("id, name").in("id", adminIds) : { data: [] as Row[] };
  const adminName = new Map((admins ?? []).map((a) => [a.id as string, a.name as string]));
  const manage = hasPermission(admin, "unpaid.manage");

  return rows.map((r): LiveCard => {
    const visit = r.visit_id as string;
    const p = r.user_id ? person.get(r.user_id as string) : undefined;
    const g = guest.get(visit);
    const o = offer.get(visit);
    // Until the wizard asks for it, a new client's name is a copy of their brand name.
    const name = p ? (p.name && p.name !== p.business_name ? (p.name as string) : null) : ((g?.name as string | null) ?? null);
    const mobile = ((p?.mobile as string | null) ?? (g?.mobile as string | null)) || null;
    const email = isRealEmail((p?.email as string | null) ?? (g?.email as string | null));
    return {
      visit,
      name,
      signedIn: Boolean(p),
      isTest: p?.is_test === true,
      city: (r.city as string | null) ?? null,
      country: (r.country as string | null) ?? null,
      device: (r.device as string | null) ?? null,
      service: r.service === "logo" ? null : (services.get(r.service as string) ?? (r.service as string)),
      stage: Number(r.stage),
      pos: (r.pos as number | null) ?? null,
      of: (r.steps_total as number | null) ?? null,
      startedAt: r.started_at as string,
      stepSince: r.step_since as string,
      updatedAt: r.updated_at as string,
      doing: (r.doing as string | null) ?? null,
      away: r.away === true,
      answers: full ? cleanLiveAnswers(r.answers) : listAnswers(cleanLiveAnswers(r.answers)),
      total: full ? ((r.total as number | null) ?? null) : null,
      locale: (r.locale as string | null) ?? null,
      contact: !mobile && !email ? null : manage ? { mobile: mobile ? maskMobile(mobile) : null, email } : "hidden",
      leadKey: r.contest_id ? `c:${r.contest_id}` : g ? `g:${visit}` : null,
      hasNumber: Boolean(mobile),
      offer: o ? { status: o.status as string, unread: Number(o.unread_by_admin ?? 0), by: o.admin_id ? (adminName.get(o.admin_id as string) ?? null) : null } : null,
    };
  });
}

/** What the list needs for "picked “Restaurant & food”" and the package; the rest only in Watch. */
const listAnswers = (a: LiveAnswers): LiveAnswers => ({ ...(a.business ? { business: a.business } : {}), ...(a.package ? { package: a.package } : {}) });

export type HelpThread = {
  status: string;
  by: string | null;
  createdAt: string;
  typing: boolean;
  messages: { id: number; fromAdmin: boolean; by: string | null; kind: string; body: string; at: string }[];
} | null;

/** One visit's help chat. An admin with Unpaid · Manage looking at it is "Online now" for the visitor, and reads it. */
export async function helpThread(admin: CurrentUser, visitId: string, now = new Date()): Promise<HelpThread> {
  if (!isSupabaseConfigured()) return null;
  const db = createAdminClient();
  const { data: o } = await db.from("help_offers").select("id, status, admin_id, created_at, visitor_typing_at").eq("visit_id", visitId).maybeSingle();
  if (!o) return null;
  const [{ data: messages }] = await Promise.all([
    db.from("help_messages").select("id, from_admin, admin_id, kind, body, created_at").eq("offer_id", o.id).order("id", { ascending: true }).limit(60),
    hasPermission(admin, "unpaid.manage") ? db.from("help_offers").update({ admin_seen_at: now.toISOString(), unread_by_admin: 0 }).eq("id", o.id) : null,
  ]);
  const ids = [...new Set([o.admin_id, ...(messages ?? []).map((m) => m.admin_id)].filter((v): v is string => typeof v === "string"))];
  const { data: admins } = ids.length ? await db.from("profiles").select("id, name").in("id", ids) : { data: [] as Row[] };
  const name = new Map((admins ?? []).map((a) => [a.id as string, a.name as string]));
  const typingAt = o.visitor_typing_at ? Date.parse(o.visitor_typing_at as string) : 0;
  return {
    status: o.status as string,
    by: o.admin_id ? (name.get(o.admin_id as string) ?? null) : null,
    createdAt: o.created_at as string,
    typing: now.getTime() - typingAt < TYPING_MS,
    messages: (messages ?? []).map((m) => ({ id: m.id as number, fromAdmin: m.from_admin === true, by: m.admin_id ? (name.get(m.admin_id as string) ?? null) : null, kind: m.kind as string, body: (m.body as string | null) ?? "", at: m.created_at as string })),
  };
}
