/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { AccentTitle, ProfileMock } from "@/components/how/how-parts";
import { ReviewMock } from "@/components/home/how-it-works";
import { Icon } from "@/components/home/sections";
import { Avatar } from "@/components/ui/avatar";
import { cx } from "@/lib/cx";
import type { FeaturedDesigner } from "@/lib/designers/featured";
import { getI18n } from "@/lib/i18n/server";
import { qrSvg } from "@/lib/profile/qr";
import { EXAMPLE_WORK } from "./example-work";

/** Columns sit at different heights, as in the 99designs reference. */
const OFFSETS = ["mt-10 sm:mt-14", "mt-0", "mt-5 sm:mt-8"];

/** Five stars in an arc over the avatar; filled up to the designer's real average rating. */
function StarCrown({ rating }: { rating: number }) {
  const filled = Math.round(rating);
  const points = [
    [6, 30],
    [16, 13],
    [32, 5],
    [48, 13],
    [58, 30],
  ];
  return (
    <svg viewBox="0 0 64 36" className="mx-auto -mb-1 h-7 w-14 sm:h-9 sm:w-[4.5rem]" aria-hidden>
      {points.map(([x, y], i) => (
        <path
          key={i}
          transform={`translate(${x - 6} ${y - 6})`}
          d="M6 0l1.8 3.7 4 .6-2.9 2.8.7 4L6 9.2 2.4 11.1l.7-4L.2 4.3l4-.6Z"
          fill={i < filled ? "var(--color-primary)" : "var(--color-line)"}
        />
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Designers you can trust (owner 2026-10-08, from the 99designs reference)
// ---------------------------------------------------------------------------
export async function TrustedDesigners({ designers }: { designers: FeaturedDesigner[] }) {
  const { t } = await getI18n();
  const real = designers.length >= 3 && designers.every((d) => d.logos.length >= 3);

  return (
    <section className="mx-auto w-full max-w-page px-4 py-16 sm:py-20">
      <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-16">
        <div className="relative">
          {!real && (
            <span className="absolute -top-3 right-2 z-10 rounded-full bg-cream px-2.5 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-primary-dark shadow-card">
              {t("home.how.art.example")}
            </span>
          )}
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            {(real ? designers.slice(0, 3) : EXAMPLE_WORK).map((col, i) => {
              const d = real ? (col as FeaturedDesigner) : null;
              return (
                <div key={i} className={cx("flex flex-col", OFFSETS[i])}>
                  {d && (
                    <div className="relative z-10 -mb-7 flex flex-col items-center sm:-mb-9">
                      {d.rating !== null && <StarCrown rating={d.rating} />}
                      <Avatar name={d.name} url={d.avatarUrl} className="size-14 text-lg ring-4 ring-white sm:size-[4.5rem] sm:text-xl" />
                    </div>
                  )}
                  <div className="flex flex-col gap-1.5 overflow-hidden rounded-xl shadow-card sm:gap-2">
                    {d
                      ? d.logos.slice(0, 3).map((url) => (
                          <img key={url} src={url} loading="lazy" alt={t("home.trust.logoBy", { name: d.name })} className="aspect-square w-full bg-white object-contain" />
                        ))
                      : (col as React.ReactNode[]).map((logo, j) => <div key={j}>{logo}</div>)}
                  </div>
                  {d && (
                    <Link href={`/d/${d.username}`} className="mt-2 self-end font-display text-sm italic text-muted hover:text-primary sm:text-base">
                      {t("home.trust.by", { name: d.name })}
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">{t("home.trust.eyebrow")}</p>
          <AccentTitle lead={t("home.trust.lead")} accent={t("home.trust.accent")} className="mt-3 text-h2 lg:text-[2.5rem]" />
          <span className="mt-5 block h-1 w-12 rounded-full bg-gradient-to-r from-primary to-accent" aria-hidden />
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted">{t("home.trust.body")}</p>
          <Link href="/contests" className="mt-6 inline-flex min-h-11 items-center gap-2 text-lg font-semibold text-ink hover:text-primary">
            {t("home.trust.cta")}
            <Icon d="M5 12h14M13 6l6 6-6 6" className="size-5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Two ways in: run a contest | become a designer (owner 2026-10-08)
// ---------------------------------------------------------------------------
function WayCard({ tile, art, title, body, href, cta }: { tile: string; art: React.ReactNode; title: string; body: string; href: string; cta: string }) {
  return (
    <div className="flex flex-col items-center text-center">
      {/* Same height for both cards so the titles line up */}
      <div className="relative flex h-[18rem] w-full max-w-md items-center justify-center px-4 sm:h-[20rem] sm:px-8">
        <div className={cx("absolute inset-x-10 inset-y-0 rounded-[1.75rem] sm:inset-x-14", tile)} aria-hidden />
        {/* Decorations, as in the reference: a squiggle and a ring */}
        <svg viewBox="0 0 60 24" className="absolute left-4 top-6 w-14 text-primary/70 sm:left-6" aria-hidden>
          <path d="M3 16c6-12 12-12 18 0s12 12 18 0 12-12 18 0" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
        </svg>
        <span className="absolute bottom-4 right-6 size-12 rounded-full border-[10px] border-primary/80 sm:right-8" aria-hidden />
        <div className="relative w-full max-w-[21rem] animate-float-soft">{art}</div>
      </div>
      <h3 className="mt-8 text-2xl font-bold tracking-tight text-ink sm:text-[1.75rem]">{title}</h3>
      <p className="mt-3 max-w-md text-lg leading-relaxed text-muted">{body}</p>
      <Link href={href} className="mt-5 inline-flex min-h-11 items-center gap-2 font-semibold text-primary hover:underline">
        {cta}
        <Icon d="M5 12h14M13 6l6 6-6 6" className="size-4" />
      </Link>
    </div>
  );
}

export async function TwoWays() {
  const { t, locale } = await getI18n();
  const mockQr = await qrSvg("https://logocontest.bd/d/rafi_designs");
  return (
    <section className="mx-auto w-full max-w-page px-4 py-16 sm:py-20">
      <div className="grid gap-16 md:grid-cols-2 md:gap-10">
        <WayCard
          tile="bg-gradient-to-br from-aurora-sky to-aurora-lilac"
          art={<ReviewMock t={t} locale={locale} />}
          title={t("home.ways.contest.title")}
          body={t("home.ways.contest.body")}
          href="/start"
          cta={t("home.ways.contest.cta")}
        />
        <WayCard
          tile="bg-gradient-to-br from-aurora-peach to-aurora-rose"
          art={<ProfileMock t={t} qrSvg={mockQr} />}
          title={t("nav.becomeDesigner")}
          body={t("home.ways.designer.body")}
          href="/designers/signup"
          cta={t("home.ways.designer.cta")}
        />
      </div>
    </section>
  );
}
