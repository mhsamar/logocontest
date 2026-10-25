import { cookies } from "next/headers";
import { after, NextResponse, type NextRequest } from "next/server";
import { AT_PAYMENT } from "@/lib/admin/unpaid-rules";
import { countryOf, deviceOf, isBot } from "@/lib/analytics/rules";
import { cityFrom, ipFrom } from "@/lib/auth/device";
import { getCurrentUser } from "@/lib/auth/session";
import { calculatePrice } from "@/lib/contests/pricing";
import { getPricingConfig } from "@/lib/contests/pricing-config";
import { isSupabaseConfigured } from "@/lib/env";
import { notifyWithPush } from "@/lib/notifications/broadcast";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ADMIN_ONLINE_MS,
  cleanHelpText,
  cleanLiveAnswers,
  firstName,
  HELP_BODY_MAX,
  HELP_MAX_MESSAGES,
  isAnswerKey,
  orderFrom,
} from "@/lib/wizard-live-rules";

/**
 * "Creating a contest right now" (owner, 2026-10-25; Design/unpaid-contests, phase 2): Start a contest pings here
 * while it is open, with the step and a fixed list of form answers (checked again here), and gets back the one help
 * message the team may have sent, with its chat. A route, not a server action, so a ping never waits in line with
 * the wizard's own saving and paying. Never fails loudly; before migration 0077 it does nothing.
 */

const UUID = /^[0-9a-f-]{36}$/i;
const SERVICE = /^[a-z0-9-]{1,60}$/;
const NO_STORE = { "Cache-Control": "no-store" };
const MISSING = /PGRST205|PGRST204|42P01|42703/;
const none = () => NextResponse.json({ offer: null }, { headers: NO_STORE });
const slowDown = () => NextResponse.json(null, { status: 429, headers: NO_STORE });

// Per-server guards so a script can't flood the tables or the team's live list (the internet address is only counted
// here, never stored): one visit at most 60 requests a minute (pings, chat polls, replies), one address 240 a minute
// and 20 new visits in 10 minutes.
const hits = new Map<string, number[]>();
function over(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  const full = list.length >= max;
  if (!full) list.push(now);
  hits.delete(key);
  hits.set(key, list);
  // Oldest first (the map keeps the order keys were last used): forget the quiet ones.
  if (hits.size > 20_000) for (const k of [...hits.keys()].slice(0, 5_000)) hits.delete(k);
  return full;
}

/** The same answers, whatever order the database gave the keys back in. */
const sameAnswers = (a: unknown, b: unknown) => {
  const flat = (v: unknown) => JSON.stringify(Object.entries((v ?? {}) as Record<string, unknown>).sort(([x], [y]) => x.localeCompare(y)));
  return flat(a) === flat(b);
};

const int = (v: unknown, min: number, max: number) => (typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : null);
type Body = { v?: unknown; s?: unknown; st?: unknown; p?: unknown; n?: unknown; c?: unknown; a?: unknown; d?: unknown; away?: unknown; bye?: unknown; loc?: unknown; h?: { act?: unknown; text?: unknown } };

