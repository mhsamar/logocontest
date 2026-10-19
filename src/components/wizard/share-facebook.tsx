"use client";

import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";

/**
 * "Share my contest on Facebook" in the contest form (owner, 2026-10-19; Design/contest-cards). On by default; a
 * private or NDA contest is never shared, so the switch shows off and can't be turned on.
 */
export function ShareOnFacebook({ on, onChange, isPrivate }: { on: boolean; onChange: (on: boolean) => void; isPrivate: boolean }) {
  const { t } = useI18n();
  const shown = on && !isPrivate;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={shown}
      disabled={isPrivate}
      onClick={() => onChange(!on)}
      data-share-facebook
      className={cx("flex w-full items-start gap-3 rounded-[22px] p-4 text-left transition-[box-shadow,background-color] duration-300 disabled:cursor-default", shown ? "bg-tint/50 ring-2 ring-primary" : "bg-surface ring-1 ring-line hover:shadow-card")}
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-[#1877F2] text-white">
        <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
          <path d="M14 8.6V11h3l-.5 3H14v8h-3.5v-8H8v-3h2.5V8.3C10.5 5.7 12 4 14.7 4c1 0 2 .1 2.3.2v2.7h-1.6c-1.1 0-1.4.6-1.4 1.7Z" />
        </svg>
      </span>
      <span className="min-w-0 flex-1">
        <span className="font-semibold text-ink">{t("wizard.shareFb.title")}</span>
        <span className="mt-0.5 block text-sm leading-snug text-muted">{isPrivate ? t("wizard.shareFb.private") : t("wizard.shareFb.lead")}</span>
      </span>
      <span aria-hidden className={cx("relative mt-1 h-6 w-11 shrink-0 rounded-full transition-colors duration-300", shown ? "bg-primary" : "bg-line")}>
        <span className={cx("absolute top-0.5 size-5 rounded-full bg-white shadow-card transition-[left] duration-300", shown ? "left-[1.375rem]" : "left-0.5")} />
      </span>
    </button>
  );
}
