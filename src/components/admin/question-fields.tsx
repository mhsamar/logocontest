"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n/client";
import { FIELD_TYPES, type BriefField, type Lang } from "@/lib/services/types";
import { ADM_INPUT } from "./ui";

/**
 * The question editor shared by Admin › Services (owner, 2026-10-13) and Admin › Onboarding (2026-10-14): key, type,
 * required, wording in English and Bangla, ready answers and choices. `extra` adds a control per question (the step
 * an onboarding question is asked on); `move` lets the owner change the order.
 */

const AREA = "min-h-[88px] w-full rounded-[12px] border border-[#dcdee3] bg-surface px-3.5 py-2.5 text-[15px] text-ink focus:outline-2 focus:outline-offset-1 focus:outline-primary";
const LABEL = "flex flex-col gap-1 text-[14px] font-bold text-ink";
const empty = (): Lang => ({ en: "", bn: "" });
const lines = (v: string): Lang[] =>
  v.split("\n").map((line) => {
    const [en, bn] = line.split("|");
    return { en: (en ?? "").trim(), bn: (bn ?? en ?? "").trim() };
  });

export function LangPair({ label, value, onChange, long, max, disabled }: { label: string; value: Lang; onChange: (v: Lang) => void; long?: boolean; max: number; disabled: boolean }) {
  const { t } = useI18n();
  const Input = long ? "textarea" : "input";
  return (
    <fieldset className="m-0 grid gap-2 border-0 p-0 sm:grid-cols-2">
      <legend className="mb-1 text-[14px] font-bold text-ink">{label}</legend>
      {(["en", "bn"] as const).map((k) => (
        <label key={k} className="flex flex-col gap-1 text-[13px] font-semibold text-muted">
          {k === "en" ? t("admin.services.english") : t("admin.services.bangla")}
          <Input value={value[k]} maxLength={max} disabled={disabled} lang={k} onChange={(e) => onChange({ ...value, [k]: e.target.value })} className={long ? AREA : ADM_INPUT} />
        </label>
      ))}
    </fieldset>
  );
}

export function QuestionFields<F extends BriefField>({
  fields,
  onChange,
  readOnly,
  max = 15,
  extra,
  make,
  move = false,
}: {
  fields: F[];
  onChange: (fields: F[]) => void;
  readOnly: boolean;
  max?: number;
  extra?: (f: F, set: (patch: Partial<F>) => void) => ReactNode;
  /** A new question (the onboarding editor adds its step). */
  make?: (base: BriefField) => F;
  move?: boolean;
}) {
  const { t } = useI18n();
  const setField = (i: number, patch: Partial<F>) => onChange(fields.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const swap = (i: number, j: number) => {
    if (j < 0 || j >= fields.length) return;
    const next = [...fields];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <>
      {fields.map((f, i) => (
        <div key={i} className="flex flex-col gap-2.5 rounded-[14px] bg-[#F7F8FA] p-3.5">
          <div className="grid gap-2.5 sm:grid-cols-[1fr_1fr_auto_auto]">
            <label className={LABEL}>
              {t("admin.services.fieldKey")}
              <input value={f.key} maxLength={30} disabled={readOnly} onChange={(e) => setField(i, { key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") } as Partial<F>)} className={ADM_INPUT} />
            </label>
            <label className={LABEL}>
              {t("admin.services.fieldType")}
              <select value={f.type} disabled={readOnly} onChange={(e) => setField(i, { type: e.target.value as BriefField["type"] } as Partial<F>)} className={ADM_INPUT}>
                {FIELD_TYPES.map((ft) => (
                  <option key={ft} value={ft}>
                    {t(`admin.services.types.${ft}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 self-end pb-3 text-[14px] font-bold">
              <input type="checkbox" checked={f.required} disabled={readOnly} onChange={(e) => setField(i, { required: e.target.checked } as Partial<F>)} className="size-[18px] accent-[#8B0000]" />
              {t("admin.services.required")}
            </label>
            <button type="button" disabled={readOnly} onClick={() => onChange(fields.filter((_, j) => j !== i))} className="self-end pb-3 text-[14px] font-bold text-[#A3121B] disabled:opacity-40">
              {t("admin.services.removeField")}
            </button>
          </div>
          {extra?.(f, (patch) => setField(i, patch))}
          <LangPair label={t("admin.services.fieldLabel")} value={f.label} onChange={(v) => setField(i, { label: v } as Partial<F>)} max={80} disabled={readOnly} />
          <LangPair label={t("admin.services.fieldHelp")} value={f.help} onChange={(v) => setField(i, { help: v } as Partial<F>)} max={200} disabled={readOnly} />
          {(f.type === "text" || f.type === "long_text") && (
            <label className={LABEL}>
              {t("admin.services.suggestions")}
              <textarea value={(f.suggestions ?? []).map((o) => `${o.en} | ${o.bn}`).join("\n")} disabled={readOnly} onChange={(e) => setField(i, { suggestions: lines(e.target.value) } as Partial<F>)} className={AREA} />
              <span className="text-[13px] font-medium text-muted">{t("admin.services.suggestionsHint")}</span>
            </label>
          )}
          {(f.type === "choice" || f.type === "multi_choice") && (
            <label className={LABEL}>
              {t("admin.services.options")}
              <textarea value={f.options.map((o) => `${o.en} | ${o.bn}`).join("\n")} disabled={readOnly} onChange={(e) => setField(i, { options: lines(e.target.value) } as Partial<F>)} className={AREA} />
              <span className="text-[13px] font-medium text-muted">{t("admin.services.optionsHint")}</span>
            </label>
          )}
          {move && (
            <div className="flex gap-2">
              <button type="button" disabled={readOnly || i === 0} onClick={() => swap(i, i - 1)} className="min-h-10 rounded-[10px] border border-[#dcdee3] px-3 text-[14px] font-bold disabled:opacity-40">
                ↑ {t("admin.onboarding.up")}
              </button>
              <button type="button" disabled={readOnly || i === fields.length - 1} onClick={() => swap(i, i + 1)} className="min-h-10 rounded-[10px] border border-[#dcdee3] px-3 text-[14px] font-bold disabled:opacity-40">
                ↓ {t("admin.onboarding.down")}
              </button>
            </div>
          )}
        </div>
      ))}
      <button
        type="button"
        disabled={readOnly || fields.length >= max}
        onClick={() => {
          const base: BriefField = { key: `question_${fields.length + 1}`, type: "text", label: empty(), help: empty(), required: false, options: [] };
          onChange([...fields, make ? make(base) : (base as F)]);
        }}
        className="self-start rounded-[10px] border border-dashed border-[#B9BCC4] px-4 py-2.5 text-[14.5px] font-bold disabled:opacity-40"
      >
        {t("admin.services.addField")}
      </button>
    </>
  );
}
