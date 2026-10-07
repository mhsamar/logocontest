import { cx } from "@/lib/cx";
import { getI18n } from "@/lib/i18n/server";
import { formatTaka } from "@/lib/money";
import { SAMPLE_LOGOS } from "./sample-logos";

function Stars({ value }: { value: number }) {
  return (
    <span className="flex gap-0.5" aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} viewBox="0 0 20 20" className={cx("size-3", i <= value ? "text-accent" : "text-line")} fill="currentColor">
          <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.8l-5.2 2.8 1-5.8L1.5 7.7l5.9-.9Z" />
        </svg>
      ))}
    </span>
  );
}

const RATINGS = [5, 4, 4, 3, 5, 4];

/**
 * The large rounded "app preview" panel under the hero: an example contest
 * with our own sample logos. Clearly labelled; no invented counts.
 */
export async function HeroPreview({ standardPrize }: { standardPrize: number }) {
  const { t, locale } = await getI18n();
  return (
    <figure className="relative mx-auto w-full max-w-5xl">
      <div className="rounded-[1.75rem] bg-surface/90 p-2 shadow-panel ring-1 ring-white backdrop-blur sm:p-3">
        <div className="overflow-hidden rounded-[1.1rem] bg-canvas ring-1 ring-line">
          {/* window bar */}
          <div className="flex items-center gap-1.5 border-b border-line bg-surface px-4 py-3">
            <span className="size-2.5 rounded-full bg-line" />
            <span className="size-2.5 rounded-full bg-line" />
            <span className="size-2.5 rounded-full bg-line" />
            <span className="ml-3 rounded-full bg-cream px-2.5 py-0.5 text-[0.6875rem] font-semibold text-primary-dark">
              {t("home.preview.label")}
            </span>
          </div>

          <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[260px_minmax(0,1fr)]">
            {/* brief */}
            <div className="rounded-lg bg-surface p-4 text-left shadow-card ring-1 ring-line">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">{t("home.preview.brief")}</p>
              <p className="mt-1 text-lg font-bold text-ink">{t("home.preview.brand")}</p>
              <p className="text-sm text-muted">{t("wizard.businessTypes.food")}</p>
              <p className="mt-3 text-xl font-bold text-accent">{formatTaka(standardPrize, locale)}</p>
              <p className="text-xs text-muted">{t("wizard.packages.standard.name")}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {["emblem", "wordmark"].map((s) => (
                  <span key={s} className="rounded-full bg-canvas px-2.5 py-1 text-xs font-medium text-ink ring-1 ring-line">
                    {t(`wizard.styles.${s as "emblem" | "wordmark"}`)}
                  </span>
                ))}
              </div>
              <div className="mt-4 flex gap-1.5" aria-hidden>
                {["var(--color-primary)", "var(--color-cream)", "var(--color-ink)"].map((c) => (
                  <span key={c} className="size-6 rounded-full ring-1 ring-line" style={{ background: c }} />
                ))}
              </div>
            </div>

            {/* entries */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {SAMPLE_LOGOS.map((logo, i) => (
                <div
                  key={i}
                  className={cx(
                    "relative overflow-hidden rounded-lg bg-surface text-left shadow-card ring-1",
                    i === 0 ? "ring-2 ring-primary" : "ring-line",
                    i > 3 && "hidden sm:block",
                  )}
                >
                  {i === 0 && (
                    <span className="absolute left-2 top-2 z-10 rounded-full bg-primary px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide text-white">
                      {t("home.preview.winner")}
                    </span>
                  )}
                  <div className="aspect-[4/3]">{logo}</div>
                  <div className="flex items-center justify-between border-t border-line px-2.5 py-2">
                    <span className="text-xs font-semibold text-muted">#{i + 1}</span>
                    <Stars value={RATINGS[i]} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <figcaption className="mt-4 text-center text-sm text-muted">{t("home.preview.caption")}</figcaption>
    </figure>
  );
}
