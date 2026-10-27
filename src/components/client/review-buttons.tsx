"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/ui/toast";
import { cx } from "@/lib/cx";
import { rateEntry, setShortlist } from "@/lib/entries/review-actions";
import { useI18n } from "@/lib/i18n/client";
import { CwIcon, CwStar } from "./icons";

/** The client's review tools in the premium workspace, on the existing actions (rateEntry, setShortlist). */

/** The heart on a design card: add to or take off the shortlist. */
export function ShortlistHeart({ entryId, on, disabled = false }: { entryId: string; on: boolean; disabled?: boolean }) {
  const { t } = useI18n();
  const toast = useToast();
  const [busy, start] = useTransition();
  const [state, setState] = useState(on);
  if (disabled) return null;
  return (
    <button
      type="button"
      className={cx("cfrh", state && "on")}
      aria-pressed={state}
      aria-label={t(state ? "cw.review.unshortlist" : "cw.review.shortlist")}
      disabled={busy}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const next = !state;
        setState(next);
        start(async () => {
          const res = await setShortlist(entryId, next);
          if (!res.ok) {
            setState(!next);
            return toast(t(res.error), "danger");
          }
        });
      }}
      data-shortlist={entryId}
    >
      <CwIcon name="heart" size={15} strokeWidth={2.2} />
    </button>
  );
}

/** "Shortlist entry #12" as a wide button (Messages panel). */
export function ShortlistButton({ entryId, number, on, disabled = false }: { entryId: string; number: string; on: boolean; disabled?: boolean }) {
  const { t } = useI18n();
  const toast = useToast();
  const [busy, start] = useTransition();
  return (
    <button
      type="button"
      className={on ? "dout sm wide" : "dbtn sm wide"}
      disabled={busy || disabled}
      onClick={() =>
        start(async () => {
          const res = await setShortlist(entryId, !on);
          if (!res.ok) return toast(t(res.error), "danger");
          toast(t(on ? "cw.review.unshortlisted" : "cw.review.shortlisted"));
        })
      }
    >
      <CwIcon name="heart" size={15} />
      {t(on ? "cw.review.unshortlistN" : "cw.review.shortlistN", { n: number })}
    </button>
  );
}

/** Rate a design with 1–5 stars (Messages panel); the same action as in the design view. */
export function RateStars({ entryId, rating, disabled = false }: { entryId: string; rating: number | null; disabled?: boolean }) {
  const { t } = useI18n();
  const toast = useToast();
  const [busy, start] = useTransition();
  const [value, setValue] = useState(rating ?? 0);
  const [hover, setHover] = useState(0);
  return (
    <div className="dout sm wide" role="group" aria-label={t("cw.review.rate")} style={{ gap: 4 }} data-rate={entryId}>
      <CwIcon name="star" size={15} />
      <span style={{ marginRight: 6 }}>{t("cw.review.rate")}</span>
      <span className="dstars" style={{ marginLeft: 0 }} onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            disabled={busy || disabled}
            aria-label={t("cw.review.stars", { n })}
            aria-pressed={value === n}
            onMouseEnter={() => setHover(n)}
            onClick={() => {
              const next = value === n ? 0 : n;
              setValue(next);
              start(async () => {
                const res = await rateEntry(entryId, next);
                if (!res.ok) {
                  setValue(rating ?? 0);
                  return toast(t(res.error), "danger");
                }
              });
            }}
            style={{ border: 0, background: "none", padding: 0, cursor: "pointer", color: "inherit" }}
          >
            <CwStar on={(hover || value) >= n} size={16} />
          </button>
        ))}
      </span>
    </div>
  );
}
