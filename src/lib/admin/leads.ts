import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { stageOf } from "./unpaid-rules";

/**
 * New clients who gave their mobile number on the wizard's first step but haven't signed up (owner, 2026-10-14),
 * newest first. A number that now belongs to an account is left out. Before migration 0052: none.
 * One entry per number (owner, 2026-10-25): its latest visit, with what they typed on the first step (migration 0075),
 * when they first came, how far they ever got and how many times they tried.
 * Onboarding v2 (owner, 2026-10-29; spec §4) makes the account on its first step, before any contest: a client who
 * stopped there stays a lead (see `accounts`).
 */
export type WizardLead = {
  /** The latest visit's id: the lead's details open with ?lead=<visitId> (never the number in an address). */
  visitId: string;
  /** Every visit of this number, so a link to an older one still opens it. */
  visitIds: string[];
  mobile: string;
  name: string | null;
  email: string | null;
  whatsapp: boolean | null;
  /** False before migration 0075: name, email and WhatsApp couldn't be saved yet. */
  detailsSaved: boolean;
  brand: string | null;
  service: string | null;
  /** The furthest step of any visit (as recorded). */
  step: number;
  /** The furthest stage in today's numbering, worked out per visit (visits before 15 Oct used the old one). */
  stage: number;
  updatedAt: Date;
  /** First contact: the earliest visit. */
  createdAt: Date;
  visits: number;
  /** When the team was told about this person (migration 0075). */
  alertedAt: Date | null;
  /** The client account this number made on the new wizard's first step, which has no contest yet (its visits are then only those typed with the account's email); null for a guest. */
  account: string | null;
};

type Row = Record<string, unknown>;
type Db = ReturnType<typeof createAdminClient>;
const BASE = "visit_id, mobile, brand_name, service, furthest_step, created_at, updated_at";
const DETAILS = `${BASE}, name, email, whatsapp, alerted_at`;
const UUID = /^[0-9a-f-]{36}$/i;

/** Lead rows (all, or one number's), newest first, with the details when migration 0075 has run. */
async function readRows(db: Db, mobile?: string): Promise<{ rows: Row[]; detailsSaved: boolean } | null> {
  const read = (cols: string) => {
    const q = db.from("wizard_leads").select(cols);
    return (mobile ? q.eq("mobile", mobile) : q).order("updated_at", { ascending: false }).limit(200);
  };
  let { data, error } = await read(DETAILS);
  if (!error) return { rows: (data ?? []) as unknown as Row[], detailsSaved: true };
  // Before migration 0075: no name, email or alert columns yet.
  ({ data, error } = await read(BASE));
  return error ? null : { rows: (data ?? []) as unknown as Row[], detailsSaved: false };
}

/** A client account made on the new wizard's first step, with the email it signed up with. */
export type StepOneAccount = { id: string; email: string | null };

/** Two emails are the same address (lower case, no spaces around); an empty one matches nothing. */
const sameEmail = (a: unknown, b: unknown) => typeof a === "string" && typeof b === "string" && a.trim() !== "" && a.trim().toLowerCase() === b.trim().toLowerCase();
/** A visit the account holder made themselves: the email typed with the number is the account's. */
const isOwn = (r: Row, a: StepOneAccount | undefined) => a !== undefined && sameEmail(r.email, a.email);
/** A step-1 account's own visits only (someone else may have typed that number); anyone else's list as it is. */
const ownRows = (list: Row[], a: StepOneAccount | undefined) => (a ? list.filter((r) => isOwn(r, a)) : list);

/**
 * Which numbers belong to an account, so they are left out (their draft is listed instead), and which of them are
 * left in: a client who made their account on the new wizard's first step and has no contest at all yet. Told apart by
 * a visit of that number being the new wizard's (migration 0079) with the account's own email: someone else who typed
 * that number there (their sign-up was then refused, the number being taken) is not the account holder, and neither
 * makes the account a lead nor mixes into it. A designer's or admin's number, a client with a contest, one only seen
 * on the old wizard, and every account before that migration: left out as before.
 */
