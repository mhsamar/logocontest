"use client";

/* eslint-disable @next/next/no-img-element */
import { LockedPicture } from "@/components/entries/hidden-bits";
import Link from "@/components/ui/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { WinnerBadge, WinnerTrophy } from "@/components/ui/trophy";
import { removeEntryPicture } from "@/lib/entries/actions";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";

/**
 * Waiting for approval (owner, 2026-10-16): large, under the design's title. Its designer reads why and that removing
 * the doubted picture publishes it; the team is sent to To approve.
 */
/** "_all": it waits only because every design waits for approval (owner, 2026-10-20), not because of a picture. */
export type HeldWho = "mine" | "team" | "mine_all" | "team_all";
const HELD_TEXT = { mine: "entry.heldNotice.mine", team: "entry.heldNotice.team", mine_all: "entry.heldNotice.mineAll", team_all: "entry.heldNotice.teamAll" } as const;

export function HeldNotice({ who }: { who: HeldWho }) {
  const { t } = useI18n();
  return (
    <div role="status" className="rounded-2xl border-2 border-gold bg-[#fff6d6] px-4 py-3" data-held-notice>
      <p className="m-0 flex items-center gap-2 text-lg font-bold text-gold-ink">
        <svg viewBox="0 0 24 24" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
        {t("entry.heldNotice.title")}
      </p>
      <p className="m-0 mt-1 text-[15px] leading-relaxed text-ink">{t(HELD_TEXT[who])}</p>
    </div>
  );
}

/**
 * P-04 (owner, 2026-10-08): every mockup of one design, large, with arrows,
 * swipe, keyboard and thumbnails; the design's details and comments beside it.
 */
