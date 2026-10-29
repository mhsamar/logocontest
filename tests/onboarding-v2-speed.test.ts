import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Step 1 of onboarding v2 was slow (owner, 2026-10-29): the checks now run at once, the profile writes overlap the
 * sign-in, and the emails and the welcome push go after the reply. The same answers, in the same order, as before.
 */
const s = vi.hoisted(() => ({
  calls: [] as string[],
  after: [] as (() => unknown)[],
  rejected: null as null | { key: string },
  tooShort: null as null | { error: { key: string } },
  blocked: false,
  phone: null as null | { id: string },
  mail: null as null | { id: string; role: string },
  phoneThrows: false,
  signInError: null as null | { error: { key: string } },
  createdAt: new Date().toISOString(),
  mine: [false, true],
  viewingAs: false,
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Map([["user-agent", "test"]]), cookies: async () => ({ get: () => undefined }) }));
vi.mock("next/server", () => ({ after: (fn: () => unknown) => void s.after.push(fn) }));
vi.mock("@/lib/auth/email-check", () => ({ emailRejection: async () => (s.calls.push("emailRejection"), s.rejected) }));
vi.mock("@/lib/auth/contact-blocks", () => ({ contactBlocked: async () => (s.calls.push("contactBlocked"), s.blocked) }));
vi.mock("@/lib/auth/email-service", () => ({ sendVerificationEmail: async () => void s.calls.push("codeEmail") }));
vi.mock("@/lib/auth/services", () => ({ clientIp: async () => "1.2.3.4" }));
vi.mock("@/lib/auth/sign-in", () => ({
  findProfileByPhone: async () => {
    s.calls.push("findPhone");
    if (s.phoneThrows) throw new Error("db down");
    return s.phone;
  },
  findProfileByEmail: async () => (s.calls.push("findEmail"), s.mail),
  passwordError: async () => (s.calls.push("passwordError"), s.tooShort),
  signIn: async () => (s.calls.push("signIn"), s.signInError),
}));
vi.mock("@/lib/content/texts", () => ({ translatorFor: async () => (key: string) => key }));
vi.mock("@/lib/email/events", () => ({ emailWelcome: async () => void s.calls.push("welcomeEmail") }));
vi.mock("@/lib/i18n/server", () => ({ getLocale: async () => "bn", getI18n: async () => ({ locale: "bn", t: (k: string) => k }) }));
vi.mock("@/lib/notifications/switches", () => ({ noticeOn: async () => true }));
vi.mock("@/lib/profile/usernames", () => ({ assignUsername: async () => void s.calls.push("username") }));
vi.mock("@/lib/push", () => ({
  savePushSubscription: async (_u: string, _p: unknown, _ua: string | null, o: { takeOver?: boolean }) => (s.calls.push(`savePush:${o.takeOver}`), true),
  notifyUser: async () => (s.calls.push("welcomePush"), 1),
  pushIsMine: async () => s.mine.shift() ?? true,
  viewingAs: async () => s.viewingAs,
}));
vi.mock("@/lib/visitor-popup/source", () => ({ takeSignupSource: async () => null, saveSignupSource: async () => void s.calls.push("source") }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: { admin: { createUser: async () => (s.calls.push("createUser"), { data: { user: { id: "u1" } }, error: null }) } },
    from: () => ({
      update: () => ({ eq: async () => (s.calls.push("whatsapp"), { error: null }) }),
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { created_at: s.createdAt } }) }) }),
    }),
  }),
}));

const { createClientAccount } = await import("@/lib/contests/client-account");
const input = { name: "Rahim Uddin", mobile: "01712345678", country: "BD", email: "rahim@example.com", password: "secret123", push: { endpoint: "https://push.example/1" } };
const runAfter = async () => {
  for (const fn of s.after.splice(0)) await fn();
};

beforeEach(() => {
  Object.assign(s, { calls: [], after: [], rejected: null, tooShort: null, blocked: false, phone: null, mail: null, phoneThrows: false, signInError: null, createdAt: new Date().toISOString(), mine: [false, true], viewingAs: false });
});

