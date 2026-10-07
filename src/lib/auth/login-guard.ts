export interface LoginAttemptRepository {
  countFailuresSince(filter: { phone?: string; ip?: string }, since: Date): Promise<number>;
  record(attempt: { phone: string; ip: string | null; succeeded: boolean }): Promise<void>;
}

export type LoginGuardConfig = {
  maxFailuresPerPhone: number;
  maxFailuresPerIp: number;
  windowMinutes: number;
};

/** Rate limits password logins by mobile number and by IP. */
export class LoginGuard {
  private readonly now: () => Date;

  constructor(
    private readonly deps: {
      repo: LoginAttemptRepository;
      config: () => Promise<LoginGuardConfig>;
      now?: () => Date;
    },
  ) {
    this.now = deps.now ?? (() => new Date());
  }

  async check(phone: string, ip: string | null): Promise<{ allowed: true } | { allowed: false; retryAfterMinutes: number }> {
    const cfg = await this.deps.config();
    const since = new Date(this.now().getTime() - cfg.windowMinutes * 60_000);

    const byPhone = await this.deps.repo.countFailuresSince({ phone }, since);
    const byIp = ip ? await this.deps.repo.countFailuresSince({ ip }, since) : 0;

    if (byPhone >= cfg.maxFailuresPerPhone || byIp >= cfg.maxFailuresPerIp) {
      return { allowed: false, retryAfterMinutes: cfg.windowMinutes };
    }
    return { allowed: true };
  }

  record(phone: string, ip: string | null, succeeded: boolean): Promise<void> {
    return this.deps.repo.record({ phone, ip, succeeded });
  }
}
