import "server-only";
import { headers } from "next/headers";
import { requireEnv } from "@/lib/env";
import { getSettings } from "@/lib/settings";
import { getSmsSender } from "@/lib/sms";
import { createAdminClient } from "@/lib/supabase/admin";
import { LoginGuard } from "./login-guard";
import { OtpService } from "./otp-service";
import { SupabaseLoginAttemptRepository, SupabaseOtpRepository } from "./supabase-repositories";

/** SMS codes are no longer used for sign-up or reset (owner, 2026-10-07); kept for future mobile verification. */
export function otpService() {
  return new OtpService({
    repo: new SupabaseOtpRepository(createAdminClient()),
    sms: getSmsSender(),
    secret: requireEnv("OTP_SECRET"),
    config: async () => {
      const s = await getSettings([
        "otp.length",
        "otp.ttl_minutes",
        "otp.resend_cooldown_seconds",
        "otp.max_per_phone_per_hour",
        "otp.max_per_ip_per_hour",
        "otp.max_verify_attempts",
        "otp.ticket_ttl_minutes",
      ]);
      return {
        length: s["otp.length"],
        ttlMinutes: s["otp.ttl_minutes"],
        resendCooldownSeconds: s["otp.resend_cooldown_seconds"],
        maxPerPhonePerHour: s["otp.max_per_phone_per_hour"],
        maxPerIpPerHour: s["otp.max_per_ip_per_hour"],
        maxVerifyAttempts: s["otp.max_verify_attempts"],
        ticketTtlMinutes: s["otp.ticket_ttl_minutes"],
      };
    },
  });
}

export function loginGuard() {
  return new LoginGuard({
    repo: new SupabaseLoginAttemptRepository(createAdminClient()),
    config: async () => {
      const s = await getSettings([
        "auth.login_max_failures_per_phone",
        "auth.login_max_failures_per_ip",
        "auth.login_window_minutes",
      ]);
      return {
        maxFailuresPerPhone: s["auth.login_max_failures_per_phone"],
        maxFailuresPerIp: s["auth.login_max_failures_per_ip"],
        windowMinutes: s["auth.login_window_minutes"],
      };
    },
  });
}

export async function clientIp(): Promise<string | null> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
}
