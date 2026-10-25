import "server-only";
import { unstable_cache } from "next/cache";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminIdsWith } from "./recipients";
import { wizardLeads, wizardLeadsByMobile } from "./leads";
import { isRealEmail } from "./reminder-rules";
import { unpaidNotes, type UnpaidOutcome } from "./unpaid-notes";
import {
  DRAFT_STAGE,
  AT_PAYMENT,
  PAID,
  RANGE_DAYS,
  dhakaMidnight,
  funnelCounts,
  stageOf,
  type CloseReason,
  type FakeReason,
  type FunnelStep,
  type How,
  type LeadState,
  type LeadStatus,
  type Range,
} from "./unpaid-rules";
import { cleanRemindBy, type RemindWay } from "./unpaid-alert-rules";

/**
 * Admin › Unpaid contests, follow-ups (owner, 2026-10-25; Design/unpaid-contests): everyone who started a contest but
 * didn't pay, as one list. An unpaid draft (signed up) or a guest who only gave a number on the first step. What the
 * team logged comes from unpaid_leads (migration 0076; before it, everyone is simply "new"). Phone and email are kept
 * apart in `contacts` and never go into the page's props: the page shows them only to Unpaid · Manage.
 */

const LIVE_OR_LATER = ["open", "judging", "winner_selected", "handover", "completed", "no_result"];
const MISSING = /PGRST205|PGRST204|42P01|42703/;
const missing = (e: { code?: string; message?: string } | null | undefined) => Boolean(e && (MISSING.test(e.code ?? "") || /does not exist|schema cache|Could not find/.test(e.message ?? "")));
type Row = Record<string, unknown>;

export type PaymentFailure = { kind: "bkash"; note: string | null } | { kind: "card" };

export type Lead = LeadState & {
  /** c:<contest id> or g:<visit id> (or g:<lead id> for a closed guest whose visits were deleted). */
  key: string;
  kind: "contest" | "guest";
  leadId: string | null;
  contestId: string | null;
  slug: string | null;
  /** The LC number, once the contest has opened (won back). */
  number: number | null;
  brand: string;
  clientName: string | null;
  clientId: string | null;
  isTest: boolean;
  signedUpAt: Date | null;
  prize: number | null;
  addons: number | null;
  fakeReason: FakeReason | null;
  closeNote: string | null;
  closedAt: Date | null;
  closedBy: string | null;
  owner: { id: string; name: string } | null;
  nextType: How | null;
  remindBy: RemindWay[] | null;
  lastContact: { type: string; at: Date; result: string | null } | null;
  paymentFailed: PaymentFailure | null;
  visits: number;
  lastSeen: Date | null;
  device: string | null;
  city: string | null;
  wonBack: { at: Date; amount: number } | null;
  hasContact: { mobile: boolean; email: boolean; whatsapp: boolean };
  visitIds: string[];
  /** Guests only: false before migration 0075 (name and email couldn't be saved). */
  detailsSaved: boolean;
};

export type Contact = { mobile: string | null; email: string | null; whatsapp: boolean | null };

export type Board = {
  leads: Lead[];
  /** Server-side only: for search and the audited contact actions. Never pass to a client component. */
  contacts: Map<string, Contact>;
  /** Migration 0076 has run. */
  ready: boolean;
  /** Admins who can follow up (Unpaid · Manage), for Assign to and the Owner filter. */
  owners: { id: string; name: string }[];
  /** Planned follow-ups carried out today. */
  doneToday: { key: string; brand: string; at: Date; type: string }[];
};

const date = (v: unknown) => (v ? new Date(v as string) : null);

/** A query over many ids, a slice at a time, so the request address never gets too long. Errors are logged, not thrown. */
async function inChunks(ids: string[], q: (part: string[]) => PromiseLike<{ data: unknown[] | null; error: { message?: string } | null }>, size = 150): Promise<Row[]> {
  const out: Row[] = [];
  for (let i = 0; i < ids.length; i += size) {
    const { data, error } = await q(ids.slice(i, i + size));
    if (error) console.error("[unpaid-board]", error.message);
    out.push(...((data ?? []) as Row[]));
  }
  return out;
}

