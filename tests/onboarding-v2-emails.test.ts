import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { V2_NOTICE, briefUntouched, v2Mail, type V2MailContest } from "@/lib/email/onboarding-v2";
import { render } from "@/lib/email/render";
import { MESSAGES } from "@/lib/i18n/messages";
import { createTranslator } from "@/lib/i18n/translate";
import { channelOn, NOTICE_ROWS, parseChannelsOff } from "@/lib/notifications/admin-catalog";
import { newCompletion } from "@/lib/onboarding/brief-defaults";

// Owner, 2026-10-29 (client-onboarding-v2-spec.md §2 step 4 and §3 item 3): a /start-v2 contest's client gets "we got
// your payment" when the bKash payment is sent and ONE "your contest is live" when it is approved, with the brief's
// link only if they never touched it. Each has its own switch in Admin › Notifications. Old contests: nothing new.
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const SITE = "https://logocontest.bd";
const C = "0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0";
const en = createTranslator("en", MESSAGES.en);
const bn = createTranslator("bn", MESSAGES.bn);
const contest = (more: Partial<V2MailContest> = {}): V2MailContest => ({ id: C, slug: "rahim-tea", brand: "  Rahim   Tea ", completion: newCompletion(), ...more });

describe("the two emails' words and links", () => {
  it("payment received: the brand, the minutes from the setting, and the contest's page as the button", () => {
    const m = v2Mail("received", { t: en, locale: "en", origin: SITE, contest: contest(), minutes: 45 });
    expect(m.subject).toBe("We got your payment for “Rahim Tea”");
    expect(m.body).toBe(en("wizardV2.email.receivedBody", { minutes: 45 }));
    expect(m.body).toContain("45 minutes");
    expect(m.buttonUrl).toBe(`${SITE}/client/contests/rahim-tea`);
    // A Bangla client: Bangla words and digits, and the page opens in Bangla.
    const b = v2Mail("received", { t: bn, locale: "bn", origin: SITE, contest: contest(), minutes: 30 });
    expect(b.subject).toBe(bn("wizardV2.email.receivedSubject", { brand: "Rahim Tea" }));
    expect(b.body).toContain("৩০ মিনিটের");
    expect(b.buttonUrl).toBe(`${SITE}/client/contests/rahim-tea?lang=bn`);
  });

  it("contest live: the brief line and its link only while the brief is untouched and the brief page is on", () => {
    const m = v2Mail("live", { t: en, locale: "en", origin: SITE, contest: contest(), briefLink: true });
    expect(m.subject).toBe("Your “Rahim Tea” contest is live!");
    expect(m.body.split("\n")).toEqual([en("wizardV2.email.liveBody"), "", en("wizardV2.email.briefNote"), `Change the brief: ${SITE}/start-v2/brief?c=${C}`]);
    expect(m.buttonUrl).toBe(`${SITE}/client/contests/rahim-tea`);
    expect(v2Mail("live", { t: bn, locale: "bn", origin: SITE, contest: contest(), briefLink: true }).body).toContain(`${SITE}/start-v2/brief?c=${C}&lang=bn`);
    // Changed a part, said "keep it like this", or /start-v2 is off: no brief line.
    for (const completion of [{ ...newCompletion(), edited: ["look" as const] }, { ...newCompletion(), acceptedAt: "2026-10-29T08:00:00Z" }]) {
      expect(v2Mail("live", { t: en, locale: "en", origin: SITE, contest: contest({ completion }), briefLink: true }).body).toBe(en("wizardV2.email.liveBody"));
    }
    expect(v2Mail("live", { t: en, locale: "en", origin: SITE, contest: contest(), briefLink: false }).body).toBe(en("wizardV2.email.liveBody"));
    expect(briefUntouched(newCompletion())).toBe(true);
    expect(briefUntouched({ ...newCompletion(), edited: ["business"] })).toBe(false);
    // Never the /r resume link: it stops working once the contest is paid.
    expect(JSON.stringify([m, v2Mail("received", { t: en, locale: "en", origin: SITE, contest: contest() })])).not.toContain("/r/");
  });

  it("every word used exists in both languages", () => {
    for (const k of ["receivedSubject", "receivedBody", "liveSubject", "liveBody", "briefNote", "open", "brief"] as const) {
      expect(en(`wizardV2.email.${k}`), k).not.toBe(`wizardV2.email.${k}`);
      expect(bn(`wizardV2.email.${k}`), k).not.toBe(`wizardV2.email.${k}`);
      expect(bn(`wizardV2.email.${k}`), k).not.toBe(en(`wizardV2.email.${k}`));
    }
  });
});

