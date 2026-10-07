import { beforeEach, describe, expect, it } from "vitest";
import { OtpService, type OtpConfig, type OtpRecord, type OtpRepository } from "@/lib/auth/otp-service";

class MemoryOtpRepo implements OtpRepository {
  rows: OtpRecord[] = [];
  constructor(private clock: () => Date) {}
  async latest(phone: string, purpose: string) {
    return [...this.rows].reverse().find((r) => r.phone === phone && r.purpose === purpose) ?? null;
  }
  async findById(id: string) {
    return this.rows.find((r) => r.id === id) ?? null;
  }
  async countSince(f: { phone?: string; ip?: string }, since: Date) {
    return this.rows.filter((r) => r.createdAt >= since && (!f.phone || r.phone === f.phone) && (!f.ip || r.ip === f.ip)).length;
  }
  async create(r: Parameters<OtpRepository["create"]>[0]) {
    const row: OtpRecord = { ...r, id: `otp-${this.rows.length + 1}`, attempts: 0, verifiedAt: null, ticketHash: null, consumedAt: null, createdAt: this.clock() };
    this.rows.push(row);
    return row;
  }
  async incrementAttempts(id: string) {
    const row = (await this.findById(id))!;
    row.attempts += 1;
    return row.attempts;
  }
  async markVerified(id: string, ticketHash: string, at: Date) {
    Object.assign((await this.findById(id))!, { ticketHash, verifiedAt: at });
  }
  async markConsumed(id: string, at: Date) {
    const row = (await this.findById(id))!;
    if (row.consumedAt) return false;
    row.consumedAt = at;
    return true;
  }
}

const CONFIG: OtpConfig = {
  length: 6,
  ttlMinutes: 5,
  resendCooldownSeconds: 60,
  maxPerPhonePerHour: 3,
  maxPerIpPerHour: 5,
  maxVerifyAttempts: 3,
  ticketTtlMinutes: 15,
};

const PHONE = "+8801712345678";

