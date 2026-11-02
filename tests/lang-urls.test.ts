import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pickLocale } from "@/lib/i18n/config";
import { banglaOnlyAlternates, isLocalizedPath, langOf, localizedPath, seoAlternates, splitLangPath, switchHref } from "@/lib/i18n/url";

/** Each language has its own address (owner, 2026-11-03): Bangla plain, English under /en. */
describe("language addresses", () => {
  beforeEach(() => vi.stubEnv("SITE_URL", "https://logocontest.bd"));
  afterEach(() => vi.unstubAllEnvs());

  it("reads only en and bn from ?lang", () => {
    expect(langOf("?lang=bn")).toBe("bn");
    expect(langOf("lang=en&x=1")).toBe("en");
    expect(langOf("?lang=fr")).toBeNull();
    expect(langOf("")).toBeNull();
  });

  it("a public page is Bangla at the plain address and English under /en; other settings are kept", () => {
    expect(localizedPath("/contests", "bn")).toBe("/contests");
    expect(localizedPath("/contests", "en")).toBe("/en/contests");
    expect(localizedPath("/", "bn")).toBe("/");
    expect(localizedPath("/", "en")).toBe("/en");
    expect(localizedPath("/en/how-it-works", "bn")).toBe("/how-it-works");
    expect(localizedPath("/how-it-works?for=designers", "en")).toBe("/en/how-it-works?for=designers");
    expect(localizedPath("/contests?lang=bn&status=open", "en")).toBe("/en/contests?status=open");
    expect(localizedPath("/contest/abc/design/3", "en")).toBe("/en/contest/abc/design/3");
  });

  it("a page outside the public site has one address; Bangla adds ?lang=bn to set the language", () => {
    expect(localizedPath("/client/contests/x", "bn")).toBe("/client/contests/x?lang=bn");
    expect(localizedPath("/start-v2/brief?c=1", "en")).toBe("/start-v2/brief?c=1");
    expect(localizedPath("/leaderboard", "bn")).toBe("/leaderboard");
    expect(isLocalizedPath("/login")).toBe(false);
    expect(isLocalizedPath("/guides/a-guide")).toBe(true);
  });

  it("splits the /en prefix off", () => {
    expect(splitLangPath("/en")).toEqual({ locale: "en", path: "/" });
    expect(splitLangPath("/en/winners")).toEqual({ locale: "en", path: "/winners" });
    expect(splitLangPath("/winners")).toEqual({ locale: null, path: "/winners" });
    expect(splitLangPath("/english")).toEqual({ locale: null, path: "/english" });
  });

  it("the switch links keep the page and its settings", () => {
    expect(switchHref("/contests", "status=open", "en")).toBe("/en/contests?status=open");
    expect(switchHref("/en/contests", "status=open&lang=en", "bn")).toBe("/contests?status=open");
    expect(switchHref("", "", "en")).toBe("/en");
    expect(switchHref("/login", "next=%2F", "bn")).toBe("/login?next=%2F&lang=bn");
  });

  it("canonical is the page's own clean address; bn, en and Bangla as the default are listed", () => {
    expect(seoAlternates("/winners", "bn")).toEqual({
      canonical: "https://logocontest.bd/winners",
      languages: { bn: "https://logocontest.bd/winners", en: "https://logocontest.bd/en/winners", "x-default": "https://logocontest.bd/winners" },
    });
    expect(seoAlternates("/winners", "en").canonical).toBe("https://logocontest.bd/en/winners");
    expect(banglaOnlyAlternates("/leaderboard").languages).not.toHaveProperty("en");
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
