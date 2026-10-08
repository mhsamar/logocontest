"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { useI18n } from "@/lib/i18n/client";
import { ShareProfile } from "./share-profile";

/** P-06 "Share profile": opens a sheet with the link, share buttons and the QR code. */
export function ShareProfileButton(props: { url: string; qrSvg: string; qrDownloadHref: string; name: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 font-semibold text-white transition-colors hover:bg-primary-dark"
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v14" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {t("designerProfile.share")}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={t("designerProfile.share")} closeLabel={t("common.close")}>
        <ShareProfile {...props} stacked />
      </Modal>
    </>
  );
}
