"use client";

/* eslint-disable @next/next/no-img-element */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCheckEntry } from "@/components/logo-check/checker-box";
import { Button, ButtonLink } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { WinnerBadge, WinnerTrophy } from "@/components/ui/trophy";
import { useI18n } from "@/lib/i18n/client";

/**
 * C-16 (owner, 2026-10-11): right after the client picks the winner, a pop-up with the winning design, a
 * congratulation message and two buttons: the AI copyright checker for that design, and Go to dashboard.
 * The page opens it from `?won=N`, so it survives the refresh after picking.
 */
export function WinnerPopup({
  entryId,
  number,
  brand,
  designer,
  cover,
  fileDays,
  closeHref,
}: {
  entryId: string;
  number: number;
  brand: string;
  designer: string | null;
  cover: string | null;
  fileDays: number;
  closeHref: string;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const checkEntry = useCheckEntry();
  // Rendered only when the page has ?won=N, so it starts open (the Modal opens its dialog once mounted).
  const [open, setOpen] = useState(true);
  const fmt = (n: number) => new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US").format(n);

  const close = () => {
    setOpen(false);
    router.replace(closeHref, { scroll: false });
  };
  const check = () => {
    setOpen(false);
    router.replace(closeHref, { scroll: false });
    // The add-on isn't bought, no checks are left or the checker is off: show the checker box, which says why.
    if (!checkEntry(entryId)) setTimeout(() => document.getElementById("addons")?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={t("manage.winner.popup.title")}
      closeLabel={t("common.close")}
      footer={
        <div className="flex w-full flex-col gap-2 sm:flex-row">
          <Button size="lg" className="flex-1" onClick={check}>
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3Z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
            {t("manage.winner.popup.checker")}
          </Button>
          <ButtonLink href="/dashboard" variant="secondary" size="lg" className="flex-1">
            {t("manage.winner.popup.dashboard")}
          </ButtonLink>
        </div>
      }
    >
      <div className="flex flex-col items-center text-center">
        <div className="relative w-full max-w-[16rem] overflow-hidden rounded-[22px] bg-canvas shadow-card ring-2 ring-primary">
          {cover ? <img src={cover} alt={t("entry.title", { n: fmt(number) })} className="aspect-square w-full object-cover" /> : <div className="aspect-square w-full" />}
          <WinnerBadge label={t("entry.winner")} className="absolute left-2.5 top-2.5" />
          <WinnerTrophy className="absolute right-2.5 top-2.5" />
        </div>
        <p className="m-0 mt-5 text-xl font-semibold tracking-[-0.02em] text-ink">{t("manage.winner.popup.heading", { brand })}</p>
        <p className="m-0 mt-2 text-sm text-muted">
          {designer ? t("manage.winner.popup.picked", { n: fmt(number), name: designer }) : t("manage.winner.popup.pickedNoName", { n: fmt(number) })}
        </p>
        <p className="m-0 mt-3 rounded-[16px] bg-chip px-4 py-3 text-sm text-ink">{t("manage.winner.popup.next", { days: fmt(fileDays) })}</p>
      </div>
    </Modal>
  );
}
