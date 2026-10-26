import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readResumeToken, resumeToken, resumeUntil } from "@/lib/contests/resume-token";

// Owner, 2026-10-26: a "resume contest" link (logocontest.bd/r/<token>) that opens the client's unpaid contest at the
// step where they stopped, without a password; copied on Admin › Unpaid contests and sent in the reminder emails.
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

type Row = Record<string, unknown>;
const db = vi.hoisted(() => ({ tables: {} as Record<string, Row[]>, missing: new Set<string>(), waiting: new Map<string, string>() }));

function table(name: string) {
  const filters: ((r: Row) => boolean)[] = [];
  const q = {
    select: () => q,
    eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), q),
    maybeSingle: async () => (db.missing.has(name) ? { data: null, error: { code: "PGRST205", message: "not in the schema cache" } } : { data: (db.tables[name] ?? []).find((r) => filters.every((f) => f(r))) ?? null, error: null }),
  };
  return q;
}

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ requireEnv: () => "test-secret", isSupabaseConfigured: () => true }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: (n: string) => table(n) }) }));
vi.mock("@/lib/payments/manual", () => ({ awaitingApproval: async (ids: string[]) => new Map(ids.filter((i) => db.waiting.has(i)).map((i) => [i, db.waiting.get(i)!])) }));
vi.mock("@/lib/settings", () => ({ getSetting: async () => 7 }));
vi.mock("@/lib/site-origin", () => ({ linkOrigin: async () => "https://logocontest.bd" }));
vi.mock("@/lib/admin/unpaid-leads", () => ({ leadRow: async () => null }));

const C = "0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0";
const now = new Date("2026-10-26T10:00:00Z");

beforeEach(() => {
  db.tables = {
    contests: [{ id: C, client_id: "u1", status: "draft", brand_name: "Purple Holdings", service: "logo" }],
    profiles: [{ id: "u1", role: "client", status: "active", suspended_until: null, deleted_at: null }],
    unpaid_leads: [],
  };
  db.missing = new Set();
  db.waiting = new Map();
});

describe("the resume link's token", () => {
  it("names the contest and its end, is short, and only uses letters safe in a link", () => {
    const token = resumeToken("s", C, resumeUntil(now, 7));
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[0-9a-z]+\.[A-Za-z0-9_-]{22}$/);
    expect(token.length).toBeLessThan(60);
    expect(readResumeToken("s", token, now)).toEqual({ contestId: C, until: new Date(Math.floor(resumeUntil(now, 7).getTime() / 1000) * 1000) });
  });

  it("can't be changed, made up or used after its end", () => {
    const token = resumeToken("s", C, resumeUntil(now, 7));
    const [id, end, sig] = token.split(".");
    expect(readResumeToken("other secret", token, now)).toBeNull();
    // Another contest, a later end, a changed signature.
    expect(readResumeToken("s", `${Buffer.from("1".repeat(32), "hex").toString("base64url")}.${end}.${sig}`, now)).toBeNull();
    expect(readResumeToken("s", `${id}.${(parseInt(end, 36) + 86400 * 30).toString(36)}.${sig}`, now)).toBeNull();
    expect(readResumeToken("s", `${id}.${end}.${sig.slice(0, -1)}${sig.endsWith("A") ? "B" : "A"}`, now)).toBeNull();
    expect(readResumeToken("s", token, new Date(now.getTime() + 8 * 86_400_000))).toBeNull();
    for (const bad of ["", "a.b", "a.b.c.d", `${token} `, "<script>.x.y", 42, null, "x".repeat(200)]) expect(readResumeToken("s", bad, now)).toBeNull();
  });
});

