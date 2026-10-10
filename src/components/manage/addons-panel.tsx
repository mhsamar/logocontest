"use client";

import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { buyAddon } from "@/lib/contests/addon-actions";
import type { AddonKey } from "@/lib/contests/addons";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";

type Item = AddonKey | "extend";

const ICONS: Record<Item, React.ReactNode> = {
  promote: <path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7Z" />,
  extend: (
    <>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2.5M9 2h6" />
    </>
  ),
  private: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  blind: <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A9.8 9.8 0 0 1 12 5c5 0 9 5 9 7a10 10 0 0 1-2.4 3.4M6.6 6.6C4.3 8 3 10.4 3 12c0 2 4 7 9 7a9.7 9.7 0 0 0 4.1-.9" />,
  logo_scan: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-4.3-4.3M3 7V4a1 1 0 0 1 1-1h3M21 7V4a1 1 0 0 0-1-1h-3" />
    </>
  ),
};

const TINT: Record<Item, string> = {
  promote: "from-[#fff7e0] to-[#ffe6a8] text-gold-ink",
  extend: "from-[#e8f1ff] to-[#d4e4ff] text-[#1d4ed8]",
  private: "from-[#f1ecff] to-[#e2d6ff] text-[#5b21b6]",
  blind: "from-[#eef2f7] to-[#dde3ec] text-ink",
  logo_scan: "from-[#e7f8f0] to-[#c9efdc] text-[#0f6b45]",
};

/**
 * C-13b add-ons (owner, 2026-10-08): one row per add-on with its benefit and either "Active"
 * or its price; buying picks bKash or card and goes to the gateway checkout. Rows sit side
 * by side with the price when there is room (pop-up) and stack in the narrow sidebar.
 */
