"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextAreaField } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { cx } from "@/lib/cx";
import { pickWinner, rateEntry, rejectEntry, setShortlist } from "@/lib/entries/review-actions";
import { REJECT_REASONS, type RejectReason } from "@/lib/entries/review-options";
import { useI18n } from "@/lib/i18n/client";

type Props = {
  entryId: string;
  number: number;
  rating: number | null;
  shortlisted: boolean;
  /** Reject and pick are only for active designs while the contest is open or judging. */
  canAct: boolean;
  fileDays: number;
  /** "card": stars, heart and a "…" menu; "panel": everything spelled out (C-15). */
  variant: "card" | "panel";
  /** Where to go after picking this design as the winner: the page with the winner pop-up open. */
  wonHref: string;
};

function StarIcon({ on, className }: { on: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={cx(className, on ? "text-accent" : "text-line")} fill="currentColor" aria-hidden>
      <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.8l-5.2 2.8 1-5.8L1.5 7.7l5.9-.9Z" />
    </svg>
  );
}

/** The client's tools on one design (UI-JOURNEY C-13b, C-15; owner 2026-10-08). */
export function OwnerActions({ entryId, number, rating, shortlisted, canAct, fileDays, variant, wonHref }: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [stars, setStars] = useState(rating ?? 0);
  const [hover, setHover] = useState(0);
  const [heart, setHeart] = useState(shortlisted);
  const [menu, setMenu] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [picking, setPicking] = useState(false);
  const [reason, setReason] = useState<RejectReason | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setMenu(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);

  const rate = (n: number) => {
    const next = n === stars ? 0 : n;
    setStars(next);
    start(async () => {
      const res = await rateEntry(entryId, next);
      if (!res.ok) {
        setStars(rating ?? 0);
        toast(t(res.error), "danger");
      }
    });
  };
  const toggleHeart = () => {
    setHeart(!heart);
    start(async () => {
      const res = await setShortlist(entryId, !heart);
      if (!res.ok) {
        setHeart(heart);
        toast(t(res.error), "danger");
      }
    });
  };
  const reject = () =>
    start(async () => {
      setError(null);
      if (!reason) return setError(t("manage.reject.pickReason"));
      const res = await rejectEntry(entryId, reason, note);
      if (!res.ok) return setError(t(res.error));
      setRejecting(false);
      toast(t("manage.reject.done"));
    });
  const pick = () =>
    start(async () => {
      setError(null);
      const res = await pickWinner(entryId);
      if (!res.ok) return setError(t(res.error));
      setPicking(false);
      // The page shows the "You picked a winner" pop-up (owner, 2026-10-11).
      router.push(wonHref, { scroll: false });
    });

  const starRow = (size: string) => (
    <div className="flex items-center" onMouseLeave={() => setHover(0)} role="group" aria-label={t("manage.review.rate", { n: stars })}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => rate(n)}
          onMouseEnter={() => setHover(n)}
          aria-label={t("manage.review.rate", { n })}
          aria-pressed={stars === n}
          className="flex size-8 items-center justify-center rounded-[10px] transition-transform hover:scale-110"
        >
          <StarIcon on={(hover || stars) >= n} className={size} />
        </button>
      ))}
    </div>
  );

  const heartButton = (
    <button
      type="button"
      onClick={toggleHeart}
      aria-pressed={heart}
      aria-label={heart ? t("manage.review.unshortlist") : t("manage.review.shortlist")}
      className={cx(
        "flex items-center justify-center gap-1.5 rounded-full transition-colors",
        variant === "card" ? "size-9" : "min-h-10 px-4 text-sm font-semibold ring-1",
        heart ? "bg-primary/10 text-primary ring-primary/30" : "text-muted ring-line hover:text-primary",
      )}
    >
      <svg viewBox="0 0 24 24" className={cx("size-5 transition-transform", heart && "scale-110")} fill={heart ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" strokeLinejoin="round" />
      </svg>
      {variant === "panel" && (heart ? t("manage.review.unshortlist") : t("manage.review.shortlist"))}
    </button>
  );

  const modals = (
    <>
      <Modal
        open={rejecting}
        onClose={() => setRejecting(false)}
        title={t("manage.reject.title", { n: number })}
        closeLabel={t("common.close")}
        footer={
          <div className="w-full space-y-2">
            {error && <Alert tone="danger">{error}</Alert>}
            <Button variant="danger" block size="lg" onClick={reject} loading={busy} disabled={!reason}>
              {t("manage.reject.confirm")}
            </Button>
          </div>
        }
      >
        <div className="space-y-2">
          {REJECT_REASONS.map((r) => (
            <label key={r} className={cx("flex cursor-pointer items-center gap-3 rounded-[14px] p-3 ring-1", reason === r ? "bg-danger/5 ring-2 ring-danger" : "ring-line hover:bg-chip")}>
              <input type="radio" name={`reject-${entryId}`} checked={reason === r} onChange={() => setReason(r)} className="size-4 accent-danger" />
              <span className="text-sm font-medium text-ink">{t(`manage.reject.reasons.${r}`)}</span>
            </label>
          ))}
        </div>
        <div className="mt-4">
          <TextAreaField label={t("manage.reject.note")} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} />
        </div>
      </Modal>
      <Modal
        open={picking}
        onClose={() => setPicking(false)}
        title={t("manage.winner.title", { n: number })}
        closeLabel={t("common.close")}
        footer={
          <div className="w-full space-y-2">
            {error && <Alert tone="danger">{error}</Alert>}
            <Button block size="lg" onClick={pick} loading={busy}>
              {t("manage.winner.confirm")}
            </Button>
          </div>
        }
      >
        <p className="text-ink">{t("manage.winner.body", { days: fileDays })}</p>
      </Modal>
    </>
  );

  if (variant === "card") {
    return (
      <div className="flex items-center justify-between gap-1">
        {starRow("size-4")}
        <div className="flex items-center">
          {heartButton}
          {canAct && (
            <div ref={menuRef} className="relative">
              <button type="button" onClick={() => setMenu(!menu)} aria-expanded={menu} aria-label={t("manage.review.more")} className="flex size-9 items-center justify-center rounded-full text-muted hover:bg-chip hover:text-ink">
                <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
                  <circle cx="5" cy="12" r="1.8" />
                  <circle cx="12" cy="12" r="1.8" />
                  <circle cx="19" cy="12" r="1.8" />
                </svg>
              </button>
              {menu && (
                <div role="menu" className="absolute bottom-full right-0 z-20 mb-1 w-48 overflow-hidden rounded-[14px] bg-surface py-1 shadow-card ring-1 ring-line animate-fade-in">
                  <button type="button" role="menuitem" onClick={() => (setMenu(false), setError(null), setPicking(true))} className="flex min-h-11 w-full items-center gap-2 px-4 text-left text-sm font-semibold text-primary hover:bg-chip">
                    {t("manage.winner.action")}
                  </button>
                  <button type="button" role="menuitem" onClick={() => (setMenu(false), setError(null), setRejecting(true))} className="flex min-h-11 w-full items-center gap-2 px-4 text-left text-sm text-danger hover:bg-chip">
                    {t("manage.reject.action")}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        {modals}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {starRow("size-6")}
        {heartButton}
      </div>
      {canAct && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button className="flex-1" onClick={() => (setError(null), setPicking(true))}>
            {t("manage.winner.action")}
          </Button>
          <Button variant="danger" onClick={() => (setError(null), setRejecting(true))}>
            {t("manage.reject.action")}
          </Button>
        </div>
      )}
      {modals}
    </div>
  );
}
