"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import {
  BUSINESS_TYPES,
  type BusinessType,
  DELIVERABLES,
  LIMITS,
  LOGO_STYLES,
  MAX_COLORS,
  REQUIREMENTS,
  STYLE_SLIDERS,
  USED_ON,
  type Brief,
  type FieldErrors,
  type LogoStyle,
} from "@/lib/contests/brief";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";
import { StyleExamples } from "./style-art";
import { Suggestions } from "./suggestions";
import { audienceSuggestions, descriptionSuggestions } from "@/lib/contests/suggestions";

export type BriefChoices = { businessTypes: string[]; swatches: string[] };

export type BriefStepProps = {
  choices: BriefChoices;
  brief: Brief;
  update: (patch: Partial<Brief>) => void;
  errors: FieldErrors;
  touched: Set<string>;
  touch: (field: string) => void;
};

/** Visible business types in the admin's order; a hidden type a draft already uses stays selectable. */
function businessTypeOptions(visible: string[], current: string): BusinessType[] {
  const known = visible.filter((v): v is BusinessType => (BUSINESS_TYPES as readonly string[]).includes(v));
  const list = known.length ? known : [...BUSINESS_TYPES];
  return current && !list.includes(current as BusinessType) && (BUSINESS_TYPES as readonly string[]).includes(current) ? [...list, current as BusinessType] : list;
}

function useError({ errors, touched }: Pick<BriefStepProps, "errors" | "touched">) {
  const { t } = useI18n();
  return (field: string, params?: Record<string, string | number>) => {
    const key = errors[field];
    return key && touched.has(field) ? t(key, params) : undefined;
  };
}

function counter(value: string, max: number, locale: string) {
  const fmt = new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US");
  return `${fmt.format(value.trim().length)} / ${fmt.format(max)}`;
}

/** Things that are always part of every contest, shown ticked and locked (owner, 2026-10-08). */
function AlwaysList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl bg-success/5 p-3 ring-1 ring-success/20">
      <p className="text-xs font-semibold uppercase tracking-wider text-success">{title}</p>
      <ul className="mt-2 space-y-1.5">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-ink">
            <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-success text-white" aria-hidden>
              <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            </span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

// C-01
export function BrandStep(p: BriefStepProps) {
  const { t } = useI18n();
  const error = useError(p);
  const [extra, setExtra] = useState(Boolean(p.brief.logoText || p.brief.slogan));
  return (
    <div className="space-y-5">
      <TextField
        label={t("wizard.c01.brandLabel")}
        value={p.brief.brandName}
        onChange={(e) => p.update({ brandName: e.target.value })}
        onBlur={() => p.touch("brandName")}
        maxLength={LIMITS.brandName.max}
        error={error("brandName")}
        autoComplete="organization"
        autoFocus
      />
      <TextField
        label={t("wizard.c01.shortNameLabel")}
        hint={t("wizard.c01.shortNameHint")}
        optionalLabel={t("common.optional")}
        value={p.brief.shortName}
        onChange={(e) => p.update({ shortName: e.target.value })}
        onBlur={() => p.touch("shortName")}
        maxLength={LIMITS.shortName.max}
        error={error("shortName")}
      />
      {extra ? (
        <>
          <TextField
            label={t("wizard.c01.logoTextLabel")}
            hint={t("wizard.c01.logoTextHint")}
            optionalLabel={t("common.optional")}
            value={p.brief.logoText}
            onChange={(e) => p.update({ logoText: e.target.value })}
            onBlur={() => p.touch("logoText")}
            maxLength={LIMITS.logoText.max}
            error={error("logoText")}
          />
          <TextField
            label={t("wizard.c01.sloganLabel")}
            optionalLabel={t("common.optional")}
            value={p.brief.slogan}
            onChange={(e) => p.update({ slogan: e.target.value })}
            onBlur={() => p.touch("slogan")}
            maxLength={LIMITS.slogan.max}
            error={error("slogan")}
          />
        </>
      ) : (
        <Button variant="ghost" className="-ml-3" onClick={() => setExtra(true)}>
          {t("wizard.c01.add")}
        </Button>
      )}
    </div>
  );
}

