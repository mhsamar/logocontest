"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
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
  const prefix = t("home.landing.namePrefix");
  const examples = t("home.landing.nameExamples");

  // The hint types example business names one after another (owner, 2026-10-12): type, pause, delete, next. It
  // writes the placeholder directly (no re-render per letter), stops on focus, and stays still for reduced motion.
  useEffect(() => {
    const el = input.current;
    const names = examples.split("|").map((x) => x.trim()).filter(Boolean);
    if (!el || names.length === 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const split = (x: string) =>
      typeof Intl !== "undefined" && "Segmenter" in Intl ? [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(x)].map((g) => g.segment) : Array.from(x);
    // Start from the hint the page opened with (the first name, in full) and delete it first.
    let word = 0;
    let shown = split(names[0]).length;
    let deleting = true;
    let timer = 0;
    const tick = () => {
      if (document.activeElement === el) {
        el.placeholder = prefix + names[word];
        timer = window.setTimeout(tick, 400);
        return;
      }
      const letters = split(names[word]);
      if (!deleting && shown < letters.length) {
        shown++;
        el.placeholder = prefix + letters.slice(0, shown).join("") + "|";
        timer = window.setTimeout(tick, 70 + Math.random() * 60);
      } else if (!deleting) {
        // Hold the full name with a blinking caret, then start deleting.
        deleting = true;
        let blinks = 0;
        const blink = () => {
          el.placeholder = prefix + names[word] + (blinks % 2 === 0 ? "" : "|");
          if (++blinks < 5) timer = window.setTimeout(blink, 360);
          else timer = window.setTimeout(tick, 200);
        };
        blink();
      } else if (shown > 0) {
        shown--;
        el.placeholder = prefix + letters.slice(0, shown).join("") + "|";
        timer = window.setTimeout(tick, 34);
      } else {
        deleting = false;
        word = (word + 1) % names.length;
        timer = window.setTimeout(tick, 320);
      }
    };
    timer = window.setTimeout(tick, 1800);
    return () => window.clearTimeout(timer);
  }, [prefix, examples]);

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
            // Focus (owner, 2026-10-12): a soft red border and a gentle halo round the whole box, not a hard stroke.
            "flex h-[58px] min-w-0 flex-[1_1_220px] items-center gap-2.5 rounded-xl border-[1.5px] bg-white px-4 text-[var(--lc-muted)] transition-[border-color,box-shadow,color] duration-300 focus-within:border-[color-mix(in_srgb,var(--lc-red)_45%,white)] focus-within:text-[var(--lc-red)] focus-within:shadow-[0_0_0_5px_rgb(139_0_0/0.07),0_10px_24px_-14px_rgb(139_0_0/0.35)]",
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
