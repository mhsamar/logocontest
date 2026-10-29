"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useReadOnly } from "@/components/admin/read-only";
import { useToast } from "@/components/ui/toast";
import { BUSINESS_TYPES, DELIVERABLES, LOGO_STYLES, REQUIREMENTS, STYLE_SLIDERS, USED_ON, type BusinessType } from "@/lib/contests/brief";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";
import { defaultsFor, SEED, type BriefDefault } from "@/lib/onboarding/brief-defaults";
import { saveBriefDefaults } from "@/lib/onboarding/defaults-actions";

/** One business type's row: its own defaults, or "Same as Other" (no entry of its own; "other" always has one). */
export type DefaultsRow = { type: BusinessType; own: boolean; values: BriefDefault };

/** The original defaults ("Back to the original"): the seed's own types, every other type the same as "other". */
export const seedRows = (): DefaultsRow[] => BUSINESS_TYPES.map((type) => ({ type, own: type in SEED, values: defaultsFor(SEED, type) }));

/** What is saved: only the rows with their own defaults, in business-type order. */
export const toSaved = (rows: DefaultsRow[]): Partial<Record<BusinessType, BriefDefault>> => Object.fromEntries(rows.filter((r) => r.own || r.type === "other").map((r) => [r.type, r.values]));

const flip = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
const copy = (d: BriefDefault): BriefDefault => ({ ...d, styles: [...d.styles], sliders: { ...d.sliders }, usedOn: [...d.usedOn], deliverables: [...d.deliverables], requirements: [...d.requirements] });

const CHIP = "inline-flex min-h-9 items-center rounded-[10px] px-3 py-1.5 text-left text-[13.5px] font-bold transition-colors disabled:cursor-not-allowed";
const chip = (on: boolean) => cx(CHIP, on ? "bg-[#111216] text-white" : "bg-[#F4F5F7] text-ink hover:bg-[#ECEDF0]");
const LEGEND = "mb-1.5 p-0 text-[13px] font-bold text-adm-strong";

