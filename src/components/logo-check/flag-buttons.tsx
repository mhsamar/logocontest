"use client";

import { useTransition } from "react";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/client";
import { reviewCheckFlag } from "@/lib/logo-check/flag-actions";

/** Keep or remove a High match entry (owner, 2026-10-14). */
export function FlagButtons({ flagId }: { flagId: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const [busy, start] = useTransition();
  const act = (decision: "keep" | "remove") =>
    start(async () => {
      const res = await reviewCheckFlag(flagId, decision);
      if (!res.ok) toast(t(res.error), "danger");
    });
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={busy} onClick={() => act("keep")} className="min-h-10 rounded-[10px] border border-adm-line bg-surface px-3 text-[14px] font-bold text-ink hover:bg-adm-bg disabled:opacity-50">
        {t("entryCheck.admin.keep")}
      </button>
      <button type="button" disabled={busy} onClick={() => act("remove")} className="min-h-10 rounded-[10px] border border-danger bg-surface px-3 text-[14px] font-bold text-danger hover:bg-danger/10 disabled:opacity-50">
        {t("entryCheck.admin.remove")}
      </button>
    </div>
  );
}
