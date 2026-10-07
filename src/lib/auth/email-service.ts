import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getEmailSender, siteOrigin } from "@/lib/email";
import { requireEnv } from "@/lib/env";
import type { Locale } from "@/lib/i18n/config";
import { MESSAGES } from "@/lib/i18n/messages";
import { createTranslator } from "@/lib/i18n/translate";
import { getSettings } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { EmailVerificationService, type EmailCodeConfig, type VerificationRecord, type VerificationRepository } from "./email-verification";

class SupabaseVerificationRepository implements VerificationRepository {
  constructor(private readonly db: SupabaseClient) {}

  async create(r: Pick<VerificationRecord, "userId" | "email" | "codeHash" | "expiresAt">) {
    const { error } = await this.db.from("email_verifications").insert({
      user_id: r.userId,
      email: r.email,
      token_hash: r.codeHash,
      expires_at: r.expiresAt.toISOString(),
    });
    if (error) throw new Error(error.message);
  }

  async latest(userId: string) {
    const { data, error } = await this.db
      .from("email_verifications")
      .select("id, user_id, email, token_hash, attempts, expires_at, used_at, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data
      ? {
          id: data.id as string,
          userId: data.user_id as string,
          email: data.email as string,
          codeHash: data.token_hash as string,
          attempts: data.attempts as number,
          expiresAt: new Date(data.expires_at),
          usedAt: data.used_at ? new Date(data.used_at) : null,
          createdAt: new Date(data.created_at),
        }
      : null;
  }

  async incrementAttempts(id: string) {
    const { data: row } = await this.db.from("email_verifications").select("attempts").eq("id", id).single();
    const attempts = ((row?.attempts as number) ?? 0) + 1;
    const { error } = await this.db.from("email_verifications").update({ attempts }).eq("id", id);
    if (error) throw new Error(error.message);
    return attempts;
  }

  async markUsed(id: string, at: Date) {
    const { data, error } = await this.db
      .from("email_verifications")
      .update({ used_at: at.toISOString() })
      .eq("id", id)
      .is("used_at", null)
      .select("id");
    if (error) throw new Error(error.message);
    return (data ?? []).length === 1;
  }

  async markEmailVerified(userId: string, email: string, at: Date) {
    // Only confirms the address the code was sent to, in case the email changed since.
    const { error } = await this.db
      .from("profiles")
      .update({ email_verified_at: at.toISOString() })
      .eq("id", userId)
      .ilike("email", email);
    if (error) throw new Error(error.message);
  }
}

export async function emailCodeConfig(): Promise<EmailCodeConfig> {
  const s = await getSettings([
    "auth.email_code_length",
    "auth.email_code_ttl_minutes",
    "auth.email_code_max_attempts",
    "auth.email_code_resend_seconds",
  ]);
  return {
    length: s["auth.email_code_length"],
    ttlMinutes: s["auth.email_code_ttl_minutes"],
    maxAttempts: s["auth.email_code_max_attempts"],
    resendSeconds: s["auth.email_code_resend_seconds"],
  };
}

export function emailVerificationService() {
  return new EmailVerificationService({
    repo: new SupabaseVerificationRepository(createAdminClient()),
    secret: requireEnv("OTP_SECRET"),
    config: emailCodeConfig,
  });
}

type Kind = "verify" | "reset";

/** Per-address and per-IP hourly limits for emails we send on request. */
async function underLimit(kind: Kind, email: string, ip: string | null): Promise<boolean> {
  const db = createAdminClient();
  const s = await getSettings(["auth.email_max_per_address_per_hour", "auth.email_max_per_ip_per_hour"]);
  const since = new Date(Date.now() - 3_600_000).toISOString();
  const count = async (column: "email" | "ip", value: string) => {
    const { count, error } = await db
      .from("email_sends")
      .select("id", { count: "exact", head: true })
      .eq("kind", kind)
      .eq(column, value)
      .gte("created_at", since);
    if (error) throw new Error(error.message);
    return count ?? 0;
  };
  if ((await count("email", email)) >= s["auth.email_max_per_address_per_hour"]) return false;
  if (ip && (await count("ip", ip)) >= s["auth.email_max_per_ip_per_hour"]) return false;
  return true;
}

async function recordSend(kind: Kind, email: string, ip: string | null) {
  await createAdminClient().from("email_sends").insert({ kind, email, ip });
}

export type SendCodeResult = { status: "sent" } | { status: "rate_limited" } | { status: "cooldown"; retryAfterSeconds: number };

/** Email with the 6-digit confirm-your-email code, sent right after sign-up and on "Resend code". */
export async function sendVerificationEmail(input: {
  userId: string;
  email: string;
  name: string;
  locale: Locale;
  ip: string | null;
}): Promise<SendCodeResult> {
  if (!(await underLimit("verify", input.email, input.ip))) return { status: "rate_limited" };
  const issued = await emailVerificationService().issue(input.userId, input.email);
  if (!issued.ok) return { status: "cooldown", retryAfterSeconds: issued.retryAfterSeconds };
  const t = createTranslator(input.locale, MESSAGES[input.locale]);
  await getEmailSender().send({
    to: input.email,
    subject: t("email.verify.subject"),
    text: t("email.verify.body", { name: input.name, code: issued.code, minutes: issued.ttlMinutes }),
  });
  await recordSend("verify", input.email, input.ip);
  return { status: "sent" };
}

/**
 * Emailed password reset (owner, 2026-10-07). Supabase creates the one-time
 * recovery token; we send the link so it works with any email provider.
 * Returns "sent" even when no account exists, so the page never reveals that.
 */
export async function sendPasswordResetEmail(input: { email: string; locale: Locale; ip: string | null }): Promise<"sent" | "rate_limited"> {
  if (!(await underLimit("reset", input.email, input.ip))) return "rate_limited";
  await recordSend("reset", input.email, input.ip);

  const db = createAdminClient();
  const { data: profile } = await db.from("profiles").select("id, name, status").ilike("email", input.email).maybeSingle();
  if (!profile || profile.status === "banned") return "sent";

  const { data, error } = await db.auth.admin.generateLink({ type: "recovery", email: input.email });
  if (error || !data?.properties?.hashed_token) {
    console.error("[auth] could not create a recovery link:", error?.message);
    return "sent";
  }
  const t = createTranslator(input.locale, MESSAGES[input.locale]);
  const link = `${await siteOrigin()}/auth/confirm?type=recovery&token_hash=${encodeURIComponent(data.properties.hashed_token)}`;
  await getEmailSender().send({
    to: input.email,
    subject: t("email.reset.subject"),
    text: t("email.reset.body", { name: profile.name as string, link }),
  });
  return "sent";
}
