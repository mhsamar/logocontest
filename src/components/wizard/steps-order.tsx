"use client";

import { useRef, useState } from "react";
import { GlideTrack } from "@/components/ui/glide-track";
import { UPGRADE_ICONS, UPGRADE_TINT } from "./upgrade-meta";
import { Checkbox, TextField } from "@/components/ui/field";
import { PACKAGES, UPGRADES, type Order } from "@/lib/contests/brief";
import { activeUpgrades, includedByNda, prizeWithFee, validateOrder, type PricingConfig } from "@/lib/contests/pricing";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";
import { formatTaka } from "@/lib/money";
import { deleteFile, putFile } from "./file-store";
import type { LocalFile, ServerFile } from "./state";

const ACCEPT: Record<string, true> = { "image/jpeg": true, "image/png": true, "application/pdf": true };

// C-07
export function FilesStep({
  localFiles,
  serverFiles,
  limits,
  onChange,
  onRemoveServerFile,
}: {
  localFiles: LocalFile[];
  serverFiles: ServerFile[];
  limits: { maxFiles: number; maxMb: number };
  onChange: (files: LocalFile[]) => void;
  onRemoveServerFile: (id: string) => void;
}) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const total = localFiles.length + serverFiles.length;

  const add = async (list: FileList | null) => {
    if (!list) return;
    const problems: string[] = [];
    const added: LocalFile[] = [];
    for (const file of Array.from(list)) {
      if (total + added.length >= limits.maxFiles) {
        problems.push(t("wizard.errors.fileCount", { max: limits.maxFiles }));
        break;
      }
      if (!ACCEPT[file.type]) {
        problems.push(t("wizard.errors.fileType", { name: file.name }));
        continue;
      }
      if (file.size > limits.maxMb * 1024 * 1024) {
        problems.push(t("wizard.errors.fileSize", { name: file.name, mb: limits.maxMb }));
        continue;
      }
      const id = crypto.randomUUID();
      await putFile(id, file);
      added.push({ id, name: file.name, type: file.type, size: file.size, isCurrentLogo: false });
    }
    setErrors(problems);
    if (added.length) onChange([...localFiles, ...added]);
    if (input.current) input.current.value = "";
  };

  const remove = async (id: string) => {
    await deleteFile(id);
    onChange(localFiles.filter((f) => f.id !== id));
  };

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void add(e.dataTransfer.files);
        }}
        disabled={total >= limits.maxFiles}
        className={cx(
          "flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed bg-surface px-4 py-8 text-center transition-colors disabled:opacity-50",
          dragging ? "border-primary bg-primary/10" : "border-line hover:border-primary",
        )}
      >
        <svg viewBox="0 0 24 24" className="size-8 text-primary" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M12 16V4m0 0L7 9m5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="font-semibold text-ink">{t("wizard.c07.choose")}</span>
        <span className="hidden text-sm text-muted sm:block">{t("wizard.c07.drag")}</span>
        <span className="text-xs text-muted">{t("wizard.c07.limits", { max: limits.maxFiles, mb: limits.maxMb })}</span>
      </button>
      <input
        ref={input}
        type="file"
        accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
        multiple
        hidden
        onChange={(e) => void add(e.target.files)}
      />

      {errors.length > 0 && (
        <ul role="alert" className="space-y-1 text-sm text-danger">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      {total > 0 && (
        <ul className="m-0 list-none divide-y divide-line overflow-hidden rounded-[20px] border border-line bg-surface p-0">
          {serverFiles.map((f) => (
            <FileRow key={f.id} name={f.name} type={f.type} onRemove={() => onRemoveServerFile(f.id)} removeLabel={t("wizard.c07.remove", { name: f.name })} />
          ))}
          {localFiles.map((f) => (
            <FileRow
              key={f.id}
              name={f.name}
              type={f.type}
              removeLabel={t("wizard.c07.remove", { name: f.name })}
              onRemove={() => void remove(f.id)}
              extra={
                <Checkbox
                  className="py-0"
                  label={<span className="text-sm">{t("wizard.c07.currentLogo")}</span>}
                  checked={f.isCurrentLogo}
                  onChange={(e) => onChange(localFiles.map((x) => (x.id === f.id ? { ...x, isCurrentLogo: e.target.checked } : x)))}
                />
              }
            />
          ))}
        </ul>
      )}

      <p className="m-0 rounded-[18px] bg-chip px-4 py-3 text-sm text-muted">{t("wizard.c07.note")}</p>
    </div>
  );
}