/** Everyone on the page, with what the team logged. `include`: a guest visit an alert links to, found even if older. */
export async function unpaidBoard(now = new Date(), include?: string): Promise<Board> {
  const empty: Board = { leads: [], contacts: new Map(), ready: false, owners: [], doneToday: [] };
  if (!isSupabaseConfigured()) return empty;
  const db = createAdminClient();

  const [leadRows, open, guests, ownerIds] = await Promise.all([
    db.from("unpaid_leads").select("*").order("updated_at", { ascending: false }).limit(1000),
    db
      .from("contests")
      .select("id, slug, brand_name, status, total_amount, prize_amount, upgrades_amount, client_id, created_at, updated_at, contest_number, starts_at")
      .in("status", ["draft", "pending_payment"])
      .order("updated_at", { ascending: false })
      .limit(300),
    wizardLeads(200, include),
    adminIdsWith("unpaid.manage"),
  ]);
  const ready = !leadRows.error;
  if (leadRows.error && !missing(leadRows.error)) console.error("[unpaid-board]", leadRows.error.message);
  const rows = (ready ? leadRows.data ?? [] : []) as Row[];
  const byContest = new Map(rows.filter((r) => r.contest_id).map((r) => [r.contest_id as string, r]));
  const byMobile = new Map(rows.filter((r) => r.guest_mobile).map((r) => [r.guest_mobile as string, r]));

  // Contests the team followed up that are no longer unpaid: paid since (won back), or closed and gone from the list.
  const openContests = (open.data ?? []) as Row[];
  const openIds = new Set(openContests.map((c) => c.id as string));
  const otherIds = [...byContest.keys()].filter((id) => !openIds.has(id));
  const others = await inChunks(otherIds, (part) => db.from("contests").select("id, slug, brand_name, status, total_amount, prize_amount, upgrades_amount, client_id, created_at, updated_at, contest_number, starts_at").in("id", part));
  const contests = [...openContests, ...others];
  const contestIds = contests.map((c) => c.id as string);
  const clientIds = [...new Set(contests.map((c) => c.client_id as string).filter(Boolean))];
  const peopleIds = [...new Set([...clientIds, ...ownerIds, ...rows.flatMap((r) => [r.owner_id, r.closed_by].filter(Boolean) as string[])])];

  const [people, sessions, visits, payments, proofs, done] = await Promise.all([
    inChunks(peopleIds, (part) => db.from("profiles").select("id, name, mobile, email, whatsapp, is_test, last_seen_at, created_at").in("id", part)),
    inChunks(clientIds, (part) => db.from("user_sessions").select("user_id, device, city, last_seen_at").in("user_id", part).order("last_seen_at", { ascending: false }).limit(1000)),
    inChunks(contestIds, (part) => db.from("wizard_visits").select("contest_id, furthest_step, created_at").in("contest_id", part).limit(5000)),
    inChunks(contestIds, (part) => db.from("payments").select("contest_id, status, created_at").eq("purpose", "contest").in("contest_id", part).order("created_at", { ascending: false }).limit(2000)),
    inChunks(contestIds, (part) => db.from("manual_payments").select("contest_id, status, note, created_at").eq("kind", "contest").in("contest_id", part).order("created_at", { ascending: false }).limit(2000)),
    ready ? db.from("lead_activities").select("lead_id, kind, completes_at, created_at").not("completes_at", "is", null).gte("created_at", dhakaMidnight(now).toISOString()).limit(500) : { data: [] as Row[] },
  ]);
  const person = new Map(people.map((p) => [p.id as string, p]));
  const session = new Map<string, Row>();
  for (const s of sessions) if (!session.has(s.user_id as string)) session.set(s.user_id as string, s);
  const visitsOf = new Map<string, Row[]>();
  for (const v of visits) visitsOf.set(v.contest_id as string, [...(visitsOf.get(v.contest_id as string) ?? []), v]);
  const paysOf = new Map<string, Row[]>();
  for (const p of payments) paysOf.set(p.contest_id as string, [...(paysOf.get(p.contest_id as string) ?? []), p]);
  const proofsOf = new Map<string, Row[]>();
  for (const p of proofs) proofsOf.set(p.contest_id as string, [...(proofsOf.get(p.contest_id as string) ?? []), p]);
  // Guest rows that became a draft when the person signed up: the draft carries on their follow-up.
  const adopted = new Set<string>();
  const nameOf = (id: unknown) => (id ? ((person.get(id as string)?.name as string | undefined) ?? "—") : null);
  const ownerOf = (r: Row | undefined) => (r?.owner_id ? { id: r.owner_id as string, name: nameOf(r.owner_id) ?? "—" } : null);

  const state = (r: Row | undefined) => ({
    leadId: (r?.id as string | undefined) ?? null,
    status: ((r?.status as LeadStatus | undefined) ?? "new") as LeadStatus,
    closedReason: (r?.closed_reason as CloseReason | null | undefined) ?? null,
    fakeReason: (r?.fake_reason as FakeReason | null | undefined) ?? null,
    closeNote: (r?.close_note as string | null | undefined) ?? null,
    closedAt: date(r?.closed_at),
    closedBy: nameOf(r?.closed_by),
    hidden: r?.hidden === true,
    contacts: Number(r?.contacts_count ?? 0),
    nextAt: date(r?.next_followup_at),
    nextType: (r?.next_followup_type as How | null | undefined) ?? null,
    // "Remind me by" (phase 3; none before migration 0078).
    remindBy: cleanRemindBy(r?.remind_by),
    owner: ownerOf(r),
    ownerId: (r?.owner_id as string | null | undefined) ?? null,
    lastContact: r?.last_contact_at ? { type: String(r.last_contact_type ?? "note"), at: new Date(r.last_contact_at as string), result: (r.last_result as string | null) ?? null } : null,
  });

  const contacts = new Map<string, Contact>();
  const leads: Lead[] = [];

  for (const c of contests) {
    const id = c.id as string;
    const client = person.get(c.client_id as string);
    const asGuest = !byContest.get(id) && client?.mobile ? byMobile.get(client.mobile as string) : undefined;
    const r = byContest.get(id) ?? asGuest;
    const live = LIVE_OR_LATER.includes(c.status as string);
    const unpaid = c.status === "draft" || c.status === "pending_payment";
    // A bKash payment waiting for approval is paid as far as following up goes.
    const proofList = proofsOf.get(id) ?? [];
    if (unpaid && proofList.some((p) => p.status === "pending")) continue;
    const s = state(r);
    const wonBackAt = live && r && s.status !== "closed" && s.contacts > 0 && c.starts_at && new Date(r.created_at as string) < new Date(c.starts_at as string) ? new Date(c.starts_at as string) : null;
    // Paid without the team's help, or deleted: not a lead any more unless it was closed (kept for the record) or the
    // team is still on it (reopened after the draft went to the Trash).
    if (!unpaid && !wonBackAt && s.status !== "closed" && !(r && byContest.get(id) && c.status === "deleted")) continue;
    if (asGuest) adopted.add(asGuest.id as string);
    const p = person.get(c.client_id as string);
    const sess = session.get(c.client_id as string);
    const vs = visitsOf.get(id) ?? [];
    const stage = live ? PAID : Math.max(c.status === "pending_payment" ? AT_PAYMENT : DRAFT_STAGE, ...vs.map((v) => stageOf(v.furthest_step as number, v.created_at as string)));
    const latestPay = (paysOf.get(id) ?? [])[0];
    const latestProof = proofList[0];
    const proofFailed = latestProof?.status === "rejected" && (!latestPay || new Date(latestProof.created_at as string) >= new Date(latestPay.created_at as string));
    const paymentFailed: PaymentFailure | null = unpaid ? (proofFailed ? { kind: "bkash", note: (latestProof.note as string | null) ?? null } : latestPay?.status === "failed" ? { kind: "card" } : null) : null;
    const email = isRealEmail(p?.email as string | null) ? (p!.email as string) : null;
    const key = `c:${id}`;
    contacts.set(key, { mobile: (p?.mobile as string | null) ?? null, email, whatsapp: (p?.whatsapp as boolean | null) ?? null });
    const lastActivity = Math.max(new Date(c.updated_at as string).getTime(), s.lastContact?.at.getTime() ?? 0, ...vs.map((v) => new Date(v.created_at as string).getTime()));
    leads.push({
      ...s,
      key,
      kind: "contest",
      contestId: id,
      slug: (c.slug as string) ?? null,
      number: (c.contest_number as number | null) ?? null,
      brand: ((c.brand_name as string) || (r?.brand_snapshot as string) || "").trim(),
      clientName: (p?.name as string | null) ?? null,
      clientId: (c.client_id as string | null) ?? null,
      isTest: p?.is_test === true,
      signedUpAt: date(p?.created_at),
      amount: Number(c.total_amount ?? r?.amount_snapshot ?? 0) || null,
      prize: (c.prize_amount as number | null) ?? null,
      addons: (c.upgrades_amount as number | null) ?? null,
      stage,
      createdAt: new Date(c.created_at as string),
      lastActivityAt: new Date(lastActivity),
      paymentFailed,
      visits: vs.length,
      lastSeen: date(p?.last_seen_at),
      device: (sess?.device as string | null) ?? null,
      city: (sess?.city as string | null) ?? null,
      wonBackAt,
      wonBack: wonBackAt ? { at: wonBackAt, amount: Number(c.total_amount ?? 0) } : null,
      hasContact: { mobile: Boolean(p?.mobile), email: Boolean(email), whatsapp: p?.whatsapp === true },
      visitIds: [],
      detailsSaved: true,
    });
  }

  // Guests: a mobile number from the first step, no account yet (a number that signed up became a draft above).
  const seenGuests = new Set<string>();
  for (const g of guests) {
    seenGuests.add(g.mobile);
    const r = byMobile.get(g.mobile);
    const s = state(r);
    const key = `g:${g.visitId}`;
    contacts.set(key, { mobile: g.mobile, email: g.email, whatsapp: g.whatsapp });
    leads.push({
      ...s,
      key,
      kind: "guest",
      contestId: null,
      slug: null,
      number: null,
      brand: (g.brand ?? (r?.brand_snapshot as string) ?? "").trim(),
      clientName: g.name,
      clientId: null,
      isTest: false,
      signedUpAt: null,
      amount: null,
      prize: null,
      addons: null,
      stage: g.stage,
      createdAt: g.createdAt,
      lastActivityAt: new Date(Math.max(g.updatedAt.getTime(), s.lastContact?.at.getTime() ?? 0)),
      paymentFailed: null,
      visits: g.visits,
      lastSeen: g.updatedAt,
      device: null,
      city: null,
      wonBackAt: null,
      wonBack: null,
      hasContact: { mobile: true, email: Boolean(g.email), whatsapp: g.whatsapp === true },
      visitIds: g.visitIds,
      detailsSaved: g.detailsSaved,
    });
  }
  // Guests the team is following up who dropped out of the newest visits: loaded by their number.
  const missingGuests = rows.filter((r) => r.guest_mobile && !seenGuests.has(r.guest_mobile as string) && r.status !== "closed" && !adopted.has(r.id as string)).map((r) => r.guest_mobile as string);
  for (const g of await wizardLeadsByMobile(missingGuests)) {
    seenGuests.add(g.mobile);
    const s = state(byMobile.get(g.mobile));
    const key = `g:${g.visitId}`;
    contacts.set(key, { mobile: g.mobile, email: g.email, whatsapp: g.whatsapp });
    leads.push({ ...s, key, kind: "guest", contestId: null, slug: null, number: null, brand: (g.brand ?? "").trim(), clientName: g.name, clientId: null, isTest: false, signedUpAt: null, amount: null, prize: null, addons: null, stage: g.stage, createdAt: g.createdAt, lastActivityAt: new Date(Math.max(g.updatedAt.getTime(), s.lastContact?.at.getTime() ?? 0)), paymentFailed: null, visits: g.visits, lastSeen: g.updatedAt, device: null, city: null, wonBackAt: null, wonBack: null, hasContact: { mobile: true, email: Boolean(g.email), whatsapp: g.whatsapp === true }, visitIds: g.visitIds, detailsSaved: g.detailsSaved });
  }
  // Leads whose visits or draft are gone (after 90 days, or the Trash was emptied) stay from their own copy: closed ones
  // for the record (a fake close can still be reopened, lifting its block), open ones so nobody is dropped. Keyed by
  // the lead's own id (l:). A guest number that signed up since is left to its draft.
  const orphans = rows.filter((r) => !adopted.has(r.id as string) && ((r.guest_mobile && !seenGuests.has(r.guest_mobile as string)) || (r.kind === "contest" && !r.contest_id)));
  const orphanMobiles = orphans.map((r) => r.guest_mobile as string | null).filter((m): m is string => Boolean(m));
  const withAccount = new Set((await inChunks(orphanMobiles, (part) => db.from("profiles").select("mobile").in("mobile", part))).map((p) => p.mobile as string));
  for (const r of orphans) {
    const mobile = (r.guest_mobile as string | null) ?? null;
    if (mobile && withAccount.has(mobile)) continue;
    const s = state(r);
    const key = `l:${r.id as string}`;
    const client = r.client_id ? person.get(r.client_id as string) : undefined;
    contacts.set(key, { mobile: mobile ?? ((client?.mobile as string | null) ?? null), email: null, whatsapp: null });
    leads.push({
      ...s,
      key,
      kind: mobile ? "guest" : "contest",
      contestId: null,
      slug: null,
      number: null,
      brand: ((r.brand_snapshot as string) ?? "").trim(),
      clientName: (client?.name as string | undefined) ?? null,
      clientId: (r.client_id as string | null) ?? null,
      isTest: false,
      signedUpAt: null,
      amount: (r.amount_snapshot as number | null) ?? null,
      prize: null,
      addons: null,
      stage: 1,
      createdAt: new Date(r.created_at as string),
      lastActivityAt: new Date(r.updated_at as string),
      paymentFailed: null,
      visits: 0,
      lastSeen: null,
      device: null,
      city: null,
      wonBackAt: null,
      wonBack: null,
      hasContact: { mobile: Boolean(mobile ?? client?.mobile), email: false, whatsapp: false },
      visitIds: [],
      detailsSaved: false,
    });
  }

  const byLeadId = new Map(leads.filter((l) => l.leadId).map((l) => [l.leadId!, l]));
  const doneToday = ((done.data ?? []) as Row[]).flatMap((a) => {
    const l = byLeadId.get(a.lead_id as string);
    return l ? [{ key: l.key, brand: l.brand, at: new Date(a.completes_at as string), type: a.kind as string }] : [];
  });
  const owners = ownerIds.map((id) => ({ id, name: nameOf(id) ?? "—" })).sort((a, b) => a.name.localeCompare(b.name));
  return { leads, contacts, ready, owners, doneToday };
}

