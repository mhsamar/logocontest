"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, TextField } from "@/components/ui/field";
import { PACKAGES, UPGRADES, type Order, type PackageKey } from "@/lib/contests/brief";
import { serviceFee, validateOrder, type PricingConfig } from "@/lib/contests/pricing";
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
        <ul className="divide-y divide-line rounded-lg bg-surface ring-1 ring-line">
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

      <p className="rounded-md bg-canvas px-4 py-3 text-sm text-muted ring-1 ring-line">{t("wizard.c07.note")}</p>
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
      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[0.6875rem] font-bold uppercase text-primary-dark">
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
        className="flex size-11 shrink-0 items-center justify-center rounded-md text-muted hover:bg-canvas hover:text-danger"
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
        </svg>
      </button>
    </li>
  );
}

// C-08
const PACKAGE_LINES: Record<PackageKey, string> = {
  economy: "wizard.packages.economy.line",
  standard: "wizard.packages.standard.line",
  premium: "wizard.packages.premium.line",
  custom: "wizard.packages.custom.line",
};

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

  const customError =
    order.package === "custom" && customTouched && orderError?.startsWith("custom")
      ? t(`wizard.errors.${orderError}` as "wizard.errors.custom_min", {
          min: taka(config.customMin),
          step: taka(config.customStep),
          example: taka(config.customMin + config.customStep),
        })
      : undefined;

  return (
    <div className="space-y-8">
      <div className="grid gap-3 sm:grid-cols-2">
        {PACKAGES.map((pkg) => {
          const on = order.package === pkg;
          const prize = pkg === "custom" ? null : config.packagePrizes[pkg];
          return (
            <button
              key={pkg}
              type="button"
              onClick={() => update({ package: pkg })}
              aria-pressed={on}
              className={cx(
                "relative rounded-lg bg-surface p-4 text-left ring-1 transition-shadow",
                on ? "ring-2 ring-primary" : "ring-line hover:ring-muted/40",
              )}
            >
              {pkg === "standard" && (
                <span className="absolute -top-2.5 right-3 rounded-full bg-primary px-2 py-0.5 text-[0.6875rem] font-semibold text-white">
                  {t("wizard.packages.recommended")}
                </span>
              )}
              <span className="block text-sm font-semibold text-muted">{t(`wizard.packages.${pkg}.name`)}</span>
              <span className="mt-1 block text-2xl font-bold text-accent tabular-nums">
                {prize ? taka(prize) : t("wizard.packages.custom.price")}
              </span>
              <span className="mt-1 block text-sm text-ink">{t(PACKAGE_LINES[pkg] as "wizard.packages.economy.line")}</span>
              {prize && (
                <span className="mt-2 block text-xs text-muted">
                  {t("wizard.packages.youPay", { total: taka(prize + serviceFee(prize, config.serviceFeePercent)) })}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {order.package === "custom" && (
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
      )}

      <fieldset>
        <legend className="mb-3 text-base font-semibold text-ink">{t("wizard.c08.durationTitle")}</legend>
        <div className="flex gap-2">
          {config.durationOptions.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => update({ durationDays: d })}
              aria-pressed={order.durationDays === d}
              className={cx(
                "min-h-11 flex-1 rounded-md px-3 text-sm font-semibold ring-1",
                order.durationDays === d ? "bg-primary text-white ring-primary" : "bg-surface text-ink ring-line hover:ring-muted/40",
              )}
            >
              {t("wizard.c08.days", { days: d })}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-3 text-base font-semibold text-ink">{t("wizard.c08.upgradesTitle")}</legend>
        <div className="divide-y divide-line rounded-lg bg-surface ring-1 ring-line">
          {UPGRADES.map((u) => {
            const on = order.upgrades[u];
            return (
              <div key={u} className="flex items-start gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">
                    {t(`wizard.upgrades.${u}.name`)}{" "}
                    <span className="font-normal text-accent">+{taka(config.upgradePrices[u])}</span>
                  </p>
                  <p className="mt-0.5 text-sm text-muted">{t(`wizard.upgrades.${u}.desc`)}</p>
                </div>
                <Button
                  size="md"
                  variant={on ? "primary" : "secondary"}
                  aria-pressed={on}
                  onClick={() => update({ upgrades: { ...order.upgrades, [u]: !on } })}
                  className="shrink-0"
                >
                  {on ? t("wizard.c08.added") : t("wizard.c08.add")}
                </Button>
              </div>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}