describe("Admin › Notifications switches", () => {
  it("one email-only client row each, on at first; switched off on its own", () => {
    for (const id of Object.values(V2_NOTICE)) {
      expect(NOTICE_ROWS.find((r) => r.id === id), id).toMatchObject({ audience: "client", types: [], channels: ["email"], email: "notification", alsoIn: "user" });
      expect(NOTICE_ROWS.find((r) => r.id === id)?.locked).toBeUndefined();
      expect(channelOn({}, id, "email")).toBe(true);
      for (const locale of ["en", "bn"] as const) {
        const t = createTranslator(locale, MESSAGES[locale]);
        expect(t(`admin.notices.rows.${id}.label` as never), `${locale} ${id}`).not.toContain("admin.notices");
        expect(t(`admin.notices.rows.${id}.when` as never), `${locale} ${id}`).not.toContain("admin.notices");
      }
    }
    const off = parseChannelsOff({ onboarding_live: ["email"] });
    expect(channelOn(off, "onboarding_live", "email")).toBe(false);
    expect(channelOn(off, "onboarding_received", "email")).toBe(true);
  });
});

// ---- Sending: what events.ts loads and hands to sendEmail (which applies the switch, Email settings and EMAIL_DRIVER) --

type Row = Record<string, unknown>;
const db: { contests: Row[]; profiles: Row[]; settings: Row } = { contests: [], profiles: [], settings: {} };
const sent: { mails: Row[]; last: Set<string> } = { mails: [], last: new Set() };

function table(name: "contests" | "profiles") {
  const filters: [string, unknown][] = [];
  const q = {
    select: () => q,
    eq: (k: string, v: unknown) => (filters.push([k, v]), q),
    maybeSingle: async () => ({ data: db[name].find((r) => filters.every(([k, v]) => r[k] === v)) ?? null, error: null }),
  };
  return q;
}

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn, revalidateTag: vi.fn(), updateTag: vi.fn() }));
vi.mock("@/lib/env", () => ({ isSupabaseConfigured: () => true, requireEnv: () => "secret" }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: (n: "contests" | "profiles") => table(n) }) }));
vi.mock("@/lib/settings", async () => {
  const { parseSetting } = await import("@/lib/settings/registry");
  return { getSettings: async (keys: string[]) => Object.fromEntries(keys.map((k) => [k, parseSetting(k as never, db.settings[k])])) };
});
vi.mock("@/lib/content/texts", async () => {
  const { MESSAGES: M } = await import("@/lib/i18n/messages");
  const { createTranslator: make } = await import("@/lib/i18n/translate");
  return { translatorFor: async (locale: "en" | "bn") => make(locale, M[locale]) };
});
vi.mock("@/lib/services/store", () => ({ getService: async () => null }));
vi.mock("@/lib/seo/test-accounts", () => ({ isTestAccount: async () => false, testIdsAmong: async (ids: string[]) => new Set(ids) }));
vi.mock("@/lib/email/send", () => ({
  emailOrigin: async () => "https://logocontest.bd",
  lastSent: async (userId: string, key: string, ref: string) => (sent.last.has(`${userId}|${key}|${ref}`) ? new Date() : null),
  sendEmail: async (input: Row) => {
    sent.mails.push(input);
    sent.last.add(`${(input.to as Row).userId}|${input.key}|${input.ref}`);
    return "sent";
  },
}));

beforeEach(() => {
  db.contests = [
    { id: C, slug: "rahim-tea", client_id: "u1", brand_name: "Rahim Tea", brief_completion: { v: 2, edited: [], acceptedAt: null } },
    { id: "old", slug: "old-shop", client_id: "u2", brand_name: "Old Shop", brief_completion: null },
  ];
  db.profiles = [
    { id: "u1", locale: "en" },
    { id: "u2", locale: "bn" },
  ];
  db.settings = { "onboarding.approval_minutes": 20 };
  sent.mails = [];
  sent.last = new Set();
  process.env.ONBOARDING_V2 = "true";
});
afterEach(() => {
  delete process.env.ONBOARDING_V2;
});

