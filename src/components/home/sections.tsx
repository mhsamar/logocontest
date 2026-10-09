import { ButtonLink } from "@/components/ui/button";
import { Carousel } from "@/components/ui/carousel";
import { EmptyState } from "@/components/ui/empty-state";
import { LogoMark } from "@/components/ui/logo";
import { ContestCard } from "@/components/contests/contest-card";
import type { ContestRow } from "@/lib/contests/browse";
import { cx } from "@/lib/cx";
import { getI18n } from "@/lib/i18n/server";
import { brandPictures } from "@/lib/content/brand";
import { getContact } from "@/lib/content/contact";
import { visibleList } from "@/lib/content/lists";
import { fillLegal } from "@/lib/legal/types";
import { HeroForm } from "./hero-form";
import { HowItWorks as HowItWorksSteps } from "./how-it-works";
import { Typewriter } from "./typewriter";
import { WhyBento } from "./why-bento";
import { HeroPreview } from "./hero-preview";

// Accent words: italic display serif in the red-to-gold gradient (owner, 2026-10-08).
export const ACCENT_TEXT = "bg-gradient-to-r from-primary via-primary-dark to-accent bg-clip-text pb-1 pr-1 text-transparent";

export function SectionHeading({ eyebrow, lead, accent, subtitle }: { eyebrow: string; lead: string; accent: string; subtitle?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">{eyebrow}</p>
      <h2 className="mt-3 text-h2 font-bold leading-tight tracking-tight text-ink lg:text-h2-lg">
        {lead}{" "}
        <span className="sr-only">{accent}</span>
        {/* Typed out when the heading scrolls into view */}
        <span className="font-display text-[1.15em] font-normal italic tracking-normal">
          <Typewriter phrases={[accent]} onView delay={200} className={ACCENT_TEXT} />
        </span>
      </h2>
      {subtitle && <p className="mt-3 text-muted">{subtitle}</p>}
    </div>
  );
}

export function Icon({ d, className }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cx("size-5", className)} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d={d} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export const ICONS = {
  bkash: "M3 7h18v10H3zM3 11h18M7 15h3",
  shield: "M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6Z M9 12l2 2 4-4",
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2",
  ideas: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z",
  hand: "M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5Z",
  key: "M15 7a4 4 0 1 1-3.9 5H9v2H7v2H4v-3l6.1-6.1A4 4 0 0 1 15 7Z",
  lock: "M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3",
};

