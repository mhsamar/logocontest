"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import {
  BUSINESS_TYPES,
  LIMITS,
  LOGO_STYLES,
  MAX_COLORS,
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
import { descriptionSuggestions, dislikesSuggestions, likesSuggestions } from "@/lib/contests/suggestions";

export type BriefStepProps = {
  brief: Brief;
  update: (patch: Partial<Brief>) => void;
  errors: FieldErrors;
  touched: Set<string>;
  touch: (field: string) => void;
};

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
      {extra ? (
        <>
          <TextField
            label={t("wizard.c01.logoTextLabel")}
            hint={t("wizard.c01.logoTextHint")}
            optionalLabel={t("common.optional")}
            value={p.brief.logoText}
            onChange={(e) => p.update({ logoText: e.target.value })}
            maxLength={LIMITS.logoText.max}
          />
          <TextField
            label={t("wizard.c01.sloganLabel")}
            optionalLabel={t("common.optional")}
            value={p.brief.slogan}
            onChange={(e) => p.update({ slogan: e.target.value })}
            maxLength={LIMITS.slogan.max}
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
        options={BUSINESS_TYPES.map((v) => ({ value: v, label: t(`wizard.businessTypes.${v}`) }))}
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
        onPick={(text) => {
          p.update({ businessDescription: text });
          p.touch("businessDescription");
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

// C-05
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
            {SUGGESTED.map((c) => (
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

// C-06
export function LikesStep(p: BriefStepProps) {
  const { t, locale } = useI18n();
  const error = useError(p);
  return (
    <div className="space-y-5">
      <TextAreaField
        label={t("wizard.c06.likesLabel")}
        hint={t("wizard.c06.likesHint", { min: LIMITS.likes.min })}
        value={p.brief.likes}
        onChange={(e) => p.update({ likes: e.target.value })}
        onBlur={() => p.touch("likes")}
        maxLength={LIMITS.likes.max}
        counterLabel={counter(p.brief.likes, LIMITS.likes.max, locale)}
        error={error("likes", { min: LIMITS.likes.min })}
      />
      <Suggestions
        items={likesSuggestions(p.brief, t)}
        onPick={(text) => {
          p.update({ likes: text });
          p.touch("likes");
        }}
      />
      <TextAreaField
        label={t("wizard.c06.dislikesLabel")}
        optionalLabel={t("common.optional")}
        value={p.brief.dislikes}
        onChange={(e) => p.update({ dislikes: e.target.value })}
        maxLength={LIMITS.dislikes.max}
        counterLabel={counter(p.brief.dislikes, LIMITS.dislikes.max, locale)}
      />
      <Suggestions items={dislikesSuggestions(p.brief, t)} onPick={(text) => p.update({ dislikes: text })} />
    </div>
  );
}
