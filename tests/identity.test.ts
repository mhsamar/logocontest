import { describe, expect, it } from "vitest";
import { normalizeEmail, parseLoginIdentifier } from "@/lib/auth/identity";

describe("login identifier (P-11: mobile number or email)", () => {
  it.each([
    ["01712345678", { kind: "mobile", mobile: "+8801712345678" }],
    ["০১৭১২-৩৪৫৬৭৮", { kind: "mobile", mobile: "+8801712345678" }],
    ["+8801912345678", { kind: "mobile", mobile: "+8801912345678" }],
    ["Rahim@Example.com ", { kind: "email", email: "rahim@example.com" }],
  ])("%s", (input, expected) => {
    expect(parseLoginIdentifier(input)).toEqual(expected);
  });

  // "rahim" is a username since 2026-10-15 (owner), so it isn't rejected any more (tests/usernames.test.ts).
  it.each(["", "0171234", "rahim@", "@example.com", "a@b"])("rejects %s", (input) => {
    expect(parseLoginIdentifier(input)).toBeNull();
  });

  it("normalises emails", () => {
    expect(normalizeEmail("  Shop@Domain.COM.bd ")).toBe("shop@domain.com.bd");
    expect(normalizeEmail("no spaces@x.com")).toBeNull();
  });
});
