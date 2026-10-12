"use client";

import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";
import { EmailCodeForm } from "./email-code-form";

/** Bar above the header until the signed-in user enters their email code (UI-JOURNEY). */
export function EmailBanner({ email, length, ownProfile = null }: { email: string; length: number; ownProfile?: string | null }) {
  const { t } = useI18n();
  const path = usePathname();
  // /verify-email has the same form in full, and a designer's own profile has its own bar (owner, 2026-10-12).
  if (path === "/verify-email" || (ownProfile && path.toLowerCase() === ownProfile.toLowerCase())) return null;
  return (
    <div className="border-b border-warning/20 bg-warning/10">
      <div className="mx-auto flex max-w-page flex-col items-center gap-2 px-4 py-2.5 text-center text-sm text-ink">
        <p>{t("auth.verify.banner", { email, length })}</p>
        <EmailCodeForm length={length} variant="compact" />
      </div>
    </div>
  );
}
