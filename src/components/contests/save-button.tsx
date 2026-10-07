"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/ui/toast";
import { toggleSaved } from "@/lib/contests/community-actions";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";

/** Designers' heart to save a contest (BLUEPRINT §10). "icon" sits on list rows, "button" on the contest page. */
export function SaveButton({ contestId, saved, variant = "icon", className }: { contestId: string; saved: boolean; variant?: "icon" | "button"; className?: string }) {
  const { t } = useI18n();
  const toast = useToast();
  // Shown at once; put back if the server says no.
  const [optimistic, setOptimistic] = useState(saved);
  const [pending, start] = useTransition();

  const toggle = () => {
    if (pending) return;
    const next = !optimistic;
    setOptimistic(next);
    start(async () => {
      const res = await toggleSaved(contestId, next).catch(() => ({ ok: false, saved: !next }));
      if (!res.ok) {
        setOptimistic(!next);
        toast(t("auth.errors.generic"), "danger");
      }
    });
  };

  const heart = (
    <svg viewBox="0 0 24 24" className="size-5" fill={optimistic ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" strokeLinejoin="round" />
    </svg>
  );

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={toggle}
        aria-pressed={optimistic}
        aria-label={optimistic ? t("contest.save.removeLabel") : t("contest.save.addLabel")}
        className={cx(
          "flex size-11 items-center justify-center rounded-full bg-surface/90 shadow-card ring-1 ring-line transition-colors",
          optimistic ? "text-primary" : "text-muted hover:text-primary",
          className,
        )}
      >
        {heart}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={optimistic}
      className={cx(
        "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md px-6 font-semibold ring-1 ring-inset transition-colors",
        optimistic ? "bg-primary/10 text-primary ring-primary/30" : "bg-surface text-ink ring-line hover:ring-primary",
        className,
      )}
    >
      {heart}
      {optimistic ? t("contest.save.remove") : t("contest.save.add")}
    </button>
  );
}
