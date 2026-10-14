"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";
import { redeemDesignerCode } from "@/lib/promos/actions";
import { PromoField } from "./pay-bits";

/** Wallet › Promo code (owner, 2026-10-14): a designer's fee code waiting for their next win, or the box to add one. */
export function DesignerPromo({ waiting }: { waiting: { code: string; fee: number } | null }) {
  const { t } = useI18n();
  const router = useRouter();
  if (waiting)
    return (
      <p className="m-0 mt-4 rounded-[14px] bg-[#e7f8f0] px-4 py-3 text-[15px] font-semibold text-[#0f6b45]" data-promo-applied={waiting.code}>
        {t("pay.wallet.applied", { code: waiting.code, fee: waiting.fee })}
      </p>
    );
  return (
    <div className="mt-4 flex flex-col gap-1 border-t border-line pt-4">
      <p className="m-0 text-sm text-muted">{t("pay.wallet.lead")}</p>
      <PromoField
        applied={null}
        onRemove={() => undefined}
        apply={async (code) => {
          const res = await redeemDesignerCode(code);
          if (!res.ok) return { ok: false, error: t(res.error) };
          router.refresh();
          return { ok: true };
        }}
      />
    </div>
  );
}
