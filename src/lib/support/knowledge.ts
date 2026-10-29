import "server-only";
import { getContact } from "@/lib/content/contact";
import { visibleList } from "@/lib/content/lists";
import { translatorFor } from "@/lib/content/texts";
import { formatDate } from "@/lib/dates";
import { faqParams } from "@/lib/home/faq-params";
import { legalDoc, legalParams } from "@/lib/legal";
import { fillLegal, LEGAL_SLUGS } from "@/lib/legal/types";
import { getProSettings } from "@/lib/pro/settings";
import { isPro } from "@/lib/pro/status";
import { getSettings } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * What the AI support assistant knows (owner, 2026-10-15): what the site itself tells visitors (the Q&A from
 * Admin › Lists, How it works, the logo checker, the Pro plan, the policies' summaries, the contact details) with the
 * numbers from Settings, and the person's own basics (role, Pro, their contests). Nothing about money they paid or are
 * owed: those questions go to the team.
 */

const STATUS: Record<string, string> = {
  draft: "draft (not paid yet)",
  pending_payment: "waiting for payment",
  open: "open, taking designs",
  judging: "ended, the client is picking a winner",
  winner_selected: "winner picked",
  handover: "winner picked, final files being delivered",
  completed: "completed",
  no_result: "ended with no result",
  cancelled: "cancelled",
  deleted: "deleted",
};

const flat = (o: unknown, prefix = ""): [string, string][] =>
  o && typeof o === "object" ? Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => (typeof v === "string" ? [[`${prefix}${k}`, v] as [string, string]] : flat(v, `${prefix}${k}.`))) : [];

/** The Q&A of the How it works page (client and designer steps), numbers filled in. */
function howQa(messages: Record<string, unknown>, params: Record<string, string | number>): string[] {
  const how = (messages.howPage ?? {}) as Record<string, unknown>;
  const out: string[] = [];
  for (const step of ["c1", "c2", "c3", "d1", "d2", "d3"]) {
    const s = (how[step] ?? {}) as Record<string, unknown>;
    for (const q of ["q1", "q2", "q3"]) {
      const item = s[q] as { q?: string; a?: string } | undefined;
      if (item?.q && item.a) out.push(`Q: ${fillLegal(item.q, params)}\nA: ${fillLegal(item.a, params)}`);
    }
  }
  return out;
}

