"use client";

import Link from "@/components/ui/link";
import { useI18n } from "@/lib/i18n/client";

/**
 * On the first step of every Start a contest wizard (owner, 2026-11-02): designers sometimes made a client account
 * here by mistake. This says plainly that it is a client account, with the way to join as a designer instead.
 */
export function ClientAccountNote() {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-1 rounded-[16px] bg-[#fff4d6] px-4 py-3.5 text-[15px] text-[#5c4300] ring-1 ring-[#f0d68a]">
      <strong className="font-semibold text-ink">{t("wizard.clientNote.title")}</strong>
      <span>
        {t("wizard.clientNote.body")}{" "}
        <Link href="/designers/signup" className="font-bold text-primary underline underline-offset-2">
          {t("wizard.clientNote.designer")}
        </Link>
      </span>
    </div>
  );
}
