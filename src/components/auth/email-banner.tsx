"use client";

import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";
import { EmailCodeForm } from "./email-code-form";

/** Bar above the header until the signed-in user enters their email code (UI-JOURNEY). */
export function EmailBanner({ email, length }: { email: string; length: number }) {
  const { t } = useI18n();
  // /verify-email has the same form in full.
  if (usePathname() === "/verify-email") return null;
  return (
    <div className="border-b border-warning/20 bg-warning/10">
      <div className="mx-auto flex max-w-page flex-col items-center gap-2 px-4 py-2.5 text-center text-sm text-ink">
        <p>{t("auth.verify.banner", { email, length })}</p>
        <EmailCodeForm length={length} variant="compact" />
      </div>
    </div>
  );
}
