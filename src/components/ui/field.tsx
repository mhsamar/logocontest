"use client";

import { useId, useMemo, useState, useSyncExternalStore } from "react";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";
import { CALLING_CODES, flagOf } from "@/lib/phone";

type FieldProps = {
  label: string;
  hint?: string;
  error?: string;
  optionalLabel?: string;
  className?: string;
  /** A red * after the label for a must-fill field (owner, 2026-10-14: email and mobile). */
  mark?: boolean;
};

/** Text boxes can offer ready answers. */
type WithIdeas = {
  /**
   * Ready answers to tap (owner, 2026-10-15): an "ideas" button at the top right of the field, beside "Optional";
   * the list opens under the label and a pick fills the box.
   */
  ideas?: Ideas;
};

export type Ideas = { items: string[]; onPick: (text: string) => void };

const BULB = (
  <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
    <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z" strokeLinecap="round" />
  </svg>
);

/** The ideas button and its list (see FieldProps.ideas). */
function IdeasButton({ ideas, open, onToggle }: { ideas: Ideas; open: boolean; onToggle: () => void }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={cx(
        "inline-flex min-h-8 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-bold transition-colors",
        open ? "bg-primary text-white" : "bg-tint text-primary hover:bg-[#F6D9D6]",
      )}
    >
      {BULB}
      {t("wizard.suggest.short", { n: ideas.items.length })}
    </button>
  );
}

