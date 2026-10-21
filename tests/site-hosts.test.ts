import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { backupOrigin, canonicalHostPattern, canonicalUrl, isOwnUrl, originForHost, ownOrigins, printedOrigin, strictOrigin } from "@/lib/site-hosts";
import { bodyHtml } from "@/lib/email/render";

/** The backup address (owner, 2026-10-21): logocontestbd.com answers for logocontest.bd while BTCL's .bd is down. */
describe("site hosts", () => {
  beforeEach(() => {
    vi.stubEnv("SITE_URL", "https://logocontest.bd");
    vi.stubEnv("BACKUP_SITE_URL", "https://logocontestbd.com");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("takes the backup address only when it is exactly logocontestbd.com", () => {
    expect(backupOrigin()).toBe("https://logocontestbd.com");
    for (const bad of ["http://logocontestbd.com", "https://logocontestbd.com@evil.example", "https://logocontestbd.com:8443", "https://logocontestbd.com/x", "https://logocontestbd.com/?a=1", "https://evil.example", "logocontestbd.com", ""]) {
      vi.stubEnv("BACKUP_SITE_URL", bad);
      expect(backupOrigin(), bad).toBeNull();
    }
    expect(strictOrigin("https://logocontestbd.com/", "logocontestbd.com")).toBe("https://logocontestbd.com");
  });

  it("knows our own hosts and treats everything else as unknown", () => {
    expect(originForHost("logocontest.bd", false)).toBe("https://logocontest.bd");
    expect(originForHost("www.logocontest.bd", false)).toBe("https://logocontest.bd");
    expect(originForHost("LOGOCONTESTBD.COM", false)).toBe("https://logocontestbd.com");
    expect(originForHost("www.logocontestbd.com", false)).toBe("https://logocontestbd.com");
    expect(originForHost("logocontest.vercel.app", false)).toBe("https://logocontest.vercel.app");
    expect(originForHost("logocontest-git-x.vercel.app", false)).toBeNull();
    expect(originForHost("evil.example", false)).toBeNull();
    expect(originForHost("localhost:3100", false)).toBeNull();
    expect(originForHost("localhost:3100", true)).toBe("http://localhost:3100");
    expect(originForHost("192.168.1.5:3100", true)).toBe("http://192.168.1.5:3100");
    expect(originForHost("abc.trycloudflare.com", true, "https")).toBe("https://abc.trycloudflare.com");
    expect(originForHost("evil.example/x", true)).toBeNull();
    vi.stubEnv("BACKUP_SITE_URL", "");
    expect(originForHost("logocontestbd.com", false)).toBeNull();
  });

  it("matches own links by exact address, so look-alikes are not ours", () => {
    expect(ownOrigins()).toEqual(["https://logocontest.bd", "https://logocontestbd.com", "https://logocontest.vercel.app"]);
    expect(isOwnUrl("https://logocontest.bd/contest/x")).toBe(true);
    expect(isOwnUrl("https://logocontestbd.com/c/LC-0012")).toBe(true);
    expect(isOwnUrl("https://logocontest.bd.evil.example/x")).toBe(false);
    expect(isOwnUrl("https://evil.example/https://logocontest.bd")).toBe(false);
    expect(isOwnUrl("not a url")).toBe(false);
    const html = bodyHtml("Open https://logocontestbd.com/x or https://logocontest.bd.evil.example/x", "https://logocontest.bd");
    expect(html).toContain('<a href="https://logocontestbd.com/x"');
    expect(html).not.toContain('<a href="https://logocontest.bd.evil.example');
  });

  it("keeps canonical links, printed links and the noindex rule on logocontest.bd", () => {
    expect(canonicalUrl("/contest/x")).toBe("https://logocontest.bd/contest/x");
    expect(canonicalUrl("winners")).toBe("https://logocontest.bd/winners");
    expect(printedOrigin("https://logocontestbd.com")).toBe("https://logocontest.bd");
    expect(canonicalHostPattern()).toBe("^logocontest\\.bd$");
    expect(canonicalHostPattern("https://WWW.logocontest.bd/")).toBe("^logocontest\\.bd$");
    const re = new RegExp(canonicalHostPattern());
    expect(re.test("logocontest.bd")).toBe(true);
    expect(re.test("logocontestbd.com")).toBe(false);
    expect(re.test("logocontest.vercel.app")).toBe(false);
  });
});