describe("OtpService", () => {
  let now: Date;
  let repo: MemoryOtpRepo;
  let sent: { to: string; message: string }[];
  let nextCode: string;
  let service: OtpService;

  const advance = (seconds: number) => {
    now = new Date(now.getTime() + seconds * 1000);
  };
  const request = (phone = PHONE, ip: string | null = "1.1.1.1") =>
    service.request({ phone, purpose: "register", ip, message: (code, minutes) => `code ${code} ${minutes}m` });

  beforeEach(() => {
    now = new Date("2026-10-07T10:00:00Z");
    repo = new MemoryOtpRepo(() => now);
    sent = [];
    nextCode = "123456";
    service = new OtpService({
      repo,
      sms: { send: async (to, message) => void sent.push({ to, message }) },
      config: async () => CONFIG,
      secret: "test-secret",
      now: () => now,
      generateCode: () => nextCode,
    });
  });

  it("sends a code by SMS and never stores it in plain text", async () => {
    const result = await request();
    expect(result).toMatchObject({ ok: true, resendAfterSeconds: 60, codeLength: 6 });
    expect(sent).toEqual([{ to: PHONE, message: "code 123456 5m" }]);
    expect(repo.rows[0].codeHash).not.toContain("123456");
  });

  it("enforces the resend cooldown", async () => {
    await request();
    advance(30);
    expect(await request()).toMatchObject({ ok: false, error: "cooldown", retryAfterSeconds: 30 });
    advance(30);
    expect(await request()).toMatchObject({ ok: true });
    expect(sent).toHaveLength(2);
  });

  it("limits codes per phone per hour", async () => {
    for (let i = 0; i < 3; i++) {
      expect(await request()).toMatchObject({ ok: true });
      advance(61);
    }
    expect(await request()).toMatchObject({ ok: false, error: "phone_limit" });
    advance(3600);
    expect(await request()).toMatchObject({ ok: true });
  });

  it("limits codes per IP per hour across numbers", async () => {
    for (let i = 0; i < 5; i++) expect(await request(`+88017123456${10 + i}`)).toMatchObject({ ok: true });
    expect(await request("+8801812345678")).toMatchObject({ ok: false, error: "ip_limit" });
    expect(await request("+8801812345678", "2.2.2.2")).toMatchObject({ ok: true });
  });

  it("verifies the right code and returns a ticket", async () => {
    await request();
    const result = await service.verify({ phone: PHONE, purpose: "register", code: "123456" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(await service.checkTicket(result.ticket, "register")).toMatchObject({ ok: true, phone: PHONE });
  });

  it("counts wrong codes and locks after the maximum", async () => {
    await request();
    expect(await service.verify({ phone: PHONE, purpose: "register", code: "000000" })).toMatchObject({ ok: false, error: "invalid", attemptsLeft: 2 });
    expect(await service.verify({ phone: PHONE, purpose: "register", code: "000000" })).toMatchObject({ ok: false, error: "invalid", attemptsLeft: 1 });
    expect(await service.verify({ phone: PHONE, purpose: "register", code: "000000" })).toMatchObject({ ok: false, error: "too_many_attempts" });
    // Even the right code is refused now.
    expect(await service.verify({ phone: PHONE, purpose: "register", code: "123456" })).toMatchObject({ ok: false, error: "too_many_attempts" });
  });

  it("rejects expired codes", async () => {
    await request();
    advance(5 * 60);
    expect(await service.verify({ phone: PHONE, purpose: "register", code: "123456" })).toMatchObject({ ok: false, error: "expired" });
  });

  it("only accepts the latest code", async () => {
    await request();
    advance(61);
    nextCode = "654321";
    await request();
    expect(await service.verify({ phone: PHONE, purpose: "register", code: "123456" })).toMatchObject({ ok: false, error: "invalid" });
    expect(await service.verify({ phone: PHONE, purpose: "register", code: "654321" })).toMatchObject({ ok: true });
  });

  it("does not let a code be verified twice", async () => {
    await request();
    await service.verify({ phone: PHONE, purpose: "register", code: "123456" });
    expect(await service.verify({ phone: PHONE, purpose: "register", code: "123456" })).toMatchObject({ ok: false, error: "no_code" });
  });

  it("asks for a code first when none was sent", async () => {
    expect(await service.verify({ phone: PHONE, purpose: "register", code: "123456" })).toMatchObject({ ok: false, error: "no_code" });
  });

  it("keeps codes for different purposes apart", async () => {
    await request();
    expect(await service.verify({ phone: PHONE, purpose: "reset", code: "123456" })).toMatchObject({ ok: false, error: "no_code" });
  });

  describe("tickets", () => {
    let ticket: string;
    beforeEach(async () => {
      await request();
      const r = await service.verify({ phone: PHONE, purpose: "register", code: "123456" });
      if (!r.ok) throw new Error("setup failed");
      ticket = r.ticket;
    });

    it("are single use", async () => {
      const check = await service.checkTicket(ticket, "register");
      if (!check.ok) throw new Error("expected ok");
      expect(await service.consumeTicket(check.otpId)).toBe(true);
      expect(await service.consumeTicket(check.otpId)).toBe(false);
      expect(await service.checkTicket(ticket, "register")).toEqual({ ok: false });
    });

    it("expire", async () => {
      advance(15 * 60 + 1);
      expect(await service.checkTicket(ticket, "register")).toEqual({ ok: false });
    });

    it("are bound to their purpose", async () => {
      expect(await service.checkTicket(ticket, "reset")).toEqual({ ok: false });
    });

    it("cannot be forged", async () => {
      const [id] = ticket.split(".");
      expect(await service.checkTicket(`${id}.forged`, "register")).toEqual({ ok: false });
      expect(await service.checkTicket("garbage", "register")).toEqual({ ok: false });
      expect(await service.checkTicket(undefined, "register")).toEqual({ ok: false });
    });
  });
});