export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) return none();
  const ua = req.headers.get("user-agent") ?? "";
  if (!ua || isBot(ua)) return none();
  let body: Body;
  try {
    const raw = await req.text();
    if (raw.length > 8000) return none();
    body = JSON.parse(raw) as Body;
  } catch {
    return none();
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return none();
  const visitId = typeof body.v === "string" && UUID.test(body.v) ? body.v.toLowerCase() : null;
  if (!visitId) return none();
  const ip = ipFrom(req.headers.get("x-forwarded-for"), req.headers.get("x-real-ip")) ?? "-";
  if (over(`v:${visitId}`, 60, 60_000) || over(`ip:${ip}`, 240, 60_000)) return slowDown();

  // Only visitors and clients: never the team or designers, nor the Super admin looking through someone's account.
  const user = await getCurrentUser();
  if (user && (user.role !== "client" || (await cookies()).get("lc_as")?.value?.split("|")[0] === user.id)) return none();

  const db = createAdminClient();
  const now = new Date();
  const iso = now.toISOString();
  const [{ data: row, error }, { data: offer }] = await Promise.all([
    db.from("wizard_live").select("stage, contest_id, user_id, service, answers, total").eq("visit_id", visitId).maybeSingle(),
    db.from("help_offers").select("id, status, admin_id, admin_seen_at, contest_id, user_id, answered_at, unread_by_admin").eq("visit_id", visitId).maybeSingle(),
  ]);
  // Before migration 0077: nothing to do. Any other database trouble: try again later, keeping what the page shows.
  if (error) return MISSING.test(`${error.code}`) ? none() : NextResponse.json(null, { status: 503, headers: NO_STORE });

  // Leaving (closing the tab, going to payment): off the live list at once. A reload pings again and comes back.
  const stage = int(body.st, 1, 10);
  if (body.bye === true || (stage && stage >= AT_PAYMENT)) {
    if (row) await db.from("wizard_live").update({ ended_at: iso, updated_at: iso, ...(stage ? { stage } : {}) }).eq("visit_id", visitId);
    return none();
  }
  if (!stage) return none();
  if (!row && over(`new:${ip}`, 20, 600_000)) return slowDown();

  const service = typeof body.s === "string" && SERVICE.test(body.s) ? body.s : "logo";
  const answers = cleanLiveAnswers(body.a);
  // A draft only counts when it is this client's own (someone else signing in on the same tab starts without it).
  let contestId: string | null = row && (row.user_id ?? null) === (user?.id ?? null) ? ((row.contest_id as string | null) ?? null) : null;
  const asked = typeof body.c === "string" && UUID.test(body.c) ? body.c : null;
  if (user && asked && asked !== contestId) {
    const { data: mine } = await db.from("contests").select("id").eq("id", asked).eq("client_id", user.id).maybeSingle();
    if (mine) contestId = asked;
  }
  if (!user) contestId = null;
  // Total: worked out here from Prize on, never taken from the browser; again only when the step or answers changed.
  let total: number | null = null;
  const order = stage >= 7 ? orderFrom(answers) : null;
  if (order && row && row.stage === stage && row.service === service && sameAnswers(row.answers, answers)) total = (row.total as number | null) ?? null;
  else if (order) {
    try {
      const cfg = await getPricingConfig();
      total = calculatePrice(order, service === "logo" ? cfg : { ...cfg, customMin: 1 }).total;
    } catch {
      total = null;
    }
  }
  const live = {
    user_id: user?.id ?? null,
    contest_id: contestId,
    service,
    stage,
    pos: int(body.p, 1, 20),
    steps_total: int(body.n, 1, 20),
    doing: isAnswerKey(body.d) ? body.d : null,
    answers,
    total,
    device: deviceOf(ua),
    country: countryOf(req.headers.get("x-vercel-ip-country")),
    // A rough city from the host's header; the internet address itself is never stored.
    city: cityFrom(req.headers.get("x-vercel-ip-city")),
    locale: body.loc === "bn" ? "bn" : "en",
    away: body.away === true,
    updated_at: iso,
    ended_at: null,
  };
  if (row) await db.from("wizard_live").update({ ...live, ...(row.stage !== stage ? { step_since: iso } : {}) }).eq("visit_id", visitId);
  else await db.from("wizard_live").insert({ visit_id: visitId, ...live, started_at: iso, step_since: iso });

  // The one help message, only to the person it was sent to.
  const act = body.h?.act;
  if (!offer || (offer.user_id && offer.user_id !== user?.id)) return typeof act === "string" ? NextResponse.json({ offer: null, took: false }, { headers: NO_STORE }) : none();
  const offerId = offer.id as string;
  // A guest who signs up and saves a draft: the chat follows them to their contest's history.
  if ((contestId && offer.contest_id !== contestId) || (user && !offer.user_id)) await db.from("help_offers").update({ contest_id: contestId ?? offer.contest_id, user_id: user?.id ?? offer.user_id }).eq("id", offerId);

  let status = offer.status as string;
  // Whether a help action was taken (Reply, Call me and No thanks stored), so the card can keep an unsent reply.
  let took = status !== "declined";
  if (status !== "declined" && typeof act === "string") {
    if (act === "seen" && status === "sent") {
      await db.from("help_offers").update({ status: "seen", seen_at: iso }).eq("id", offerId).eq("status", "sent");
      status = "seen";
    } else if (act === "typing") {
      await db.from("help_offers").update({ visitor_typing_at: iso }).eq("id", offerId);
    } else if (act === "reply" || act === "call_me" || act === "no_thanks") {
      const text = act === "reply" ? cleanHelpText(body.h?.text, HELP_BODY_MAX) : null;
      const { count } = await db.from("help_messages").select("id", { count: "exact", head: true }).eq("offer_id", offerId).eq("from_admin", false);
      const canCall = act !== "call_me" || (await contactKnown(visitId, user?.mobile ?? null));
      took = Boolean((act !== "reply" || text) && (count ?? 0) < HELP_MAX_MESSAGES && canCall && !(act === "call_me" && status === "call_me"));
      if (took) {
        const { error: insertError } = await db.from("help_messages").insert({ offer_id: offerId, from_admin: false, kind: act === "reply" ? "text" : act, body: text });
        took = !insertError;
      }
      if (took) {
        const next = act === "no_thanks" ? "declined" : act === "call_me" ? "call_me" : status === "call_me" ? "call_me" : "replied";
        await db.from("help_offers").update({ status: next, answered_at: offer.answered_at ?? iso, last_message_at: iso, visitor_typing_at: null, unread_by_admin: Math.min(Number(offer.unread_by_admin ?? 0) + 1, 99) }).eq("id", offerId);
        // The admin who wrote is told once, when the person first answers (no text or number in the bell or push), after
        // this answer is sent back so the visitor doesn't wait for it.
        if (!offer.answered_at && offer.admin_id && act !== "no_thanks") after(() => notifyWithPush([offer.admin_id as string], "help_reply_admin", {}, "/admin/unpaid#live"));
        status = next;
      }
    }
  }
  const tookIt = typeof act === "string" ? { took } : {};
  if (status === "declined") return NextResponse.json({ offer: { status }, ...tookIt }, { headers: NO_STORE });

  const [{ data: messages }, { data: admin }, canCall] = await Promise.all([
    db.from("help_messages").select("id, from_admin, kind, body, created_at").eq("offer_id", offerId).order("id", { ascending: true }).limit(60),
    offer.admin_id ? db.from("profiles").select("name").eq("id", offer.admin_id).maybeSingle() : Promise.resolve({ data: null }),
    contactKnown(visitId, user?.mobile ?? null),
  ]);
  const seenAt = offer.admin_seen_at ? Date.parse(offer.admin_seen_at as string) : 0;
  return NextResponse.json(
    {
      offer: {
        status,
        from: firstName(admin?.name as string | null),
        online: now.getTime() - seenAt < ADMIN_ONLINE_MS,
        canCall,
        messages: (messages ?? []).map((m) => ({ id: m.id as number, mine: !m.from_admin, kind: m.kind as string, body: (m.body as string | null) ?? "", at: m.created_at as string })),
      },
      ...tookIt,
    },
    { headers: NO_STORE },
  );
}

/** "Call me" needs a number: a signed-in client's, or the one this visit gave on the first step. */
async function contactKnown(visitId: string, mobile: string | null): Promise<boolean> {
  if (mobile) return true;
  const { data } = await createAdminClient().from("wizard_leads").select("visit_id").eq("visit_id", visitId).maybeSingle();
  return Boolean(data);
}
