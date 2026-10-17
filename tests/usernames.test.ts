import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseLoginIdentifier } from "@/lib/auth/identity";
import { checkUsernameFormat } from "@/lib/designers/signup";
import { memberUsername, memberUsernameAlt, usernameBase, usernameCandidates } from "@/lib/profile/username-rules";

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

  it("a username is the first name + the account number (owner, 2026-10-17)", () => {
    expect(memberUsername(usernameBase("Anika Jaman", "client"), 10)).toBe("anika010");
    expect(memberUsername(usernameBase("Das", "designer"), 8)).toBe("das008");
    expect(memberUsername(usernameBase("Rafi", "designer"), 1)).toBe("rafi001");
    expect(memberUsername("anika", 1234)).toBe("anika1234");
    // Titles before the name are skipped.
    expect(usernameBase("Md. Asif Khan", "designer")).toBe("asif");
    expect(usernameBase("Mst Rokeya Begum", "client")).toBe("rokeya");
    expect(usernameBase("Dr. Kamal", "client")).toBe("kamal");
    expect(usernameBase("Md", "client")).toBe("md");
    // Accents go, digits at the end of the name go, long names are cut to 12 letters.
    expect(usernameBase("José", "client")).toBe("jose");
    expect(usernameBase("PixelsBD2", "client")).toBe("pixelsbd");
    expect(usernameBase("Abdurrahmanulhaque Chowdhury", "client")).toBe("abdurrahmanu");
    // A Bangla-only (or empty) name uses the group's name.
    expect(usernameBase("আনিকা জামান", "client")).toBe("client");
    expect(usernameBase("", "designer")).toBe("designer");
    // When a client and a designer would share one, the second gets its group's letter.
    expect(memberUsernameAlt("anika", 10, "designer")).toBe("anika010_d");
    // Every one is a valid username.
    for (const u of ["anika010", "das008", "client001", "abdurrahmanu1234", "anika010_d"]) expect(checkUsernameFormat(u).ok).toBe(true);
  });

  it("before migration 0065, names alone still give a valid username", () => {
    const c = usernameCandidates("Anika Jaman", "client", () => 0.5);
    expect(c[0]).toBe("anika_jaman");
    expect(c.every((u) => checkUsernameFormat(u).ok)).toBe(true);
    expect(usernameCandidates("আনিকা জামান", "client", () => 0.5)[0]).toBe("client_5500");
  });

  it("migration 0065 numbers each group in order, one at a time", () => {
    const sql = readFileSync("supabase/migrations/0065_member_numbers.sql", "utf8");
    expect(sql).toContain("add column if not exists member_no int");
    expect(sql).toContain("on public.profiles (role, member_no) where member_no is not null");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("coalesce(max(member_no), 0) + 1");
    expect(sql).toContain("revoke all on function public.assign_member_no(uuid) from public, anon, authenticated");
  });

  it("nobody can change their username any more, and designers don't pick one at sign-up", () => {
    const actions = readFileSync("src/lib/profile/actions.ts", "utf8");
    expect(actions).not.toContain("changeUsername");
    const signup = readFileSync("src/components/designers/signup-flow.tsx", "utf8");
    expect(signup).not.toContain("checkUsername");
    expect(signup).toContain("designerSignup.username.auto");
    const designer = readFileSync("src/lib/designers/actions.ts", "utf8");
    expect(designer).toContain('assignUsername(userId, name, "designer")');
    expect(readFileSync("src/lib/contests/actions.ts", "utf8")).toContain('assignUsername(created.data.user.id, personName, "client")');
  });

  it("migration 0063 keeps old usernames for old links", () => {
    const sql = readFileSync("supabase/migrations/0063_usernames.sql", "utf8");
    expect(sql).toContain("create table if not exists public.username_history");
    expect(sql).toContain("alter table public.username_history enable row level security");
    expect(sql).toContain("username_changed_at timestamptz");
  });
});
