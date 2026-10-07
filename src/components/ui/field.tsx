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