// ---- Where they get stuck ---------------------------------------------------------------------------------------------

/** Wizard visits in the range, by the stage they reached (old numbering mapped), and whether their contest was paid. */
export async function stuckFunnel(range: Range, now = new Date()): Promise<FunnelStep[]> {
  if (!isSupabaseConfigured()) return funnelCounts([]);
  const db = createAdminClient();
  const { data } = await db.from("wizard_visits").select("furthest_step, contest_id, created_at").gte("created_at", dhakaMidnight(now, -RANGE_DAYS[range]).toISOString()).limit(20000);
  const rows = (data ?? []) as Row[];
  const ids = [...new Set(rows.map((r) => r.contest_id as string | null).filter((x): x is string => Boolean(x)))];
  const paid = new Set<string>();
  for (const c of await inChunks(ids, (part) => db.from("contests").select("id").in("id", part).in("status", LIVE_OR_LATER))) paid.add(c.id as string);
  return funnelCounts(rows.map((r) => ({ stage: stageOf(r.furthest_step as number, r.created_at as string), paid: Boolean(r.contest_id && paid.has(r.contest_id as string)) })));
}

/**
 * The funnel for the page, kept for a minute: it doesn't change with the person opened, so clicking through the list
 * doesn't count thousands of visits again each time (owner, 2026-10-25).
 */
