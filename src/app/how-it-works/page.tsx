import type { Metadata } from "next";
import Link from "next/link";
import { ProfileMock, Step, WalletMock, type StepFaq } from "@/components/how/how-parts";
import { BriefMock, ReviewMock, WinnerMock } from "@/components/home/how-it-works";
import { Icon, ICONS } from "@/components/home/sections";
import { ButtonLink } from "@/components/ui/button";
import { PageShell, Panel } from "@/components/ui/panel";
import { Arrow, IconBadge, PageTitle, SectionHead } from "@/components/ui/section-heading";
import { Svg } from "@/components/ui/svg";
import { cx } from "@/lib/cx";
import { faqParams } from "@/lib/home/faq-params";
import { getI18n } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { formatTaka } from "@/lib/money";
import { qrSvg } from "@/lib/profile/qr";
import { getContact } from "@/lib/content/contact";
import { visibleList } from "@/lib/content/lists";
import { fillLegal } from "@/lib/legal/types";

// Line icons for the four "why" cards: shield, people, chat, badge.
const WHY_ICONS = [
  "M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z",
  "M16 19v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1M9.5 10a3 3 0 100-6 3 3 0 000 6zM21 19v-1a4 4 0 00-3-3.9M16 4.1a3 3 0 010 5.8",
  "M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z",
  "M12 15a6 6 0 100-12 6 6 0 000 12zM8.5 14l-1.5 7 5-3 5 3-1.5-7",
];

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("howPage.meta.title"), description: t("howPage.meta.description") };
}

