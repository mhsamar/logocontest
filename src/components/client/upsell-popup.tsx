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

  // A winner to pick (owner, 2026-11-06): the big warning on every visit (once per browser session), not once a day.
  const pick = upsell.mode === "pick";
  useEffect(() => {
    let seen: string | null = null;
    try {
      seen = pick ? sessionStorage.getItem(key) : localStorage.getItem(key);
    } catch {
      // Storage blocked: show it, as a first visit would.
    }
    if (pick ? seen : seen === dhakaDate(new Date())) return;
    const id = window.setTimeout(() => setOpen(true), 1200);
    return () => window.clearTimeout(id);
  }, [key, pick]);

  const close = () => {
    setOpen(false);
    try {
      if (pick) sessionStorage.setItem(key, "1");
      else localStorage.setItem(key, dhakaDate(new Date()));
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
      {upsell.mode === "pick" ? (
        <PickWarning until={upsell.until} designs={upsell.designs} days={upsell.days} />
      ) : upsell.mode === "files" || upsell.mode === "rate" ? (
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

/**
 * The winner warning (owner, 2026-11-06): the contest ended, until when the client can pick, and that the prize is
 * shared among all the designers if no winner is picked in time, so they don't wait.
 */
function PickWarning({ until, designs, days }: { until: string | null; designs: number; days: number }) {
  const { t, locale } = useI18n();
  const num = (n: number) => new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US").format(n);
  const end = until ? new Date(until) : null;
  // eslint-disable-next-line react-hooks/purity -- the time left is read when the pop-up opens
  const left = end ? end.getTime() - Date.now() : null;
  const hours = left !== null ? Math.max(0, Math.ceil(left / 3_600_000)) : null;
  const date = end ? new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "long", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Dhaka" }).format(end) : null;
  return (
    <div className="flex flex-col gap-3.5 text-[15.5px] text-ink">
      <div className="flex items-start gap-3 rounded-[18px] bg-[linear-gradient(135deg,#8B0000,#B3201B)] px-4 py-4 text-white">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white/15" aria-hidden>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        </span>
        <span className="flex min-w-0 flex-col gap-1">
          <strong className="text-[18px] leading-snug">{t("clientUpsell.pick.ended")}</strong>
          {date && <span className="text-[14px] text-white/85">{t("clientUpsell.pick.until", { date })}</span>}
          {hours !== null && (
            <span className="mt-1 self-start rounded-[10px] bg-white px-3 py-1 text-[14px] font-bold text-primary">
              {hours >= 24 ? (hours % 24 ? t("clientUpsell.pick.daysHoursLeft", { d: num(Math.floor(hours / 24)), h: num(hours % 24) }) : t("clientUpsell.pick.daysLeft", { n: num(hours / 24) })) : t("clientUpsell.pick.hoursLeft", { n: num(hours) })}
            </span>
          )}
        </span>
      </div>
      <p role="alert" className="m-0 rounded-[16px] border-2 border-[#F2B8B5] bg-[#FDECEA] px-4 py-3.5 text-[16px] font-semibold leading-relaxed text-[#8B1E1E]">
        {t("clientUpsell.pick.warning", { days: num(days) })}
      </p>
      <p className="m-0">{designs > 0 ? t("clientUpsell.pick.designs", { n: num(designs) }) : t("clientUpsell.pick.body")}</p>
    </div>
  );
}
