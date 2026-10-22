import { describe, expect, it } from "vitest";
import { isRealEmail, profileStatus, reminderPath, remindedRecently, remindersFor, REMINDER_KINDS, REMINDER_TYPE } from "@/lib/admin/reminder-rules";
import { NOTICE_ROWS } from "@/lib/notifications/admin-catalog";
import { USER_SHOWS, parseUsersQuery } from "@/lib/admin/users-query";

const designer = { role: "designer" as const, email: "d@x.com", email_verified_at: null, avatar_path: null, bio: "", skills: [], tools: [], experience_years: null, languages: [] };

describe("Admin › Users profile reminders (owner, 2026-10-22)", () => {
  it("a new designer needs all three reminders; a complete one none", () => {
    const s = profileStatus(designer)!;
    expect(s).toMatchObject({ emailOk: false, hasPhoto: false });
    expect(s.missing).toEqual(["bio", "skills", "tools", "experience", "languages"]);
    expect(remindersFor(s)).toEqual(["verify_email", "photo", "profile"]);
    const done = profileStatus({ ...designer, email_verified_at: "2026-10-01", avatar_path: "a.png", bio: "Hi", skills: ["Logo"], tools: ["Figma"], experience_years: 2, languages: ["bn"] })!;
    expect(done.percent).toBe(100);
    expect(remindersFor(done)).toEqual([]);
  });

  it("clients: email and photo only; staff: nothing", () => {
    const c = profileStatus({ role: "client", email: "c@x.com", email_verified_at: "2026-10-01", avatar_path: null })!;
    expect(c).toMatchObject({ emailOk: true, hasPhoto: false, percent: null, missing: [] });
    expect(remindersFor(c)).toEqual(["photo"]);
    expect(profileStatus({ role: "admin", email: "a@x.com", email_verified_at: null, avatar_path: null })).toBeNull();
    expect(remindersFor(null)).toEqual([]);
  });

  it("an old phone-only address can't be asked to verify", () => {
    expect(isRealEmail("8801712345678@phone.logocontest.bd")).toBe(false);
    expect(isRealEmail(null)).toBe(false);
    const s = profileStatus({ role: "client", email: "8801712345678@phone.logocontest.bd", email_verified_at: null, avatar_path: "a.png" })!;
    expect(s.emailOk).toBeNull();
    expect(remindersFor(s)).toEqual([]);
  });

  it("each reminder opens the right page for the role", () => {
    expect(reminderPath("verify_email", "client")).toBe("/verify-email");
    expect(reminderPath("photo", "client")).toBe("/client/settings#profile");
    expect(reminderPath("photo", "designer")).toBe("/dashboard/profile#profile");
    expect(reminderPath("profile", "designer", ["skills", "tools"])).toBe("/dashboard/profile#portfolio");
    expect(reminderPath("profile", "designer", ["bio", "skills"])).toBe("/dashboard/profile#profile");
  });

  it("once a day per kind", () => {
    const now = new Date("2026-10-22T12:00:00Z");
    expect(remindedRecently("2026-10-22T00:00:00Z", now)).toBe(true);
    expect(remindedRecently("2026-10-21T11:59:00Z", now)).toBe(false);
    expect(remindedRecently(undefined, now)).toBe(false);
  });

  it("every reminder is a notice the owner can switch, and the list can filter for them", () => {
    const row = NOTICE_ROWS.find((r) => r.id === "profile_reminders");
    expect(row?.channels).toEqual(["bell", "push", "email"]);
    for (const k of REMINDER_KINDS) expect(row?.types).toContain(REMINDER_TYPE[k]);
    expect(USER_SHOWS).toEqual(expect.arrayContaining(["unverified", "nophoto", "incomplete"]));
    expect(parseUsersQuery({ show: "incomplete,unverified" }).show).toEqual(["unverified", "incomplete"]);
  });
});
