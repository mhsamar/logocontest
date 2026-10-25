import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Owner, 2026-10-25: the team gets an alert for a new client who gave their number but didn't sign up, and each lead
// on Unpaid contests opens to who they are and how to reach them.
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

type Row = Record<string, unknown>;
const db = vi.hoisted(() => ({
  leads: [] as Row[],
  profiles: [] as Row[],
  emails: [] as Row[],
  missing: false,
  failProfiles: false,
  upserts: [] as Row[],
  settings: { "notify.lead_alert_minutes": 15, "notify.lead_alert_emails_day": 20 } as Record<string, number>,
  on: ["bell", "push", "email"] as string[],
  admins: ["admin1", "admin2"] as string[],
}));
const alertAdmins = vi.hoisted(() => vi.fn<(input: Record<string, unknown>) => Promise<void>>(async () => undefined));

/** A tiny stand-in for the Supabase query builder over in-memory tables. */
function query(name: string) {
  const rows = () => (name === "profiles" ? db.profiles : name === "email_log" ? db.emails : db.leads);
  const filters: ((r: Row) => boolean)[] = [];
  const keys: string[] = [];
  let cols = "";
  let patch: Row | null = null;
  let upsert: Row | null = null;
  let max = Infinity;
  let sort: string | null = null;
  let single = false;
  const on = (k: string, f: (r: Row) => boolean) => (keys.push(k), filters.push(f), q);
  const q = {
    select: (c = "*") => ((cols = c), q),
    update: (u: Row) => ((patch = u), q),
    upsert: (u: Row) => ((upsert = u), q),
    eq: (k: string, v: unknown) => on(k, (r) => r[k] === v),
    neq: (k: string, v: unknown) => on(k, (r) => r[k] !== v),
    is: (k: string, v: unknown) => on(k, (r) => (r[k] ?? null) === v),
    not: (k: string, _op: string, v: unknown) => on(k, (r) => (r[k] ?? null) !== v),
    in: (k: string, vs: unknown[]) => on(k, (r) => vs.includes(r[k])),
    like: (k: string, v: string) => on(k, (r) => String(r[k]).startsWith(v.replace(/%$/, ""))),
    lte: (k: string, v: string) => on(k, (r) => String(r[k]) <= v),
    gte: (k: string, v: string) => on(k, (r) => String(r[k]) >= v),
    order: (k: string) => ((sort = k), q),
    limit: (n: number) => ((max = n), q),
    maybeSingle: () => ((single = true), q),
    then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => {
      // Columns added by migration 0075: reading, filtering or writing any of them fails before it runs.
      const added = ["alerted_at", "name", "email", "whatsapp"];
      const used = [...cols.split(",").map((c) => c.trim()), ...keys, ...Object.keys(patch ?? {}), ...Object.keys(upsert ?? {})];
      const fail = (name === "wizard_leads" && db.missing && used.some((c) => added.includes(c))) || (name === "profiles" && db.failProfiles);
      if (fail) return Promise.resolve({ data: null, error: { code: "42703", message: "column does not exist" } }).then(ok, bad);
      if (upsert) {
        db.upserts.push(upsert);
        return Promise.resolve({ data: null, error: null }).then(ok, bad);
      }
      let hit = rows().filter((r) => filters.every((f) => f(r)));
      if (sort) hit = [...hit].sort((a, b) => String(b[sort!]).localeCompare(String(a[sort!])));
      hit = hit.slice(0, max);
      if (patch) for (const r of hit) Object.assign(r, patch);
      const data = hit.map((r) => ({ ...r }));
      return Promise.resolve({ data: single ? (data[0] ?? null) : data, count: hit.length, error: null }).then(ok, bad);
    },
  };
  return q;
}

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ isSupabaseConfigured: () => true }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: (name: string) => query(name) }) }));
vi.mock("@/lib/settings", () => ({ getSettings: async (keys: string[]) => Object.fromEntries(keys.map((k) => [k, db.settings[k]])) }));
vi.mock("@/lib/notifications/admin-alerts", () => ({ alertAdmins }));
vi.mock("@/lib/admin/recipients", () => ({ adminIdsWith: async () => db.admins }));
vi.mock("@/lib/notifications/switches", () => ({ noticeOn: async (_id: string, c: string) => db.on.includes(c) }));
vi.mock("@/lib/admin/analytics", () => ({ dhakaStart: (_days: number, now: Date) => new Date(`${new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(now)}T00:00:00+06:00`) }));
vi.mock("@/lib/pro/workspace", () => ({ serviceNames: async () => new Map([["logo", "Logo"], ["tshirt", "T-shirt"]]) }));

