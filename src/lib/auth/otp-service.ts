import { randomDigits, randomToken, safeEqualHex, sha256 } from "./crypto";
import type { SmsSender } from "@/lib/sms/types";

export type OtpPurpose = "register" | "reset";

export type OtpRecord = {
  id: string;
  phone: string;
  purpose: OtpPurpose;
  codeHash: string;
  attempts: number;
  ip: string | null;
  expiresAt: Date;
  verifiedAt: Date | null;
  ticketHash: string | null;
  consumedAt: Date | null;
  createdAt: Date;
};

export interface OtpRepository {
  latest(phone: string, purpose: OtpPurpose): Promise<OtpRecord | null>;
  findById(id: string): Promise<OtpRecord | null>;
  countSince(filter: { phone?: string; ip?: string }, since: Date): Promise<number>;
  create(record: Omit<OtpRecord, "id" | "attempts" | "verifiedAt" | "ticketHash" | "consumedAt" | "createdAt">): Promise<OtpRecord>;
  incrementAttempts(id: string): Promise<number>;
  markVerified(id: string, ticketHash: string, at: Date): Promise<void>;
  /** Returns false if it was already consumed (single use). */
  markConsumed(id: string, at: Date): Promise<boolean>;
}

export type OtpConfig = {
  length: number;
  ttlMinutes: number;
  resendCooldownSeconds: number;
  maxPerPhonePerHour: number;
  maxPerIpPerHour: number;
  maxVerifyAttempts: number;
  ticketTtlMinutes: number;
};

export type OtpRequestError = "cooldown" | "phone_limit" | "ip_limit";
export type OtpVerifyError = "no_code" | "expired" | "too_many_attempts" | "invalid";

type Fail<E> = { ok: false; error: E; retryAfterSeconds?: number; attemptsLeft?: number };

export class OtpService {
  private readonly now: () => Date;
  private readonly generateCode: (length: number) => string;

  constructor(
    private readonly deps: {
      repo: OtpRepository;
      sms: SmsSender;
      config: () => Promise<OtpConfig>;
      secret: string;
      now?: () => Date;
      generateCode?: (length: number) => string;
    },
  ) {
    this.now = deps.now ?? (() => new Date());
    this.generateCode = deps.generateCode ?? randomDigits;
  }

  private hashCode(phone: string, purpose: OtpPurpose, code: string) {
    return sha256(`${this.deps.secret}:otp:${phone}:${purpose}:${code}`);
  }

  private hashTicket(ticket: string) {
    return sha256(`${this.deps.secret}:ticket:${ticket}`);
  }

  async request(input: {
    phone: string;
    purpose: OtpPurpose;
    ip: string | null;
    message: (code: string, ttlMinutes: number) => string;
  }): Promise<{ ok: true; resendAfterSeconds: number; codeLength: number } | Fail<OtpRequestError>> {
    const cfg = await this.deps.config();
    const now = this.now();
    const { repo } = this.deps;

    const last = await repo.latest(input.phone, input.purpose);
    if (last) {
      const elapsed = (now.getTime() - last.createdAt.getTime()) / 1000;
      if (elapsed < cfg.resendCooldownSeconds) {
        return { ok: false, error: "cooldown", retryAfterSeconds: Math.ceil(cfg.resendCooldownSeconds - elapsed) };
      }
    }

    const hourAgo = new Date(now.getTime() - 3600_000);
    if ((await repo.countSince({ phone: input.phone }, hourAgo)) >= cfg.maxPerPhonePerHour) {
      return { ok: false, error: "phone_limit" };
    }
    if (input.ip && (await repo.countSince({ ip: input.ip }, hourAgo)) >= cfg.maxPerIpPerHour) {
      return { ok: false, error: "ip_limit" };
    }

    const code = this.generateCode(cfg.length);
    await repo.create({
      phone: input.phone,
      purpose: input.purpose,
      codeHash: this.hashCode(input.phone, input.purpose, code),
      ip: input.ip,
      expiresAt: new Date(now.getTime() + cfg.ttlMinutes * 60_000),
    });
    await this.deps.sms.send(input.phone, input.message(code, cfg.ttlMinutes));

    return { ok: true, resendAfterSeconds: cfg.resendCooldownSeconds, codeLength: cfg.length };
  }

  /** Checks a code. On success returns a one-time ticket that proves the number was verified. */
  async verify(input: { phone: string; purpose: OtpPurpose; code: string }): Promise<{ ok: true; ticket: string } | Fail<OtpVerifyError>> {
    const cfg = await this.deps.config();
    const now = this.now();
    const { repo } = this.deps;

    const otp = await repo.latest(input.phone, input.purpose);
    if (!otp || otp.verifiedAt || otp.consumedAt) return { ok: false, error: "no_code" };
    if (otp.expiresAt <= now) return { ok: false, error: "expired" };
    if (otp.attempts >= cfg.maxVerifyAttempts) return { ok: false, error: "too_many_attempts" };

    const given = this.hashCode(input.phone, input.purpose, input.code.trim());
    if (!safeEqualHex(given, otp.codeHash)) {
      const attempts = await repo.incrementAttempts(otp.id);
      const attemptsLeft = Math.max(0, cfg.maxVerifyAttempts - attempts);
      return attemptsLeft === 0
        ? { ok: false, error: "too_many_attempts" }
        : { ok: false, error: "invalid", attemptsLeft };
    }

    const secret = randomToken();
    await repo.markVerified(otp.id, this.hashTicket(secret), now);
    return { ok: true, ticket: `${otp.id}.${secret}` };
  }

  /** Validates a ticket without using it up. */
  async checkTicket(ticket: string | undefined, purpose: OtpPurpose): Promise<{ ok: true; otpId: string; phone: string } | { ok: false }> {
    if (!ticket) return { ok: false };
    const [id, secret] = ticket.split(".");
    if (!id || !secret) return { ok: false };

    const cfg = await this.deps.config();
    const otp = await this.deps.repo.findById(id).catch(() => null);
    if (!otp || otp.purpose !== purpose || !otp.verifiedAt || !otp.ticketHash || otp.consumedAt) {
      return { ok: false };
    }
    if (this.now().getTime() - otp.verifiedAt.getTime() > cfg.ticketTtlMinutes * 60_000) {
      return { ok: false };
    }
    if (!safeEqualHex(this.hashTicket(secret), otp.ticketHash)) return { ok: false };
    return { ok: true, otpId: otp.id, phone: otp.phone };
  }

  consumeTicket(otpId: string): Promise<boolean> {
    return this.deps.repo.markConsumed(otpId, this.now());
  }
}
