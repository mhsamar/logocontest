import { randomDigits, safeEqualHex, sha256 } from "./crypto";

export type VerificationRecord = {
  id: string;
  userId: string;
  email: string;
  codeHash: string;
  attempts: number;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
};

export interface VerificationRepository {
  create(r: Pick<VerificationRecord, "userId" | "email" | "codeHash" | "expiresAt">): Promise<void>;
  latest(userId: string): Promise<VerificationRecord | null>;
  incrementAttempts(id: string): Promise<number>;
  /** Returns false if it was already used (single use). */
  markUsed(id: string, at: Date): Promise<boolean>;
  markEmailVerified(userId: string, email: string, at: Date): Promise<void>;
}

export type EmailCodeConfig = { length: number; ttlMinutes: number; maxAttempts: number; resendSeconds: number };

export type EmailCodeError = "no_code" | "expired" | "too_many_attempts" | "invalid";

/** Confirm-your-email codes (BLUEPRINT §4, owner 2026-10-07). Only the code's hash is stored. */
export class EmailVerificationService {
  private readonly now: () => Date;
  private readonly generateCode: (length: number) => string;

  constructor(
    private readonly deps: {
      repo: VerificationRepository;
      secret: string;
      config: () => Promise<EmailCodeConfig>;
      now?: () => Date;
      generateCode?: (length: number) => string;
    },
  ) {
    this.now = deps.now ?? (() => new Date());
    this.generateCode = deps.generateCode ?? randomDigits;
  }

  private hash(userId: string, email: string, code: string) {
    return sha256(`${this.deps.secret}:verify-email:${userId}:${email.toLowerCase()}:${code}`);
  }

  /** Creates a code and returns it (to put in the email). */
  async issue(
    userId: string,
    email: string,
  ): Promise<{ ok: true; code: string; ttlMinutes: number } | { ok: false; error: "cooldown"; retryAfterSeconds: number }> {
    const cfg = await this.deps.config();
    const now = this.now();
    const last = await this.deps.repo.latest(userId);
    if (last && !last.usedAt) {
      const elapsed = (now.getTime() - last.createdAt.getTime()) / 1000;
      if (elapsed < cfg.resendSeconds) return { ok: false, error: "cooldown", retryAfterSeconds: Math.ceil(cfg.resendSeconds - elapsed) };
    }
    const code = this.generateCode(cfg.length);
    await this.deps.repo.create({
      userId,
      email,
      codeHash: this.hash(userId, email, code),
      expiresAt: new Date(now.getTime() + cfg.ttlMinutes * 60_000),
    });
    return { ok: true, code, ttlMinutes: cfg.ttlMinutes };
  }

  /** Checks the newest code for this user. Older codes stop working once a new one is sent. */
  async verify(userId: string, code: string): Promise<{ ok: true } | { ok: false; error: EmailCodeError; attemptsLeft?: number }> {
    const cfg = await this.deps.config();
    const now = this.now();
    const { repo } = this.deps;

    const record = await repo.latest(userId);
    if (!record || record.usedAt) return { ok: false, error: "no_code" };
    if (record.expiresAt <= now) return { ok: false, error: "expired" };
    if (record.attempts >= cfg.maxAttempts) return { ok: false, error: "too_many_attempts" };

    const given = this.hash(userId, record.email, code.replace(/\s/g, ""));
    if (!safeEqualHex(given, record.codeHash)) {
      const attempts = await repo.incrementAttempts(record.id);
      const attemptsLeft = Math.max(0, cfg.maxAttempts - attempts);
      return attemptsLeft === 0 ? { ok: false, error: "too_many_attempts" } : { ok: false, error: "invalid", attemptsLeft };
    }

    if (!(await repo.markUsed(record.id, now))) return { ok: false, error: "no_code" };
    await repo.markEmailVerified(userId, record.email, now);
    return { ok: true };
  }
}
