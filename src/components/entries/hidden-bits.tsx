"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useToast } from "@/components/ui/toast";
import { cx } from "@/lib/cx";
import { setEntryHidden } from "@/lib/entries/actions";
import { useI18n } from "@/lib/i18n/client";

/**
 * Pro "Hide my design" (owner, 2026-10-14). What other designers and visitors see instead of a hidden design's
 * picture: a lock, "Hidden by a Pro designer" and "Public when the winner is picked". The picture is never sent.
 */
export function LockedPicture({ title, sub, ratio = 1, large = false }: { title: string; sub: string; ratio?: number; large?: boolean }) {
  return (
    <div
      className={cx("flex flex-col items-center justify-center gap-2 bg-[linear-gradient(135deg,#F4F0FF,#ECE6FA)] p-4 text-center text-[#5B21B6]", large ? "w-[min(72vw,440px)] rounded-lg shadow-card" : "w-full")}
      style={{ aspectRatio: String(ratio) }}
      data-locked-design
    >
      <span className={cx("flex items-center justify-center rounded-full bg-white/80 shadow-sm", large ? "size-16" : "size-11")} aria-hidden>
        <svg viewBox="0 0 24 24" className={large ? "size-7" : "size-5"} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
      </span>
      <strong className={cx("leading-tight", large ? "text-lg" : "text-[13px]")}>{title}</strong>
      <span className={cx("leading-snug text-[#6D5BA8]", large ? "text-sm" : "text-[11.5px]")}>{sub}</span>
    </div>
  );
}

/** The designer's switch on their own design: hide it from other designers and visitors, or show it again. */
export function HideToggle({ entryId, hidden, canHide }: { entryId: string; hidden: boolean; canHide: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [busy, start] = useTransition();
  if (!hidden && !canHide) return null;
  const flip = () =>
    start(async () => {
      const res = await setEntryHidden(entryId, !hidden);
      if (!res.ok) return toast(t(res.error.key, res.error.params), "danger");
      toast(t(hidden ? "pro.hide.shown" : "pro.hide.hidden"));
      router.refresh();
    });
  return (
    <div className="flex flex-col gap-2 rounded-[14px] bg-[#F4F0FF] p-3.5 text-[14px] text-[#3B1A80]" data-hide-toggle={hidden ? "hidden" : "visible"}>
      <span className="flex items-start gap-2">
        <svg viewBox="0 0 24 24" className="mt-0.5 size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
        {hidden ? t("pro.hide.hiddenNote") : t("pro.hide.visibleNote")}
      </span>
      <button
        type="button"
        onClick={flip}
        disabled={busy}
        className="inline-flex min-h-11 items-center justify-center self-start rounded-full bg-[#5B21B6] px-4 text-[14px] font-bold text-white transition-opacity disabled:opacity-60"
      >
        {hidden ? t("pro.hide.show") : t("pro.hide.hide")}
      </button>
    </div>
  );
}
