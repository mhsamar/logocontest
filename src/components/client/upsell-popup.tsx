"use client";

import { useEffect, useState } from "react";
import { buttonClasses } from "@/components/ui/button";
import Link from "@/components/ui/link";
import { Modal } from "@/components/ui/modal";
import { useI18n } from "@/lib/i18n/client";
import { contestHref } from "@/lib/client/rules";
import { dhakaDate, upsellSeenKey, type Upsell } from "@/lib/client/upsell-rules";

/**
 * The client's daily pop-up (owner, 2026-11-02): final files to check, a winner to pick, more time on a contest's last
 * day, new designs to rate, or the add-ons that attract good designers (upsell-rules.ts). Once a day per contest and offer on this device; "Not now" or × closes it until tomorrow.
 * The button opens the contest's add-ons, where the client picks and pays as usual.
 */
export function UpsellPopup({ upsell }: { upsell: Upsell }) {
  const { t, price, locale } = useI18n();
  const num = (n: number) => new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US").format(n);
  const [open, setOpen] = useState(false);
  const key = upsellSeenKey(upsell);

  useEffect(() => {
    let seen: string | null = null;
    try {
      seen = localStorage.getItem(key);
    } catch {
      // Storage blocked: show it, as a first visit would.
    }
    if (seen === dhakaDate(new Date())) return;
    const id = window.setTimeout(() => setOpen(true), 1200);
    return () => window.clearTimeout(id);
  }, [key]);

  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(key, dhakaDate(new Date()));
    } catch {
      // Then it may show again on the next page; never an error.
    }
  };
  // Where each pop-up's button goes: the files to check, the designs (to pick or rate), or the add-ons.
  const href =
    upsell.mode === "files"
      ? `${contestHref(upsell.slug, "payment")}#files`
      : upsell.mode === "pick"
        ? contestHref(upsell.slug, "designs")
        : upsell.mode === "rate"
          ? contestHref(upsell.slug, "designs", { filter: "unrated" })
          : `${contestHref(upsell.slug, "payment")}#addons`;

  return (
    <Modal open={open} onClose={close} closeLabel={t("common.close")} title={t(`clientUpsell.${upsell.mode}.title`, { brand: upsell.brand, n: upsell.mode === "rate" ? num(upsell.count) : "" })}>
      {upsell.mode === "files" || upsell.mode === "pick" || upsell.mode === "rate" ? (
        <p className="m-0 text-[15.5px] text-ink">{t(`clientUpsell.${upsell.mode}.body`)}</p>
      ) : upsell.mode === "extend" ? (
        <div className="flex flex-col gap-3 text-[15.5px] text-ink">
          <p className="m-0">{t("clientUpsell.extend.body")}</p>
          <p className="m-0 rounded-[14px] bg-tint px-4 py-3 font-semibold">{t("clientUpsell.extend.price", { days: upsell.days.map(num).join(", "), price: price(upsell.price) })}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="m-0 text-[15.5px] text-ink">{t("clientUpsell.boost.body")}</p>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {upsell.items.map((i) => (
              <li key={i.key} className="flex items-start justify-between gap-3 rounded-[14px] bg-frame px-4 py-3">
                <span className="min-w-0">
                  <strong className="block text-[15px] text-ink">{t(`manage.addons.${i.key}.title`)}</strong>
                  <span className="block text-[13.5px] text-muted">{t(`manage.addons.${i.key}.line`)}</span>
                </span>
                <span className="shrink-0 text-[15px] font-bold text-primary">{i.free ? t("clientUpsell.free") : price(i.price)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-5 flex flex-col gap-2 pb-5 sm:flex-row-reverse">
        <Link href={href} onClick={close} className={buttonClasses({ size: "lg" })}>
          {t(`clientUpsell.${upsell.mode}.cta`)}
        </Link>
        <button type="button" onClick={close} className="min-h-12 rounded-[14px] px-5 text-[15px] font-bold text-muted hover:text-ink">
          {t("clientUpsell.later")}
        </button>
      </div>
    </Modal>
  );
}
