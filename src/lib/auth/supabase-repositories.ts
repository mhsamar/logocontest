import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OtpPurpose, OtpRecord, OtpRepository } from "./otp-service";
import type { LoginAttemptRepository } from "./login-guard";

type OtpRow = {
  id: string;
  phone: string;
  purpose: OtpPurpose;
  code_hash: string;
  attempts: number;
  ip: string | null;
  expires_at: string;
  verified_at: string | null;
  ticket_hash: string | null;
  consumed_at: string | null;
  created_at: string;
};

const date = (v: string | null) => (v ? new Date(v) : null);

function toRecord(row: OtpRow): OtpRecord {
  return {
    id: row.id,
    phone: row.phone,
    purpose: row.purpose,
    codeHash: row.code_hash,
    attempts: row.attempts,
    ip: row.ip,
    expiresAt: new Date(row.expires_at),
    verifiedAt: date(row.verified_at),
    ticketHash: row.ticket_hash,
    consumedAt: date(row.consumed_at),
    createdAt: new Date(row.created_at),
  };
}

function check<T>({ data, error }: { data: T; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data;
}

export class SupabaseOtpRepository implements OtpRepository {
  constructor(private readonly db: SupabaseClient) {}

  async latest(phone: string, purpose: OtpPurpose) {
    const row = check(
      await this.db
        .from("otp_codes")
        .select("*")
        .eq("phone", phone)
        .eq("purpose", purpose)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<OtpRow>(),
    );
    return row ? toRecord(row) : null;
  }

  async findById(id: string) {
    const row = check(await this.db.from("otp_codes").select("*").eq("id", id).maybeSingle<OtpRow>());
    return row ? toRecord(row) : null;
  }

  async countSince(filter: { phone?: string; ip?: string }, since: Date) {
    let q = this.db.from("otp_codes").select("id", { count: "exact", head: true }).gte("created_at", since.toISOString());
    if (filter.phone) q = q.eq("phone", filter.phone);
    if (filter.ip) q = q.eq("ip", filter.ip);
    const { count, error } = await q;
    if (error) throw new Error(error.message);
    return count ?? 0;
  }

  async create(r: Parameters<OtpRepository["create"]>[0]) {
    const row = check(
      await this.db
        .from("otp_codes")
        .insert({
          phone: r.phone,
          purpose: r.purpose,
          code_hash: r.codeHash,
          ip: r.ip,
          expires_at: r.expiresAt.toISOString(),
        })
        .select("*")
        .single<OtpRow>(),
    );
    return toRecord(row!);
  }

  async incrementAttempts(id: string) {
    return check(await this.db.rpc("otp_increment_attempts", { otp_id: id })) as number;
  }

  async markVerified(id: string, ticketHash: string, at: Date) {
    check(await this.db.from("otp_codes").update({ ticket_hash: ticketHash, verified_at: at.toISOString() }).eq("id", id));
  }

  async markConsumed(id: string, at: Date) {
    const rows = check(
      await this.db
        .from("otp_codes")
        .update({ consumed_at: at.toISOString() })
        .eq("id", id)
        .is("consumed_at", null)
        .select("id"),
    );
    return rows?.length === 1;
  }
}

export class SupabaseLoginAttemptRepository implements LoginAttemptRepository {
  constructor(private readonly db: SupabaseClient) {}

  async countFailuresSince(filter: { phone?: string; ip?: string }, since: Date) {
    let q = this.db
      .from("login_attempts")
      .select("id", { count: "exact", head: true })
      .eq("succeeded", false)
      .gte("created_at", since.toISOString());
    if (filter.phone) q = q.eq("phone", filter.phone);
    if (filter.ip) q = q.eq("ip", filter.ip);
    const { count, error } = await q;
    if (error) throw new Error(error.message);
    return count ?? 0;
  }

  async record(a: { phone: string; ip: string | null; succeeded: boolean }) {
    check(await this.db.from("login_attempts").insert(a));
  }
}