async function accounts(db: Db, rows: Row[]): Promise<{ signedUp: Set<string>; stepOne: Map<string, StepOneAccount> }> {
  const mobiles = [...new Set(rows.map((r) => r.mobile as string))];
  const stepOne = new Map<string, StepOneAccount>();
  if (!mobiles.length) return { signedUp: new Set(), stepOne };
  const { data } = await db.from("profiles").select("id, mobile, role, email").in("mobile", mobiles);
  const list = (data ?? []) as Row[];
  const signedUp = new Set(list.map((a) => a.mobile as string));
  // Numbers with exactly one account, a client's.
  const clients = new Map<string, StepOneAccount>();
  for (const m of signedUp) {
    const own = list.filter((a) => a.mobile === m);
    if (own.length === 1 && own[0].role === "client") clients.set(m, { id: own[0].id as string, email: (own[0].email as string | null) ?? null });
  }
  if (!clients.size) return { signedUp, stepOne };
  // Before migration 0075 there is no email on a visit: nobody is told apart, all left out as before.
  const visits = rows.filter((r) => isOwn(r, clients.get(r.mobile as string))).map((r) => r.visit_id as string);
  const v2 = new Set<string>();
  for (let i = 0; i < visits.length; i += 150) {
    const { data: seen, error } = await db.from("wizard_visits").select("id").in("id", visits.slice(i, i + 150)).eq("flow", "v2");
    // Before migration 0079 every visit is the old wizard's.
    if (error) return { signedUp, stepOne };
    for (const v of seen ?? []) v2.add(v.id as string);
  }
  const fromV2 = [...clients].filter(([m]) => rows.some((r) => r.mobile === m && v2.has(r.visit_id as string)));
  if (!fromV2.length) return { signedUp, stepOne };
  // Any contest at all (also paid, cancelled or in the Trash): then that contest is who they are on the page.
  const { data: made, error } = await db.from("contests").select("client_id").in("client_id", fromV2.map(([, a]) => a.id));
  if (error) return { signedUp, stepOne };
  const withContest = new Set((made ?? []).map((c) => c.client_id as string));
  for (const [m, a] of fromV2) if (!withContest.has(a.id)) stepOne.set(m, a);
  return { signedUp, stepOne };
}

/**
 * The account this number made on the new wizard's first step (no contest yet), or null: a guest key's details are
 * then the account's (its email), never what someone typed with the number.
 */
export async function stepOneAccount(mobile: string): Promise<StepOneAccount | null> {
  if (!isSupabaseConfigured() || !mobile) return null;
  const db = createAdminClient();
  const read = await readRows(db, mobile);
  if (!read?.rows.length) return null;
  return (await accounts(db, read.rows)).stepOne.get(mobile) ?? null;
}

/** One person from all their visits (newest first). */
function toLead(mobile: string, list: Row[], detailsSaved: boolean, account: string | null = null): WizardLead {
  const latest = list[0];
  const pick = <T,>(key: string) => (list.map((r) => r[key]).find((v) => v !== null && v !== undefined && v !== "") as T | undefined) ?? null;
  const alerted = list.map((r) => r.alerted_at as string | null | undefined).filter((v): v is string => Boolean(v));
  return {
    visitId: latest.visit_id as string,
    visitIds: list.map((r) => r.visit_id as string),
    mobile,
    name: pick<string>("name"),
    email: pick<string>("email"),
    whatsapp: pick<boolean>("whatsapp"),
    detailsSaved,
    brand: pick<string>("brand_name"),
    service: (latest.service as string | null) ?? null,
    step: Math.max(...list.map((r) => Number(r.furthest_step) || 1)),
    stage: Math.max(...list.map((r) => stageOf(Number(r.furthest_step) || 1, r.created_at as string))),
    updatedAt: new Date(latest.updated_at as string),
    createdAt: new Date(Math.min(...list.map((r) => Date.parse(r.created_at as string)))),
    visits: list.length,
    alertedAt: alerted.length ? new Date(alerted.sort()[0]) : null,
    account,
  };
}

