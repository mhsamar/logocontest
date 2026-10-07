import { beforeEach, describe, expect, it } from "vitest";
import { EmailVerificationService, type VerificationRecord, type VerificationRepository } from "@/lib/auth/email-verification";

class MemoryRepo implements VerificationRepository {
  rows: VerificationRecord[] = [];
  verified = new Map<string, { email: string; at: Date }>();
  constructor(private readonly clock: () => Date) {}
  async create(r: Pick<VerificationRecord, "userId" | "email" | "codeHash" | "expiresAt">) {
    this.rows.push({ ...r, id: String(this.rows.length + 1), attempts: 0, usedAt: null, createdAt: this.clock() });
  }
  async latest(userId: string) {
    return this.rows.filter((r) => r.userId === userId).at(-1) ?? null;
  }
  async incrementAttempts(id: string) {
    const r = this.rows.find((x) => x.id === id)!;
    return ++r.attempts;
  }
  async markUsed(id: string, at: Date) {
    const r = this.rows.find((x) => x.id === id)!;
    if (r.usedAt) return false;
    r.usedAt = at;
    return true;
  }
  async markEmailVerified(userId: string, email: string, at: Date) {
    this.verified.set(userId, { email, at });
  }
}

const CONFIG = { length: 6, ttlMinutes: 30, maxAttempts: 5, resendSeconds: 60 };

describe("EmailVerificationService (6-digit confirm-your-email codes)", () => {
  let now: Date;
  let repo: MemoryRepo;
  let codes: string[];
  let service: EmailVerificationService;

  const make = (secret = "s") =>
    new EmailVerificationService({ repo, secret, config: async () => CONFIG, now: () => now, generateCode: () => codes.shift() ?? "999999" });

  beforeEach(() => {
    now = new Date("2026-10-07T10:00:00Z");
    repo = new MemoryRepo(() => now);
    codes = ["123456", "654321"];
    service = make();
  });

  const later = (seconds: number) => {
    now = new Date(now.getTime() + seconds * 1000);
  };

  it("confirms the email once and stores only a hash", async () => {
    const issued = await service.issue("u1", "a@b.com");
    expect(issued).toEqual({ ok: true, code: "123456", ttlMinutes: 30 });
    expect(repo.rows[0].codeHash).not.toContain("123456");
    expect(await service.verify("u1", " 123 456 ")).toEqual({ ok: true });
    expect(repo.verified.get("u1")).toMatchObject({ email: "a@b.com" });
    expect(await service.verify("u1", "123456")).toEqual({ ok: false, error: "no_code" });
  });

  it("counts wrong tries and locks the code after the limit", async () => {
    await service.issue("u1", "a@b.com");
    expect(await service.verify("u1", "000000")).toEqual({ ok: false, error: "invalid", attemptsLeft: 4 });
    for (let i = 0; i < 3; i++) await service.verify("u1", "000000");
    expect(await service.verify("u1", "000000")).toEqual({ ok: false, error: "too_many_attempts" });
    expect(await service.verify("u1", "123456")).toEqual({ ok: false, error: "too_many_attempts" });
    expect(repo.verified.size).toBe(0);
  });

  it("expires after the configured minutes", async () => {
    await service.issue("u1", "a@b.com");
    later(30 * 60);
    expect(await service.verify("u1", "123456")).toEqual({ ok: false, error: "expired" });
  });

  it("waits before sending a new code, and the new code replaces the old one", async () => {
    await service.issue("u1", "a@b.com");
    later(20);
    expect(await service.issue("u1", "a@b.com")).toEqual({ ok: false, error: "cooldown", retryAfterSeconds: 40 });
    later(40);
    expect(await service.issue("u1", "a@b.com")).toMatchObject({ ok: true, code: "654321" });
    expect(await service.verify("u1", "123456")).toMatchObject({ ok: false, error: "invalid" });
    expect(await service.verify("u1", "654321")).toEqual({ ok: true });
  });

  it("a code is tied to the user and the secret", async () => {
    await service.issue("u1", "a@b.com");
    expect(await service.verify("u2", "123456")).toEqual({ ok: false, error: "no_code" });
    expect(await make("other").verify("u1", "123456")).toMatchObject({ ok: false, error: "invalid" });
  });
});
