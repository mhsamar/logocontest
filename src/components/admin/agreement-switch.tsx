"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useToast } from "@/components/ui/toast";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";
import { setAgreementRequired } from "@/lib/agreements/admin-actions";
import { useReadOnly } from "./read-only";

/** Admin → Agreements (owner, 2026-10-13): the agreement + ID photo before a designer's first design, on or off. */
export function AgreementSwitch({ on: initial, canManage }: { on: boolean; canManage: boolean }) {
  const { t } = useI18n();
  const readOnly = useReadOnly() || !canManage;
  const router = useRouter();
  const toast = useToast();
  const [on, setOn] = useState(initial);
  const [busy, start] = useTransition();
  const flip = () =>
    start(async () => {
      const next = !on;
      setOn(next);
      const res = await setAgreementRequired(next);
      if (!res.ok) {
        setOn(!next);
        return toast(t(res.error), "danger");
      }
      toast(t("admin.saved"));
      router.refresh();
    });
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#E9EAEE] bg-white px-4 py-3.5 sm:px-5">
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <strong className="text-[15.5px] text-ink">{t("admin.agreements.required.title")}</strong>
        <span className="text-[14px] text-muted">{on ? t("admin.agreements.required.on") : t("admin.agreements.required.off")}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={t("admin.agreements.required.title")}
        disabled={readOnly || busy}
        onClick={flip}
        className={cx("relative block h-[30px] w-[52px] flex-none rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60", on ? "bg-[linear-gradient(180deg,#2BB673,#1F7A4D)]" : "bg-[#D5D7DD]")}
      >
        <span className={cx("absolute left-[3px] top-[3px] size-6 rounded-full bg-white shadow-[0_2px_6px_rgba(17,18,22,.25)] transition-transform duration-300", on && "translate-x-[22px]")} />
      </button>
    </div>
  );
}