// ---------------------------------------------------------------------------
// 1. Hero
// ---------------------------------------------------------------------------
export async function Hero({ premiumPrize }: { premiumPrize: number }) {
  const { t, locale } = await getI18n();
  const [contact, pictures] = await Promise.all([getContact(locale), brandPictures()]);
  const trust: { icon: keyof typeof ICONS; title: string; sub: string; href?: string }[] = [
    { icon: "bkash", title: t("home.trustBar.payTitle"), sub: t("home.trustBar.paySub") },
    { icon: "shield", title: t("home.trustBar.heldTitle"), sub: t("home.trustBar.heldSub") },
    { icon: "phone", title: contact.phone, sub: t("home.trustBar.callSub"), href: contact.phoneHref },
  ];
  return (
    // Pulled up under the transparent header so the nav sits inside the frame (UI-JOURNEY §1.1).
    <section className="relative -mt-16">
      <div className="bg-aurora relative mx-2 mt-2 overflow-hidden rounded-[2rem] shadow-frame ring-1 ring-white sm:mx-4 sm:mt-3 lg:rounded-[2.75rem]">
        <div className="relative mx-auto max-w-page px-4 pb-44 pt-28 text-center sm:pb-60 sm:pt-36">
          <p className="mx-auto inline-flex animate-rise items-center gap-2 rounded-full bg-surface/80 px-3.5 py-1.5 text-sm font-medium text-muted shadow-card ring-1 ring-line">
            <span className="relative flex size-2" aria-hidden>
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/50 motion-reduce:hidden" />
              <span className="relative inline-flex size-2 rounded-full bg-primary" />
            </span>
            {t("home.eyebrow")}
          </p>
          <h1 className="mx-auto mt-5 max-w-4xl text-balance text-h1 font-bold leading-[1.08] tracking-tight text-ink sm:text-[2.75rem] lg:text-[3.6rem]">
            <span className="block animate-rise" style={{ animationDelay: "0.08s" }}>
              {t("home.titleLead")}
            </span>
            {/* Second font and colour, typed out (owner, 2026-10-08) */}
            <span className="sr-only">{t("home.titleAccent")}</span>
            <span className="mt-1 block font-display text-[1.12em] font-normal italic leading-[1.1] tracking-normal">
              <Typewriter
                phrases={[t("home.titleAccent"), t("home.titleAccent2"), t("home.titleAccent3")]}
                loop
                className={ACCENT_TEXT}
              />
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl animate-rise text-base text-muted sm:text-lg" style={{ animationDelay: "0.2s" }}>
            {t("home.subtitle")}
          </p>

          <div className="animate-rise" style={{ animationDelay: "0.3s" }}>
            <HeroForm />
          </div>

          {/* Trust points: one glass bar that floats gently (owner, 2026-10-08) */}
          <div className="mx-auto mt-8 w-full max-w-sm animate-rise sm:w-fit sm:max-w-none" style={{ animationDelay: "0.45s" }}>
            <ul className="flex animate-float-soft flex-col divide-y divide-line rounded-2xl bg-surface/85 p-1.5 text-left shadow-raised ring-1 ring-white backdrop-blur sm:flex-row sm:divide-x sm:divide-y-0 sm:rounded-full">
              {trust.map((item) => {
                const inner = (
                  <>
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-dark text-white shadow-card">
                      <Icon d={ICONS[item.icon]} className="size-[1.1rem]" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold leading-tight text-ink">{item.title}</span>
                      <span className="block text-xs leading-snug text-muted">{item.sub}</span>
                    </span>
                  </>
                );
                const cell = "flex items-center gap-3 rounded-full px-3 py-2.5 sm:py-1.5 sm:pr-5";
                return (
                  <li key={item.icon}>
                    {item.href ? (
                      <a href={item.href} className={`${cell} transition-colors hover:bg-canvas`}>
                        {inner}
                      </a>
                    ) : (
                      <span className={cell}>{inner}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>

      {/* The example panel overlaps the frame's bottom edge */}
      <div className="relative z-10 -mt-36 px-4 sm:-mt-48">
        {pictures.hero ? (
          // An admin's own picture in place of the example panel (A-17).
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pictures.hero} alt="" className="mx-auto block w-full max-w-5xl rounded-3xl bg-surface object-cover shadow-raised ring-1 ring-white" />
        ) : (
          <HeroPreview prize={premiumPrize} />
        )}
      </div>
      <div id="hero-end" aria-hidden />
    </section>
  );
}

// ---------------------------------------------------------------------------
// 2. Recent winning logos (live contests until real winners exist)
// ---------------------------------------------------------------------------
export async function Showcase({ kind, contests }: { kind: "winners" | "live"; contests: ContestRow[] }) {
  const { t } = await getI18n();
  const now = new Date();
  return (
    <section className="mx-auto w-full max-w-page px-4 py-16 sm:py-20">
      <SectionHeading
        eyebrow={t("home.showcase.eyebrow")}
        lead={kind === "winners" ? t("home.showcase.winnersLead") : t("home.showcase.liveLead")}
        accent={kind === "winners" ? t("home.showcase.winnersAccent") : t("home.showcase.liveAccent")}
        subtitle={t("home.showcase.subtitle")}
      />
      {contests.length > 0 ? (
        <>
          {/* 3 rows: 2 columns on phones (6 cards), 4 on desktop (12 cards) */}
          {/* Carousel with round arrows and dots (ofsp_ce reference) */}
          <div className="mt-10">
            <Carousel
              prevLabel={t("home.showcase.prev")}
              nextLabel={t("home.showcase.next")}
              itemClassName="w-[78%] sm:w-[calc(50%-0.5rem)] lg:w-[calc(25%-0.75rem)]"
            >
              {contests.map((c) => (
                <ContestCard key={c.slug} contest={c} now={now} />
              ))}
            </Carousel>
          </div>
          <div className="mt-10 text-center">
            <ButtonLink href="/contests" variant="secondary" size="lg">
              {t("home.showcase.browse")}
            </ButtonLink>
          </div>
        </>
      ) : (
        <div className="mx-auto mt-10 max-w-xl">
          <EmptyState
            title={t("home.showcase.emptyTitle")}
            body={t("home.showcase.emptyBody")}
            action={<ButtonLink href="/start">{t("home.cta")}</ButtonLink>}
          />
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// 3. How it works
// ---------------------------------------------------------------------------
export async function HowItWorks() {
  const { t } = await getI18n();
  return <HowItWorksSteps heading={<SectionHeading eyebrow={t("home.how.eyebrow")} lead={t("home.how.titleLead")} accent={t("home.how.titleAccent")} />} />;
}

// ---------------------------------------------------------------------------
// 4. Why Logo Contest
// ---------------------------------------------------------------------------

// Freelancer, design agency, logocontest.bd
const COMPARE: { key: "many" | "price" | "original" | "copyright" | "held"; values: [boolean, boolean, boolean] }[] = [
  { key: "many", values: [false, false, true] },
  { key: "price", values: [true, false, true] },
  { key: "original", values: [false, true, true] },
  { key: "copyright", values: [false, true, true] },
  { key: "held", values: [false, false, true] },
];

function Mark({ yes, label }: { yes: boolean; label: string }) {
  return yes ? (
    <span className="inline-flex size-7 items-center justify-center rounded-full bg-primary text-white">
      <Icon d="M5 12.5l4.5 4.5L19 7.5" className="size-4" />
      <span className="sr-only">{label}</span>
    </span>
  ) : (
    <span className="inline-flex size-7 items-center justify-center rounded-full text-muted ring-1 ring-line">
      <Icon d="M7 12h10" className="size-4" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export async function WhyUs() {
  const { t } = await getI18n();
  return (
    <section className="mx-auto w-full max-w-page px-4 py-16 sm:py-20">
      <SectionHeading eyebrow={t("home.why.eyebrow")} lead={t("home.why.titleLead")} accent={t("home.why.titleAccent")} />
      <WhyBento />

      <div className="relative mx-auto mt-14 max-w-4xl rounded-2xl bg-surface p-2 shadow-card ring-1 ring-line sm:p-4">
        <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
          <colgroup>
            <col className="w-[40%] sm:w-2/5" />
            <col />
            <col />
            <col />
          </colgroup>
          <caption className="px-3 pb-3 pt-2 text-left text-base font-semibold text-ink">{t("home.why.compare.title")}</caption>
          <thead>
            <tr>
              <th scope="col" className="px-2 py-3 sm:px-3" />
              <th scope="col" className="px-1 py-3 text-center text-xs font-semibold text-muted sm:px-3 sm:text-sm">
                {t("home.why.compare.freelancer")}
              </th>
              <th scope="col" className="px-1 py-3 text-center text-xs font-semibold text-muted sm:px-3 sm:text-sm">
                {t("home.why.compare.agency")}
              </th>
              <th scope="col" className="break-words rounded-t-lg bg-cream px-1 py-3 text-center text-xs font-bold text-primary-dark sm:px-3 sm:text-sm">
                <LogoMark className="mx-auto size-7 sm:hidden" />
                <span className="sr-only sm:not-sr-only">{t("brand.name")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {COMPARE.map((row, i) => (
              <tr key={row.key}>
                <th scope="row" className={cx("px-2 py-3.5 text-left text-[0.8125rem] font-medium leading-snug text-ink sm:px-3 sm:text-sm", i % 2 === 0 && "bg-canvas")}>
                  {t(`home.why.compare.rows.${row.key}`)}
                </th>
                {row.values.map((yes, j) => (
                  <td
                    key={j}
                    className={cx(
                      "px-1 py-3.5 text-center sm:px-3",
                      j === 2 ? "bg-cream" : i % 2 === 0 && "bg-canvas",
                      j === 2 && i === COMPARE.length - 1 && "rounded-b-lg",
                    )}
                  >
                    <Mark yes={yes} label={yes ? t("home.why.compare.yes") : t("home.why.compare.no")} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 5. Q&A
// ---------------------------------------------------------------------------
export async function Faq({ params }: { params: Record<string, string | number> }) {
  const { t, locale } = await getI18n();
  // Home Q&A list (A-15); answers may use the price placeholders.
  const items = await visibleList("home_faq", locale);
  return (
    <section id="faq" className="scroll-mt-24">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:py-20">
        <SectionHeading eyebrow={t("home.faq.eyebrow")} lead={t("home.faq.titleLead")} accent={t("home.faq.titleAccent")} />
        <div className="mt-10 divide-y divide-line rounded-2xl bg-surface/90 shadow-card ring-1 ring-line backdrop-blur">
          {items.map((item) => (
            <details key={item.id} className="group px-5 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 font-semibold text-ink">
                {item.text.q}
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface text-primary ring-1 ring-line transition-transform group-open:rotate-45">
                  <Icon d="M12 5v14M5 12h14" className="size-4" />
                </span>
              </summary>
              <p className="pb-5 pr-10 leading-relaxed text-muted">{fillLegal(item.text.a, params)}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
