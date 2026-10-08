"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import type { AddonKey } from "@/lib/contests/addons";
import { useI18n } from "@/lib/i18n/client";
import { AddonsPanel } from "./addons-panel";

/** Dashboard card: "Add-ons" opens this contest's add-ons in a pop-up (owner, 2026-10-08). */
export function AddonsButton({
  contestId,
  brand,
  active,
  prices,
  extensionDays,
  endsAt,
}: {
  contestId: string;
  brand: string;
  active: Record<AddonKey, boolean>;
  prices: Record<AddonKey, number> & { extensionPerDay: number };
  extensionDays: number[];
  endsAt: string | null;
}) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M12 5v14M5 12h14" />
        </svg>
        {t("dashboard.addons")}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={t("manage.addonsFor", { brand })} closeLabel={t("common.close")} size="wide">
        <p className="-mt-1 mb-4 text-sm text-muted">{t("manage.addons.subtitle")}</p>
        <AddonsPanel contestId={contestId} open active={active} prices={prices} extensionDays={extensionDays} endsAt={endsAt} locale={locale} />
      </Modal>
    </>
  );
}
