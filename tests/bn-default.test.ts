import { beforeEach, describe, expect, it, vi } from "vitest";

/** Bangla is the default for visitors from Bangladesh (owner, 2026-10-29); they can still switch to English. */
const s = vi.hoisted(() => ({ headers: new Map<string, string>(), cookies: new Map<string, string>() }));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: async () => ({ get: (n: string) => s.headers.get(n) ?? null }),
  cookies: async () => ({ get: (n: string) => (s.cookies.has(n) ? { name: n, value: s.cookies.get(n) } : undefined) }),
}));
vi.mock("@/lib/content/texts", () => ({ translatorFor: async () => (key: string) => key }));
vi.mock("@/lib/settings", () => ({ getSettings: async () => ({ "payments.usd_rate": 122, "payments.usd_markup_percent": 0 }) }));

const { getLocale } = await import("@/lib/i18n/server");
const { getCurrency } = await import("@/lib/currency/server");

describe("Bangla default from Bangladesh", () => {
  beforeEach(() => {
    s.headers.clear();
    s.cookies.clear();
  });

  it("a first visit from Bangladesh is in Bangla and taka; from abroad English and dollars", async () => {
    s.headers.set("x-vercel-ip-country", "BD");
    expect(await getLocale()).toBe("bn");
    expect((await getCurrency()).code).toBe("BDT");
    s.headers.set("x-vercel-ip-country", "GB");
    expect(await getLocale()).toBe("en");
    expect((await getCurrency()).code).toBe("USD");
  });

  it("a visitor who switched to English stays in English in Bangladesh", async () => {
    s.headers.set("x-vercel-ip-country", "BD");
    s.cookies.set("locale", "en");
    expect(await getLocale()).toBe("en");
    expect((await getCurrency()).code).toBe("BDT");
  });

  it("the address's ?lang= still wins over the country and the cookie", async () => {
    s.headers.set("x-vercel-ip-country", "BD");
    s.headers.set("x-lc-locale", "en");
    s.cookies.set("locale", "bn");
    expect(await getLocale()).toBe("en");
  });
});