export function EntryViewer({
  number,
  images,
  labels = [],
  closeHref,
  onClose,
  start = 0,
  byline,
  locked = false,
  winner = false,
  square = true,
  held = null,
  doubted = [],
  removable = null,
  children,
}: {
  /** False for a contest service's design in its real shape (owner, 2026-10-13). */
  square?: boolean;
  number: number;
  /** The winning design shows the Winner badge and trophy on the picture (owner, 2026-10-10). */
  winner?: boolean;
  images: string[];
  /** The designer's name for each image (owner, 2026-10-11), same order; may be empty. */
  labels?: (string | null)[];
  /** Where closing goes (the contest page), or `onClose` for a viewer opened on the spot (the dashboard, owner 2026-10-16). */
  closeHref?: string;
  onClose?: () => void;
  /** The picture shown first. */
  start?: number;
  byline: React.ReactNode;
  /** Waiting for approval (owner, 2026-10-16): the large note for its designer ("mine") or the team. */
  held?: HeldWho | null;
  /** Which pictures the design check doubted, same order as `images`. */
  doubted?: boolean[];
  /** Its designer may take single pictures off while the contest is open (owner, 2026-10-16); ids in `images` order. */
  removable?: { entryId: string; pictureIds: string[] } | null;
  /** Pro "Hide my design" (owner, 2026-10-14): this viewer sees a lock instead of the pictures. */
  locked?: boolean;
  /** Story and comment box, rendered on the server. */
  children: React.ReactNode;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [at, setI] = useState(start);
  // A picture was just removed: stay on the same place, or the last one.
  const i = Math.min(at, Math.max(0, images.length - 1));
  const touch = useRef<number | null>(null);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, run] = useTransition();
  const fmt = (n: number) => new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US").format(n);
  const go = (d: number) => setI((x) => (images.length ? (Math.min(x, images.length - 1) + d + images.length) % images.length : 0));
  const lastDoubt = doubted[i] === true && doubted.filter(Boolean).length === 1;

  const removeShown = () =>
    run(async () => {
      if (!removable) return;
      setError(null);
      const res = await removeEntryPicture(removable.entryId, removable.pictureIds[i]);
      if (!res.ok) return setError(t(res.error.key, res.error.params));
      setAsking(false);
      toast(res.published ? t("entry.picture.published", { n: fmt(number) }) : t("entry.picture.done", { i: fmt(res.picture) }));
    });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && ["TEXTAREA", "INPUT"].includes(e.target.tagName);
      // A dialog on top (e.g. Report) handles its own Escape.
      if (document.querySelector("dialog[open], [data-check-dialog]")) return;
      if (e.key === "Escape") {
        if (onClose) onClose();
        else router.push(closeHref ?? "/", { scroll: false });
      }
      else if (!typing && e.key === "ArrowRight") setI((x) => (x + 1) % Math.max(1, images.length));
      else if (!typing && e.key === "ArrowLeft") setI((x) => (x - 1 + images.length) % Math.max(1, images.length));
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [closeHref, onClose, images.length, router]);

  const arrow = (dir: -1 | 1) => (
    <button
      type="button"
      onClick={() => go(dir)}
      aria-label={dir < 0 ? t("entry.prev") : t("entry.next")}
      className={cx(
        "absolute top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink shadow-raised transition hover:bg-white",
        dir < 0 ? "left-3" : "right-3",
      )}
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
        <path d={dir < 0 ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-ink/80 backdrop-blur-sm sm:p-4" role="dialog" aria-modal="true" aria-label={t("entry.title", { n: fmt(number) })}>
      {onClose ? (
        <button type="button" onClick={onClose} className="absolute inset-0 cursor-default" aria-hidden tabIndex={-1} />
      ) : (
        <Link href={closeHref ?? "/"} scroll={false} className="absolute inset-0 cursor-default" aria-hidden tabIndex={-1} />
      )}
      <div className="relative flex w-full max-w-6xl flex-col overflow-hidden bg-surface shadow-panel sm:rounded-2xl lg:flex-row">
        {/* Images */}
        <div className="flex min-h-0 flex-col bg-canvas lg:flex-1">
          <div
            className="relative flex flex-1 items-center justify-center p-3 sm:p-5"
            onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
            onTouchEnd={(e) => {
              if (touch.current === null) return;
              const dx = e.changedTouches[0].clientX - touch.current;
              if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
              touch.current = null;
            }}
          >
            {locked && <LockedPicture title={t("pro.hide.lockedTitle")} sub={t("pro.hide.lockedSub")} ratio={square ? 1 : 4 / 3} large />}
            {images[i] && (
              <div className="relative">
                <img src={images[i]} alt={labels[i] ?? t("submit.mockups.image", { n: i + 1 })} className={cx(square && "aspect-square", "max-h-[52vh] w-auto max-w-full rounded-lg object-contain shadow-card lg:max-h-[72vh]")} />
                {winner && (
                  <>
                    <WinnerBadge label={t("entry.winner")} size="lg" className="absolute left-3 top-3" />
                    <WinnerTrophy size="lg" className="absolute right-3 top-3" />
                  </>
                )}
                {doubted[i] && (
                  <span className="absolute right-3 top-3 rounded-full bg-danger px-3 py-1 text-sm font-bold text-white shadow-card">{t("entry.picture.doubted")}</span>
                )}
                {removable && images.length > 1 && (
                  <button
                    type="button"
                    onClick={() => (setError(null), setAsking(true))}
                    className="absolute left-3 top-3 inline-flex min-h-10 items-center gap-1.5 rounded-full bg-white/95 px-3.5 text-sm font-bold text-danger shadow-card transition hover:bg-white"
                    data-remove-picture
                  >
                    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
                    </svg>
                    {t("entry.picture.remove")}
                  </button>
                )}
                {labels[i] && <p className="m-0 mt-2 truncate text-center text-sm font-semibold text-ink">{labels[i]}</p>}
              </div>
            )}
            {images.length > 1 && (
              <>
                {arrow(-1)}
                {arrow(1)}
                <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-ink/75 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-white">
                  {t("entry.counter", { i: fmt(i + 1), n: fmt(images.length) })}
                </span>
              </>
            )}
          </div>
          {images.length > 1 && (
            <ul className="flex gap-2 overflow-x-auto px-3 pb-3 sm:px-5 sm:pb-5">
              {images.map((src, j) => (
                <li key={src} className="shrink-0">
                  <button type="button" onClick={() => setI(j)} aria-label={labels[j] ?? t("submit.mockups.image", { n: j + 1 })} title={labels[j] ?? undefined} aria-current={i === j} className={cx("block size-14 overflow-hidden rounded-md ring-2 transition sm:size-16", i === j ? "ring-primary" : doubted[j] ? "ring-danger/70 opacity-80 hover:opacity-100" : "ring-transparent opacity-70 hover:opacity-100")}>
                    <img src={src} alt="" loading="lazy" className="h-full w-full bg-canvas object-contain" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Details and comments */}
        <aside className="flex min-h-0 flex-1 flex-col border-t border-line lg:w-[24rem] lg:flex-none lg:border-l lg:border-t-0">
          <div className="border-b border-line px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {/* Owner, 2026-10-16: larger title and name. */}
                <h2 className="text-2xl font-bold tracking-[-0.02em] text-ink">{t("entry.title", { n: fmt(number) })}</h2>
                <div className="mt-1 text-base text-muted">{byline}</div>
              </div>
              {onClose ? (
                <button type="button" onClick={onClose} aria-label={t("entry.close")} className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-canvas hover:text-ink">
                  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                  </svg>
                </button>
              ) : (
                <Link href={closeHref ?? "/"} scroll={false} aria-label={t("entry.close")} className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-canvas hover:text-ink">
                  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                  </svg>
                </Link>
              )}
            </div>
            {held && (
              <div className="mt-3">
                <HeldNotice who={held} />
              </div>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        </aside>
      </div>
      {removable && (
        <Modal
          open={asking}
          onClose={() => setAsking(false)}
          title={t("entry.picture.title", { i: fmt(i + 1), n: fmt(number) })}
          closeLabel={t("common.close")}
          footer={
            <div className="w-full space-y-2">
              {error && <Alert tone="danger">{error}</Alert>}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="secondary" size="lg" onClick={() => setAsking(false)}>
                  {t("entry.withdraw.keep")}
                </Button>
                <Button variant="danger" size="lg" onClick={removeShown} loading={busy}>
                  {t("entry.picture.confirm")}
                </Button>
              </div>
            </div>
          }
        >
          <div className="flex items-center gap-4">
            {images[i] && <img src={images[i]} alt="" className="size-20 shrink-0 rounded-lg bg-canvas object-contain ring-1 ring-line" />}
            <p className="m-0 text-ink">{t(lastDoubt ? "entry.picture.bodyLast" : "entry.picture.body")}</p>
          </div>
        </Modal>
      )}
    </div>
  );
}