function Chips<T extends string>({ label, all, on, name, disabled, onChange }: { label: string; all: readonly T[]; on: T[]; name: (v: T) => string; disabled: boolean; onChange: (v: T[]) => void }) {
  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className={LEGEND}>{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {all.map((v) => (
          <button key={v} type="button" aria-pressed={on.includes(v)} disabled={disabled} onClick={() => onChange(flip(on, v))} className={chip(on.includes(v))}>
            {name(v)}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Admin › Onboarding › Brief defaults (owner, 2026-10-29; client-onboarding-v2-spec.md §3): per business type, the
 * logo styles, feel, where it is used, extras and requirements a new onboarding v2 contest starts with. A type is
 * either the same as "Other" or has its own; "Back to the original" puts the seed back (saved with Save, like the rest).
 */
export function BriefDefaultsEditor({ initial }: { initial: DefaultsRow[] }) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const readOnly = useReadOnly();
  const [rows, setRows] = useState<DefaultsRow[]>(initial);
  const [busy, start] = useTransition();
  const dirty = JSON.stringify(toSaved(rows)) !== JSON.stringify(toSaved(initial));
  const set = (type: BusinessType, change: (r: DefaultsRow, all: DefaultsRow[]) => DefaultsRow) => setRows((all) => all.map((r) => (r.type === type ? change(r, all) : r)));
  const edit = (type: BusinessType, values: Partial<BriefDefault>) => set(type, (r) => ({ ...r, values: { ...r.values, ...values } }));
  // A type that gets its own defaults starts from "Other"'s, as they are on screen now.
  const makeOwn = (type: BusinessType, own: boolean) => set(type, (r, all) => ({ ...r, own, values: own && !r.own ? copy(all.find((x) => x.type === "other")!.values) : r.values }));

  const save = () =>
    start(async () => {
      const res = await saveBriefDefaults(toSaved(rows));
      if (!res.ok) return toast(t(res.error), "danger");
      toast(t("wizardV2.admin.saved"));
      router.refresh();
    });

  return (
    <section className="flex flex-col gap-3 rounded-[16px] border border-adm-line bg-surface p-4 sm:p-5" data-brief-defaults>
      <div>
        <h2 className="m-0 text-[17px] font-semibold">{t("wizardV2.admin.defaultsTitle")}</h2>
        <p className="m-0 mt-1 text-[14px] text-muted">{t("wizardV2.admin.defaultsHelp")}</p>
      </div>
      <ul aria-label={t("wizardV2.admin.type")} className="m-0 flex list-none flex-col gap-2 p-0">
        {rows.map((r) => {
          const name = t(`wizard.businessTypes.${r.type}`);
          const own = r.own || r.type === "other";
          const v = r.values;
          return (
            <li key={r.type} className="rounded-[12px] bg-surface px-3.5 py-3 ring-1 ring-[#E6E7EB]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 text-[15px] font-semibold text-ink">{name}</span>
                {r.type === "other" ? (
                  <span className="rounded-full bg-[#F4F5F7] px-3 py-1 text-[13px] font-semibold text-muted">{t("wizardV2.admin.own")}</span>
                ) : (
                  <span role="radiogroup" aria-label={name} className="flex gap-1">
                    {([false, true] as const).map((o) => (
                      <button key={String(o)} type="button" role="radio" aria-checked={r.own === o} disabled={readOnly} onClick={() => makeOwn(r.type, o)} className={chip(r.own === o)}>
                        {o ? t("wizardV2.admin.own") : t("wizardV2.admin.sameAsOther")}
                      </button>
                    ))}
                  </span>
                )}
              </div>
              {own && (
                <div className="mt-3 flex flex-col gap-3.5">
                  <Chips label={t("wizardV2.admin.styles")} all={LOGO_STYLES} on={v.styles} name={(s) => t(`wizard.styles.${s}`)} disabled={readOnly} onChange={(styles) => edit(r.type, { styles })} />
                  <fieldset className="m-0 min-w-0 border-0 p-0">
                    <legend className={LEGEND}>{t("wizardV2.admin.feel")}</legend>
                    <div className="flex flex-wrap gap-x-5 gap-y-2">
                      {STYLE_SLIDERS.map((k) => {
                        const left = t(`wizard.sliders.${k}.left`);
                        const right = t(`wizard.sliders.${k}.right`);
                        return (
                          <label key={k} className="flex items-center gap-2 text-[13.5px] font-semibold text-muted">
                            {left}
                            <select
                              value={v.sliders[k]}
                              disabled={readOnly}
                              aria-label={`${left} – ${right}`}
                              onChange={(e) => edit(r.type, { sliders: { ...v.sliders, [k]: Number(e.target.value) } })}
                              className="h-10 rounded-[10px] border border-[#dcdee3] bg-surface px-2.5 text-[14.5px] font-semibold text-ink focus:outline-2 focus:outline-primary"
                            >
                              {[1, 2, 3, 4, 5].map((n) => (
                                <option key={n} value={n}>
                                  {n}
                                </option>
                              ))}
                            </select>
                            {right}
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                  <Chips label={t("wizardV2.admin.usedOn")} all={USED_ON} on={v.usedOn} name={(u) => t(`wizard.usedOn.${u}`)} disabled={readOnly} onChange={(usedOn) => edit(r.type, { usedOn })} />
                  <Chips label={t("wizardV2.admin.deliverables")} all={DELIVERABLES} on={v.deliverables} name={(d) => t(`wizard.deliverables.${d}.title`)} disabled={readOnly} onChange={(deliverables) => edit(r.type, { deliverables })} />
                  <Chips label={t("wizardV2.admin.requirements")} all={REQUIREMENTS} on={v.requirements} name={(q) => t(`wizard.requirements.${q}`)} disabled={readOnly} onChange={(requirements) => edit(r.type, { requirements })} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <div className="sticky bottom-3 z-10 flex flex-wrap justify-end gap-2">
        <button type="button" disabled={readOnly || busy} onClick={() => setRows(seedRows())} className="min-h-12 rounded-[14px] bg-surface px-5 text-[15px] font-bold text-ink ring-1 ring-[#dcdee3] disabled:opacity-40">
          {t("wizardV2.admin.reset")}
        </button>
        <button type="button" disabled={readOnly || busy || !dirty} onClick={save} className="min-h-12 rounded-[14px] bg-[image:var(--gradient-red)] px-6 text-[15.5px] font-bold text-white shadow-[var(--shadow-glow)] disabled:opacity-40">
          {t("wizardV2.admin.save")}
        </button>
      </div>
    </section>
  );
}