export const cachedStuckFunnel = unstable_cache(async (range: Range) => stuckFunnel(range, new Date()), ["unpaid-funnel-v1"], { revalidate: 60 });

// ---- History ----------------------------------------------------------------------------------------------------------

export type HistoryItem = {
  at: Date;
  /** Who: an admin's name, or null for the system. */
  by: string | null;
  kind: "call" | "whatsapp" | "sms" | "email" | "note" | "system" | "chat";
  /** The person themselves wrote it (the help chat on Start a contest), not the team or the system. */
  visitor?: boolean;
  /** What happened, as a message key part (see admin.unpaid.fu.history.*) with its values. */
  event: string;
  result?: string | null;
  note?: string | null;
  next?: Date | null;
  tone: "good" | "bad" | "info" | "amber" | "neutral";
};

const OLD_OUTCOME: Record<UnpaidOutcome, string> = { mistake: "fake", later: "will_pay", restart: "talked", help: "needs_help", price: "talked", no_answer: "no_answer", not_interested: "not_interested", other: "talked" };

/** A lead's History, newest first: what the team logged (also on the guest number before they signed up), old call notes, and what the system saw. */
export async function leadHistory(lead: Lead, contact: Contact | undefined): Promise<HistoryItem[]> {
  if (!isSupabaseConfigured()) return [];
  const db = createAdminClient();
  const items: HistoryItem[] = [];
  const leadIds: string[] = lead.leadId ? [lead.leadId] : [];
  if (lead.kind === "contest" && contact?.mobile) {
    const { data: g } = await db.from("unpaid_leads").select("id").eq("guest_mobile", contact.mobile).maybeSingle();
    if (g?.id) leadIds.push(g.id as string);
  }
  if (leadIds.length) {
    const { data: acts } = await db.from("lead_activities").select("admin_id, kind, result, event, note, next_followup_at, created_at").in("lead_id", leadIds).order("created_at", { ascending: false }).limit(60);
    const adminIds = [...new Set((acts ?? []).map((a) => a.admin_id as string).filter(Boolean))];
    const { data: admins } = adminIds.length ? await db.from("profiles").select("id, name").in("id", adminIds) : { data: [] as Row[] };
    const name = new Map((admins ?? []).map((a) => [a.id as string, a.name as string]));
    for (const a of acts ?? []) {
      const kind = a.kind as HistoryItem["kind"];
      const result = a.result as string | null;
      const tone: HistoryItem["tone"] =
        a.event === "closed_fake" ? "bad" : kind === "system" ? "neutral" : kind === "email" ? "amber" : kind === "sms" ? "info" : kind === "note" ? "neutral" : result === "no_answer" || result === "wrong_number" ? "amber" : "good";
      items.push({ at: new Date(a.created_at as string), by: a.admin_id ? (name.get(a.admin_id as string) ?? "—") : null, kind, event: (a.event as string) || "contact", result, note: (a.note as string | null) ?? null, next: date(a.next_followup_at), tone });
    }
  }
  // The help chat from Start a contest (owner, 2026-10-25): by this draft, the client's account, or the visits that gave
  // this number (also from before they signed up).
  let visitIds = lead.visitIds;
  if (lead.kind === "contest" && contact?.mobile) {
    const { data: gave } = await db.from("wizard_leads").select("visit_id").eq("mobile", contact.mobile).limit(50);
    visitIds = [...new Set([...visitIds, ...(gave ?? []).map((g) => g.visit_id as string)])];
  }
  const ids = visitIds.filter((v) => /^[0-9a-f-]{36}$/i.test(v)).slice(0, 100);
  const chats = [lead.contestId ? `contest_id.eq.${lead.contestId}` : null, lead.clientId ? `user_id.eq.${lead.clientId}` : null, ids.length ? `visit_id.in.(${ids.join(",")})` : null].filter(Boolean);
  if (chats.length) {
    const { data: offers } = await db.from("help_offers").select("id").or(chats.join(",")).order("created_at", { ascending: false }).limit(10);
    const { data: messages } = offers?.length ? await db.from("help_messages").select("offer_id, from_admin, admin_id, kind, body, created_at").in("offer_id", offers.map((o) => o.id as string)).order("id", { ascending: true }).limit(400) : { data: [] as Row[] };
    const adminIds = [...new Set((messages ?? []).map((m) => m.admin_id as string).filter(Boolean))];
    const { data: admins } = adminIds.length ? await db.from("profiles").select("id, name").in("id", adminIds) : { data: [] as Row[] };
    const name = new Map((admins ?? []).map((a) => [a.id as string, a.name as string]));
    const opened = new Set<string>();
    for (const m of messages ?? []) {
      const first = m.from_admin === true && !opened.has(m.offer_id as string);
      if (first) opened.add(m.offer_id as string);
      const event = m.from_admin ? (first ? "help_offered" : "help_admin_reply") : m.kind === "call_me" ? "help_call_me" : m.kind === "no_thanks" ? "help_no_thanks" : "help_reply";
      items.push({ at: new Date(m.created_at as string), by: m.admin_id ? (name.get(m.admin_id as string) ?? "—") : null, visitor: !m.from_admin, kind: "chat", event, note: (m.body as string | null) || null, tone: m.kind === "no_thanks" ? "amber" : m.from_admin ? "info" : "good" });
    }
  }
  if (lead.contestId) {
    const [notes, pays, proofs, reminders] = await Promise.all([
      unpaidNotes([lead.contestId]),
      db.from("payments").select("status, created_at").eq("purpose", "contest").eq("contest_id", lead.contestId).order("created_at", { ascending: false }).limit(10),
      db.from("manual_payments").select("status, note, created_at, reviewed_at").eq("kind", "contest").eq("contest_id", lead.contestId).order("created_at", { ascending: false }).limit(10),
      // The automatic reminders that really went (phase 3, owner 2026-10-26).
      db.from("email_log").select("ref, created_at").eq("template", "contest-reminder").eq("status", "sent").in("ref", [`remind:${lead.contestId}:first`, `remind:${lead.contestId}:last`]),
    ]);
    for (const r of reminders.data ?? []) items.push({ at: new Date(r.created_at as string), by: null, kind: "email", event: String(r.ref).endsWith(":last") ? "remind_last" : "remind_first", tone: "amber" });
    for (const n of notes?.get(lead.contestId) ?? []) items.push({ at: n.at, by: n.by, kind: "note", event: "old_note", result: OLD_OUTCOME[n.outcome], note: n.note, tone: "neutral" });
    for (const p of pays.data ?? []) {
      items.push({ at: new Date(p.created_at as string), by: null, kind: "system", event: p.status === "failed" ? "payment_failed" : p.status === "paid" ? "paid" : "payment_started", tone: p.status === "failed" ? "bad" : p.status === "paid" ? "good" : "neutral" });
    }
    for (const p of proofs.data ?? []) {
      items.push({ at: new Date(p.created_at as string), by: null, kind: "system", event: "proof_sent", tone: "info" });
      if (p.status === "rejected") items.push({ at: date(p.reviewed_at) ?? new Date(p.created_at as string), by: null, kind: "system", event: "proof_rejected", note: (p.note as string | null) ?? null, tone: "bad" });
    }
  }
  items.push({ at: lead.createdAt, by: null, kind: "system", event: lead.kind === "guest" ? "gave_number" : "started", tone: "neutral" });
  return items.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 60);
}
