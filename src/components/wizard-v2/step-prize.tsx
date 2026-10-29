"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { UPGRADE_ICONS, UPGRADE_TINT } from "@/components/wizard/upgrade-meta";
import { pixelStartId, trackPixel } from "@/lib/analytics/meta-pixel";
import { PACKAGES, UPGRADES, type Order, type PackageKey, type UpgradeKey } from "@/lib/contests/brief";
import { activeUpgrades, addonsFreeFor, calculatePrice, includedByNda, prizeFor, prizeWithFee, validateOrder, type PricingConfig } from "@/lib/contests/pricing";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";
import type { MessageKey, MessageParams } from "@/lib/i18n/translate";
import { formatTaka } from "@/lib/money";
import type { V2Actions } from "./wizard-v2";

// The AI logo checker is free on every logo contest (owner, 2026-10-14): not an add-on.
const ADDONS = UPGRADES.filter((u): u is Exclude<UpgradeKey, "logo_scan"> => u !== "logo_scan");
const SAVE_AFTER_MS = 600;

const Check = () => (
  <svg viewBox="0 0 24 24" className="mt-0.5 size-4 shrink-0 text-success" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

/**
 * Step 3, the prize (spec §2: the critical step, about two phone screens): the six packages as small cards, the
 * length as chips, the add-ons folded into one row, the total. Same packages, prices, fee rule and add-ons as the old
 * wizard (Admin › Pricing). Every change is saved as the client picks.
 */
export function PrizeV2(props: {
  actions: V2Actions;
  contestId: string;
  config: PricingConfig;
  order: Order;
  onOrder: (order: Order) => void;
  whatsapp: string;
  /** The step's buttons: the team's help card keeps clear of them. */
  onBar: (el: HTMLDivElement | null) => void;
  onError: (message: string | null) => void;
  onBack: () => void;
  onDone: () => void;
}) {
  const { t, locale } = useI18n();
  const { config, order, actions, contestId } = props;
  const taka = (n: number) => formatTaka(n, locale);
  const [busy, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [otherDays, setOtherDays] = useState(!config.durationOptions.includes(order.durationDays));
  const [customTouched, setCustomTouched] = useState(false);
  // "Today" is read once, so the end date stays put while the client picks.
  const [today] = useState(() => Date.now());

  // Seen the prizes: once per contest, for the team and Meta (spec §5: ViewContent).
  useEffect(() => {
    void actions.viewPricing({ contestId });
    trackPixel(`view:${contestId}`, "ViewContent");
  }, [actions, contestId]);

  // Saved after each change, one save at a time; `picked` once a package card was chosen. A save that fails keeps its
  // order waiting, so "Go to payment" saves it again and never goes on with an older order.
  const pending = useRef<{ order: Order; picked: boolean } | null>(null);
  const timer = useRef<number | null>(null);
  const inflight = useRef<Promise<boolean> | null>(null);
  const failed = useRef(false);
  const [saveError, setSaveError] = useState<{ key: MessageKey; params?: MessageParams } | null>(null);
  const flush = useCallback(async (): Promise<boolean> => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    while (inflight.current) await inflight.current;
    const next = pending.current;
    if (!next) return !failed.current;
    pending.current = null;
    if (validateOrder(next.order, config)) return false;
    const run = actions
      .saveOrder({ contestId, order: next.order, picked: next.picked })
      .then(
        (res) => (setSaveError(res.ok ? null : res.error), res.ok),
        () => (setSaveError({ key: "wizard.errors.notSaved" }), false),
      )
      .then((ok) => {
        failed.current = !ok;
        if (!ok && !pending.current) pending.current = next;
        return ok;
      });
    inflight.current = run;
    try {
      return await run;
    } finally {
      inflight.current = null;
    }
  }, [actions, config, contestId]);
  // A tap (package, length, add-on) is saved at once; typing a prize or sliding the length waits a moment.
  const change = (patch: Partial<Order>, picked = false, soon = true) => {
    const next = { ...order, ...patch };
    props.onOrder(next);
    pending.current = { order: next, picked: picked || Boolean(pending.current?.picked) };
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flush(), soon ? 0 : SAVE_AFTER_MS);
  };
  useEffect(() => {
    // Leaving the tab (the WhatsApp button, another app, closing it) saves what is still waiting.
    const hide = () => document.visibilityState === "hidden" && void flush();
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", hide);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("pagehide", hide);
      void flush();
    };
  }, [flush]);

  const error = validateOrder(order, config);
  const price = error ? null : calculatePrice(order, config);
  const prize = prizeFor(order, config);
  const active = activeUpgrades(order);
  const best = config.bestResultsFrom ?? 0;
  const freeFrom = config.addonsFreeFrom ?? 0;
  const allFree = addonsFreeFor(prize, config);
  const chosen = ADDONS.filter((u) => order.upgrades[u]);
  const cheapest = Math.min(...ADDONS.map((u) => config.upgradePrices[u]));
  const ends = new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "long", timeZone: "Asia/Dhaka" }).format(new Date(today + order.durationDays * 86_400_000));
  const fill = ((order.durationDays - config.durationMin) / Math.max(1, config.durationMax - config.durationMin)) * 100;
  const pkgName = (p: PackageKey) => t(`wizard.packages.${p}.name`);

  const next = () => {
    if (!price) return;
    props.onError(null);
    start(async () => {
      // The last choice is saved first (anything still waiting, or a save that failed); the payment step prices what
      // was saved.
      if (failed.current && !pending.current) pending.current = { order, picked: false };
      if (!(await flush())) return;
      trackPixel(`initiate:v2:${pixelStartId()}`, "InitiateCheckout", { value: price.total, currency: "BDT" });
      props.onDone();
    });
  };

  return (
    // Room at the bottom on phones so the WhatsApp button never covers Back.
    <div className="flex flex-col gap-6 max-[720px]:pb-16">
      {best > 0 && (
        <div className={cx("rounded-2xl p-4 ring-1", prize >= best ? "bg-success/5 ring-success/25" : "bg-[#FFF8E6] ring-[#F0D27A]")} role="note">
          <p className="m-0 text-[15.5px] font-semibold leading-snug text-ink">{prize >= best ? t("wizardV2.prize.bestReached") : t("wizardV2.prize.bestTitle", { amount: taka(best) })}</p>
          {prize < best && <p className="m-0 mt-1 text-sm leading-relaxed text-ink/80">{t("wizardV2.prize.bestBody", { amount: taka(best) })}</p>}
        </div>
      )}

      {/* Six small cards, three to a row on every screen; the chosen one's line goes under the grid. */}
      <div>
        <div className="grid grid-cols-3 gap-2">
          {PACKAGES.map((p) => {
            const on = order.package === p;
            const amount = p === "custom" ? null : config.packagePrizes[p];
            return (
              <button
                key={p}
                type="button"
                aria-pressed={on}
                onClick={() => change({ package: p, customPrize: p === "custom" ? (order.customPrize ?? config.customMin) : order.customPrize }, true)}
                className={cx(
                  "relative flex min-h-[92px] flex-col justify-between rounded-2xl px-2.5 pb-2.5 pt-3 text-left transition-[box-shadow,background-color] duration-200",
                  on ? "bg-tint/60 shadow-card ring-2 ring-primary" : "bg-surface ring-1 ring-line hover:shadow-card",
                )}
              >
                {p === "standard" && (
                  <span className="absolute -top-2 right-1.5 rounded-full bg-[image:var(--gradient-red)] px-2 py-px text-[10px] font-bold text-white">{t("wizard.packages.recommended")}</span>
                )}
                <span className="text-[12.5px] font-bold leading-tight text-muted">{pkgName(p)}</span>
                <span className="mt-1 block text-[17px] font-semibold leading-tight tracking-[-0.02em] text-primary tabular-nums sm:text-[19px]">
                  {amount ? taka(amount) : t("wizard.packages.custom.price")}
                </span>
                {amount ? <span className="mt-0.5 block text-[11px] leading-tight text-muted">{t("wizardV2.prize.youPay", { total: taka(prizeWithFee(amount, config)) })}</span> : <span className="mt-0.5 block text-[11px] text-muted">&nbsp;</span>}
              </button>
            );
          })}
        </div>
        <p className="m-0 mt-3 text-sm text-ink">{t(`wizardV2.prize.lines.${order.package}`)}</p>
        {order.package === "custom" && (
          <div className="mt-3">
            <TextField
              label={t("wizardV2.prize.custom")}
              hint={t("wizard.c08.customHint", { min: taka(config.customMin), step: taka(config.customStep) })}
              type="number"
              inputMode="numeric"
              min={config.customMin}
              step={config.customStep}
              value={order.customPrize ?? ""}
              onChange={(e) => change({ customPrize: e.target.value === "" ? null : Math.floor(Number(e.target.value)) }, true, false)}
              onBlur={() => setCustomTouched(true)}
              error={customTouched && error?.startsWith("custom") ? t(`wizard.errors.${error}` as "wizard.errors.custom_min", { min: taka(config.customMin), step: taka(config.customStep), example: taka(config.customMin + config.customStep) }) : undefined}
            />
          </div>
        )}
        {prize > 0 && (
          <p className="m-0 mt-2 flex flex-wrap items-baseline justify-between gap-x-3 text-sm text-muted">
            <span>{t("wizardV2.prize.summary", { package: pkgName(order.package), prize: taka(prize) })}</span>
            <span className="font-semibold text-ink tabular-nums">{taka(prizeWithFee(prize, config))}</span>
          </p>
        )}
      </div>

      {/* Length: chips, "Other" opens the slider. */}
      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-2.5 text-[15px] font-semibold text-ink">{t("wizardV2.prize.duration")}</legend>
        <div className="flex flex-wrap gap-2">
          {config.durationOptions.map((d) => {
            const on = !otherDays && order.durationDays === d;
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setOtherDays(false);
                  change({ durationDays: d });
                }}
                className={cx("min-h-11 rounded-[14px] px-3.5 text-[14.5px] font-semibold transition-colors", on ? "bg-ink text-white" : "bg-chip text-ink hover:bg-line")}
              >
                {t("wizardV2.prize.days", { n: d })}
              </button>
            );
          })}
          <button
            type="button"
            aria-pressed={otherDays}
            onClick={() => setOtherDays(true)}
            className={cx("min-h-11 rounded-[14px] px-3.5 text-[14.5px] font-semibold transition-colors", otherDays ? "bg-ink text-white" : "bg-chip text-ink hover:bg-line")}
          >
            {t("wizardV2.prize.otherDays")}
          </button>
        </div>
        {otherDays && (
          <div className="mt-3 rounded-2xl bg-surface p-3.5 ring-1 ring-line">
            <div className="flex justify-between text-sm font-semibold text-ink">
              <span>{t("wizardV2.prize.days", { n: order.durationDays })}</span>
            </div>
            <input
              type="range"
              aria-label={t("wizardV2.prize.duration")}
              min={config.durationMin}
              max={config.durationMax}
              step={1}
              value={order.durationDays}
              onChange={(e) => change({ durationDays: Number(e.target.value) }, false, false)}
              className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-full accent-primary"
              style={{ background: `linear-gradient(to right, var(--color-primary) ${fill}%, var(--color-line) ${fill}%)` }}
            />
          </div>
        )}
        <p className="m-0 mt-2 text-sm text-muted">{t("wizardV2.prize.ends", { date: ends })}</p>
      </fieldset>

      {/* Add-ons, folded into one row until opened. */}
      <div className="overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
        <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex min-h-[60px] w-full items-center gap-3 px-4 py-3 text-left">
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-ink">{t("wizardV2.prize.addons")}</span>
            <span className="mt-0.5 block text-[13px] leading-snug text-muted">
              {chosen.length === 0
                ? t("wizardV2.prize.addonsFrom", { names: ADDONS.map((u) => t(`wizard.upgrades.${u}.name`)).join(", "), price: taka(cheapest) })
                : t(chosen.length === 1 ? "wizardV2.prize.addonsChosenOne" : "wizardV2.prize.addonsChosen", { n: chosen.length, sum: taka(price?.upgradesTotal ?? 0) })}
            </span>
          </span>
          {open && <span className="text-sm font-bold text-primary">{t("wizardV2.prize.close")}</span>}
          <svg viewBox="0 0 24 24" className={cx("size-5 shrink-0 text-muted transition-transform", open && "rotate-180")} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {open && (
          <div className="border-t border-line px-3 pb-3 pt-3">
            {freeFrom > 0 && (
              <span className={cx("mb-2 inline-flex rounded-full px-3 py-1 text-[12.5px] font-bold", allFree ? "bg-success/10 text-success" : "bg-[#FFF8E6] text-[#7A5A00]")}>{t("wizardV2.prize.addonsFree", { amount: taka(freeFrom) })}</span>
            )}
            <ul className="m-0 list-none divide-y divide-line p-0">
              {ADDONS.map((u) => {
                const on = active[u];
                const included = includedByNda(order, u);
                return (
                  <li key={u}>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={on}
                      disabled={included}
                      onClick={() => change({ upgrades: { ...order.upgrades, [u]: !order.upgrades[u] } })}
                      className="flex w-full items-center gap-3 py-3 text-left disabled:cursor-default"
                    >
                      <span className={cx("flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-gradient-to-br", UPGRADE_TINT[u])}>
                        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          {UPGRADE_ICONS[u]}
                        </svg>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-baseline gap-x-2">
                          <span className="text-[14.5px] font-semibold text-ink">{t(`wizard.upgrades.${u}.name`)}</span>
                          <span className={cx("text-[13px] font-bold tabular-nums", included || allFree ? "text-success" : "text-primary")}>
                            {included ? t("wizardV2.prize.included") : allFree ? t("wizardV2.prize.free") : `+${taka(config.upgradePrices[u])}`}
                          </span>
                        </span>
                        <span className="mt-0.5 block text-[13px] leading-snug text-muted">{t(`wizardV2.prize.addon.${u}`)}</span>
                      </span>
                      <span aria-hidden className={cx("relative h-6 w-11 shrink-0 rounded-full transition-colors", on ? (included ? "bg-success" : "bg-primary") : "bg-line")}>
                        <span className={cx("absolute top-0.5 size-5 rounded-full bg-white shadow-card transition-[left]", on ? "left-[1.375rem]" : "left-0.5")} />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <Button type="button" variant="secondary" block onClick={() => setOpen(false)} className="mt-2">
              {t("wizardV2.prize.closeAll")}
            </Button>
          </div>
        )}
      </div>

      <ul className="m-0 list-none space-y-1.5 p-0 text-sm text-ink">
        <li className="flex gap-2">
          <Check />
          {t("wizardV2.prize.trustHeld")}
        </li>
        <li className="flex gap-2">
          <Check />
          {t("wizardV2.prize.trustBkash")}
        </li>
      </ul>

      <div>
        <p className="m-0 flex items-baseline justify-between gap-3 border-t border-line pt-4">
          <span className="text-[15px] text-muted">{t("wizardV2.prize.total")}</span>
          <span className="text-[22px] font-semibold tracking-[-0.02em] text-ink tabular-nums" data-total>
            {price ? taka(price.total) : "—"}
          </span>
        </p>
        {saveError && (
          <div className="mt-3">
            <Alert tone="danger">{t(saveError.key, saveError.params)}</Alert>
          </div>
        )}
        <div ref={(el) => props.onBar(el)} className="mt-4 flex flex-col gap-2">
          <Button type="button" size="lg" block loading={busy} disabled={!price} onClick={next}>
            {t("wizardV2.prize.pay")}
          </Button>
          <Button type="button" variant="ghost" block onClick={props.onBack}>
            {t("wizardV2.back")}
          </Button>
        </div>
      </div>

      {/* Questions about the price: the team's WhatsApp, on this step only. */}
      <a
        href={props.whatsapp}
        aria-label={t("wizardV2.prize.whatsapp")}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-30 flex min-h-12 items-center gap-2 rounded-full bg-[#25D366] px-4 text-[14px] font-bold text-white shadow-card"
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
          <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.2-.7-2.7-1.1-4.4-3.8-4.6-4-.1-.2-1.1-1.5-1.1-2.8s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.3.5-.4.5c-.1.1-.3.3-.1.6.2.3.8 1.3 1.6 2 1.1 1 2 1.3 2.3 1.4.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.3Z" />
        </svg>
        <span className="max-[380px]:hidden">{t("wizardV2.prize.whatsapp")}</span>
      </a>
    </div>
  );
}
