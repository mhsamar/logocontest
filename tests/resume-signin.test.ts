import { beforeEach, describe, expect, it, vi } from "vitest";
import { resumeToken } from "@/lib/contests/resume-token";

// Owner, 2026-10-26: "Continue my contest" on a resume link signs the contest's client in without a password; the
// Unpaid page's Copy button makes the link (logged first). See tests/resume-link.test.ts for the token and the checks.

type Row = Record<string, unknown>;
const C = "0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0";
const TARGET = { contestId: C, clientId: "u1", brand: "Purple Holdings", href: `/start?draft=${C}&step=8` };
const s = vi.hoisted(() => ({
  me: null as null | { id: string; role: string },
  target: null as null | Record<string, unknown>,
  admin: null as null | Row,
  who: null as null | Row,
  verifyFails: false,
  calls: [] as string[],
  audits: [] as Row[],
  notes: [] as unknown[][],
  deleted: [] as string[],
}));

class Redirect extends Error {
  constructor(public to: string) {
    super(`redirect ${to}`);
  }
}

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Redirect(to);
  },
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ delete: (n: string) => void s.deleted.push(n) }), headers: async () => new Map([["x-vercel-ip-country", "BD"]]) }));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: async () => s.me }));
vi.mock("@/lib/auth/sessions", () => ({ markLoggedOut: async () => void s.calls.push("markLoggedOut") }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      signOut: async (o: unknown) => void s.calls.push(`signOut:${JSON.stringify(o)}`),
      verifyOtp: async (o: { token_hash: string }) => (s.calls.push(`verifyOtp:${o.token_hash}`), s.verifyFails ? { data: { session: null }, error: { message: "bad" } } : { data: { session: { access_token: "x" } }, error: null }),
    },
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: {
      admin: {
        getUserById: async (id: string) => ({ data: { user: { email: `${id}@phone.logocontest.bd` } } }),
        generateLink: async (o: { email: string }) => (s.calls.push(`generateLink:${o.email}`), { data: { properties: { hashed_token: "hash1" } }, error: null }),
      },
    },
    from: () => ({ insert: async (r: Row) => (s.audits.push(r), { error: null }) }),
  }),
}));
vi.mock("@/lib/contests/resume", () => ({
  resumeSecret: () => "test-secret",
  resumeTarget: async () => s.target,
  resumeLink: async (id: string) => `https://logocontest.bd/r/link-${id}`,
  noteResume: async (...a: unknown[]) => void s.notes.push(a),
}));
vi.mock("@/lib/admin/core", () => ({ adminUser: async (perm: string) => (perm === "unpaid.manage" ? s.admin : null), audit: vi.fn(), superAdmin: vi.fn() }));
vi.mock("@/lib/admin/recipients", () => ({ adminIdsWith: async () => [] }));
vi.mock("@/lib/settings", () => ({ getSettings: async () => ({ "notify.followup_due_minutes": 10 }) }));
vi.mock("@/lib/admin/unpaid-leads", () => ({ resolve: async () => s.who, leadRow: async () => null }));

const token = () => resumeToken("test-secret", C, new Date(Date.now() + 86_400_000));
const go = async (t = token()) => {
  const { resumeContest } = await import("@/lib/contests/resume-actions");
  try {
    await resumeContest(t);
  } catch (e) {
    if (e instanceof Redirect) return e.to;
    throw e;
  }
  return "no redirect";
};

beforeEach(() => {
  s.me = null;
  s.target = { ...TARGET };
  s.admin = { id: "a1" };
  s.who = { kind: "contest", contestId: C };
  s.verifyFails = false;
  s.calls = [];
  s.audits = [];
  s.notes = [];
  s.deleted = [];
});

describe("Continue my contest", () => {
  it("signs the client in and opens the draft where they stopped; noted in the History and the audit log", async () => {
    expect(await go()).toBe(TARGET.href);
    expect(s.calls).toEqual(["generateLink:u1@phone.logocontest.bd", "verifyOtp:hash1"]);
    expect(s.deleted).toEqual(["lc_as"]);
    expect(s.notes).toEqual([[C, "resume_opened", null]]);
    expect(s.audits).toEqual([{ admin_id: null, action: "resume_link_signin", subject_type: "contest", subject_id: C, changes: { country: "BD" } }]);
  });

  it("the client already signed in goes straight there, with no new login", async () => {
    s.me = { id: "u1", role: "client" };
    expect(await go()).toBe(TARGET.href);
    expect(s.calls).toEqual([]);
  });

  it("someone else's login on this device ends first (this device only)", async () => {
    s.me = { id: "u2", role: "client" };
    expect(await go()).toBe(TARGET.href);
    expect(s.calls).toEqual(["generateLink:u1@phone.logocontest.bd", "markLoggedOut", 'signOut:{"scope":"local"}', "verifyOtp:hash1"]);
  });

  it("staff are never switched to a client", async () => {
    s.me = { id: "a1", role: "admin" };
    expect(await go()).toMatch(/^\/r\//);
    expect(s.calls).toEqual([]);
  });

  it("a changed or dead link, or a contest that is paid or closed, signs no one in", async () => {
    expect(await go(`${token()}x`)).toMatch(/^\/r\//);
    s.target = null;
    expect(await go()).toMatch(/^\/r\//);
    expect(s.calls).toEqual([]);
    expect(s.notes).toEqual([]);
  });

  it("when the sign-in doesn't go through, it says so and opens nothing", async () => {
    s.verifyFails = true;
    expect(await go()).toMatch(/\?failed=1$/);
    expect(s.notes).toEqual([]);
  });
});

describe("Copy resume link (Unpaid contests)", () => {
  it("needs Unpaid · Manage, an unpaid draft of a signed-up client, and is logged before the link is given", async () => {
    const { resumeLinkFor } = await import("@/lib/admin/unpaid-followup-actions");
    expect(await resumeLinkFor(`c:${C}`)).toEqual({ ok: true, link: `https://logocontest.bd/r/link-${C}` });
    expect(s.audits).toEqual([{ admin_id: "a1", action: "unpaid_resume_link", subject_type: "lead", subject_id: `c:${C}`, changes: {} }]);
    expect(s.notes).toEqual([[C, "resume_link", "a1"]]);

    s.audits = [];
    s.who = { kind: "guest", contestId: null };
    expect(await resumeLinkFor("g:v1")).toEqual({ ok: false });
    s.who = { kind: "contest", contestId: C };
    s.target = null;
    expect(await resumeLinkFor(`c:${C}`)).toEqual({ ok: false, error: "admin.unpaid.fu.errors.noResume" });
    s.target = { ...TARGET };
    s.admin = null;
    expect(await resumeLinkFor(`c:${C}`)).toEqual({ ok: false });
    expect(s.audits).toEqual([]);
  });
});