describe("step 1: the checks before an account", () => {
  it("still answer in the old order: a bad email first, then the password, a block, then a taken number or email", async () => {
    Object.assign(s, { rejected: { key: "auth.errors.emailNoMail" }, tooShort: { error: { key: "auth.errors.passwordShort" } }, blocked: true, phone: { id: "x" } });
    expect(await createClientAccount(input, "")).toMatchObject({ ok: false, error: { key: "auth.errors.emailNoMail" } });
    s.rejected = null;
    expect(await createClientAccount(input, "")).toMatchObject({ ok: false, error: { key: "auth.errors.passwordShort" } });
    s.tooShort = null;
    expect(await createClientAccount(input, "")).toMatchObject({ ok: false, error: { key: "wizard.errors.blocked" } });
    s.blocked = false;
    s.mail = { id: "y", role: "client" };
    expect(await createClientAccount(input, "")).toMatchObject({ ok: false, error: { key: "auth.errors.phoneTaken" } });
    s.phone = null;
    expect(await createClientAccount(input, "")).toMatchObject({ ok: false, error: { key: "wizard.errors.emailTaken" } });
    expect(s.calls).not.toContain("createUser");
  });

  it("a failed lookup only matters once the earlier checks passed, as before", async () => {
    Object.assign(s, { rejected: { key: "auth.errors.emailNoMail" }, phoneThrows: true });
    expect(await createClientAccount(input, "")).toMatchObject({ ok: false, error: { key: "auth.errors.emailNoMail" } });
    s.rejected = null;
    await expect(createClientAccount(input, "")).rejects.toThrow("db down");
    expect(s.calls).not.toContain("createUser");
  });
});

describe("step 1: after the account is made", () => {
  it("signs in with the profile writes, then answers; the code email, welcome push and welcome email go after, in that order", async () => {
    expect(await createClientAccount(input, "")).toEqual({ ok: true, userId: "u1" });
    expect(s.calls).toEqual(expect.arrayContaining(["createUser", "whatsapp", "username", "signIn", "savePush:false"]));
    expect(s.calls).not.toContain("codeEmail");
    expect(s.calls).not.toContain("welcomeEmail");
    await runAfter();
    const later = s.calls.filter((c) => ["codeEmail", "welcomePush", "welcomeEmail"].includes(c));
    expect(later).toEqual(["codeEmail", "welcomePush", "welcomeEmail"]);
  });

  it("a sign-in that throws still lets the profile writes finish first", async () => {
    const mod = await import("@/lib/auth/sign-in");
    const spy = vi.spyOn(mod, "signIn").mockImplementationOnce(async () => {
      s.calls.push("signIn");
      throw new Error("login_attempts down");
    });
    await expect(createClientAccount(input, "")).rejects.toThrow("login_attempts down");
    expect(s.calls).toEqual(expect.arrayContaining(["whatsapp", "username", "signIn"]));
    expect(s.after).toHaveLength(0);
    spy.mockRestore();
  });

  it("a failed sign-in answers with its error and sends nothing", async () => {
    s.signInError = { error: { key: "auth.errors.generic" } };
    expect(await createClientAccount(input, "")).toMatchObject({ ok: false, error: { key: "auth.errors.generic" } });
    expect(s.after).toHaveLength(0);
  });
});

describe("step 1: the browser side", () => {
  const read = async (p: string) => (await import("node:fs")).readFileSync(p, "utf8");

  it("asks for notifications on the click but makes the account without waiting for the answer", async () => {
    const step = await read("src/components/wizard-v2/step-account.tsx");
    expect(step).toContain("const push = (pushRef.current ??= actions.push());");
    expect(step).not.toContain("await actions.push()");
    expect(step).not.toContain("actions.lead(");
    // The answer is waited for before step 2's page load (longer while the question is open), and only a new account's
    // browser is saved, also with a time limit.
    expect(step).toContain("const sub = await within(push, asked ? PROMPT_WAIT_MS : PUSH_WAIT_MS);");
    expect(step).toContain("if (res.created && sub) await within(actions.savePush({ push: sub }).catch(() => undefined), SAVE_WAIT_MS);");
  });

  it("the team's lead is saved by the account step after its reply, before any check can refuse the sign-up", async () => {
    const actions = await read("src/lib/onboarding/v2-actions.ts");
    const body = actions.slice(actions.indexOf("export async function v2Account("), actions.indexOf("export async function v2SavePush("));
    expect(body.indexOf("after(saveWizardLead(lead)")).toBeGreaterThan(-1);
    expect(body.indexOf("after(saveWizardLead(lead)")).toBeLessThan(body.indexOf("wizardV2.errors.agree"));
    expect(await read("src/components/wizard-v2/wizard-v2.tsx")).toContain('account: (input) => v2Account({ ...input, visitId: wizardVisitId("v2") })');
  });

  it("the push action is only for a new client's own browser, never taken from another account, never while an admin looks", async () => {
    const actions = await read("src/lib/onboarding/v2-actions.ts");
    const body = actions.slice(actions.indexOf("export async function v2SavePush("));
    expect(body).toContain("await viewingAs(user.id)");
    expect(body).toContain("NEW_ACCOUNT_MS");
    // One welcome push per account: none once the account has any browser saved.
    expect(body).toContain('.from("push_subscriptions").select("id", { count: "exact", head: true }).eq("user_id", user.id)');
    expect(body).toContain("{ takeOver: false }");
  });
});
