import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LogoMark } from "@/components/ui/logo";
import { ContestCard } from "@/components/contests/contest-card";
import type { ContestRow } from "@/lib/contests/browse";
import { cx } from "@/lib/cx";
import { getI18n } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { SUPPORT_PHONE, SUPPORT_PHONE_HREF } from "@/lib/site";
import { HeroForm } from "./hero-form";
import { HowItWorks as HowItWorksSteps } from "./how-it-works";
import { WhyBento } from "./why-bento";
import { HeroPreview } from "./hero-preview";

function SectionHeading({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">{eyebrow}</p>
      <h2 className="mt-3 text-h2 font-bold leading-tight tracking-tight text-ink lg:text-h2-lg">{title}</h2>
      {subtitle && <p className="mt-3 text-muted">{subtitle}</p>}
    </div>
  );
}

function Icon({ d, className }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cx("size-5", className)} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d={d} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const ICONS = {
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
export async function Hero({ standardPrize }: { standardPrize: number }) {
  const { t } = await getI18n();
  const trust: { icon: keyof typeof ICONS; text: string; href?: string }[] = [
    { icon: "bkash", text: t("home.trust.pay") },
    { icon: "shield", text: t("home.trust.held") },
    { icon: "phone", text: t("home.trust.call", { phone: SUPPORT_PHONE }), href: SUPPORT_PHONE_HREF },
  ];
  return (
    // Pulled up under the transparent header so the nav sits inside the frame (UI-JOURNEY §1.1).
    <section className="relative -mt-16">
      <div className="relative mx-2 mt-2 overflow-hidden rounded-[2rem] bg-frame shadow-frame ring-1 ring-white sm:mx-4 sm:mt-3 lg:rounded-[2.75rem]">
        <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_bottom,black_55%,transparent)]" aria-hidden />
        <div className="relative mx-auto max-w-page px-4 pb-44 pt-28 text-center sm:pb-60 sm:pt-36">
          <p className="text-sm font-medium text-muted">{t("home.eyebrow")}</p>
          <h1 className="mx-auto mt-4 max-w-4xl text-balance text-h1 font-bold leading-[1.1] tracking-tight text-ink sm:text-[2.75rem] lg:text-[3.5rem]">
            {t("home.title")}
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-muted sm:text-lg">{t("home.subtitle")}</p>

          <HeroForm />

          <ul className="mx-auto mt-7 flex w-fit max-w-full flex-col items-start gap-x-6 gap-y-2.5 text-left text-sm text-muted sm:w-auto sm:max-w-2xl sm:flex-row sm:flex-wrap sm:items-center sm:justify-center">
            {trust.map((item) => (
              <li key={item.icon} className="flex items-center gap-2.5">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-surface text-primary shadow-card ring-1 ring-line">
                  <Icon d={ICONS[item.icon]} className="size-4" />
                </span>
                {item.href ? (
                  <a href={item.href} className="hover:text-ink">
                    {item.text}
                  </a>
                ) : (
                  item.text
                )}
              </li>
            ))}
          </ul>

          {/* Icon chips just above the example panel, as in the reference layout (decorative) */}
          <div className="mx-auto mt-10 hidden max-w-5xl justify-end gap-3 lg:flex" aria-hidden>
            {(["ideas", "hand", "key", "lock"] as const).map((icon) => (
              <span key={icon} className="flex size-12 items-center justify-center rounded-xl bg-surface text-primary shadow-card ring-1 ring-line">
                <Icon d={ICONS[icon]} />
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* The example panel overlaps the frame's bottom edge */}
      <div className="relative z-10 -mt-36 px-4 sm:-mt-48">
        <HeroPreview standardPrize={standardPrize} />
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
        title={kind === "winners" ? t("home.showcase.winnersTitle") : t("home.showcase.liveTitle")}
        subtitle={t("home.showcase.subtitle")}
      />
      {contests.length > 0 ? (
        <>
          {/* 3 rows: 2 columns on phones (6 cards), 4 on desktop (12 cards) */}
          {/* Centred, so a short row doesn't hug the left edge */}
          <ul className="mt-10 flex flex-wrap justify-center gap-3 sm:gap-4">
            {contests.map((c, i) => (
              <li key={c.slug} className={cx("w-[calc(50%-0.375rem)] sm:w-[calc(50%-0.5rem)] lg:w-[calc(25%-0.75rem)]", i >= 6 && "hidden lg:block")}>
                <ContestCard contest={c} now={now} />
              </li>
            ))}
          </ul>
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
  return <HowItWorksSteps heading={<SectionHeading eyebrow={t("home.how.eyebrow")} title={t("home.how.title")} />} />;
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
      <SectionHeading eyebrow={t("home.why.eyebrow")} title={t("home.why.title")} />
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
  const { t } = await getI18n();
  const items = Array.from({ length: 10 }, (_, i) => i + 1);
  return (
    <section className="border-t border-line bg-surface">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:py-20">
        <SectionHeading eyebrow={t("home.faq.eyebrow")} title={t("home.faq.title")} />
        <div className="mt-10 divide-y divide-line rounded-2xl bg-canvas ring-1 ring-line">
          {items.map((n) => (
            <details key={n} className="group px-5 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 font-semibold text-ink">
                {t(`home.faq.q${n}.q` as MessageKey)}
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface text-primary ring-1 ring-line transition-transform group-open:rotate-45">
                  <Icon d="M12 5v14M5 12h14" className="size-4" />
                </span>
              </summary>
              <p className="pb-5 pr-10 leading-relaxed text-muted">{t(`home.faq.q${n}.a` as MessageKey, params)}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