function IdeasList({ ideas, onClose }: { ideas: Ideas; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <div className="animate-rise rounded-[18px] border border-line bg-surface p-2.5">
      <div className="mb-1.5 flex items-center justify-between gap-2 px-1">
        <p className="m-0 text-[13px] font-semibold text-muted">{t("wizard.suggest.title")}</p>
        <button type="button" onClick={onClose} className="min-h-8 shrink-0 px-2 text-xs font-semibold text-muted hover:text-ink">
          {t("wizard.suggest.hide")}
        </button>
      </div>
      <ul className="m-0 list-none space-y-1.5 p-0">
        {ideas.items.map((text, i) => (
          <li key={text} className="animate-item-in" style={{ animationDelay: `${i * 40}ms` }}>
            <button
              type="button"
              onClick={() => {
                ideas.onPick(text);
                onClose();
              }}
              className="flex min-h-11 w-full items-start gap-2 rounded-[14px] bg-chip px-3 py-2.5 text-left text-sm leading-relaxed text-ink ring-1 ring-transparent transition-[background-color,box-shadow] hover:bg-surface hover:ring-primary"
            >
              <span className="mt-0.5 text-primary" aria-hidden>
                +
              </span>
              <span>{text}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Inputs from the site design (owner, 2026-10-10; UI-JOURNEY §1): white, thin line, 14px corners, 52px tall.
export const INPUT =
  "block w-full min-h-[52px] rounded-[14px] bg-surface px-4 text-[17px] font-medium text-ink placeholder:font-normal placeholder:text-muted/80 " +
  "ring-1 ring-inset ring-line transition-shadow " +
  "focus:outline-none focus:ring-2 focus:ring-primary " +
  "disabled:bg-chip disabled:text-muted";

function FieldShell({
  id,
  label,
  hint,
  error,
  optionalLabel,
  className,
  mark,
  ideas,
  children,
}: FieldProps & WithIdeas & { id: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const withIdeas = ideas && ideas.items.length > 0 ? ideas : null;
  return (
    <div className={cx("space-y-1.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-semibold text-ink">
          {label}
          {mark && (
            <span className="ml-0.5 text-danger" aria-hidden>
              *
            </span>
          )}
        </label>
        {(withIdeas || optionalLabel) && (
          <span className="flex shrink-0 items-center gap-2">
            {withIdeas && <IdeasButton ideas={withIdeas} open={open} onToggle={() => setOpen((x) => !x)} />}
            {optionalLabel && <span className="text-xs font-normal text-muted">{optionalLabel}</span>}
          </span>
        )}
      </div>
      {withIdeas && open && <IdeasList ideas={withIdeas} onClose={() => setOpen(false)} />}
      {children}
      {error ? (
        <p id={`${id}-msg`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-msg`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function TextField({
  label,
  hint,
  error,
  optionalLabel,
  className,
  mark,
  ideas,
  ...input
}: FieldProps & WithIdeas & Omit<React.InputHTMLAttributes<HTMLInputElement>, "className">) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optionalLabel={optionalLabel} className={className} mark={mark} ideas={ideas}>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-msg` : undefined}
        className={cx(INPUT, error && "ring-2 ring-danger focus:ring-danger")}
        {...input}
      />
    </FieldShell>
  );
}

const noSubscribe = () => () => {};

/** Country names in the reader's language, Bangladesh first (owner, 2026-10-14). */
function countryOptions(locale: string): { iso: string; label: string }[] {
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames([locale === "bn" ? "bn" : "en"], { type: "region" });
  } catch {
    names = null;
  }
  const name = (iso: string) => names?.of(iso) ?? iso;
  const rest = Object.keys(CALLING_CODES)
    .filter((iso) => iso !== "BD")
    .map((iso) => ({ iso, label: `${name(iso)} (+${CALLING_CODES[iso]})` }))
    .sort((x, y) => x.label.localeCompare(y.label, locale === "bn" ? "bn" : "en"));
  return [{ iso: "BD", label: `${name("BD")} (+880)` }, ...rest];
}

/**
 * Mobile number. With `onCountryChange` (or `countryName` for a plain form) the flag becomes a country picker,
 * Bangladesh by default (owner, 2026-10-14); without it the field is Bangladesh only (bKash numbers).
 */
export function PhoneField(
  props: FieldProps & { country?: string; onCountryChange?: (iso: string) => void; countryName?: string; countryLabel?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "className" | "type">,
) {
  const { label, hint, error, optionalLabel, className, mark, country: controlled, onCountryChange, countryName, countryLabel, ...input } = props;
  const id = useId();
  const { locale } = useI18n();
  const [own, setOwn] = useState(controlled ?? "BD");
  const country = controlled ?? own;
  const picker = Boolean(onCountryChange || countryName);
  // Country names differ between the server and the browser, so the full list is made in the browser only.
  const inBrowser = useSyncExternalStore(noSubscribe, () => true, () => false);
  const options = useMemo(() => (picker && inBrowser ? countryOptions(locale) : [{ iso: country, label: `+${CALLING_CODES[country]}` }]), [picker, inBrowser, locale, country]);
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optionalLabel={optionalLabel} className={className} mark={mark}>
      <div className={cx("flex rounded-[14px] ring-1 ring-inset ring-line focus-within:ring-2 focus-within:ring-primary bg-surface", error && "ring-2 ring-danger focus-within:ring-danger")}>
        {picker ? (
          <label className="relative flex shrink-0 cursor-pointer items-center gap-1.5 border-r border-line pl-3.5 pr-2.5">
            <span className="text-lg leading-none" aria-hidden>
              {flagOf(country)}
            </span>
            <span className="text-[15px] font-semibold tabular-nums text-ink">+{CALLING_CODES[country]}</span>
            <svg viewBox="0 0 24 24" className="size-3.5 text-muted" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
              <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <select
              name={countryName}
              value={country}
              aria-label={countryLabel ?? "Country"}
              onChange={(e) => {
                setOwn(e.target.value);
                onCountryChange?.(e.target.value);
              }}
              className="absolute inset-0 cursor-pointer opacity-0"
            >
              {options.map((o) => (
                <option key={o.iso} value={o.iso}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <span className="flex items-center border-r border-line pl-3.5 pr-3 text-lg leading-none" aria-hidden>
            🇧🇩
          </span>
        )}
        <input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? `${id}-msg` : undefined}
          className="min-h-[52px] w-full min-w-0 rounded-r-[14px] bg-transparent px-4 text-[17px] font-medium text-ink placeholder:font-normal placeholder:text-muted/80 focus:outline-none"
          {...input}
        />
      </div>
    </FieldShell>
  );
}

export function PasswordField({
  showLabel,
  hideLabel,
  ...props
}: FieldProps & { showLabel: string; hideLabel: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "className" | "type">) {
  const { label, hint, error, optionalLabel, className, mark, ...input } = props;
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optionalLabel={optionalLabel} className={className} mark={mark}>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? `${id}-msg` : undefined}
          className={cx(INPUT, "pr-12", error && "ring-2 ring-danger focus:ring-danger")}
          {...input}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? hideLabel : showLabel}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-md text-muted hover:text-ink"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
            <circle cx="12" cy="12" r="3" />
            {visible && <path d="M3 3l18 18" strokeLinecap="round" />}
          </svg>
        </button>
      </div>
    </FieldShell>
  );
}

export function OtpField(props: FieldProps & { length: number } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "className" | "type" | "maxLength">) {
  const { label, hint, error, optionalLabel, className, mark, length, ...input } = props;
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optionalLabel={optionalLabel} className={className} mark={mark}>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9০-৯]*"
        maxLength={length}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-msg` : undefined}
        className={cx(INPUT, "text-center font-mono text-2xl tracking-[0.5em]", error && "ring-2 ring-danger focus:ring-danger")}
        {...input}
      />
    </FieldShell>
  );
}

/** Textarea with a live character counter (shown as used / max). */
export function TextAreaField({
  label,
  hint,
  error,
  optionalLabel,
  className,
  mark,
  ideas,
  value,
  maxLength,
  counterLabel,
  ...input
}: FieldProps & WithIdeas & { value: string; counterLabel?: string } & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "className" | "value">) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optionalLabel={optionalLabel} className={className} mark={mark} ideas={ideas}>
      <textarea
        id={id}
        value={value}
        maxLength={maxLength}
        rows={4}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-msg` : undefined}
        className={cx(INPUT, "min-h-28 py-3 leading-relaxed", error && "ring-2 ring-danger focus:ring-danger")}
        {...input}
      />
      {counterLabel && (
        <p className="text-right text-xs text-muted" aria-live="polite">
          {counterLabel}
        </p>
      )}
    </FieldShell>
  );
}

export function SelectField({
  label,
  hint,
  error,
  optionalLabel,
  className,
  mark,
  options,
  placeholder,
  ...select
}: FieldProps & { options: { value: string; label: string }[]; placeholder: string } & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "className">) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optionalLabel={optionalLabel} className={className} mark={mark}>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-msg` : undefined}
        className={cx(INPUT, "appearance-none bg-[length:1rem] bg-[right_0.875rem_center] bg-no-repeat pr-10", error && "ring-2 ring-danger")}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
        }}
        {...select}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

/** A full-width, 44px+ tall checkbox row. */
export function Checkbox({
  label,
  description,
  className,
  ...input
}: { label: React.ReactNode; description?: string; className?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "className" | "type">) {
  const id = useId();
  return (
    <label htmlFor={id} className={cx("flex min-h-11 cursor-pointer items-start gap-3 py-2.5", className)}>
      <input id={id} type="checkbox" className="mt-0.5 size-5 shrink-0 rounded accent-primary" {...input} />
      <span className="text-[0.9375rem] leading-snug text-ink">
        {label}
        {description && <span className="mt-0.5 block text-sm text-muted">{description}</span>}
      </span>
    </label>
  );
}
