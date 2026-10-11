"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/ui/toast";
import { cx } from "@/lib/cx";
import { voteEntry } from "@/lib/entries/actions";
import { useI18n } from "@/lib/i18n/client";

export function ThumbIcon({ down = false, filled = false, className }: { down?: boolean; filled?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cx(className, down && "rotate-180")} fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7 10v11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h3Zm0 0 4-8a2.5 2.5 0 0 1 2.5 2.5V8h5.3a2 2 0 0 1 2 2.3l-1.3 8.5a2 2 0 0 1-2 1.7H7" />
    </svg>
  );
}

/**
 * Like and dislike on one design (owner, 2026-10-11). Everyone who sees the design sees the counts; designers can
 * vote on other designers' designs, the client on designs in their own contest. Tapping your vote again takes it back.
 */
export function VoteButtons({
  entryId,
  up,
  down,
  mine,
  canVote,
  hint,
}: {
  entryId: string;
  up: number;
  down: number;
  mine: -1 | 0 | 1;
  canVote: boolean;
  /** Shown under the buttons when the viewer can't vote (for example "Log in as a designer to vote"). */
  hint?: string | null;
}) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const [state, setState] = useState({ up, down, mine });
  const [busy, start] = useTransition();
  const num = (n: number) => new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US").format(n);

  const vote = (v: 1 | -1) => {
    const before = state;
    const next = before.mine === v ? 0 : v;
    setState({
      mine: next,
      up: before.up - (before.mine === 1 ? 1 : 0) + (next === 1 ? 1 : 0),
      down: before.down - (before.mine === -1 ? 1 : 0) + (next === -1 ? 1 : 0),
    });
    start(async () => {
      const res = await voteEntry(entryId, next);
      if (res.ok) setState({ up: res.likes, down: res.dislikes, mine: res.mine });
      else {
        setState(before);
        toast(t(res.error.key, res.error.params), "danger");
      }
    });
  };

  const pill = (v: 1 | -1) => {
    const on = state.mine === v;
    const count = v === 1 ? state.up : state.down;
    const label = v === 1 ? t("entry.votes.like") : t("entry.votes.dislike");
    const body = (
      <>
        <ThumbIcon down={v === -1} filled={on} className="size-[18px]" />
        <span className="tabular-nums">{num(count)}</span>
      </>
    );
    const base = "inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold ring-1 ring-inset transition-colors";
    if (!canVote)
      return (
        <span className={cx(base, "text-muted ring-line")} title={label} aria-label={`${label}: ${num(count)}`}>
          {body}
        </span>
      );
    return (
      <button
        type="button"
        onClick={() => vote(v)}
        disabled={busy}
        aria-pressed={on}
        aria-label={`${label}: ${num(count)}`}
        className={cx(
          base,
          on ? (v === 1 ? "bg-success text-white ring-success" : "bg-ink text-white ring-ink") : "bg-surface text-ink ring-line hover:ring-primary",
        )}
      >
        {body}
      </button>
    );
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("entry.votes.label")}>
        {pill(1)}
        {pill(-1)}
      </div>
      {!canVote && hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}
