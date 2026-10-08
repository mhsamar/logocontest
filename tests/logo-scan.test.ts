import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { GoogleLogoScanner, LogLogoScanner } = await import("@/lib/moderation/logo-scan");

const reply = (body: unknown, ok = true) => vi.fn(async () => ({ ok, status: ok ? 200 : 500, json: async () => body })) as unknown as typeof fetch;

describe("Logo Scan (owner, 2026-10-08)", () => {
  it("the dev driver searches nothing and says which driver ran", async () => {
    const r = await new LogLogoScanner().scan(new Uint8Array([1, 2, 3]));
    expect(r).toEqual({ driver: "log", full: [], partial: [], similar: [], pages: [] });
  });

  it("reads Vision web detection into matches and pages", async () => {
    const fetcher = reply({
      responses: [
        {
          webDetection: {
            fullMatchingImages: [{ url: "https://a.example/logo.png" }, { url: "javascript:alert(1)" }],
            partialMatchingImages: [{ url: "https://b.example/x.jpg" }],
            visuallySimilarImages: [{ url: "https://c.example/y.jpg" }],
            pagesWithMatchingImages: [{ url: "https://shop.example/p", pageTitle: "<b>Shop</b> logo" }],
          },
        },
      ],
    });
    const r = await new GoogleLogoScanner("key", fetcher).scan(new Uint8Array([1]));
    expect(r.driver).toBe("google");
    expect(r.full).toEqual([{ url: "https://a.example/logo.png" }]);
    expect(r.partial).toHaveLength(1);
    expect(r.similar).toHaveLength(1);
    expect(r.pages).toEqual([{ url: "https://shop.example/p", title: "Shop logo" }]);
  });

  it("throws when the API fails, so the client sees an error instead of a false all-clear", async () => {
    await expect(new GoogleLogoScanner("key", reply({}, false)).scan(new Uint8Array([1]))).rejects.toThrow();
  });
});
