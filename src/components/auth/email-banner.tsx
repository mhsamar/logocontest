"use client";

import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";
import { EmailCodeForm } from "./email-code-form";

/** Bar above the header until the signed-in user enters their email code (UI-JOURNEY). */
export function EmailBanner({ email, length, ownProfile = null }: { email: string; length: number; ownProfile?: string | null }) {
  const { t } = useI18n();
  const path = usePathname();
  // /verify-email has the same form in full, a designer's own profile has its own bar (owner, 2026-10-12), and
  // Profile settings has the code box in its Email section (owner, 2026-10-15).
  // Not inside onboarding v2 (owner, 2026-10-28: each step fits one phone screen); the bar comes back afterwards.
  if (path.startsWith("/start-v2") || path === "/verify-email" || path === "/dashboard/profile" || path === "/client/settings" || (ownProfile && path.toLowerCase() === ownProfile.toLowerCase())) return null;
  return (
    <div className="border-b border-warning/20 bg-warning/10">
      <div className="mx-auto flex max-w-page flex-col items-center gap-3 px-4 py-4 text-center text-[15px] text-ink">
        <p className="font-medium">{t("auth.verify.banner", { email, length })}</p>
        <EmailCodeForm length={length} variant="compact" />
      </div>
    </div>
  );
}