// C-02
export function BusinessStep(p: BriefStepProps) {
  const { t, locale } = useI18n();
  const error = useError(p);
  return (
    <div className="space-y-5">
      <SelectField
        label={t("wizard.c02.typeLabel")}
        placeholder={t("wizard.c02.typePlaceholder")}
        value={p.brief.businessType}
        onChange={(e) => {
          p.update({ businessType: e.target.value as Brief["businessType"] });
          p.touch("businessType");
        }}
        options={businessTypeOptions(p.choices.businessTypes, p.brief.businessType).map((v) => ({ value: v, label: t(`wizard.businessTypes.${v}`) }))}
        error={error("businessType")}
      />
      <TextAreaField
        label={t("wizard.c02.descLabel")}
        hint={t("wizard.c02.descHint")}
        value={p.brief.businessDescription}
        onChange={(e) => p.update({ businessDescription: e.target.value })}
        onBlur={() => p.touch("businessDescription")}
        maxLength={LIMITS.description.max}
        counterLabel={counter(p.brief.businessDescription, LIMITS.description.max, locale)}
        error={error("businessDescription")}
      />
      <Suggestions
        items={descriptionSuggestions(p.brief, t)}
        value={p.brief.businessDescription}
        onPick={(text) => {
          p.update({ businessDescription: text });
          p.touch("businessDescription");
        }}
      />
      <TextAreaField
        label={t("wizard.c02.audienceLabel")}
        hint={t("wizard.c02.audienceHint")}
        rows={3}
        value={p.brief.targetAudience}
        onChange={(e) => p.update({ targetAudience: e.target.value })}
        onBlur={() => p.touch("targetAudience")}
        maxLength={LIMITS.targetAudience.max}
        counterLabel={counter(p.brief.targetAudience, LIMITS.targetAudience.max, locale)}
        error={error("targetAudience")}
      />
      <Suggestions
        items={audienceSuggestions(p.brief, t)}
        value={p.brief.targetAudience}
        onPick={(text) => {
          p.update({ targetAudience: text });
          p.touch("targetAudience");
        }}
      />
    </div>
  );
}

// C-03
export function WebsiteStep(p: BriefStepProps) {
  const { t } = useI18n();
  const error = useError(p);
  return (
    <div className="space-y-3">
      <TextField
        label={t("wizard.c03.urlLabel")}
        type="url"
        inputMode="url"
        placeholder="facebook.com/yourpage"
        value={p.brief.noWebsite ? "" : p.brief.websiteUrl}
        disabled={p.brief.noWebsite}
        onChange={(e) => p.update({ websiteUrl: e.target.value })}
        onBlur={() => p.touch("websiteUrl")}
        maxLength={LIMITS.url.max}
        error={error("websiteUrl")}
      />
      <Checkbox
        label={t("wizard.c03.none")}
        checked={p.brief.noWebsite}
        onChange={(e) => p.update({ noWebsite: e.target.checked })}
      />
    </div>
  );
}

// C-04
export function StylesStep(p: BriefStepProps) {
  const { t } = useI18n();
  const toggle = (s: LogoStyle) => {
    p.update({ styles: p.brief.styles.includes(s) ? p.brief.styles.filter((x) => x !== s) : [...p.brief.styles, s] });
    p.touch("styles");
  };
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" role="group" aria-label={t("wizard.c04.heading")}>
        {LOGO_STYLES.map((s) => {
          const on = p.brief.styles.includes(s);
          return (
            <button
              key={s}
              type="button"
              onClick={() => toggle(s)}
              aria-pressed={on}
              className={cx(
                "relative flex flex-col items-center gap-2 rounded-lg bg-surface px-2 pb-3 pt-4 text-center ring-1 transition-shadow",
                on ? "ring-2 ring-primary" : "ring-line hover:ring-muted/40",
              )}
            >
              <span
                className={cx(
                  "absolute right-2 top-2 flex size-5 items-center justify-center rounded-full text-xs",
                  on ? "bg-primary text-white" : "ring-1 ring-line",
                )}
                aria-hidden
              >
                {on && "✓"}
              </span>
              <StyleExamples style={s} />
              <span className="text-sm font-medium text-ink">{t(`wizard.styles.${s}`)}</span>
            </button>
          );
        })}
      </div>
      <p className="-mt-3 text-xs text-muted">{t("wizard.c04.credit")}</p>

      <fieldset className="space-y-5">
        <legend className="mb-3 text-sm font-semibold text-ink">{t("wizard.c04.slidersTitle")}</legend>
        {STYLE_SLIDERS.map((k) => (
          <div key={k}>
            <div className="mb-1 flex justify-between text-sm text-muted">
              <span>{t(`wizard.sliders.${k}.left`)}</span>
              <span>{t(`wizard.sliders.${k}.right`)}</span>
            </div>
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={p.brief.sliders[k]}
              onChange={(e) => p.update({ sliders: { ...p.brief.sliders, [k]: Number(e.target.value) } })}
              aria-label={`${t(`wizard.sliders.${k}.left`)} – ${t(`wizard.sliders.${k}.right`)}`}
              className="h-11 w-full accent-primary"
            />
          </div>
        ))}
      </fieldset>
    </div>
  );
}

