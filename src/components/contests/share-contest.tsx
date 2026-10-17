"use client";

import { ShareButtons } from "@/components/share/share-buttons";
import { useI18n } from "@/lib/i18n/client";

/**
 * P-03 stats card: share this contest on Facebook, Pinterest or WhatsApp, or copy its link (owner, 2026-10-08;
 * Pinterest 2026-10-18). `pin` is the tall Pinterest picture, only for contests anyone may see.
 */
export function ShareContest({ url, brand, pin }: { url: string; brand: string; pin?: string | null }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm font-semibold text-ink">{t("contest.share.title")}</p>
      <ShareButtons url={url} media={pin} text={t("contest.share.text", { brand })} />
    </div>
  );
}
