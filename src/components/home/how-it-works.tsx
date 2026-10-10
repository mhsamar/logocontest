import { WinnerTrophy } from "@/components/ui/trophy";
import { cx } from "@/lib/cx";
import type { Translate } from "@/lib/i18n/translate";
import { formatNumber } from "@/lib/money";
import { SAMPLE_LOGOS } from "./sample-logos";

/** Small product mocks for the How It Works steps (UI-JOURNEY P-08). */

function Star({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={cx("size-3.5", on ? "text-accent" : "text-line")} fill="currentColor" aria-hidden>
      <path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7Z" />
    </svg>
  );
}

export function Stars({ value }: { value: number }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} on={n <= value} />
      ))}
    </span>
  );
}

export function MockCard({ t, children, className }: { t: Translate; children: React.ReactNode; className?: string }) {
  return (
    <div className={cx("lc-card lc-sh relative w-full max-w-sm rounded-[24px] p-4 sm:p-5", className)} aria-hidden>
      <span className="absolute -top-2.5 right-4 rounded-full bg-tint px-2.5 py-0.5 text-[0.625rem] font-bold uppercase tracking-wider text-primary">
        {t("home.how.art.example")}
      </span>
      {children}
    </div>
  );
}

/** Step 1: the brief's look-and-feel sliders, styles and colours. */
export function BriefMock({ t }: { t: Translate }) {
  const sliders = [
    { key: "complexity", value: 0.3 },
    { key: "era", value: 0.72 },
    { key: "tone", value: 0.55 },
  ] as const;
  return (
    <MockCard t={t}>
      <ul className="space-y-3.5">
        {sliders.map((s) => (
          <li key={s.key} className="grid grid-cols-[4.5rem_1fr_4.5rem] items-center gap-2 text-xs text-muted">
            <span className="truncate text-right">{t(`wizard.sliders.${s.key}.left`)}</span>
            <span className="relative h-1.5 rounded-full bg-line">
              <span className="absolute inset-y-0 left-0 rounded-full bg-primary/30" style={{ width: `${s.value * 100}%` }} />
              <span
                className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-2 ring-surface"
                style={{ left: `${s.value * 100}%` }}
              />
            </span>
            <span className="truncate">{t(`wizard.sliders.${s.key}.right`)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3.5">
        <div className="flex flex-wrap gap-1.5">
          {(["emblem", "wordmark"] as const).map((s) => (
            <span key={s} className="rounded-full bg-cream/70 px-2.5 py-0.5 text-[0.6875rem] font-medium text-primary-dark">
              {t(`wizard.styles.${s}`)}
            </span>
          ))}
        </div>
        <div className="flex -space-x-1.5">
          {["var(--color-primary)", "var(--color-accent)", "var(--color-ink)"].map((c) => (
            <span key={c} className="size-5 rounded-full ring-2 ring-surface" style={{ background: c }} />
          ))}
        </div>
      </div>
    </MockCard>
  );
}

export function EntryTile({ logo, n, stars, t, locale, className }: { logo: number; n: number; stars: number; t: Translate; locale: "en" | "bn"; className?: string }) {
  return (
    <div className={cx("min-w-0", className)}>
      <div className="aspect-[4/3] overflow-hidden rounded-lg ring-1 ring-line">{SAMPLE_LOGOS[logo]}</div>
      <p className="mt-1.5 truncate text-[0.6875rem] font-medium text-muted">{t("home.how.art.entry", { n: formatNumber(n, locale) })}</p>
      <div className="mt-0.5">
        <Stars value={stars} />
      </div>
    </div>
  );
}

/** Step 2: two example entries, rated, with a client comment. */
export function ReviewMock({ t, locale }: { t: Translate; locale: "en" | "bn" }) {
  return (
    <MockCard t={t}>
      <div className="grid grid-cols-2 gap-3">
        <EntryTile logo={2} n={12} stars={3} t={t} locale={locale} />
        <EntryTile logo={0} n={14} stars={5} t={t} locale={locale} />
      </div>
      <div className="mt-3 flex items-start gap-2 rounded-lg bg-canvas p-2.5">
        <span className="mt-0.5 rounded bg-primary px-1.5 py-0.5 text-[0.5625rem] font-bold uppercase tracking-wider text-white">
          {t("contest.comments.clientBadge")}
        </span>
        <p className="text-xs leading-snug text-ink">{t("home.how.art.comment")}</p>
      </div>
    </MockCard>
  );
}

/** Step 3: the picked winner with a ribbon, and the final files. */
export function WinnerMock({ t, locale }: { t: Translate; locale: "en" | "bn" }) {
  return (
    <MockCard t={t}>
      <div className="grid grid-cols-2 gap-3">
        <div className="relative rounded-xl p-1.5 ring-2 ring-accent">
          <EntryTile logo={0} n={14} stars={5} t={t} locale={locale} />
          <WinnerTrophy className="absolute -right-3 -top-3" />
          <span className="absolute left-3 top-3 rounded-full bg-accent px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wider text-white">
            {t("home.how.art.winner")}
          </span>
        </div>
        <EntryTile logo={2} n={12} stars={3} t={t} locale={locale} className="p-1.5 opacity-50" />
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
        <span className="text-xs font-medium text-muted">{t("home.how.art.files")}</span>
        <span className="flex gap-1.5">
          {["AI", "SVG", "PNG"].map((f) => (
            <span key={f} className="rounded bg-ink px-1.5 py-0.5 text-[0.625rem] font-bold text-cream">
              {f}
            </span>
          ))}
        </span>
      </div>
    </MockCard>
  );
}
