"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/ui/toast";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";
import { toggleLike } from "@/lib/rewards/actions";

/**
 * Like a winning design (owner, 2026-10-09). Everyone sees the count; designers can tap it (not on their own).
 * `canLike` false shows the count only.
 */
export function LikeButton({ entryId, likes, liked, canLike, size = "md" }: { entryId: string; likes: number; liked: boolean; canLike: boolean; size?: "sm" | "md" }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const [state, setState] = useState({ likes, liked });
  const [pop, setPop] = useState(false);
  const [busy, start] = useTransition();
  const num = new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US").format(state.likes);
  const heart = (
    <svg viewBox="0 0 24 24" className={cx(size === "sm" ? "size-4" : "size-5", "transition-transform duration-300", pop && "scale-125")} fill={state.liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 7.9 3.6 4.5 7 4.5c2 0 3.6 1.2 5 3 1.4-1.8 3-3 5-3 3.4 0 5.6 3.4 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2Z" strokeLinejoin="round" />
    </svg>
  );
  const pad = size === "sm" ? "min-h-8 gap-1 px-2.5 text-xs" : "min-h-10 gap-1.5 px-3.5 text-sm";

  if (!canLike)
    return (
      <span className={cx("inline-flex items-center rounded-full font-semibold tabular-nums", pad, state.likes ? "text-primary" : "text-muted")} title={t("likes.count", { n: num })}>
        {heart}
        {num}
      </span>
    );

  return (
    <button
      type="button"
      aria-pressed={state.liked}
      aria-label={state.liked ? t("likes.unlike") : t("likes.like")}
      disabled={busy}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const before = state;
        setState({ liked: !before.liked, likes: before.likes + (before.liked ? -1 : 1) });
        if (!before.liked) {
          setPop(true);
          setTimeout(() => setPop(false), 300);
        }
        start(async () => {
          const res = await toggleLike(entryId);
          if (res.ok) setState({ liked: res.liked, likes: res.likes });
          else {
            setState(before);
            toast(t(res.error), "danger");
          }
        });
      }}
      className={cx(
        "inline-flex items-center rounded-full font-semibold tabular-nums ring-1 ring-inset transition-[background-color,color,box-shadow] duration-200",
        pad,
        state.liked ? "bg-primary text-white ring-primary" : "bg-surface text-primary ring-line hover:ring-primary",
      )}
    >
      {heart}
      {num}
    </button>
  );
}