const NOW = new Date("2026-10-25T12:00:00Z");
const at = (min: number, from = NOW) => new Date(from.getTime() - min * 60_000).toISOString();
const lead = (visit: string, mobile: string, createdMin: number, more: Row = {}): Row => ({ visit_id: visit, mobile, name: null, email: null, whatsapp: null, brand_name: null, service: "logo", furthest_step: 1, created_at: at(createdMin), updated_at: at(createdMin), alerted_at: null, ...more });
const call = (i = 0) => (alertAdmins.mock.calls[i] as unknown[])[0] as Record<string, unknown>;
const alerted = (v: string) => Boolean(db.leads.find((r) => r.visit_id === v)!.alerted_at);

beforeEach(() => {
  db.leads = [];
  db.profiles = [];
  db.emails = [];
  db.missing = false;
  db.failProfiles = false;
  db.upserts = [];
  db.settings = { "notify.lead_alert_minutes": 15, "notify.lead_alert_emails_day": 20 };
  db.on = ["bell", "push", "email"];
  db.admins = ["admin1", "admin2"];
  alertAdmins.mockClear();
});

describe("lead alerts (lifecycle job)", () => {
  it("tells the team about each new person once, after the wait, and never puts the number in it", async () => {
    const { alertNewLeads } = await import("@/lib/admin/lead-alerts");
    const { leadPath } = await import("@/lib/admin/lead-path");
    db.leads = [
      lead("a1", "+8801711111111", 30, { name: "Rahim", brand_name: "Rahim Tea", furthest_step: 3 }),
      lead("a2", "+8801711111111", 5, { brand_name: "Rahim Tea House", updated_at: at(2) }),
      lead("b1", "+8801722222222", 10, { name: "Not yet due" }),
      lead("c1", "+8801733333333", 40, { name: "Signed up" }),
      lead("d1", "+8801744444444", 2 * 24 * 60, { name: "Too old" }),
      lead("e0", "+8801755555555", 3 * 24 * 60, { alerted_at: at(3 * 24 * 60 - 20) }),
      lead("e1", "+8801755555555", 30, { name: "Told before" }),
    ];
    db.profiles = [{ mobile: "+8801733333333" }];

    expect(await alertNewLeads(NOW)).toBe(1);
    expect(alertAdmins).toHaveBeenCalledTimes(1);
    expect(call()).toMatchObject({ permission: "unpaid.view", type: "lead_new_admin", notice: "admin_leads", email: true, data: { name: "Rahim" }, path: leadPath("a1"), ref: "lead:a1" });
    expect(call().actorId).toBeUndefined();
    expect(JSON.stringify(call())).not.toMatch(/1711111111|01711/);
    // The email names no one: it outlives the lead.
    const params = (call().params as (t: unknown, l: string) => Record<string, string>)((k: string) => k, "en");
    expect(params).toMatchObject({ service: "Logo", step: "admin.dashboard.steps.s3" });
    expect(Object.values(params).join(" ")).not.toMatch(/Rahim|1711111111/);

    // Only due visits are marked: the newer visit, the not-yet-due and the old are left alone.
    expect(["a1", "c1", "e1"].every(alerted)).toBe(true);
    expect(alerted("a2") || alerted("b1") || alerted("d1")).toBe(false);

    // Running again tells nobody twice; ten minutes later the next person is due, and the newer visit of the one
    // already told is marked quietly.
    expect(await alertNewLeads(NOW)).toBe(0);
    expect(await alertNewLeads(new Date(NOW.getTime() + 10 * 60_000))).toBe(1);
    expect(alertAdmins).toHaveBeenCalledTimes(2);
    expect(call(1).data).toEqual({ name: "Not yet due" });
    expect(alerted("a2")).toBe(true);
  });

  it("more than 3 people at once go out as one summary to the Unpaid page", async () => {
    const { alertNewLeads } = await import("@/lib/admin/lead-alerts");
    db.leads = Array.from({ length: 5 }, (_, i) => lead(`v${i}`, `+880171000000${i}`, 20 + i, { name: `P${i}` }));
    expect(await alertNewLeads(NOW)).toBe(5);
    expect(alertAdmins).toHaveBeenCalledTimes(1);
    expect(call()).toMatchObject({ type: "leads_new_admin", data: { number: 5 }, path: "/admin/unpaid", notice: "admin_leads" });
  });

  it("a service lead names its service and no logo step; no name falls back to the brand", async () => {
    const { alertNewLeads } = await import("@/lib/admin/lead-alerts");
    db.leads = [lead("s1", "+8801766666666", 20, { service: "tshirt", brand_name: "Shirt Co", furthest_step: 1 })];
    await alertNewLeads(NOW);
    expect(call().data).toEqual({ name: "Shirt Co" });
    expect((call().params as (t: unknown, l: string) => Record<string, string>)((k: string) => k, "bn")).toMatchObject({ service: "T-shirt", step: "—" });
  });

  it("a wait of a whole day still alerts (the day window counts from when they were due)", async () => {
    const { alertNewLeads } = await import("@/lib/admin/lead-alerts");
    db.settings["notify.lead_alert_minutes"] = 1440;
    db.leads = [lead("w1", "+8801788888888", 1440 + 30, { name: "Late" }), lead("w2", "+8801799999999", 600, { name: "Not yet" })];
    expect(await alertNewLeads(NOW)).toBe(1);
    expect(call().data).toEqual({ name: "Late" });
  });

  it("marks no one when it can't tell who signed up or was told", async () => {
    const { alertNewLeads } = await import("@/lib/admin/lead-alerts");
    db.failProfiles = true;
    db.leads = [lead("x1", "+8801777777777", 20, { name: "Someone" })];
    await expect(alertNewLeads(NOW)).rejects.toThrow();
    expect(alertAdmins).not.toHaveBeenCalled();
    expect(alerted("x1")).toBe(false);
  });

  it("turned off in Admin › Notifications: nobody is marked as alerted", async () => {
    const { alertNewLeads } = await import("@/lib/admin/lead-alerts");
    db.on = [];
    db.leads = [lead("x1", "+8801777777777", 20, { name: "Someone" })];
    expect(await alertNewLeads(NOW)).toBe(0);
    expect(alerted("x1")).toBe(false);
  });

  it("after the day's email limit only the bell and phone go; one email per admin counts", async () => {
    const { alertNewLeads } = await import("@/lib/admin/lead-alerts");
    // 17 sent, limit 20, 2 admins: one more alert fits by email (2), the next would pass the limit.
    db.emails = Array.from({ length: 17 }, (_, i) => ({ template: "notification", ref: `lead:old${i}`, status: "sent", created_at: at(60) }));
    db.leads = [lead("x1", "+8801777777777", 20, { name: "First" }), lead("x2", "+8801788888888", 25, { name: "Second" })];
    expect(await alertNewLeads(NOW)).toBe(2);
    expect(alertAdmins.mock.calls.map((c) => (c as unknown[])[0] as Record<string, unknown>).map((c) => c.email)).toEqual([true, false]);
  });

  it("with only email on and the day's limit reached, nobody is marked until it can be told", async () => {
    const { alertNewLeads } = await import("@/lib/admin/lead-alerts");
    db.on = ["email"];
    db.emails = Array.from({ length: 19 }, (_, i) => ({ template: "notification", ref: `lead:old${i}`, status: "sent", created_at: at(60) }));
    db.leads = [lead("x1", "+8801777777777", 20, { name: "Someone" })];
    expect(await alertNewLeads(NOW)).toBe(0);
    expect(alertAdmins).not.toHaveBeenCalled();
    expect(alerted("x1")).toBe(false);
  });

  it("a brand stands in for a missing name only as plain words", async () => {
    const { alertNewLeads } = await import("@/lib/admin/lead-alerts");
    db.leads = [lead("x1", "+8801777777777", 20, { brand_name: "Win now http://bit.ly/x 01811111111" })];
    await alertNewLeads(NOW);
    const name = (call().data as { name: string }).name;
    expect(name).not.toMatch(/[:/.\d]/);
    expect(call().data).toEqual({ name });
  });

  it("does nothing before migration 0075 adds the alert column", async () => {
    const { alertNewLeads } = await import("@/lib/admin/lead-alerts");
    db.missing = true;
    db.leads = [lead("x1", "+8801777777777", 20)];
    expect(await alertNewLeads(NOW)).toBe(0);
    expect(alertAdmins).not.toHaveBeenCalled();
  });

  it("runs last in the 15-minute job, its failure never stops the job, and its bell alerts go after 88 days", () => {
    const run = read("src/lib/lifecycle/run.ts");
    expect(run).toMatch(/try \{\n\s*report\.leadAlerts = await alertNewLeads\(now\);\n\s*\} catch \(e\) \{\n\s*fail\("leads", "-", e\);\n\s*\}\n\n\s*return report;/);
    expect(run).toContain('db.from("notifications").delete().eq("type", "lead_new_admin").lt("created_at", new Date(now.getTime() - 88 * day).toISOString());');
  });

  it("has its row in Admin › Notifications with the waiting minutes (15) and a daily email limit (20)", async () => {
    const { NOTICE_ROWS } = await import("@/lib/notifications/admin-catalog");
    const { SETTINGS } = await import("@/lib/settings/registry");
    expect(NOTICE_ROWS.find((r) => r.id === "admin_leads")).toMatchObject({ audience: "admin", types: ["lead_new_admin", "leads_new_admin"], channels: ["bell", "push", "email"], timing: ["notify.lead_alert_minutes", "notify.lead_alert_emails_day"] });
    expect(SETTINGS["notify.lead_alert_minutes"].default).toBe(15);
    expect(SETTINGS["notify.lead_alert_minutes"].schema.safeParse(4).success).toBe(false);
    expect(SETTINGS["notify.lead_alert_emails_day"].default).toBe(20);
  });
});