export function AddonsPanel({
  contestId,
  open,
  active,
  prices,
  extensionDays,
  endsAt,
  locale,
}: {
  contestId: string;
  open: boolean;
  active: Record<AddonKey, boolean>;
  prices: Record<AddonKey, number> & { extensionPerDay: number };
  extensionDays: number[];
  endsAt: string | null;
  locale: "en" | "bn";
}) {
  const { t } = useI18n();
  const [buying, setBuying] = useState<Item | null>(null);
  const [days, setDays] = useState(extensionDays[0] ?? 3);
  const [method, setMethod] = useState<"bkash" | "card">("bkash");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const nf = new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US");
  const taka = (n: number) => `৳${nf.format(n)}`;
  const date = (d: Date) =>
    new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", {
      day: "numeric",
      month: "long",
      timeZone: "Asia/Dhaka",
    }).format(d);
  const price = (item: Item) => (item === "extend" ? prices.extensionPerDay * days : prices[item]);
  const items: Item[] = ["promote", "extend", "logo_scan", "private", "blind"];

  const pay = () =>
    start(async () => {
      if (!buying) return;
      setError(null);
      const res = await buyAddon(buying === "extend" ? { contestId, extensionDays: days, method } : { contestId, addon: buying, method });
      if (!res.ok) return setError(t(res.error));
      window.location.href = res.redirectUrl;
    });

  return (
    <>
      <ul className="@container grid gap-2.5">
        {items.map((item) => {
          const isActive = item !== "extend" && active[item];
          const status = isActive ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-success/10 px-3 py-1 text-sm font-semibold text-success">
              {/* A live dot that keeps pulsing while the add-on is on */}
              <span className="relative flex size-2" aria-hidden>
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-success/60" />
                <span className="relative inline-flex size-2 rounded-full bg-success" />
              </span>
              {t("manage.addons.active")}
            </span>
          ) : (
            <>
              <span className="text-sm font-bold text-ink transition-colors duration-300 group-hover:text-primary">{item === "extend" ? `${taka(prices.extensionPerDay)}/${locale === "bn" ? "দিন" : "day"}` : taka(prices[item])}</span>
              <button
                type="button"
                disabled={!open}
                onClick={() => (setError(null), setBuying(item))}
                className="btn-sheen relative inline-flex min-h-9 items-center overflow-clip rounded-full bg-ink px-4 text-sm font-semibold text-white transition-[background-color,box-shadow,scale] duration-200 hover:bg-primary-dark hover:shadow-[0_8px_20px_-8px_rgb(139_0_0/0.6)] active:scale-95 disabled:opacity-40"
              >
                {t("manage.addons.add")}
              </button>
            </>
          );
          // The add-on's icon on its colour tile.
          const icon = (
            <span
              className={cx(
                "flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-gradient-to-br",
                TINT[item],
              )}
            >
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                {ICONS[item]}
              </svg>
            </span>
          );
          return (
            <li
              key={item}
              data-tilt
              className={cx(
                "group relative grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 overflow-clip rounded-[20px] p-3 ring-1 transition-[box-shadow,--tw-ring-color] duration-300 hover:shadow-card @md:grid-cols-[auto_1fr_auto] @md:gap-x-4 @md:p-4",
                isActive ? "bg-success/5 ring-success/30" : "bg-surface ring-line hover:ring-[#f1c75c]/70",
              )}
            >
              {/* A light sheen sweeps across the row on hover */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/70 to-transparent opacity-0 transition-[left,opacity] duration-700 ease-out group-hover:left-full group-hover:opacity-100"
              />
              {icon}
              <div className="min-w-0">
                <p className="font-semibold text-ink">{t(`manage.addons.${item}.title`)}</p>
                <p className="text-xs leading-relaxed text-muted">{t(`manage.addons.${item}.line`)}</p>
              </div>
              <div className="col-span-2 flex items-center justify-between gap-3 @md:col-span-1 @md:justify-end">{status}</div>
            </li>
          );
        })}
      </ul>
      {!open && <p className="mt-3 text-sm text-muted">{t("manage.addons.closed")}</p>}

      <Modal
        open={buying !== null}
        onClose={() => setBuying(null)}
        title={buying ? t(`manage.addons.${buying}.title`) : ""}
        closeLabel={t("common.close")}
        footer={
          <div className="w-full space-y-2">
            {error && <Alert tone="danger">{error}</Alert>}
            <Button block size="lg" onClick={pay} loading={busy}>
              {buying ? t("manage.addons.pay", { amount: taka(price(buying)) }) : ""}
            </Button>
          </div>
        }
      >
        {buying && <p className="text-ink">{t(`manage.addons.${buying}.line`)}</p>}
        {buying === "extend" && (
          <div className="mt-4 grid grid-cols-3 gap-2">
            {extensionDays.map((d) => {
              const end = endsAt ? new Date(new Date(endsAt).getTime() + d * 86_400_000) : null;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDays(d)}
                  aria-pressed={days === d}
                  className={cx("rounded-[14px] p-3 text-center ring-1 transition-colors", days === d ? "bg-primary/5 ring-2 ring-primary" : "ring-line hover:bg-chip")}
                >
                  <span className="block font-bold text-ink">{t("manage.addons.extend.days", { n: nf.format(d) })}</span>
                  <span className="block text-sm font-semibold text-primary">{taka(prices.extensionPerDay * d)}</span>
                  {end && <span className="mt-1 block text-[0.6875rem] text-muted">{t("manage.addons.extend.newEnd", { date: date(end) })}</span>}
                </button>
              );
            })}
          </div>
        )}
        <p className="mt-5 text-sm font-medium text-ink">{t("manage.addons.payWith")}</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(["bkash", "card"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMethod(m)}
              aria-pressed={method === m}
              className={cx(
                "min-h-12 rounded-[14px] text-sm font-semibold ring-1 transition-colors",
                method === m ? "bg-ink text-white ring-ink" : "text-ink ring-line hover:bg-chip",
              )}
            >
              {t(`wizard.c11.${m}`)}
            </button>
          ))}
        </div>
      </Modal>
    </>
  );
}