// C-05 (the admin's Colour choices list replaces these when set, A-15)
const SUGGESTED = ["#0f766e", "#1d4ed8", "#dc2626", "#f59e0b", "#16a34a", "#7c3aed", "#db2777", "#111827", "#ffffff", "#a16207"];

export function ColorsStep(p: BriefStepProps) {
  const { t } = useI18n();
  const error = useError(p);
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState("#0f766e");
  const valid = /^#[0-9a-f]{6}$/i.test(draft);

  const openSlot = (i: number) => {
    setDraft(p.brief.colors[i] ?? "#0f766e");
    setEditing(i);
  };
  const save = () => {
    if (editing === null || !valid) return;
    const colors = [...p.brief.colors];
    colors[editing] = draft.toLowerCase();
    p.update({ colors: colors.filter(Boolean).slice(0, MAX_COLORS) });
    p.touch("colors");
    setEditing(null);
  };
  const remove = () => {
    if (editing === null) return;
    p.update({ colors: p.brief.colors.filter((_, i) => i !== editing) });
    setEditing(null);
  };

  return (
    <div className="space-y-8">
      <div>
        <div className={cx("flex flex-wrap gap-3", p.brief.letDesignersChoose && "pointer-events-none opacity-40")}>
          {Array.from({ length: MAX_COLORS }, (_, i) => {
            const color = p.brief.colors[i];
            const slotIndex = color ? i : p.brief.colors.length;
            if (!color && i > p.brief.colors.length) return null;
            return (
              <button
                key={i}
                type="button"
                onClick={() => openSlot(slotIndex)}
                aria-label={color ? t("wizard.c05.editColor", { n: i + 1, hex: color }) : t("wizard.c05.addColor")}
                className={cx(
                  "flex size-14 items-center justify-center rounded-full",
                  color ? "ring-1 ring-line" : "border-2 border-dashed border-line text-muted hover:border-primary hover:text-primary",
                )}
                style={color ? { background: color } : undefined}
              >
                {!color && <span className="text-2xl leading-none">+</span>}
              </button>
            );
          })}
        </div>
        {p.brief.colors.length > 0 && !p.brief.letDesignersChoose && (
          <p className="mt-2 font-mono text-xs uppercase text-muted">{p.brief.colors.join("  ")}</p>
        )}
        <Checkbox
          className="mt-3"
          label={t("wizard.c05.letChoose")}
          checked={p.brief.letDesignersChoose}
          onChange={(e) => {
            p.update({ letDesignersChoose: e.target.checked });
            p.touch("colors");
          }}
        />
        {error("colors") && (
          <p role="alert" className="text-sm text-danger">
            {error("colors")}
          </p>
        )}
      </div>

      <fieldset>
        <legend className="mb-1 text-base font-semibold text-ink">{t("wizard.c05.usedOnTitle")}</legend>
        <div className="grid sm:grid-cols-2 sm:gap-x-6">
          {USED_ON.map((u) => (
            <Checkbox
              key={u}
              label={t(`wizard.usedOn.${u}`)}
              checked={p.brief.usedOn.includes(u)}
              onChange={(e) =>
                p.update({ usedOn: e.target.checked ? [...p.brief.usedOn, u] : p.brief.usedOn.filter((x) => x !== u) })
              }
            />
          ))}
        </div>
      </fieldset>

      {/* What you need (owner, 2026-10-08): always-included items, then extras to tick */}
      <fieldset>
        <legend className="text-base font-semibold text-ink">{t("wizard.c05.needTitle")}</legend>
        <p className="mb-3 mt-0.5 text-sm text-muted">{t("wizard.c05.needHelper")}</p>
        <AlwaysList title={t("wizard.c05.alwaysTitle")} items={[t("wizard.c05.always.main"), t("wizard.c05.always.files")]} />
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {DELIVERABLES.map((d) => {
            const on = p.brief.deliverables.includes(d);
            return (
              <label
                key={d}
                className={cx(
                  "flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl p-3 ring-1 transition-[background-color,box-shadow] duration-200",
                  on ? "bg-primary/5 ring-2 ring-primary" : "bg-surface ring-line hover:bg-canvas",
                )}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 size-5 shrink-0 rounded accent-primary"
                  checked={on}
                  onChange={(e) => p.update({ deliverables: e.target.checked ? [...p.brief.deliverables, d] : p.brief.deliverables.filter((x) => x !== d) })}
                />
                <span className="min-w-0">
                  <span className="block text-[0.9375rem] font-semibold leading-snug text-ink">{t(`wizard.deliverables.${d}.title`)}</span>
                  <span className="mt-0.5 block text-sm text-muted">{t(`wizard.deliverables.${d}.line`)}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={t("wizard.c05.sheetTitle")}
        closeLabel={t("common.close")}
        footer={
          <>
            {editing !== null && editing < p.brief.colors.length && (
              <Button variant="danger" onClick={remove}>
                {t("wizard.c05.remove")}
              </Button>
            )}
            <Button onClick={save} disabled={!valid}>
              {t("wizard.c05.done")}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={valid ? draft : "#000000"}
              onChange={(e) => setDraft(e.target.value)}
              aria-label={t("wizard.c05.sheetTitle")}
              className="h-12 w-16 cursor-pointer rounded-md border border-line bg-surface p-1"
            />
            <TextField
              className="flex-1"
              label={t("wizard.c05.hexLabel")}
              value={draft}
              onChange={(e) => setDraft(e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`)}
              maxLength={7}
              spellCheck={false}
              error={valid ? undefined : t("wizard.errors.hex")}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {(p.choices.swatches.length ? p.choices.swatches : SUGGESTED).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setDraft(c)}
                aria-label={c}
                className={cx("size-11 rounded-full ring-1 ring-line", draft.toLowerCase() === c && "ring-2 ring-primary ring-offset-2")}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}

// C-06 Requirements (owner, 2026-10-08: the like / don't like boxes were removed)
export function RequirementsStep(p: BriefStepProps) {
  const { t, locale } = useI18n();
  const error = useError(p);
  return (
    <div className="space-y-5">
      {/* Requirements (owner, 2026-10-08): always-on rules, then ones the client can add */}
      <fieldset>
        <legend className="sr-only">{t("wizard.c06.requirementsTitle")}</legend>
        <AlwaysList title={t("wizard.c06.alwaysTitle")} items={[t("wizard.c06.always.original"), t("wizard.c06.always.noAi")]} />
        <div className="mt-2">
          {REQUIREMENTS.map((r) => (
            <Checkbox
              key={r}
              label={t(`wizard.requirements.${r}`)}
              checked={p.brief.requirements.includes(r)}
              onChange={(e) => p.update({ requirements: e.target.checked ? [...p.brief.requirements, r] : p.brief.requirements.filter((x) => x !== r) })}
            />
          ))}
        </div>
        <TextAreaField
          className="mt-2"
          label={t("wizard.c06.noteLabel")}
          optionalLabel={t("common.optional")}
          rows={3}
          value={p.brief.requirementsNote}
          onChange={(e) => p.update({ requirementsNote: e.target.value })}
          onBlur={() => p.touch("requirementsNote")}
          maxLength={LIMITS.requirementsNote.max}
          counterLabel={counter(p.brief.requirementsNote, LIMITS.requirementsNote.max, locale)}
          error={error("requirementsNote")}
        />
      </fieldset>
    </div>
  );
}
