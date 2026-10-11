"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { LIMITS } from "@/lib/contests/brief";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";

/**
 * Hero "Your business name" + Get a logo (UI-JOURNEY P-01; look from the 2026-10-11 hero design). The name must be
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
    <form action="/start" method="get" onSubmit={submit} noValidate className="flex w-full flex-col gap-2">
      <label htmlFor="hero-name" className="text-left text-sm font-bold text-[var(--lc-muted)]">
        {t("home.nameLabel")}
      </label>
      {/* Look from the 2026-10-11 hero design: a search-style field and a round "Get a logo" button */}
      <div className="lc-hero-row flex flex-wrap gap-2.5">
        <span
          className={cx(
            "flex h-[58px] min-w-0 flex-[1_1_220px] items-center gap-2.5 rounded-xl border-[1.5px] bg-white px-4 text-[var(--lc-muted)] transition-colors focus-within:border-[var(--lc-red)]",
            error ? "border-danger" : "border-[#B9BCC4]",
          )}
        >
          <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <circle cx="11" cy="11" r="6.5" />
            <path d="M16 16l4 4" />
          </svg>
          <input
            ref={input}
            id="hero-name"
            name="name"
            required
            minLength={LIMITS.brandName.min}
            maxLength={LIMITS.brandName.max}
            autoComplete="organization"
            placeholder={t("home.landing.namePlaceholder")}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={() => error && setError(null)}
            className="h-full min-w-0 flex-1 border-0 bg-transparent text-lg font-medium text-[var(--lc-ink)] outline-none placeholder:text-[var(--lc-muted)]/70"
          />
        </span>
        <button type="submit" className="lc-g h-[58px] flex-none rounded-full border-0 bg-[var(--lc-red)] px-[30px] text-lg font-bold text-white">
          {t("home.hero.cta")}
        </button>
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-left text-sm text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