/**
 * These numbers as leads (all their visits), leaving out numbers that now have an account (but a new-wizard step-1
 * sign-up): guests the team is following up who have dropped out of the newest visits.
 */
export async function wizardLeadsByMobile(mobiles: string[]): Promise<WizardLead[]> {
  if (!isSupabaseConfigured() || !mobiles.length) return [];
  const db = createAdminClient();
  const out: WizardLead[] = [];
  for (let i = 0; i < mobiles.length; i += 100) {
    const part = mobiles.slice(i, i + 100);
    const read = (cols: string) => db.from("wizard_leads").select(cols).in("mobile", part).order("updated_at", { ascending: false }).limit(1000);
    let { data, error } = await read(DETAILS);
    const detailsSaved = !error;
    if (error) ({ data, error } = await read(BASE));
    if (error) continue;
    const rows = (data ?? []) as unknown as Row[];
    const { signedUp, stepOne } = await accounts(db, rows);
    const byMobile = new Map<string, Row[]>();
    for (const r of rows) if (!signedUp.has(r.mobile as string) || stepOne.has(r.mobile as string)) byMobile.set(r.mobile as string, [...(byMobile.get(r.mobile as string) ?? []), r]);
    for (const [mobile, list] of byMobile) out.push(toLead(mobile, ownRows(list, stepOne.get(mobile)), detailsSaved, stepOne.get(mobile)?.id ?? null));
  }
  return out;
}

/**
 * The list on Unpaid contests. `include` is the visit an alert links to: it is added first when it fell outside the
 * newest 200 visits or the first 40 people, so the link always finds its person (unless they signed up or 90 days
 * passed).
 */
export async function wizardLeads(limit = 40, include?: string): Promise<WizardLead[]> {
  if (!isSupabaseConfigured()) return [];
  const db = createAdminClient();
  const read = await readRows(db);
  if (!read?.rows.length) return [];
  const { rows, detailsSaved } = read;
  const { signedUp, stepOne } = await accounts(db, rows);
  const byMobile = new Map<string, Row[]>();
  for (const r of rows) {
    const m = r.mobile as string;
    if (signedUp.has(m) && !stepOne.has(m)) continue;
    byMobile.set(m, [...(byMobile.get(m) ?? []), r]);
  }
  const out: WizardLead[] = [];
  // Rows are newest first, so the first of each number is its latest visit.
  for (const [mobile, list] of byMobile) {
    out.push(toLead(mobile, ownRows(list, stepOne.get(mobile)), detailsSaved, stepOne.get(mobile)?.id ?? null));
    if (out.length >= limit) break;
  }
  if (include && UUID.test(include) && !out.some((l) => l.visitIds.includes(include))) {
    const { data: visit } = await db.from("wizard_leads").select("mobile").eq("visit_id", include).maybeSingle();
    const mobile = visit?.mobile as string | undefined;
    if (mobile && (!signedUp.has(mobile) || stepOne.has(mobile))) {
      const all = await readRows(db, mobile);
      const own = all?.rows.length ? await accounts(db, all.rows) : null;
      if (all && own && (!own.signedUp.has(mobile) || own.stepOne.has(mobile))) {
        // Already listed from newer visits only: the full entry takes its place, so nobody shows twice.
        const at = out.findIndex((l) => l.mobile === mobile);
        if (at >= 0) out.splice(at, 1);
        out.unshift(toLead(mobile, ownRows(all.rows, own.stepOne.get(mobile)), all.detailsSaved, own.stepOne.get(mobile)?.id ?? null));
      }
    }
  }
  return out;
}