function FileRow({
  name,
  type,
  onRemove,
  removeLabel,
  extra,
}: {
  name: string;
  type: string;
  onRemove: () => void;
  removeLabel: string;
  extra?: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 px-3 py-2">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-tint text-[0.6875rem] font-bold uppercase text-primary">
        {type === "application/pdf" ? "PDF" : type === "image/png" ? "PNG" : "JPG"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{name}</p>
        {extra}
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={removeLabel}
        className="flex size-11 shrink-0 items-center justify-center rounded-[12px] text-muted hover:bg-chip hover:text-danger"
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
        </svg>
      </button>
    </li>
  );
}

// C-08 (owner, 2026-10-08): five packages + Custom, 3–30 day contests, seven add-ons, motion everywhere.

// Amounts in a clear dark gold so they read easily (owner, 2026-10-08).
const AMOUNT = "lc-d text-primary tracking-[-0.03em]";

export function PackageStep({
  order,
  update,
  config,
}: {
  order: Order;
  update: (patch: Partial<Order>) => void;
  config: PricingConfig;
}) {
  const { t, locale } = useI18n();
  const taka = (n: number) => formatTaka(n, locale);
  const orderError = validateOrder(order, config);
  const [customTouched, setCustomTouched] = useState(false);
  const active = activeUpgrades(order);
  // "Today" is read once, so the end date shown under the slider stays put while the client picks.
  const [today] = useState(() => Date.now());
  const endDate = new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "long", timeZone: "Asia/Dhaka" }).format(new Date(today + order.durationDays * 86_400_000));
  const fill = ((order.durationDays - config.durationMin) / Math.max(1, config.durationMax - config.durationMin)) * 100;

  const customError =
    order.package === "custom" && customTouched && orderError?.startsWith("custom")
      ? t(`wizard.errors.${orderError}` as "wizard.errors.custom_min", {
          min: taka(config.customMin),
          step: taka(config.customStep),
          example: taka(config.customMin + config.customStep),
        })
      : undefined;

  return (
    <div className="space-y-9">
      {/* Packages */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {PACKAGES.map((pkg) => {
          const on = order.package === pkg;
          const prize = pkg === "custom" ? null : config.packagePrizes[pkg];
          const elite = pkg === "elite";
          return (
            <button
              key={pkg}
              type="button"
              onClick={() => update({ package: pkg })}
              aria-pressed={on}
              className={cx(
                "group relative flex flex-col rounded-[22px] p-4 text-left transition-[box-shadow,background-color] duration-300",
                on ? "bg-tint/50 shadow-card ring-2 ring-primary" : "bg-surface ring-1 ring-line hover:shadow-card",
                elite && !on && "ring-[#f1c75c]",
              )}
            >
              {pkg === "standard" && (
                <span className="absolute -top-2.5 right-3 rounded-full bg-[image:var(--gradient-red)] px-2.5 py-0.5 text-[0.6875rem] font-bold text-white">
                  {t("wizard.packages.recommended")}
                </span>
              )}
              <span className="flex items-center justify-between gap-2">
                <span className={cx("text-sm font-bold", elite ? "text-gold-ink" : "text-muted")}>
                  {elite && "👑 "}
                  {t(`wizard.packages.${pkg}.name`)}
                </span>
                <span
                  aria-hidden
                  className={cx(
                    "flex size-5 items-center justify-center rounded-full transition-[background-color,scale] duration-300",
                    on ? "scale-100 bg-[image:var(--gradient-red)] text-white" : "scale-90 ring-1 ring-line",
                  )}
                >
                  {on && (
                    <svg viewBox="0 0 24 24" className="size-3.5 animate-pop-in" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12.5l4.5 4.5L19 7.5" />
                    </svg>
                  )}
                </span>
              </span>
              <span className={cx("mt-1 block text-2xl font-semibold tabular-nums sm:text-[1.65rem]", AMOUNT)}>
                {prize ? taka(prize) : t("wizard.packages.custom.price")}
              </span>
              <span className="mt-1 block text-sm leading-snug text-ink">{t(`wizard.packages.${pkg}.line`)}</span>
              {prize && (
                <span className="mt-auto block pt-2 text-xs text-muted">
                  {t("wizard.packages.youPay", { total: taka(prizeWithFee(prize, config)) })}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {order.package === "custom" && (
        <div className="animate-rise">
          <TextField
            label={t("wizard.c08.customLabel")}
            hint={t("wizard.c08.customHint", { min: taka(config.customMin), step: taka(config.customStep) })}
            type="number"
            inputMode="numeric"
            min={config.customMin}
            step={config.customStep}
            value={order.customPrize ?? ""}
            onChange={(e) => update({ customPrize: e.target.value === "" ? null : Math.floor(Number(e.target.value)) })}
            onBlur={() => setCustomTouched(true)}
            error={customError}
            autoFocus
          />
        </div>
      )}

      {/* Contest length: quick chips + any day from min to max */}
      <fieldset>
        <legend className="mb-3 text-base font-semibold text-ink">{t("wizard.c08.durationTitle")}</legend>
        <GlideTrack>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
            {config.durationOptions.map((d) => {
              const on = order.durationDays === d;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => update({ durationDays: d })}
                  aria-pressed={on}
                  className={cx(
                    "relative min-h-11 rounded-[14px] px-2 text-[15px] font-semibold transition-[background-color,color,scale] duration-200 active:scale-95",
                    on ? "bg-ink text-white" : "bg-chip text-ink hover:bg-line",
                  )}
                >
                  {t("wizard.c08.days", { days: d })}
                </button>
              );
            })}
          </div>
        </GlideTrack>
        <div className="mt-4 rounded-[20px] border border-line bg-surface p-4">
          <div className="flex items-center justify-between gap-3 text-sm">
            <label htmlFor="duration-slider" className="font-medium text-muted">
              {t("wizard.c08.durationSlider")}
            </label>
            <span key={order.durationDays} className="animate-pop-in font-semibold text-ink">
              {t("wizard.c08.durationEnds", { days: order.durationDays, date: endDate })}
            </span>
          </div>
          <input
            id="duration-slider"
            type="range"
            min={config.durationMin}
            max={config.durationMax}
            step={1}
            value={order.durationDays}
            onChange={(e) => update({ durationDays: Number(e.target.value) })}
            className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full accent-primary"
            style={{ background: `linear-gradient(to right, var(--color-primary) ${fill}%, var(--color-line) ${fill}%)` }}
          />
          <div className="mt-1 flex justify-between text-xs text-muted">
            <span>{t("wizard.c08.days", { days: config.durationMin })}</span>
            <span>{t("wizard.c08.days", { days: config.durationMax })}</span>
          </div>
        </div>
      </fieldset>

      {/* Add-ons */}
      <fieldset>
        <legend className="mb-3 text-base font-semibold text-ink">{t("wizard.c08.upgradesTitle")}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {UPGRADES.map((u) => {
            const on = active[u];
            const included = includedByNda(order, u);
            return (
              <button
                key={u}
                type="button"
                role="switch"
                aria-checked={on}
                disabled={included}
                onClick={() => update({ upgrades: { ...order.upgrades, [u]: !order.upgrades[u] } })}
                className={cx(
                  "group relative flex items-start gap-3 overflow-clip rounded-[22px] p-4 text-left transition-[box-shadow,background-color] duration-300 disabled:cursor-default",
                  on ? "bg-tint/50 shadow-card ring-2 ring-primary" : "bg-surface ring-1 ring-line hover:shadow-card",
                )}
              >
                <span
                  className={cx(
                    "flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-gradient-to-br",
                    UPGRADE_TINT[u],
                  )}
                >
                  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    {UPGRADE_ICONS[u]}
                  </svg>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-semibold text-ink">{t(`wizard.upgrades.${u}.name`)}</span>
                    <span className={cx("text-sm font-bold tabular-nums", included ? "text-success" : AMOUNT)}>
                      {included ? t("wizard.c08.included") : `+${taka(config.upgradePrices[u])}`}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-sm leading-snug text-muted">{t(`wizard.upgrades.${u}.desc`)}</span>
                </span>
                {/* Switch */}
                <span
                  aria-hidden
                  className={cx("relative mt-1 h-6 w-11 shrink-0 rounded-full transition-colors duration-300", on ? (included ? "bg-success" : "bg-primary") : "bg-line")}
                >
                  <span
                    className={cx(
                      "absolute top-0.5 size-5 rounded-full bg-white shadow-card transition-[left] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                      on ? "left-[1.375rem]" : "left-0.5",
                    )}
                  />
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}
