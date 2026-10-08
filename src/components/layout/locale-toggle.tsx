import { setLocale } from "@/lib/i18n/actions";
import type { Locale } from "@/lib/i18n/config";
import { cx } from "@/lib/cx";

/** EN / বাংলা switch. A plain form, so it works before JavaScript loads. */
export function LocaleToggle({
  locale,
  label,
  ariaLabel,
  className,
  tone = "light",
}: {
  locale: Locale;
  label: string;
  ariaLabel: string;
  className?: string;
  /** "dark" for the floating header pill. */
  tone?: "light" | "dark";
}) {
  return (
    <form action={setLocale} className={className}>
      <input type="hidden" name="locale" value={locale === "en" ? "bn" : "en"} />
      <button
        type="submit"
        aria-label={ariaLabel}
        lang={locale === "en" ? "bn" : "en"}
        className={cx(
          "inline-flex min-h-11 items-center gap-1.5 px-3 text-sm font-semibold",
          tone === "dark" ? "rounded-full text-white/70 hover:bg-white/10 hover:text-white" : "rounded-full text-ink/85 hover:bg-white/70 hover:text-ink",
        )}
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3Z" />
        </svg>
        {label}
      </button>
    </form>
  );
}