describe("the lead list on Unpaid contests", () => {
  it("one entry per number with its name, email and WhatsApp, how far it ever got, first contact and tries", async () => {
    const { wizardLeads } = await import("@/lib/admin/leads");
    db.leads = [
      lead("a1", "+8801711111111", 60, { name: "Rahim", email: "r@x.com", whatsapp: true, brand_name: "Rahim Tea", furthest_step: 7, alerted_at: at(40) }),
      lead("a2", "+8801711111111", 5, { brand_name: "Rahim Tea", furthest_step: 2, updated_at: at(1) }),
      lead("c1", "+8801733333333", 30, { name: "Signed up" }),
    ];
    db.profiles = [{ mobile: "+8801733333333" }];
    const list = await wizardLeads();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ visitId: "a2", visitIds: ["a2", "a1"], name: "Rahim", email: "r@x.com", whatsapp: true, detailsSaved: true, brand: "Rahim Tea", step: 7, visits: 2 });
    expect(list[0].createdAt.toISOString()).toBe(at(60));
    expect(list[0].alertedAt?.toISOString()).toBe(at(40));
  });

  it("an alert's link finds its person even past the list's limit", async () => {
    const { wizardLeads } = await import("@/lib/admin/leads");
    db.leads = [lead("n1", "+8801711111111", 5, { name: "Newer" }), lead("o1", "+8801722222222", 60, { name: "Older" })];
    expect((await wizardLeads(1)).map((l) => l.visitId)).toEqual(["n1"]);
    expect((await wizardLeads(1, "o1")).map((l) => l.visitId)).toEqual(["n1"]);
    db.leads[1].visit_id = "0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0";
    expect((await wizardLeads(1, "0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0")).map((l) => l.name)).toEqual(["Older", "Newer"]);
    // Already listed from a newer visit: the full entry replaces it, so nobody shows twice.
    db.leads.push(lead("o2", "+8801722222222", 1, { name: "Older", updated_at: at(0) }));
    // 200 newer visits from a number that signed up push the linked visit out of the list's window.
    for (let i = 0; i < 200; i++) db.leads.push(lead(`f${i}`, "+8801700000000", 2, { updated_at: at(2) }));
    db.profiles = [{ mobile: "+8801700000000" }];
    const twice = await wizardLeads(1, "0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0");
    expect(twice.map((l) => l.visitIds)).toEqual([["o2", "0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0"]]);
    // Not for someone who has since signed up.
    db.profiles.push({ mobile: "+8801722222222" });
    expect(await wizardLeads(1, "0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0")).toEqual([]);
  });

  it("still lists numbers before migration 0075, without the new details", async () => {
    const { wizardLeads } = await import("@/lib/admin/leads");
    db.missing = true;
    db.leads = [lead("a1", "+8801711111111", 60, { brand_name: "Rahim Tea" })];
    const list = await wizardLeads();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ name: null, email: null, whatsapp: null, detailsSaved: false, alertedAt: null, brand: "Rahim Tea" });
  });

  it("an alert opens that person on the Unpaid page by the visit's id, never by the number", async () => {
    const { leadPath } = await import("@/lib/admin/lead-path");
    expect(leadPath("0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0")).toBe("/admin/unpaid?sel=g:0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0#lead");
    // The page finds a guest by any of their visits, so an older visit's link still opens them.
    expect(read("src/app/admin/unpaid/page.tsx")).toContain('l.key === q.sel || (q.sel!.startsWith("g:") && l.visitIds.includes(q.sel!.slice(2)))');
  });
});

