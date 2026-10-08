"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { LIMITS } from "@/lib/contests/brief";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";

/**
 * Hero "Your business name" + Get Started (UI-JOURNEY P-01). The name must be
 * valid before continuing; it is carried into the wizard so C-01 is already done.
 */
export function HeroForm() {
  const { t } = useI18n();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const errorId = useId();
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = (input.current?.value ?? "").trim();
    if (name.length < LIMITS.brandName.min || name.length > LIMITS.brandName.max) {
      setError(t("home.nameError", { min: LIMITS.brandName.min }));
      input.current?.focus();
      return;
    }
    router.push(`/start?name=${encodeURIComponent(name)}`);
  };

  return (
    // Without JavaScript the form still works and the browser enforces the length.
    <form action="/start" method="get" onSubmit={submit} noValidate className="mx-auto mt-9 max-w-md">
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <label htmlFor="hero-name" className="sr-only">
          {t("home.nameLabel")}
        </label>
        <input
          ref={input}
          id="hero-name"
          name="name"
          required
          minLength={LIMITS.brandName.min}
          maxLength={LIMITS.brandName.max}
          autoComplete="organization"
          placeholder={t("home.namePlaceholder")}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={() => error && setError(null)}
          className={cx(
            "min-h-12 w-full rounded-full bg-surface px-5 text-base text-ink shadow-card ring-1 ring-inset placeholder:text-muted focus:outline-none focus:ring-2",
            error ? "ring-2 ring-danger focus:ring-danger" : "ring-line focus:ring-primary",
          )}
        />
        <button
          type="submit"
          className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-7 text-base font-semibold text-white shadow-card transition-colors hover:bg-primary-dark"
        >
          {t("home.cta")}
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-2 text-left text-sm text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
