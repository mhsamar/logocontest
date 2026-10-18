"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/translate";
import { choosePinterestBoard, pinNow, retryFailedPins, setPinterestOn, setPinterestRule } from "@/lib/pinterest/actions";
import { PINTEREST_RULES, type PinterestRule } from "@/lib/pinterest/rules";
import { ADM_INPUT } from "./ui";
import { useReadOnly } from "./read-only";

/** Admin › Pinterest controls (owner, 2026-10-19). The server checks Content · manage on every action. */

type Res = { ok: true; message?: MessageKey; params?: Record<string, string> } | { ok: false; error: MessageKey; params?: Record<string, string> };

function useRun() {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [busy, start] = useTransition();
  const run = (fn: () => Promise<Res>, done?: MessageKey) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return void toast(t(res.error, res.params), "danger");
      toast(t(res.message ?? done ?? "admin.saved", res.params));
      router.refresh();
    });
  return { busy, run };
}

export function BoardPicker({ boards, current }: { boards: { id: string; name: string }[]; current: string | null }) {
  const { t } = useI18n();
  const readOnly = useReadOnly();
  const { busy, run } = useRun();
  const [pick, setPick] = useState(current ?? "");
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <select value={pick} onChange={(e) => setPick(e.target.value)} disabled={readOnly || busy} aria-label={t("admin.pinterest.boardPick")} className={cx(ADM_INPUT, "max-w-sm flex-[1_1_240px]")}>
        <option value="">{t("admin.pinterest.boardPick")}</option>
        {boards.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
      {!readOnly && (
        <Button onClick={() => run(() => choosePinterestBoard(pick))} loading={busy} disabled={!pick || pick === current}>
          {t("admin.pinterest.boardSave")}
        </Button>
      )}
    </div>
  );
}

export function AutoPin({ on, rule, canTurnOn }: { on: boolean; rule: PinterestRule; canTurnOn: boolean }) {
  const { t } = useI18n();
  const readOnly = useReadOnly();
  const { busy, run } = useRun();
  return (
    <div className="flex flex-col gap-4">
      <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-[#F4F5F7] px-4 py-3.5">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <strong className="text-[15.5px] text-ink">{t("admin.pinterest.autoOn")}</strong>
          <span className="text-[14px] text-muted">{t("admin.pinterest.autoLead")}</span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={t("admin.pinterest.autoOn")}
          disabled={readOnly || busy || (!on && !canTurnOn)}
          onClick={() => run(() => setPinterestOn(!on))}
          data-pinterest-switch
          className={cx("relative block h-7 w-[46px] flex-none rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60", on ? "bg-[#14633C]" : "bg-[#B9BCC4]")}
        >
          <span className={cx("absolute top-[3px] size-[22px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.25)] transition-[left]", on ? "left-[21px]" : "left-[3px]")} />
        </button>
      </label>
      <fieldset className="flex flex-col gap-2.5" disabled={readOnly || busy}>
        <legend className="mb-2 text-[13px] font-bold uppercase tracking-[.06em] text-muted">{t("admin.pinterest.rule")}</legend>
        {PINTEREST_RULES.map((r) => (
          <label key={r} className={cx("flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3", r === rule ? "border-primary bg-tint/40" : "border-[#E3E4E8] bg-white")}>
            <input type="radio" name="pinterest-rule" value={r} checked={r === rule} onChange={() => run(() => setPinterestRule(r))} className="mt-1 size-4 accent-[#8B0000]" />
            <span className="flex flex-col gap-0.5">
              <strong className="text-[15px] text-ink">{t(`admin.pinterest.rules.${r}.title`)}</strong>
              <span className="text-[14px] text-muted">{t(`admin.pinterest.rules.${r}.lead`)}</span>
            </span>
          </label>
        ))}
      </fieldset>
    </div>
  );
}

export function PinButtons({ failed }: { failed: number }) {
  const { t } = useI18n();
  const readOnly = useReadOnly();
  const { busy, run } = useRun();
  if (readOnly) return null;
  return (
    <div className="flex flex-wrap gap-2.5">
      <Button onClick={() => run(pinNow)} loading={busy} data-pin-now>
        {t("admin.pinterest.pinNow")}
      </Button>
      {failed > 0 && (
        <Button variant="secondary" onClick={() => run(retryFailedPins)} loading={busy}>
          {t("admin.pinterest.retry")}
        </Button>
      )}
    </div>
  );
}
