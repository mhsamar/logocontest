import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { stageOf } from "./unpaid-rules";

/**
 * New clients who gave their mobile number on the wizard's first step but haven't signed up (owner, 2026-10-14),
 * newest first. A number that now belongs to an account is left out. Before migration 0052: none.
 * One entry per number (owner, 2026-10-25): its latest visit, with what they typed on the first step (migration 0075),
 * when they first came, how far they ever got and how many times they tried.
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

/** One person from all their visits (newest first). */
function toLead(mobile: string, list: Row[], detailsSaved: boolean): WizardLead {
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
  };
}

/**
 * These numbers as leads (all their visits), leaving out numbers that now have an account: guests the team is
 * following up who have dropped out of the newest visits.
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
    const { data: accounts } = await db.from("profiles").select("mobile").in("mobile", part);
    const signedUp = new Set((accounts ?? []).map((a) => a.mobile as string));
    const byMobile = new Map<string, Row[]>();
    for (const r of (data ?? []) as unknown as Row[]) if (!signedUp.has(r.mobile as string)) byMobile.set(r.mobile as string, [...(byMobile.get(r.mobile as string) ?? []), r]);
    for (const [mobile, list] of byMobile) out.push(toLead(mobile, list, detailsSaved));
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
  const mobiles = [...new Set(rows.map((r) => r.mobile as string))];
  const { data: accounts } = await db.from("profiles").select("mobile").in("mobile", mobiles);
  const signedUp = new Set((accounts ?? []).map((a) => a.mobile as string));
  const byMobile = new Map<string, Row[]>();
  for (const r of rows) {
    const m = r.mobile as string;
    if (signedUp.has(m)) continue;
    byMobile.set(m, [...(byMobile.get(m) ?? []), r]);
  }
  const out: WizardLead[] = [];
  // Rows are newest first, so the first of each number is its latest visit.
  for (const [mobile, list] of byMobile) {
    out.push(toLead(mobile, list, detailsSaved));
    if (out.length >= limit) break;
  }
  if (include && UUID.test(include) && !out.some((l) => l.visitIds.includes(include))) {
    const { data: visit } = await db.from("wizard_leads").select("mobile").eq("visit_id", include).maybeSingle();
    const mobile = visit?.mobile as string | undefined;
    if (mobile && !signedUp.has(mobile)) {
      const [{ data: account }, all] = await Promise.all([db.from("profiles").select("id").eq("mobile", mobile).limit(1), readRows(db, mobile)]);
      if (!account?.length && all?.rows.length) {
        // Already listed from newer visits only: the full entry takes its place, so nobody shows twice.
        const at = out.findIndex((l) => l.mobile === mobile);
        if (at >= 0) out.splice(at, 1);
        out.unshift(toLead(mobile, all.rows, all.detailsSaved));
      }
    }
  }
  return out;
}