describe("where the link goes, checked every time it is used", () => {
  it("a logo draft opens at the first unfinished step (else Review and pay); a design service at Pay", async () => {
    const { resumeTarget } = await import("@/lib/contests/resume");
    expect(await resumeTarget(C)).toEqual({ contestId: C, clientId: "u1", brand: "Purple Holdings", href: `/start?draft=${C}&step=8`, locale: "en" });
    db.tables.contests[0].service = "social-media-post";
    expect((await resumeTarget(C))?.href).toBe(`/start?draft=${C}&step=pay`);
    db.tables.contests[0].status = "pending_payment";
    expect((await resumeTarget(C))?.href).toBe(`/start?draft=${C}&step=pay`);
  });

  it("a bKash payment waiting for approval opens its page, never a second payment", async () => {
    const { resumeTarget } = await import("@/lib/contests/resume");
    db.waiting.set(C, "p9");
    expect((await resumeTarget(C))?.href).toBe("/pay/contest/p9");
  });

  it("stops once the contest is paid or deleted, and only ever signs in an active client", async () => {
    const { resumeTarget } = await import("@/lib/contests/resume");
    for (const status of ["open", "judging", "completed", "cancelled", "deleted"]) {
      db.tables.contests[0].status = status;
      expect(await resumeTarget(C)).toBeNull();
    }
    db.tables.contests[0].status = "draft";
    for (const p of [{ role: "designer" }, { role: "admin" }, { status: "banned" }, { status: "suspended", suspended_until: "2099-01-01T00:00:00Z" }, { deleted_at: "2026-10-01T00:00:00Z" }]) {
      db.tables.profiles = [{ id: "u1", role: "client", status: "active", suspended_until: null, deleted_at: null, ...p }];
      expect(await resumeTarget(C)).toBeNull();
    }
    // A suspension that has run out counts as active.
    db.tables.profiles = [{ id: "u1", role: "client", status: "suspended", suspended_until: "2026-01-01T00:00:00Z", deleted_at: null }];
    expect(await resumeTarget(C)).not.toBeNull();
    expect(await resumeTarget("ffffffff-ffff-ffff-ffff-ffffffffffff")).toBeNull();
  });

  it("stops once the lead is closed (not interested, paid another way, fake), hidden or blocked on the Unpaid page", async () => {
    const { resumeTarget } = await import("@/lib/contests/resume");
    for (const lead of [{ status: "closed" }, { status: "in_touch", hidden: true }, { status: "new", blocked: true }]) {
      db.tables.unpaid_leads = [{ contest_id: C, hidden: false, blocked: false, ...lead }];
      expect(await resumeTarget(C)).toBeNull();
    }
    db.tables.unpaid_leads = [{ contest_id: C, status: "promised", hidden: false, blocked: false }];
    expect(await resumeTarget(C)).not.toBeNull();
    // Before migration 0076 there is no lead table: the link still works.
    db.missing.add("unpaid_leads");
    expect(await resumeTarget(C)).not.toBeNull();
  });

  it("a fresh link is on the site's own address, works for the setting's days, and opens in the client's language", async () => {
    const { resumeLink, resumeTarget } = await import("@/lib/contests/resume");
    const link = await resumeLink(C, now);
    expect(link).toMatch(/^https:\/\/logocontest\.bd\/r\/[A-Za-z0-9_.-]+$/);
    const got = readResumeToken("test-secret", link.split("/r/")[1], now);
    expect(got?.contestId).toBe(C);
    expect(got!.until.getTime() - now.getTime()).toBeGreaterThan(6.9 * 86_400_000);
    expect(await resumeLink(C, now, "bn")).toMatch(/\?lang=bn$/);
    db.tables.profiles[0].locale = "bn";
    expect((await resumeTarget(C))?.locale).toBe("bn");
  });
});

describe("wiring", () => {
  it("opening the link never signs anyone in: only its button does (link previews and email scanners open links too)", () => {
    const page = read("src/app/r/[token]/page.tsx");
    expect(page).not.toMatch(/verifyOtp|generateLink|createClient/);
    expect(page).toContain("<form action={resumeContest.bind(null, token)}");
    expect(page).toContain("if (target && me?.id === target.clientId) redirect(target.href);");
    expect(page).toContain("robots: { index: false, follow: false }");
    const action = read("src/lib/contests/resume-actions.ts");
    expect(action).toContain('if (me?.role === "admin") redirect(back);');
    expect(action).toContain('await supabase.auth.signOut({ scope: "local" });');
    expect(action).toContain('(await cookies()).delete("lc_as");');
  });

  it("the token never leaves the site: no Meta pixel, no stored page view, no ads or pop-up; a signed-out device still opens it", async () => {
    const { noPixelPath } = await import("@/lib/analytics/meta-pixel");
    const { trackablePath } = await import("@/lib/analytics/rules");
    const { adsAllowedOn } = await import("@/components/ads/ads-script");
    expect(noPixelPath("/r/abc.def.ghi")).toBe(true);
    expect(noPixelPath("/rules")).toBe(false);
    expect(trackablePath("/r/abc.def.ghi")).toBe("/r");
    expect(trackablePath("/rewards")).toBe("/rewards");
    expect(adsAllowedOn("/r/abc")).toBe(false);
    expect(read("src/lib/visitor-popup/rules.ts")).toContain('const BLOCKED = [\n  "/r",');
    expect(read("src/proxy.ts")).toContain('if (ended && isPage && !pathname.startsWith("/r/")) {');
    // A form sent before the page's script loads lands on a page with the pixel: it only learns "logocontest.bd".
    expect(read("next.config.ts")).toContain('{ source: "/r/:token", headers: [{ key: "Referrer-Policy", value: "strict-origin" }] },');
    // The WhatsApp preview never carries the link (no og:url path).
    expect(read("src/app/r/[token]/page.tsx")).toContain("openGraph: openGraphFor({ ...meta, locale })");
  });

  it("the reminder emails and the Unpaid page use it", () => {
    expect(read("src/lib/admin/unpaid-reminders.ts")).toContain('link: await resumeLink(id, now, locale === "bn" ? "bn" : "en").catch(() => `${origin}/client/contests/${id}`)');
    expect(read("src/components/admin/unpaid/lead-list.tsx")).toContain('resume={l.kind === "contest" && Boolean(l.contestId) && l.stage < PAID}');
    expect(read("src/components/admin/unpaid/lead-details.tsx")).toContain("{canManage && resumeDays !== null && open && <CopyResume leadKey={lead.key} big />}");
    // Made and logged on the server at the click: never sitting in the page.
    expect(read("src/app/admin/unpaid/page.tsx")).not.toContain("/r/");
  });
});
