import { beforeEach, describe, expect, it } from "vitest";
import { LoginGuard, type LoginAttemptRepository } from "@/lib/auth/login-guard";

describe("LoginGuard", () => {
  let now: Date;
  let attempts: { phone: string; ip: string | null; succeeded: boolean; at: Date }[];
  let guard: LoginGuard;

  beforeEach(() => {
    now = new Date("2026-10-07T10:00:00Z");
    attempts = [];
    const repo: LoginAttemptRepository = {
      async countFailuresSince(f, since) {
        return attempts.filter((a) => !a.succeeded && a.at >= since && (!f.phone || a.phone === f.phone) && (!f.ip || a.ip === f.ip)).length;
      },
      async record(a) {
        attempts.push({ ...a, at: now });
      },
    };
    guard = new LoginGuard({ repo, config: async () => ({ maxFailuresPerPhone: 3, maxFailuresPerIp: 5, windowMinutes: 15 }), now: () => now });
  });

  it("locks a number after too many failures, then unlocks after the window", async () => {
    for (let i = 0; i < 3; i++) await guard.record("+8801712345678", "1.1.1.1", false);
    expect(await guard.check("+8801712345678", "9.9.9.9")).toEqual({ allowed: false, retryAfterMinutes: 15 });
    expect(await guard.check("+8801812345678", "9.9.9.9")).toEqual({ allowed: true });
    now = new Date(now.getTime() + 15 * 60_000 + 1);
    expect(await guard.check("+8801712345678", "9.9.9.9")).toEqual({ allowed: true });
  });

  it("locks an IP that tries many numbers", async () => {
    for (let i = 0; i < 5; i++) await guard.record(`+88017123456${10 + i}`, "1.1.1.1", false);
    expect(await guard.check("+8801999999999", "1.1.1.1")).toMatchObject({ allowed: false });
    expect(await guard.check("+8801999999999", "2.2.2.2")).toEqual({ allowed: true });
  });

  it("does not count successful logins", async () => {
    for (let i = 0; i < 5; i++) await guard.record("+8801712345678", "1.1.1.1", true);
    expect(await guard.check("+8801712345678", "1.1.1.1")).toEqual({ allowed: true });
  });
});
