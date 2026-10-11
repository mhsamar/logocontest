"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/toast";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";

type Size = "square" | "story";

/**
 * Download and share a card picture (owner, 2026-10-11; Design/rewards/designer-win-card.html). On a phone, Share
 * opens the phone's share sheet with the picture, so it can go straight to Instagram or Facebook. On a computer,
 * Facebook shares the public page (its preview is the card) and Instagram downloads the picture, because
 * Instagram doesn't take posts from websites.
 */
export function CardShare({
  images,
  pageUrl,
  fileName,
  shareText,
  compact = false,
}: {
  images: Record<Size, string>;
  /** The public page to share and copy (/wins/<slug>). */
  pageUrl: string;
  fileName: string;
  shareText: string;
  /** The small row of three (Download, Facebook, Instagram) under a monthly prize card. */
  compact?: boolean;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [size, setSize] = useState<Size>("square");
  const [busy, setBusy] = useState<string | null>(null);

  const picture = async (): Promise<File> => {
    const res = await fetch(images[size]);
    if (!res.ok) throw new Error("card");
    const blob = await res.blob();
    return new File([blob], `${fileName}-${size}.png`, { type: "image/png" });
  };

  const save = (file: File) => {
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  /** The phone's share sheet with the picture, when the browser can share files. */
  const shareSheet = async (file: File) => {
    if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], text: shareText });
      return true;
    }
    return false;
  };

  const run = async (what: string, fn: () => Promise<void>) => {
    setBusy(what);
    try {
      await fn();
    } catch (err) {
      // Closing the share sheet is not an error.
      if (!(err instanceof DOMException && err.name === "AbortError")) toast(t("winCard.share.failed"), "danger");
    } finally {
      setBusy(null);
    }
  };

  const download = () => run("download", async () => save(await picture()));
  const facebook = () =>
    run("facebook", async () => {
      if (await shareSheet(await picture())) return;
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`, "_blank", "noopener,width=640,height=560");
    });
  const instagram = () =>
    run("instagram", async () => {
      const file = await picture();
      if (await shareSheet(file)) return;
      save(file);
      toast(t("winCard.share.instagramDownloaded"));
    });
  const copy = () =>
    run("copy", async () => {
      await navigator.clipboard.writeText(pageUrl);
      toast(t("winCard.share.copied"));
    });

  const icons = {
    download: (
      <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 20h14" />
      </svg>
    ),
    facebook: (
      <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5h1.5V4.4c-.3-.1-1.2-.2-2.2-.2-2.2 0-3.8 1.4-3.8 3.9v2.4H8v3h2.5V21z" />
      </svg>
    ),
    instagram: (
      <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="4" width="16" height="16" rx="5" />
        <circle cx="12" cy="12" r="3.6" />
        <path d="M16.8 7.2v.1" />
      </svg>
    ),
  };

  if (compact) {
    const small = "inline-flex min-h-11 flex-[1_1_auto] items-center justify-center gap-2 rounded-full border border-[#DCDEE3] bg-white px-3 text-[14.5px] font-bold disabled:opacity-60";
    return (
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={download} disabled={busy !== null} className={cx(small, "text-[#111216]")}>
          {icons.download}
          {busy === "download" ? t("winCard.share.working") : t("winCard.share.downloadShort")}
        </button>
        <button type="button" onClick={facebook} disabled={busy !== null} className={cx(small, "text-[#1553B7]")}>
          {icons.facebook}
          Facebook
        </button>
        <button type="button" onClick={instagram} disabled={busy !== null} className={cx(small, "text-[#A1126B]")}>
          {icons.instagram}
          Instagram
        </button>
      </div>
    );
  }

  const btn = "inline-flex min-h-[50px] items-center justify-center gap-2 rounded-full px-5 text-[16px] font-bold disabled:opacity-60";
  return (
    <div className="flex w-full flex-col items-start gap-4">
      <div role="radiogroup" aria-label={t("winCard.share.size")} className="flex gap-1.5 rounded-full bg-[#F4F5F7] p-[5px]">
        {(["square", "story"] as const).map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={size === s}
            onClick={() => setSize(s)}
            className={cx("min-h-10 rounded-full px-[18px] text-[15px] font-bold", size === s ? "bg-[#111216] text-white" : "text-[#3A3C45]")}
          >
            {t(`winCard.share.${s}`)}
          </button>
        ))}
      </div>
      <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
        <button type="button" onClick={download} disabled={busy !== null} className={cx(btn, "bg-[linear-gradient(180deg,#B3201B,#8B0000)] text-white")}>
          <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 20h14" />
          </svg>
          {busy === "download" ? t("winCard.share.working") : t("winCard.share.download")}
        </button>
        <button type="button" onClick={facebook} disabled={busy !== null} className={cx(btn, "border border-[#DCDEE3] bg-white text-[#1553B7]")}>
          <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5h1.5V4.4c-.3-.1-1.2-.2-2.2-.2-2.2 0-3.8 1.4-3.8 3.9v2.4H8v3h2.5V21z" />
          </svg>
          {t("winCard.share.facebook")}
        </button>
        <button type="button" onClick={instagram} disabled={busy !== null} className={cx(btn, "border border-[#DCDEE3] bg-white text-[#A1126B]")}>
          <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="4" width="16" height="16" rx="5" />
            <circle cx="12" cy="12" r="3.6" />
            <path d="M16.8 7.2v.1" />
          </svg>
          {t("winCard.share.instagram")}
        </button>
      </div>
      <button type="button" onClick={copy} className="inline-flex min-h-11 items-center gap-2 text-[15.5px] font-bold text-[#8B0000]">
        <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
          <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
        </svg>
        {t("winCard.share.copy")}
      </button>
      <p className="m-0 max-w-[520px] rounded-xl bg-[#F4F5F7] px-3.5 py-3 text-[14.5px] text-[#3A3C45]">
        <strong>{t("winCard.share.phoneLabel")}</strong> {t("winCard.share.phone")} <strong>{t("winCard.share.computerLabel")}</strong> {t("winCard.share.computer")}
      </p>
    </div>
  );
}
