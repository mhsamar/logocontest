"use client";

/* eslint-disable @next/next/no-img-element */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";
import { saveRewardNote, setRewardSwitch, type RewardSwitch } from "@/lib/rewards/month-actions";
import { useReadOnly } from "./read-only";

/**
 * Admin → Monthly winner (owner, 2026-10-11; Design/rewards/admin-monthly-winner.html): the four switches, the card
 * preview and the admins' note.
 */

export function RewardSwitches({ items }: { items: { key: RewardSwitch; title: string; lead: string; on: boolean }[] }) {
  const { t } = useI18n();
  const readOnly = useReadOnly();
  const router = useRouter();
  const toast = useToast();
  const [state, setState] = useState(() => Object.fromEntries(items.map((i) => [i.key, i.on])) as Record<RewardSwitch, boolean>);
  const [busy, start] = useTransition();

  const flip = (key: RewardSwitch) =>
    start(async () => {
      const next = !state[key];
      setState((s) => ({ ...s, [key]: next }));
      const res = await setRewardSwitch(key, next);
      if (!res.ok) {
        setState((s) => ({ ...s, [key]: !next }));
        return toast(t(res.error), "danger");
      }
      toast(t("admin.saved"));
      router.refresh();
    });

  return (
    <div className="flex flex-wrap gap-3">
      {items.map((i) => (
        <label key={i.key} className="flex min-w-0 flex-[1_1_290px] cursor-pointer items-center gap-3 rounded-xl bg-[#F4F5F7] px-4 py-3.5">
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <strong className="text-[15.5px] text-ink">{i.title}</strong>
            <span className="text-[14px] text-muted">{i.lead}</span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={state[i.key]}
            aria-label={i.title}
            disabled={readOnly || busy}
            onClick={() => flip(i.key)}
            className={cx("relative block h-7 w-[46px] flex-none rounded-full transition-colors disabled:cursor-not-allowed", state[i.key] ? "bg-[#14633C]" : "bg-[#B9BCC4]")}
          >
            <span className={cx("absolute top-[3px] size-[22px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.25)] transition-[left]", state[i.key] ? "left-[21px]" : "left-[3px]")} />
          </button>
        </label>
      ))}
    </div>
  );
}

/** "Preview the cards": the smartphone and gift box cards for whoever leads now (drawn on request, not kept). */
export function CardPreview({ month, test, names }: { month: string; test: boolean; names: { smartphone: string | null; gift_box: string | null } }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const q = `?month=${month}${test ? "&test=1" : ""}`;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="h-[42px] rounded-[10px] border border-[#DCDEE3] bg-white px-4 text-[15px] font-bold text-ink">
        {t("admin.monthly.preview")}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={t("admin.monthly.preview")} closeLabel={t("common.close")} size="wide">
        <p className="m-0 text-sm text-muted">{t("admin.monthly.previewLead")}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {(["smartphone", "gift_box"] as const).map((k) => (
            <figure key={k} className="m-0 flex flex-col gap-1.5">
              {open && names[k] ? (
                <img src={`/api/cards/preview/${k}${q}`} alt={names[k]!} width={1080} height={1080} className={cx("aspect-square w-full rounded-2xl object-cover", k === "smartphone" ? "bg-[#8B0000]" : "bg-[#FFDF9C]")} />
              ) : (
                <span className="flex aspect-square w-full items-center justify-center rounded-2xl bg-canvas px-4 text-center text-sm text-muted">{t("admin.monthly.previewNobody")}</span>
              )}
              <figcaption className="text-[13.5px] font-bold text-muted">{k === "smartphone" ? t("admin.monthClose.smartphone") : t("admin.monthClose.giftBox")}</figcaption>
            </figure>
          ))}
        </div>
      </Modal>
    </>
  );
}

export function RewardNote({ id, note }: { id: string; note: string }) {
  const { t } = useI18n();
  const readOnly = useReadOnly();
  const router = useRouter();
  const toast = useToast();
  const [value, setValue] = useState(note);
  const [busy, start] = useTransition();
  const save = () =>
    start(async () => {
      const res = await saveRewardNote(id, value);
      if (!res.ok) return toast(t(res.error), "danger");
      toast(t("admin.saved"));
      router.refresh();
    });
  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1.5 text-[14.5px] font-bold text-ink">
        {t("admin.monthly.note")}
        <textarea
          rows={2}
          maxLength={1000}
          readOnly={readOnly}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t("admin.monthly.notePlaceholder")}
          className="resize-y rounded-xl border border-[#DCDEE3] px-3 py-2.5 text-[15px] font-medium focus:outline-2 focus:outline-offset-1 focus:outline-primary"
        />
      </label>
      {!readOnly && value.trim() !== note.trim() && (
        <button type="button" onClick={save} disabled={busy} className="self-start rounded-[10px] border border-[#DCDEE3] bg-white px-4 py-2 text-[14.5px] font-bold disabled:opacity-60">
          {busy ? t("admin.monthly.saving") : t("admin.monthly.saveNote")}
        </button>
      )}
    </div>
  );
}
