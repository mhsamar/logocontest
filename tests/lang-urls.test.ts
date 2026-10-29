import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pickLocale } from "@/lib/i18n/config";
import { langOf, localizedPath, seoAlternates, switchHref } from "@/lib/i18n/url";

/** Each language has its own address (owner, 2026-10-21): English plain, Bangla with ?lang=bn. */
describe("language addresses", () => {
  beforeEach(() => vi.stubEnv("SITE_URL", "https://logocontest.bd"));
  afterEach(() => vi.unstubAllEnvs());

  it("reads only en and bn from ?lang", () => {
    expect(langOf("?lang=bn")).toBe("bn");
    expect(langOf("lang=en&x=1")).toBe("en");
    expect(langOf("?lang=fr")).toBeNull();
    expect(langOf("")).toBeNull();
  });

  it("English is the plain address, Bangla adds ?lang=bn, other settings are kept", () => {
    expect(localizedPath("/contests", "en")).toBe("/contests");
    expect(localizedPath("/contests", "bn")).toBe("/contests?lang=bn");
    expect(localizedPath("/", "bn")).toBe("/?lang=bn");
    expect(localizedPath("/how-it-works?for=designers", "bn")).toBe("/how-it-works?for=designers&lang=bn");
    expect(localizedPath("/contests?lang=bn&status=open", "en")).toBe("/contests?status=open");
  });

  it("the switch links keep the page and its settings and always name the language", () => {
    expect(switchHref("/contests", "status=open", "bn")).toBe("/contests?status=open&lang=bn");
    expect(switchHref("/contests", "lang=bn", "en")).toBe("/contests?lang=en");
    expect(switchHref("", "", "bn")).toBe("/?lang=bn");
  });

  it("canonical follows the language shown; both versions and English as the default are listed", () => {
    expect(seoAlternates("/winners", "bn")).toEqual({
      canonical: "https://logocontest.bd/winners?lang=bn",
      languages: { en: "https://logocontest.bd/winners", bn: "https://logocontest.bd/winners?lang=bn", "x-default": "https://logocontest.bd/winners" },
    });
    expect(seoAlternates("/winners", "en").canonical).toBe("https://logocontest.bd/winners");
  });

  it("Bangla is the default from Bangladesh (owner, 2026-10-29); ?lang= and the visitor's own choice still win", () => {
    expect(pickLocale({ country: "BD" })).toBe("bn");
    expect(pickLocale({ country: "bd" })).toBe("bn");
    expect(pickLocale({ country: "US" })).toBe("en");
    expect(pickLocale({})).toBe("en");
    // Switched to English once: stays English in Bangladesh.
    expect(pickLocale({ cookie: "en", country: "BD" })).toBe("en");
    expect(pickLocale({ cookie: "bn", country: "US" })).toBe("bn");
    expect(pickLocale({ url: "en", cookie: "bn", country: "BD" })).toBe("en");
    expect(pickLocale({ url: "bn", country: "US" })).toBe("bn");
    expect(pickLocale({ url: "fr", cookie: "xx", country: "BD" })).toBe("bn");
  });
});