// P-08 How It Works (UI-JOURNEY, owner 2026-10-08): For clients | For designers.
export default async function HowItWorksPage({ searchParams }: PageProps<"/how-it-works">) {
  const sp = await searchParams;
  const designers = sp.for === "designers";
  const { t, locale } = await getI18n();
  const [{ pricing, params }, contact, homeFaq] = await Promise.all([faqParams(t, locale), getContact(locale), visibleList("home_faq", locale)]);
  const tk = (key: string, p?: Record<string, string | number>) => t(key as MessageKey, p);

  // Built-in Q&A items from the home list (A-15); a hidden or deleted one is left out here too.
  const faqById = new Map(homeFaq.map((f) => [f.id, f.text]));
  const faq = (n: number): StepFaq[] => {
    const f = faqById.get(`q${n}`);
    return f ? [{ q: f.q, a: fillLegal(f.a, params) }] : [];
  };
  const dfaq = (step: number, n: number): StepFaq => ({ q: tk(`howPage.d${step}.q${n}.q`), a: tk(`howPage.d${step}.q${n}.a`, params) });

  const prize = pricing.packagePrizes.standard;
  const net = Math.round(prize * (1 - Number(params.tierFirst) / 100));
  const mockQr = designers ? await qrSvg("https://logocontest.bd/d/rafi_designs") : "";

  const steps = designers
    ? [
        { key: "d1", faqs: [dfaq(1, 1), dfaq(1, 2), dfaq(1, 3)], mock: <ProfileMock t={t} qrSvg={mockQr} /> },
        { key: "d2", faqs: [dfaq(2, 1), dfaq(2, 2), dfaq(2, 3)], mock: <ReviewMock t={t} locale={locale} /> },
        {
          key: "d3",
          faqs: [dfaq(3, 1), dfaq(3, 2), dfaq(3, 3)],
          mock: <WalletMock t={t} prize={formatTaka(prize, locale)} net={formatTaka(net, locale)} fee={Number(params.tierFirst)} />,
        },
      ]
    : [
        { key: "c1", faqs: [...faq(2), ...faq(3), ...faq(9)], mock: <BriefMock t={t} /> },
        { key: "c2", faqs: [...faq(1), ...faq(4), ...faq(7)], mock: <ReviewMock t={t} locale={locale} /> },
        { key: "c3", faqs: [...faq(6), ...faq(8), ...faq(5)], mock: <WinnerMock t={t} locale={locale} /> },
      ];

  const cta = designers ? { href: "/designers/signup", label: t("howPage.becomeDesigner") } : { href: "/start", label: t("howPage.getStarted") };
  const whyKeys = designers ? ["d1", "d2", "d3", "d4"] : ["c1", "c2", "c3", "c4"];

  const numbers = new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US");

  return (
    <PageShell>
      {/* Top */}
      <Panel as="header" className="overflow-hidden">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <PageTitle pill={t("howPage.eyebrow")} lead={t("howPage.titleLead")} accent={t("howPage.titleAccent")} sub={designers ? t("howPage.introDesigners") : t("howPage.intro")} />

            <nav aria-label={t("howPage.tabs.label")} className="mt-7">
              <ul className="m-0 inline-flex list-none gap-1 rounded-[18px] bg-chip p-1 ring-1 ring-line">
                {(["clients", "designers"] as const).map((tab) => {
                  const active = (tab === "designers") === designers;
                  return (
                    <li key={tab}>
                      <Link
                        href={tab === "designers" ? "/how-it-works?for=designers" : "/how-it-works"}
                        aria-current={active ? "page" : undefined}
                        className={cx(
                          "flex min-h-11 items-center rounded-[14px] px-4 text-[15px] font-bold transition-colors",
                          active ? "bg-surface text-primary shadow-card" : "text-muted hover:text-ink",
                        )}
                      >
                        {t(`howPage.tabs.${tab}`)}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>

          {/* Collage of mocks */}
          <div className="relative mx-auto h-[22rem] w-full max-w-md rounded-[28px] bg-frame sm:h-[24rem]" aria-hidden>
            <div className="absolute left-3 top-5 w-[78%] -rotate-3 sm:left-5">
              {designers ? <ProfileMock t={t} qrSvg={mockQr} /> : <BriefMock t={t} />}
            </div>
            <div className="absolute bottom-5 right-3 w-[78%] rotate-2 sm:right-5">
              {designers ? (
                <WalletMock t={t} prize={formatTaka(prize, locale)} net={formatTaka(net, locale)} fee={Number(params.tierFirst)} />
              ) : (
                <WinnerMock t={t} locale={locale} />
              )}
            </div>
          </div>
        </div>

        {/* Step links */}
        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-line pt-6 sm:flex-row">
          <nav aria-label={t("howPage.stepsLabel")}>
            <ol className="m-0 flex list-none flex-wrap justify-center gap-2 p-0">
              {steps.map((s, i) => (
                <li key={s.key}>
                  <a href={`#step-${i + 1}`} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-chip px-4 text-sm font-bold text-ink ring-1 ring-line transition-colors hover:ring-primary">
                    <span className="flex size-6 items-center justify-center rounded-full bg-[image:var(--gradient-red)] text-xs font-bold text-white">{numbers.format(i + 1)}</span>
                    {tk(`howPage.stepNav.${s.key}`)}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
          <ButtonLink href={cta.href} size="lg">
            {cta.label} <Arrow />
          </ButtonLink>
        </div>
      </Panel>

      {/* The three steps */}
      {steps.map((s, i) => (
        <Step
          key={s.key}
          n={i + 1}
          stepLabel={t("home.landing.step", { n: numbers.format(i + 1) })}
          lead={tk(`howPage.${s.key}.lead`)}
          accent={tk(`howPage.${s.key}.accent`)}
          body={tk(`howPage.${s.key}.body`, params)}
          points={[1, 2, 3].map((p) => tk(`howPage.${s.key}.p${p}`, params))}
          faqs={s.faqs}
          mock={s.mock}
          flip={i % 2 === 1}
          tone={i % 2 === 1 ? "grey" : "white"}
          moreHref="/#faq"
          moreLabel={t("howPage.moreQuestions")}
        />
      ))}

      {/* So, why us? */}
      <Panel tone="grey">
        <SectionHead pill={t("howPage.eyebrow")} lead={t("howPage.why.lead")} accent={t("howPage.why.accent")} />
        <ul className="m-0 mt-10 grid list-none gap-3.5 p-0 sm:grid-cols-2 lg:grid-cols-4">
          {whyKeys.map((k, i) => (
            <li key={k} className="lc-card lc-rv flex flex-col items-start p-6">
              <IconBadge dark={i % 2 === 1}>
                <Svg d={WHY_ICONS[i % WHY_ICONS.length]} size={24} stroke="#fff" />
              </IconBadge>
              <h3 className="mt-5 text-xl font-semibold leading-snug tracking-[-0.02em] text-ink">{tk(`howPage.why.${k}.title`)}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">{tk(`howPage.why.${k}.body`)}</p>
            </li>
          ))}
        </ul>
        <div className="mt-10 flex justify-center">
          <ButtonLink href={cta.href} size="lg">
            {cta.label} <Arrow />
          </ButtonLink>
        </div>
      </Panel>

      {/* The other side */}
      <section className="lc-rv relative overflow-hidden rounded-[32px] bg-[image:var(--gradient-red-dark)] px-6 py-12 text-white sm:px-10 max-[720px]:rounded-[24px] max-[720px]:px-5">
        <div className="relative mx-auto flex max-w-5xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="m-0 text-[clamp(26px,3vw,38px)] font-semibold leading-[1.1] tracking-[-0.03em]">{designers ? t("howPage.band.clientTitle") : t("howPage.band.designerTitle")}</h2>
            <p className="mt-2 max-w-xl text-white/75">{designers ? t("howPage.band.clientBody") : t("howPage.band.designerBody")}</p>
          </div>
          <ButtonLink href={designers ? "/start" : "/designers/signup"} variant="secondary" size="lg" className="shrink-0">
            {designers ? t("howPage.band.startContest") : t("howPage.becomeDesigner")} <Arrow />
          </ButtonLink>
        </div>
      </section>

      {/* Questions */}
      <Panel>
        <SectionHead pill={t("home.faq.eyebrow")} lead={t("howPage.questions.lead")} accent={t("howPage.questions.accent")} sub={t("howPage.questions.body")} />
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <ButtonLink href={contact.phoneHref} size="lg">
            <Icon d={ICONS.phone} className="size-4" />
            {t("howPage.questions.call", { phone: contact.phone })}
          </ButtonLink>
          <ButtonLink href="/#faq" variant="secondary" size="lg">
            {t("howPage.moreQuestions")}
          </ButtonLink>
        </div>
      </Panel>
    </PageShell>
  );
}