describe("sending (events.ts)", () => {
  it("payment received: to the client, in their language, with its own switch; an old contest gets nothing", async () => {
    const { emailV2PaymentReceived } = await import("@/lib/email/events");
    expect(await emailV2PaymentReceived("old")).toBe("skipped");
    expect(sent.mails).toHaveLength(0);
    expect(await emailV2PaymentReceived(C)).toBe("sent");
    expect(sent.mails[0]).toMatchObject({ key: "notification", to: { userId: "u1" }, notice: "onboarding_received", ref: `v2-received:${C}` });
    const data = sent.mails[0].data as Row;
    expect(data).toMatchObject({ title: "We got your payment for “Rahim Tea”", button_text: "Open my contest", button_url: `${SITE}/client/contests/rahim-tea` });
    expect(data.body).toContain("20 minutes");
    // The button in the designed email opens the contest's page.
    expect(render("notification", { ...(data as Record<string, string>), site_url: SITE }).html).toContain(`href="${SITE}/client/contests/rahim-tea"`);

    db.contests[0].client_id = "u2";
    db.profiles[1].locale = "bn";
    await emailV2PaymentReceived(C);
    expect((sent.mails[1].data as Row).title).toBe(bn("wizardV2.email.receivedSubject", { brand: "Rahim Tea" }));
    expect((sent.mails[1].data as Row).button_text).toBe(bn("wizardV2.email.open"));
  });

  it("contest live: once per contest, with the brief's link while it is untouched; an old contest gets nothing", async () => {
    const { emailV2ContestLive } = await import("@/lib/email/events");
    expect(await emailV2ContestLive("old")).toBe("skipped");
    expect(await emailV2ContestLive(C)).toBe("sent");
    expect(sent.mails[0]).toMatchObject({ key: "notification", to: { userId: "u1" }, notice: "onboarding_live", ref: `v2-live:${C}` });
    const data = sent.mails[0].data as Row;
    expect(data).toMatchObject({ title: "Your “Rahim Tea” contest is live!", button_url: `${SITE}/client/contests/rahim-tea` });
    expect(data.body).toContain(`${SITE}/start-v2/brief?c=${C}`);
    expect(render("notification", { ...(data as Record<string, string>), site_url: SITE }).html).toContain(`<a href="${SITE}/start-v2/brief?c=${C}"`);
    // ONE email: a second approval run sends nothing.
    expect(await emailV2ContestLive(C)).toBe("skipped");
    expect(sent.mails).toHaveLength(1);

    sent.last = new Set();
    db.contests[0].brief_completion = { v: 2, edited: ["needs"], acceptedAt: null };
    await emailV2ContestLive(C);
    expect((sent.mails[1].data as Row).body).toBe(en("wizardV2.email.liveBody"));

    sent.last = new Set();
    db.contests[0].brief_completion = { v: 2, edited: [], acceptedAt: null };
    process.env.ONBOARDING_V2 = "false";
    await emailV2ContestLive(C);
    expect((sent.mails[2].data as Row).body).toBe(en("wizardV2.email.liveBody"));
  });
});

describe("where they are sent from (manual bKash payments)", () => {
  const src = read("src/lib/payments/manual.ts");
  const submit = src.slice(src.indexOf("export async function submitProof"), src.indexOf("type ProofRow"));
  const approve = src.slice(src.indexOf("export async function approveProof"), src.indexOf("export async function rejectProof"));

  it("after the reply, so a slow or failed email never delays or breaks sending or approving a payment", () => {
    expect(submit).toContain('const v2Id = target.kind === "contest" ? target.contest?.id : null;');
    expect(submit).toContain("if (v2Id) after(() => emailV2PaymentReceived(v2Id));");
    // Only once the proof is saved (after the insert's error return).
    expect(submit.indexOf("emailV2PaymentReceived")).toBeGreaterThan(submit.indexOf('return { ok: false, error: "generic" }'));
    const contestBranch = approve.slice(approve.indexOf('if (p.kind === "contest")'), approve.indexOf('} else if (p.kind === "addon")'));
    expect(contestBranch).toContain("after(() => emailV2ContestLive(contest.id));");
    expect(contestBranch.indexOf("emailV2ContestLive")).toBeGreaterThan(contestBranch.indexOf("confirmPayment("));
    // Add-ons, Pro and rejections: no change.
    expect(approve.slice(approve.indexOf('} else if (p.kind === "addon")')).match(/emailV2/g)).toBeNull();
    expect(src.slice(src.indexOf("export async function rejectProof")).match(/emailV2/g)).toBeNull();
    expect(src).not.toMatch(/resumeLink/);
  });
});