/** Everything about the site, in English (the assistant answers in the person's language). */
export async function siteInfo(): Promise<string> {
  const t = await translatorFor("en");
  const { MESSAGES } = await import("@/lib/i18n/messages");
  const messages = MESSAGES.en as unknown as Record<string, unknown>;
  const [{ params }, faq, contact, pro, s, lp] = await Promise.all([
    faqParams(t, "en"),
    visibleList("home_faq", "en"),
    getContact("en"),
    getProSettings(),
    getSettings(["contact.whatsapp", "limits.withdrawal_min", "timers.copy_claim_days", "limits.entry_max_images", "limits.entry_max_images_pro", "limits.logo_checks_per_contest", "limits.logo_check_close_from"]),
    legalParams(t, "en"),
  ]);
  const parts: string[] = [];
  parts.push("Common questions:\n" + faq.map((f) => `Q: ${f.text.q}\nA: ${fillLegal(f.text.a, params)}`).join("\n\n"));
  parts.push("How it works:\n" + howQa(messages, params).join("\n\n"));

  // The logo checker page's own Q&A, with its numbers filled in, and how many checks each person gets (owner,
  // 2026-10-29: 10 per contest whatever the prize; Basic 2 and Pro 20 a month; the 3-day trial 5).
  const nums = { basic: String(pro.settings.basicLogoChecks), pro: String(pro.settings.proLogoChecks), n: String(s["limits.logo_check_close_from"]) };
  const fill = (v: string) => v.replace(/\{(basic|pro|n)\}/g, (_, k: keyof typeof nums) => nums[k]);
  const checker = flat((messages.checkerPage as Record<string, unknown> | undefined)?.faq).filter(([k]) => /\.(q|a)$/.test(k));
  const allowance = [
    `Clients: up to ${s["limits.logo_checks_per_contest"]} AI logo checks on each logo contest, whatever the prize (failed checks don't count).`,
    pro.ready ? `Designers: Basic ${pro.settings.basicLogoChecks} a month, Pro ${pro.settings.proLogoChecks} a month (they start again on the 1st).` : "",
    pro.ready && pro.settings.freeTrialEnabled ? `Free Pro Trial: ${pro.settings.freeTrialDays} days with ${pro.settings.trialLogoChecks} logo checks for the whole trial.` : "",
  ].filter(Boolean);
  parts.push("Logo checker:\n" + [...allowance, ...checker.map(([k, v]) => (k.endsWith(".q") ? `Q: ${fill(String(v))}` : `A: ${fill(String(v))}`))].join("\n"));

  // The Pro plan for designers.
  if (pro.ready) {
    const p = pro.settings;
    const on = Object.entries(p.features)
      .filter(([, v]) => v)
      .map(([k]) => k.replace(/_/g, " "))
      .join(", ");
    parts.push(
      [
        "Designer Pro plan:",
        p.isForSale ? `Price: ৳${p.priceBdt} a month, renews monthly, cancel any time.` : "The Pro plan is not on sale right now.",
        `Pro features turned on: ${on || "none"}.`,
        p.features.early_access && p.earlyAccessMinutes > 0 ? `Pro designers hear about new contests ${p.earlyAccessMinutes} minutes before other designers.` : "",
        `Designs per contest: Basic up to ${s["limits.entry_max_images"]} mockup images per design, Pro up to ${s["limits.entry_max_images_pro"]}.`,
        `Logo checks of their own logos: Pro ${p.proLogoChecks} a month, Basic ${p.basicLogoChecks} a month (they start again on the 1st).`,
        `Portfolio pictures: Pro up to ${p.proPortfolioLimit}.`,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  // The policies' summaries (the full text is on each page).
  for (const slug of LEGAL_SLUGS) {
    const doc = await legalDoc(slug, "en", lp).catch(() => null);
    if (doc?.summary.length) parts.push(`${doc.title} (/legal/${slug}):\n` + doc.summary.map((x) => `• ${x}`).join("\n"));
  }

  parts.push(
    [
      "Contact the team:",
      `Phone: ${contact.phone}`,
      s["contact.whatsapp"] ? `WhatsApp: ${s["contact.whatsapp"]}` : "",
      contact.email ? `Email: ${contact.email}` : "",
      `Designers can withdraw from ${params.withdrawMin} to bKash or a bank account. Copy claims can be opened within ${s["timers.copy_claim_days"]} days.`,
    ]
      .filter(Boolean)
      .join("\n"),
  );
  return parts.join("\n\n");
}

/** The site's main pages, as full links. */
export function pageList(origin: string): string {
  const pages: [string, string][] = [
    ["Start a logo contest", "/start"],
    ["Browse open contests", "/contests"],
    ["How it works", "/how-it-works"],
    ["Help and contact", "/help"],
    ["Designer Pro plan", "/pro"],
    ["Logo checker", "/logo-checker"],
    ["Join as a designer", "/designers/signup"],
    ["Dashboard", "/dashboard"],
    ["Profile, payout method, mobile, email and password", "/dashboard/profile"],
    ["Wallet and withdrawals (designers)", "/dashboard/wallet"],
    ["My logo checks", "/dashboard/logo-checks"],
    ["Notifications", "/notifications"],
    ["Winners", "/winners"],
    ["Leaderboard", "/leaderboard"],
    ...LEGAL_SLUGS.map((slug) => [slug.replace(/-/g, " "), `/legal/${slug}`] as [string, string]),
  ];
  return pages.map(([label, path]) => `${label}: ${origin}${path}`).join("\n");
}

/** The person's own basics: name, role, Pro, confirmed email, and their latest contests. */
export async function personInfo(user: { id: string; name: string; role: "client" | "designer"; emailVerifiedAt?: string | Date | null }): Promise<string> {
  const db = createAdminClient();
  const lines = [`Name: ${user.name}`, `Role: ${user.role}`, `Email confirmed: ${user.emailVerifiedAt ? "yes" : "no"}`];
  if (user.role === "designer") {
    const [pro, { data: p }, { data: entries }] = await Promise.all([
      isPro(user.id).catch(() => false),
      db.from("profiles").select("wins_count, username").eq("id", user.id).maybeSingle(),
      db.from("entries").select("contest_id, status, contest:contests!contest_id(brand_name, status, ends_at, is_private, is_nda)").eq("designer_id", user.id).order("created_at", { ascending: false }).limit(20),
    ]);
    lines.push(`Plan: ${pro ? "Pro" : "Basic"}`, `Wins: ${(p?.wins_count as number | null) ?? 0}`);
    const seen = new Set<string>();
    const contests: string[] = [];
    for (const e of entries ?? []) {
      if (seen.has(e.contest_id as string) || contests.length >= 5) continue;
      seen.add(e.contest_id as string);
      const c = (Array.isArray(e.contest) ? e.contest[0] : e.contest) as { brand_name: string; status: string; ends_at: string | null; is_private: boolean; is_nda: boolean } | null;
      if (!c) continue;
      const name = c.is_private || c.is_nda ? "a private contest" : c.brand_name;
      contests.push(`• ${name}: ${STATUS[c.status] ?? c.status}${c.ends_at && c.status === "open" ? `, ends ${formatDate(new Date(c.ends_at), "en", "long")}` : ""}; their design is ${e.status}`);
    }
    lines.push(contests.length ? `Contests they sent designs to (latest):\n${contests.join("\n")}` : "They have not sent designs yet.");
  } else {
    const { data: contests } = await db
      .from("contests")
      .select("id, brand_name, status, ends_at, prize_amount, contest_number")
      .eq("client_id", user.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(5);
    const ids = (contests ?? []).map((c) => c.id as string);
    const { data: entries } = ids.length ? await db.from("entries").select("contest_id").in("contest_id", ids).in("status", ["active", "winner", "forfeited"]) : { data: [] };
    const count = new Map<string, number>();
    for (const e of entries ?? []) count.set(e.contest_id as string, (count.get(e.contest_id as string) ?? 0) + 1);
    const list = (contests ?? []).map(
      (c) =>
        `• ${c.brand_name}${c.contest_number ? ` (LC-${String(c.contest_number).padStart(4, "0")})` : ""}: ${STATUS[c.status as string] ?? c.status}, prize ৳${c.prize_amount}, ${count.get(c.id as string) ?? 0} designs${c.ends_at && c.status === "open" ? `, ends ${formatDate(new Date(c.ends_at as string), "en", "long")}` : ""}`,
    );
    lines.push(list.length ? `Their contests (latest):\n${list.join("\n")}` : "They have not started a contest yet.");
  }
  return lines.join("\n");
}
