import "server-only";
import { isRealEmail } from "@/lib/admin/reminder-rules";
import { createAdminClient } from "@/lib/supabase/admin";
import { LEAD_KEY } from "./unpaid-rules";

/**
 * Admin › Unpaid contests (owner, 2026-10-25): who a lead key points at, and the lead's row. Shared by the follow-up
 * actions and the client's resume link (owner, 2026-10-26), which notes in the lead's History that it was opened.
 */

type Row = Record<string, unknown>;

/** Who a key points at: an unpaid draft (c:<contest id>) or a guest (g:<visit id> or g:<lead id>). */
export async function resolve(key: string): Promise<{ kind: "contest" | "guest"; contestId: string | null; mobile: string | null; email: string | null; brand: string; amount: number | null; clientId: string | null; leadId?: string } | null> {
  if (!LEAD_KEY.test(key)) return null;
  const db = createAdminClient();
  const id = key.slice(2);
  if (key.startsWith("c:")) {
    const { data: c } = await db.from("contests").select("id, brand_name, total_amount, client_id, status").eq("id", id).maybeSingle();
    if (!c) return null;
    // Only an unpaid draft, or a contest this page already follows (won back, closed): never any other client's details.
    if (c.status !== "draft" && c.status !== "pending_payment") {
      const { data: followed } = await db.from("unpaid_leads").select("id").eq("contest_id", id).maybeSingle();
      if (!followed) return null;
    }
    const { data: p } = c.client_id ? await db.from("profiles").select("mobile, email").eq("id", c.client_id).maybeSingle() : { data: null };
    return { kind: "contest", contestId: c.id as string, mobile: (p?.mobile as string | null) ?? null, email: isRealEmail(p?.email as string | null) ? (p!.email as string) : null, brand: (c.brand_name as string) ?? "", amount: (c.total_amount as number | null) ?? null, clientId: (c.client_id as string | null) ?? null };
  }
  if (key.startsWith("l:")) {
    // A lead whose draft or visits are gone: from its own copy.
    const { data: l } = await db.from("unpaid_leads").select("kind, contest_id, guest_mobile, client_id, brand_snapshot, amount_snapshot").eq("id", id).maybeSingle();
    if (!l) return null;
    const { data: p } = l.client_id ? await db.from("profiles").select("mobile, email").eq("id", l.client_id).maybeSingle() : { data: null };
    return { kind: l.kind as "contest" | "guest", contestId: (l.contest_id as string | null) ?? null, mobile: (l.guest_mobile as string | null) ?? (p?.mobile as string | null) ?? null, email: l.kind === "contest" && isRealEmail(p?.email as string | null) ? (p!.email as string) : null, brand: (l.brand_snapshot as string) ?? "", amount: (l.amount_snapshot as number | null) ?? null, clientId: (l.client_id as string | null) ?? null, leadId: id };
  }
  const { data: g } = await db.from("wizard_leads").select("mobile, brand_name").eq("visit_id", id).maybeSingle();
  if (g) {
    // The email typed on the first step (migration 0075); before it, none.
    const { data: withEmail } = await db.from("wizard_leads").select("email").eq("mobile", g.mobile).not("email", "is", null).order("updated_at", { ascending: false }).limit(1);
    return { kind: "guest", contestId: null, mobile: g.mobile as string, email: (withEmail?.[0]?.email as string | undefined) ?? null, brand: (g.brand_name as string) ?? "", amount: null, clientId: null };
  }
  const { data: l } = await db.from("unpaid_leads").select("guest_mobile, brand_snapshot").eq("id", id).eq("kind", "guest").maybeSingle();
  return l ? { kind: "guest", contestId: null, mobile: l.guest_mobile as string, email: null, brand: (l.brand_snapshot as string) ?? "", amount: null, clientId: null } : null;
}

/** The lead's row, made on its first action. Null before migration 0076. */
export async function leadRow(key: string): Promise<{ row: Row; who: NonNullable<Awaited<ReturnType<typeof resolve>>> } | "missing" | null> {
  const who = await resolve(key);
  if (!who) return null;
  const db = createAdminClient();
  const match = who.leadId ? { col: "id", val: who.leadId } : who.kind === "contest" ? { col: "contest_id", val: who.contestId! } : { col: "guest_mobile", val: who.mobile! };
  const { data: found, error } = await db.from("unpaid_leads").select("*").eq(match.col, match.val).maybeSingle();
  if (error) return /PGRST205|42P01|schema cache|does not exist/.test(`${error.code} ${error.message}`) ? "missing" : null;
  if (found) return { row: found as Row, who };
  if (who.leadId) return null;
  // A guest who signed up: their draft takes over the guest's follow-up (history, owner, plan) rather than starting over.
  if (who.kind === "contest" && who.mobile) {
    const { data: adopted } = await db.from("unpaid_leads").update({ kind: "contest", contest_id: who.contestId, client_id: who.clientId, guest_mobile: null, brand_snapshot: who.brand.slice(0, 200) || null, amount_snapshot: who.amount }).eq("guest_mobile", who.mobile).is("contest_id", null).select("*").maybeSingle();
    if (adopted) return { row: adopted as Row, who };
  }
  const { data: made, error: insertError } = await db
    .from("unpaid_leads")
    .insert({ kind: who.kind, contest_id: who.contestId, guest_mobile: who.kind === "guest" ? who.mobile : null, client_id: who.clientId, brand_snapshot: who.brand.slice(0, 200) || null, amount_snapshot: who.amount })
    .select("*")
    .maybeSingle();
  if (made) return { row: made as Row, who };
  // Made by another admin at the same moment.
  const { data: again } = insertError ? await db.from("unpaid_leads").select("*").eq(match.col, match.val).maybeSingle() : { data: null };
  return again ? { row: again as Row, who } : null;
}
