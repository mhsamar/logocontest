import { ButtonLink } from "@/components/ui/button";
import { cx } from "@/lib/cx";
import { getI18n } from "@/lib/i18n/server";
import type { Translate } from "@/lib/i18n/translate";
import { formatNumber } from "@/lib/money";
import { SAMPLE_LOGOS } from "./sample-logos";

/**
 * Home page section 3 (UI-JOURNEY P-01): steps on the left, numbered dots on a
 * wavy dashed line in the middle, and a small product mock on the right.
 */

// The wave crosses the centre exactly where the three dots sit (1/6, 1/2, 5/6 of the height).
const WAVE = (() => {
  const H = 600;
  const points = Array.from({ length: 121 }, (_, i) => {
    const y = (i / 120) * H;
    const x = 60 + 38 * Math.sin((3 * Math.PI * y) / H - Math.PI / 2);
    return `${x.toFixed(1)} ${y.toFixed(1)}`;
  });
  return `M${points.join(" L")}`;
})();

function Star({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={cx("size-3.5", on ? "text-accent" : "text-line")} fill="currentColor" aria-hidden>
      <path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7Z" />
    </svg>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} on={n <= value} />
      ))}
    </span>
  );
}

function MockCard({ t, children, className }: { t: Translate; children: React.ReactNode; className?: string }) {
  return (
    <div className={cx("relative w-full max-w-sm rounded-2xl bg-surface p-4 shadow-raised ring-1 ring-line sm:p-5", className)} aria-hidden>
      <span className="absolute -top-2.5 right-4 rounded-full bg-cream px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wider text-primary-dark">
        {t("home.how.art.example")}
      </span>
      {children}
    </div>
  );
}

/** Step 1: the brief's look-and-feel sliders, styles and colours. */
function BriefMock({ t }: { t: Translate }) {
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

function EntryTile({ logo, n, stars, t, locale, className }: { logo: number; n: number; stars: number; t: Translate; locale: "en" | "bn"; className?: string }) {
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
function ReviewMock({ t, locale }: { t: Translate; locale: "en" | "bn" }) {
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
function WinnerMock({ t, locale }: { t: Translate; locale: "en" | "bn" }) {
  return (
    <MockCard t={t}>
      <div className="grid grid-cols-2 gap-3">
        <div className="relative rounded-xl p-1.5 ring-2 ring-accent">
          <EntryTile logo={0} n={14} stars={5} t={t} locale={locale} />
          <span className="absolute -right-2 -top-2 flex size-8 items-center justify-center rounded-full bg-accent text-white shadow-card ring-2 ring-surface">
            <svg viewBox="0 0 24 24" className="size-4" fill="currentColor">
              <path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7Z" />
            </svg>
          </span>
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

export async function HowItWorks({ heading }: { heading: React.ReactNode }) {
  const { t, locale } = await getI18n();
  const steps = [
    { n: 1, art: <BriefMock t={t} /> },
    { n: 2, art: <ReviewMock t={t} locale={locale} /> },
    { n: 3, art: <WinnerMock t={t} locale={locale} /> },
  ] as const;

  return (
    <section className="relative overflow-hidden border-y border-line bg-gradient-to-b from-cream/35 via-frame to-surface">
      <div className="mx-auto max-w-page px-4 py-16 sm:py-20">
        {heading}

        <div className="relative mx-auto mt-12 max-w-5xl lg:mt-6">
          {/* Desktop: wavy dashed line down the middle */}
          <svg
            viewBox="0 0 120 600"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-y-0 left-1/2 hidden h-full w-28 -translate-x-1/2 lg:block"
            aria-hidden
          >
            <path d={WAVE} fill="none" stroke="var(--color-primary)" strokeOpacity="0.35" strokeWidth="2.5" strokeDasharray="7 9" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>

          <ol className="relative space-y-12 lg:space-y-0">
            {steps.map(({ n, art }) => (
              <li key={n} className="relative grid grid-cols-[2.5rem_1fr] gap-x-4 gap-y-6 lg:h-80 lg:grid-cols-[1fr_7rem_1fr] lg:items-center lg:gap-0">
                {/* Phones: dashed line from this dot down to the next one */}
                {n < steps.length && <span className="absolute -bottom-12 left-5 top-10 border-l-2 border-dashed border-primary/30 lg:hidden" aria-hidden />}
                <span className="col-start-1 row-start-1 flex size-10 items-center justify-center self-start rounded-full bg-primary text-base font-bold text-white shadow-card ring-8 ring-frame lg:col-start-2 lg:self-center lg:justify-self-center">
                  {formatNumber(n, locale)}
                </span>
                <div className="col-start-2 row-start-1 lg:col-start-1 lg:max-w-sm lg:justify-self-end lg:pr-10">
                  <h3 className="text-h3 font-bold leading-snug text-ink lg:text-[1.625rem]">{t(`home.how.step${n}.title`)}</h3>
                  <p className="mt-2 leading-relaxed text-muted lg:mt-3 lg:text-lg">{t(`home.how.step${n}.body`)}</p>
                </div>
                <div className="col-start-2 row-start-2 lg:col-start-3 lg:row-start-1 lg:pl-10">{art}</div>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-12 text-center">
          <ButtonLink href="/start" size="lg">
            {t("home.cta")}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
