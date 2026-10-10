"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { LIMITS } from "@/lib/contests/brief";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";

/**
 * Hero "Your business name" + Get Started (UI-JOURNEY P-01; look from the 2026-10-10 home design). The name must be
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
    <form action="/start" method="get" onSubmit={submit} noValidate className="flex w-full flex-col items-center gap-2">
      <label htmlFor="hero-name" className="text-sm font-semibold text-[var(--lc-muted)]">
        {t("home.nameLabel")}
      </label>
      <div className={cx("lc-sh lc-hero-form flex w-full flex-wrap gap-1.5 rounded-[20px] border bg-white p-1.5", error ? "border-danger" : "border-[var(--lc-line)]")}>
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
          className="h-[52px] min-w-0 flex-[1_1_200px] rounded-[14px] border-0 bg-transparent px-4 text-lg font-medium text-[var(--lc-ink)] placeholder:text-[var(--lc-muted)]/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lc-red)]"
        />
        <button type="submit" className="lc-g inline-flex h-[52px] flex-none items-center gap-2 rounded-[14px] border-0 bg-[image:var(--lc-grad)] px-[26px] text-[17px] font-bold text-white">
          {t("home.cta")}
          <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
