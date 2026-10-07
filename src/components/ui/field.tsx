"use client";

import { useId, useState } from "react";
import { cx } from "@/lib/cx";

type FieldProps = {
  label: string;
  hint?: string;
  error?: string;
  optionalLabel?: string;
  className?: string;
};

const INPUT =
  "block w-full min-h-12 rounded-md bg-surface px-3.5 text-base text-ink placeholder:text-muted " +
  "ring-1 ring-inset ring-line transition-shadow " +
  "focus:outline-none focus:ring-2 focus:ring-primary " +
  "disabled:bg-canvas disabled:text-muted";

function FieldShell({
  id,
  label,
  hint,
  error,
  optionalLabel,
  className,
  children,
}: FieldProps & { id: string; children: React.ReactNode }) {
  return (
    <div className={cx("space-y-1.5", className)}>
      <label htmlFor={id} className="flex items-baseline justify-between gap-2 text-sm font-medium text-ink">
        {label}
        {optionalLabel && <span className="text-xs font-normal text-muted">{optionalLabel}</span>}
      </label>
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
  ...input
}: FieldProps & Omit<React.InputHTMLAttributes<HTMLInputElement>, "className">) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optionalLabel={optionalLabel} className={className}>
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

export function PhoneField(props: FieldProps & Omit<React.InputHTMLAttributes<HTMLInputElement>, "className" | "type">) {
  const { label, hint, error, optionalLabel, className, ...input } = props;
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optionalLabel={optionalLabel} className={className}>
      <div className={cx("flex rounded-md ring-1 ring-inset ring-line focus-within:ring-2 focus-within:ring-primary bg-surface", error && "ring-2 ring-danger focus-within:ring-danger")}>
        <span className="flex items-center border-r border-line pl-3.5 pr-3 text-lg leading-none" aria-hidden>
          🇧🇩
        </span>
        <input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? `${id}-msg` : undefined}
          className="min-h-12 w-full min-w-0 rounded-r-md bg-transparent px-3.5 text-base text-ink placeholder:text-muted focus:outline-none"
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
  const { label, hint, error, optionalLabel, className, ...input } = props;
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optionalLabel={optionalLabel} className={className}>
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
  const { label, hint, error, optionalLabel, className, length, ...input } = props;
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optionalLabel={optionalLabel} className={className}>
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
  value,
  maxLength,
  counterLabel,
  ...input
}: FieldProps & { value: string; counterLabel?: string } & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "className" | "value">) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optionalLabel={optionalLabel} className={className}>
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
  options,
  placeholder,
  ...select
}: FieldProps & { options: { value: string; label: string }[]; placeholder: string } & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "className">) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optionalLabel={optionalLabel} className={className}>
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
