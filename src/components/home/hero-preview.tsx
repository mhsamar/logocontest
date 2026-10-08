/* eslint-disable @next/next/no-img-element */
import { TrophyIcon, WinnerTrophy } from "@/components/ui/trophy";
import { cx } from "@/lib/cx";
import { getI18n } from "@/lib/i18n/server";
import { formatTaka } from "@/lib/money";
import { SAMPLE_LOGO_SRC } from "./sample-logos";

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

/**
 * Entries in the example contest (owner, 2026-10-08): the winner is our own "lc"
 * icon, the others are lettermark examples the owner chose. The sixth slot says
 * more designs are coming instead of showing a number.
 */
const RATINGS = [5, 4, 4, 5, 3];
const ENTRIES = SAMPLE_LOGO_SRC.slice(0, 5).map((src, i) => ({ src, rating: RATINGS[i] }));

/**
 * The large rounded "app preview" panel under the hero: an example contest for
 * our own brand on the Premium package. Clearly labelled; no invented counts.
 */
export async function HeroPreview({ prize }: { prize: number }) {
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
            <div className="flex flex-col rounded-lg bg-surface p-4 text-left shadow-card ring-1 ring-line">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">{t("home.preview.brief")}</p>
              <p className="mt-1 text-lg font-bold text-ink">{t("home.preview.brand")}</p>
              <p className="text-sm text-muted">{t("wizard.businessTypes.services")}</p>
              <p className="mt-3 text-xl font-bold text-accent">{formatTaka(prize, locale)}</p>
              <p className="text-xs text-muted">{t("wizard.packages.premium.name")}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {["lettermark", "emblem"].map((s) => (
                  <span key={s} className="rounded-full bg-canvas px-2.5 py-1 text-xs font-medium text-ink ring-1 ring-line">
                    {t(`wizard.styles.${s as "lettermark" | "emblem"}`)}
                  </span>
                ))}
              </div>
              <div className="mt-4 flex gap-1.5 lg:mb-5" aria-hidden>
                {["#5c0b0f", "#d4a017", "var(--color-ink)"].map((c) => (
                  <span key={c} className="size-6 rounded-full ring-1 ring-line" style={{ background: c }} />
                ))}
              </div>

              {/* Desktop: the end of the story, the winner and the files (fills the card down to the grid's height). Phones show the grid right below, so it is left out there. */}
              <div className="mt-auto hidden border-t border-line pt-4 lg:block">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-cream/70 py-0.5 pl-1 pr-2.5 text-xs font-semibold text-primary-dark">
                  <TrophyIcon className="size-5" />
                  {t("home.preview.picked")}
                </span>
                {/* The winner's full logo (owner's logo pack) */}
                <div className="mt-3 rounded-lg bg-white px-3 py-4 ring-2 ring-primary">
                  <img src="/brand/logo-full.png" alt="" width={501} height={74} className="mx-auto h-auto w-full" />
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-sm font-semibold text-ink">#1</p>
                  <Stars value={ENTRIES[0].rating} />
                </div>
                <div className="mt-4 flex items-center justify-between gap-2 rounded-md bg-canvas px-3 py-2">
                  <span className="text-xs font-medium text-muted">{t("home.preview.files")}</span>
                  <span className="flex gap-1">
                    {["AI", "SVG", "PNG"].map((f) => (
                      <span key={f} className="rounded bg-ink px-1.5 py-0.5 text-[0.625rem] font-bold text-cream">
                        {f}
                      </span>
                    ))}
                  </span>
                </div>
              </div>
            </div>

            {/* entries */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {ENTRIES.map((entry, i) => (
                <div
                  key={i}
                  className={cx(
                    "relative flex flex-col overflow-hidden rounded-lg bg-surface text-left shadow-card ring-1",
                    i === 0 ? "ring-2 ring-primary" : "ring-line",
                    i > 3 && "hidden sm:flex",
                  )}
                >
                  {i === 0 && (
                    <>
                      <span className="absolute left-2 top-2 z-10 rounded-full bg-primary px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide text-white">
                        {t("home.preview.winner")}
                      </span>
                      <WinnerTrophy className="absolute right-2 top-2 z-10" />
                    </>
                  )}
                  <img src={entry.src} alt="" className="aspect-[4/3] min-h-0 w-full flex-1 object-cover" loading={i === 0 ? "eager" : "lazy"} />
                  <div className="flex items-center justify-between border-t border-line px-2.5 py-2">
                    <span className="text-xs font-semibold text-muted">#{i + 1}</span>
                    <Stars value={entry.rating} />
                  </div>
                </div>
              ))}
              <div className="hidden flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-line bg-surface/60 p-4 text-center sm:flex">
                <span className="flex size-10 items-center justify-center rounded-full bg-cream text-xl font-bold text-primary-dark" aria-hidden>
                  +
                </span>
                <span className="text-sm font-medium text-muted">{t("home.preview.more")}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <figcaption className="mt-4 text-center text-sm text-muted">{t("home.preview.caption")}</figcaption>
    </figure>
  );
}
