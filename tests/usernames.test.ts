import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseLoginIdentifier } from "@/lib/auth/identity";
import { checkUsernameFormat } from "@/lib/designers/signup";
import { canChangeUsername, nextUsernameChange, USERNAME_CHANGE_DAYS, usernameCandidates } from "@/lib/profile/username-rules";

describe("usernames (owner, 2026-10-15)", () => {
  it("log in with a mobile number, an email or a username", () => {
    expect(parseLoginIdentifier("01712-345678")).toEqual({ kind: "mobile", mobile: "+8801712345678" });
    expect(parseLoginIdentifier("Anika@Example.com")).toEqual({ kind: "email", email: "anika@example.com" });
    expect(parseLoginIdentifier("Anika_Jaman")).toEqual({ kind: "username", username: "anika_jaman" });
    expect(parseLoginIdentifier("@nila_designs")).toEqual({ kind: "username", username: "nila_designs" });
    // Older client usernames had dashes.
    expect(parseLoginIdentifier("be-healthy-bd-2926d5")).toEqual({ kind: "username", username: "be-healthy-bd-2926d5" });
    expect(parseLoginIdentifier("12345")).toBeNull();
    expect(parseLoginIdentifier("a b")).toBeNull();
  });

  it("a client's username comes from their name, with a number when it is taken", () => {
    const c = usernameCandidates("Anika Jaman", "client", () => 0.5);
    expect(c[0]).toBe("anika_jaman");
    expect(c[1]).toBe("anika_jaman2");
    expect(c.every((u) => checkUsernameFormat(u).ok)).toBe(true);
    // A Bangla-only name, or one that is a reserved word, still gets a valid username.
    expect(usernameCandidates("আনিকা জামান", "client", () => 0.5)[0]).toBe("client_5500");
    expect(usernameCandidates("Admin", "designer", () => 0.5)[0]).toBe("designer_5500");
    // Long names stay within 20 characters, numbers included.
    expect(usernameCandidates("Mohammad Abdullah Al Mamun Chowdhury", "client").every((u) => u.length <= 20)).toBe(true);
  });

  it("a Pro designer can change it once every 60 days", () => {
    const now = new Date("2026-10-15T12:00:00Z");
    expect(USERNAME_CHANGE_DAYS).toBe(60);
    expect(canChangeUsername(null, now)).toBe(true);
    expect(nextUsernameChange(null)).toBeNull();
    const changed = new Date("2026-09-01T12:00:00Z");
    expect(nextUsernameChange(changed)?.toISOString()).toBe("2026-10-31T12:00:00.000Z");
    expect(canChangeUsername(changed, now)).toBe(false);
    expect(canChangeUsername(changed, new Date("2026-10-31T12:00:00Z"))).toBe(true);
  });

  it("migration 0063 keeps old usernames for old links", () => {
    const sql = readFileSync("supabase/migrations/0063_usernames.sql", "utf8");
    expect(sql).toContain("create table if not exists public.username_history");
    expect(sql).toContain("alter table public.username_history enable row level security");
    expect(sql).toContain("username_changed_at timestamptz");
  });
});