describe("saving a lead's details from the first step", () => {
  const UUID = "0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0";

  it("keeps the name, a valid email and the WhatsApp tick with the number", async () => {
    const { saveWizardLead } = await import("@/lib/wizard-tracking");
    await saveWizardLead({ visitId: UUID, mobile: "01711111111", country: "BD", name: "  Rahim   Uddin ", email: " R@X.COM ", whatsapp: false });
    expect(db.upserts).toHaveLength(1);
    expect(db.upserts[0]).toMatchObject({ visit_id: UUID, mobile: "+8801711111111", name: "Rahim Uddin", email: "r@x.com", whatsapp: false });
    await saveWizardLead({ visitId: UUID, mobile: "01711111111", country: "BD", email: "not an email" });
    expect(db.upserts[1]).not.toHaveProperty("email");
    expect(db.upserts[1]).not.toHaveProperty("name");
  });

  it("checks the name on the server too: no links or junk reach the team's alerts", async () => {
    const { saveWizardLead } = await import("@/lib/wizard-tracking");
    for (const name of ["Visit http://x.co now", "<b>Hi</b>", "A", "x".repeat(61)]) await saveWizardLead({ visitId: UUID, mobile: "01711111111", country: "BD", name });
    expect(db.upserts).toHaveLength(4);
    for (const u of db.upserts) expect(u).not.toHaveProperty("name");
  });

  it("a different number on the same visit starts the wait again", async () => {
    const { saveWizardLead } = await import("@/lib/wizard-tracking");
    db.leads = [lead(UUID, "+8801711111111", 60, { alerted_at: at(40) })];
    await saveWizardLead({ visitId: UUID, mobile: "01711111111", country: "BD" });
    expect(db.leads[0].alerted_at).toBe(at(40));
    await saveWizardLead({ visitId: UUID, mobile: "01722222222", country: "BD" });
    expect(db.leads[0].alerted_at).toBeNull();
  });

  it("before migration 0075 still saves the number", async () => {
    const { saveWizardLead } = await import("@/lib/wizard-tracking");
    db.missing = true;
    await saveWizardLead({ visitId: UUID, mobile: "01711111111", country: "BD", name: "Rahim" });
    expect(db.upserts).toHaveLength(1);
    expect(db.upserts[0]).toMatchObject({ visit_id: UUID, mobile: "+8801711111111" });
    expect(db.upserts[0]).not.toHaveProperty("name");
  });

  it("both wizards send them (WhatsApp left out when that question is hidden), and the privacy policy says so", () => {
    expect(read("src/components/wizard/wizard.tsx")).toContain('name: personName, email: state.email, whatsapp: hidden.has("whatsapp") ? undefined : state.whatsapp === true');
    expect(read("src/components/services/service-wizard.tsx")).toMatch(/name: personName, email, whatsapp/);
    expect(read("src/lib/legal/en.ts")).toContain("Details from a contest started without signing up are deleted after 90 days.");
    expect(read("src/lib/legal/bn.ts")).toContain("সাইন আপ ছাড়া শুরু করা কনটেস্টের তথ্য ৯০ দিন পর মুছে যায়।");
  });
});
