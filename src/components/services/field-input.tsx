"use client";

import { TextAreaField, TextField } from "@/components/ui/field";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";
import { LIMITS, type BriefField, type Lang } from "@/lib/services/types";

/**
 * One question from Admin › Services (owner, 2026-10-13) or the owner's own onboarding questions (Admin › Onboarding,
 * 2026-10-14), as the person answering it sees it.
 */
export function FieldInput({ f, value, onChange, error, l }: { f: BriefField; value: string | string[] | undefined; onChange: (v: string | string[]) => void; error?: string; l: (x: Lang) => string }) {
  const { t } = useI18n();
  const optional = f.required ? undefined : t("common.optional");
  const label = l(f.label);
  const hint = l(f.help) || undefined;
  const str = typeof value === "string" ? value : "";
  const list = Array.isArray(value) ? value : [];
  // Ready answers to tap (owner, 2026-10-13), set per question in Admin → Services.
  const items = (f.suggestions ?? []).map(l).filter(Boolean);
  const ideas = items.length > 0 ? { items, onPick: (text: string) => onChange(text) } : undefined;
  if (f.type === "link")
    return <TextField label={label} hint={hint} optionalLabel={optional} value={str} type="url" inputMode="url" maxLength={LIMITS.link} onChange={(e) => onChange(e.target.value)} error={error} />;
  if (f.type === "text") return <TextField label={label} hint={hint} optionalLabel={optional} value={str} maxLength={LIMITS.text} onChange={(e) => onChange(e.target.value)} error={error} ideas={ideas} />;
  if (f.type === "long_text") return <TextAreaField label={label} hint={hint} optionalLabel={optional} value={str} maxLength={LIMITS.longText} onChange={(e) => onChange(e.target.value)} error={error} ideas={ideas} />;
  if (f.type === "colours")
    return (
      <fieldset className="min-w-0 border-0 p-0">
        <legend className="mb-1 text-sm font-medium text-ink">
          {label} {optional && <span className="text-muted">({optional})</span>}
        </legend>
        {hint && <p className="m-0 mb-2 text-sm text-muted">{hint}</p>}
        <div className="flex flex-wrap items-center gap-2">
          {list.map((c) => (
            <button key={c} type="button" onClick={() => onChange(list.filter((x) => x !== c))} aria-label={t("services.wizard.removeColour", { colour: c })} className="flex min-h-10 items-center gap-2 rounded-full bg-surface px-3 text-sm font-semibold ring-1 ring-line">
              <span className="size-5 rounded-full ring-1 ring-line" style={{ background: c }} />
              {c.toUpperCase()} ✕
            </button>
          ))}
          {list.length < LIMITS.colours && (
            <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-full px-3 text-sm font-bold text-primary ring-1 ring-dashed ring-line">
              <input type="color" className="size-6 cursor-pointer border-0 bg-transparent p-0" onChange={(e) => !list.includes(e.target.value) && onChange([...list, e.target.value])} />
              {t("services.wizard.addColour")}
            </label>
          )}
        </div>
        {error && <p className="m-0 mt-1.5 text-sm text-danger">{error}</p>}
      </fieldset>
    );
  const multi = f.type === "multi_choice";
  return (
    <fieldset className="min-w-0 border-0 p-0">
      <legend className="mb-1 text-sm font-medium text-ink">
        {label} {optional && <span className="text-muted">({optional})</span>}
      </legend>
      {hint && <p className="m-0 mb-2 text-sm text-muted">{hint}</p>}
      <div className="flex flex-wrap gap-2">
        {f.options.map((o) => {
          const on = multi ? list.includes(o.en) : str === o.en;
          return (
            <button key={o.en} type="button" aria-pressed={on} onClick={() => onChange(multi ? (on ? list.filter((x) => x !== o.en) : [...list, o.en]) : on ? "" : o.en)} className={cx("min-h-10 rounded-full px-4 text-[14.5px] font-semibold ring-1", on ? "bg-primary text-white ring-primary" : "bg-surface ring-line")}>
              {l(o)}
            </button>
          );
        })}
      </div>
      {error && <p className="m-0 mt-1.5 text-sm text-danger">{error}</p>}
    </fieldset>
  );
}
