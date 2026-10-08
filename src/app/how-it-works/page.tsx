import type { Metadata } from "next";
import Link from "next/link";
import { AccentTitle, ProfileMock, Step, WalletMock, type StepFaq } from "@/components/how/how-parts";
import { BriefMock, ReviewMock, WinnerMock } from "@/components/home/how-it-works";
import { Icon, ICONS, SectionHeading } from "@/components/home/sections";
import { BlobIcon, type BlobShape } from "@/components/ui/blob-icon";
import { ButtonLink } from "@/components/ui/button";
import { cx } from "@/lib/cx";
import { faqParams } from "@/lib/home/faq-params";
import { getI18n } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { formatTaka } from "@/lib/money";
import { qrSvg } from "@/lib/profile/qr";
import { SUPPORT_PHONE, SUPPORT_PHONE_HREF } from "@/lib/site";

const BLOBS: BlobShape[] = ["sun", "lens", "dome", "petals"];

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("howPage.meta.title"), description: t("howPage.meta.description") };
}

// P-08 How It Works (UI-JOURNEY, owner 2026-10-08): For clients | For designers.
export default async function HowItWorksPage({ searchParams }: PageProps<"/how-it-works">) {
  const sp = await searchParams;
  const designers = sp.for === "designers";
  const { t, locale } = await getI18n();
  const { pricing, params } = await faqParams(t, locale);
  const tk = (key: string, p?: Record<string, string | number>) => t(key as MessageKey, p);

  const faq = (n: number): StepFaq => ({ q: tk(`home.faq.q${n}.q`), a: tk(`home.faq.q${n}.a`, params) });
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
        { key: "c1", faqs: [faq(2), faq(3), faq(9)], mock: <BriefMock t={t} /> },
        { key: "c2", faqs: [faq(1), faq(4), faq(7)], mock: <ReviewMock t={t} locale={locale} /> },
        { key: "c3", faqs: [faq(6), faq(8), faq(5)], mock: <WinnerMock t={t} locale={locale} /> },
      ];

  const cta = designers ? { href: "/designers/signup", label: t("howPage.becomeDesigner") } : { href: "/start", label: t("howPage.getStarted") };
  const whyKeys = designers ? ["d1", "d2", "d3", "d4"] : ["c1", "c2", "c3", "c4"];

  return (
    <div className="pb-16">
      {/* Top */}
      <section className="mx-auto w-full max-w-page px-4 pt-6 sm:pt-10">
        <div className="bg-aurora relative overflow-hidden rounded-[2rem] px-5 py-10 shadow-frame ring-1 ring-white sm:px-10 sm:py-14">
          <div className="relative grid items-center gap-10 lg:grid-cols-2">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">{t("howPage.eyebrow")}</p>
              <AccentTitle as="h1" lead={t("howPage.titleLead")} accent={t("howPage.titleAccent")} onView={false} className="mt-3 text-h1 sm:text-[2.75rem] lg:text-[3.25rem]" />
              <span className="mt-4 block h-1 w-12 rounded-full bg-gradient-to-r from-primary to-accent" aria-hidden />
              <p className="mt-4 max-w-lg text-lg leading-relaxed text-muted">{designers ? t("howPage.introDesigners") : t("howPage.intro")}</p>

              <nav aria-label={t("howPage.tabs.label")} className="mt-6">
                <ul className="inline-flex rounded-full bg-surface p-1 ring-1 ring-line">
                  {(["clients", "designers"] as const).map((tab) => {
                    const active = (tab === "designers") === designers;
                    return (
                      <li key={tab}>
                        <Link
                          href={tab === "designers" ? "/how-it-works?for=designers" : "/how-it-works"}
                          aria-current={active ? "page" : undefined}
                          className={cx(
                            "flex min-h-10 items-center rounded-full px-4 text-sm font-semibold transition-colors",
                            active ? "bg-ink text-white" : "text-muted hover:text-ink",
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
            <div className="relative mx-auto h-[22rem] w-full max-w-md sm:h-[24rem]" aria-hidden>
              <div className="absolute left-0 top-0 w-[80%] -rotate-3 animate-float-soft">
                {designers ? <ProfileMock t={t} qrSvg={mockQr} /> : <BriefMock t={t} />}
              </div>
              <div className="absolute bottom-0 right-0 w-[80%] rotate-2 animate-float" style={{ animationDelay: "1.2s" }}>
                {designers ? (
                  <WalletMock t={t} prize={formatTaka(prize, locale)} net={formatTaka(net, locale)} fee={Number(params.tierFirst)} />
                ) : (
                  <WinnerMock t={t} locale={locale} />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Step links */}
        <div className="mx-auto mt-6 flex max-w-5xl flex-col items-center justify-between gap-4 sm:flex-row">
          <nav aria-label={t("howPage.stepsLabel")}>
            <ol className="flex flex-wrap justify-center gap-2">
              {steps.map((s, i) => (
                <li key={s.key}>
                  <a href={`#step-${i + 1}`} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-surface px-4 text-sm font-semibold text-ink ring-1 ring-line transition-colors hover:ring-primary">
                    <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                      {new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US").format(i + 1)}
                    </span>
                    {tk(`howPage.stepNav.${s.key}`)}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
          <ButtonLink href={cta.href} size="lg">
            {cta.label}
          </ButtonLink>
        </div>
      </section>

      {/* The three steps */}
      {steps.map((s, i) => (
        <Step
          key={s.key}
          n={i + 1}
          lead={tk(`howPage.${s.key}.lead`)}
          accent={tk(`howPage.${s.key}.accent`)}
          body={tk(`howPage.${s.key}.body`, params)}
          points={[1, 2, 3].map((p) => tk(`howPage.${s.key}.p${p}`, params))}
          faqs={s.faqs}
          mock={s.mock}
          flip={i % 2 === 1}
          moreHref="/#faq"
          moreLabel={t("howPage.moreQuestions")}
        />
      ))}

      <div className="text-center">
        <ButtonLink href={cta.href} size="lg">
          {cta.label}
        </ButtonLink>
      </div>

      {/* So, why us? */}
      <section className="mx-auto mt-16 w-full max-w-page px-4 sm:mt-24">
        <SectionHeading eyebrow={t("howPage.eyebrow")} lead={t("howPage.why.lead")} accent={t("howPage.why.accent")} />
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {whyKeys.map((k, i) => (
            <li key={k} className="flex flex-col items-center rounded-2xl bg-surface/90 px-6 py-8 text-center shadow-card ring-1 ring-line backdrop-blur transition-shadow hover:shadow-raised">
              <BlobIcon shape={BLOBS[i % BLOBS.length]} />
              <h3 className="mt-4 text-lg font-semibold leading-snug text-ink">{tk(`howPage.why.${k}.title`)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{tk(`howPage.why.${k}.body`)}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* The other side */}
      <section className="mx-auto mt-16 w-full max-w-page px-4">
        <div className="relative overflow-hidden bg-aurora rounded-[2rem] px-6 py-10 text-ink shadow-frame ring-1 ring-white sm:px-10">
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-h2 font-bold lg:text-h2-lg">{designers ? t("howPage.band.clientTitle") : t("howPage.band.designerTitle")}</h2>
              <p className="mt-2 max-w-xl text-muted">{designers ? t("howPage.band.clientBody") : t("howPage.band.designerBody")}</p>
            </div>
            <Link
              href={designers ? "/start" : "/designers/signup"}
              className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-full bg-primary px-6 font-semibold text-white shadow-card transition-colors hover:bg-primary-dark"
            >
              {designers ? t("howPage.band.startContest") : t("howPage.becomeDesigner")}
            </Link>
          </div>
        </div>
      </section>

      {/* Questions */}
      <section className="mx-auto mt-16 w-full max-w-3xl px-4 text-center">
        <SectionHeading eyebrow={t("home.faq.eyebrow")} lead={t("howPage.questions.lead")} accent={t("howPage.questions.accent")} subtitle={t("howPage.questions.body")} />
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href={SUPPORT_PHONE_HREF}
            className="inline-flex min-h-12 items-center gap-2 rounded-full bg-primary px-6 font-semibold text-white transition-colors hover:bg-primary-dark"
          >
            <Icon d={ICONS.phone} className="size-4" />
            {t("howPage.questions.call", { phone: SUPPORT_PHONE })}
          </a>
          <Link href="/#faq" className="inline-flex min-h-12 items-center rounded-full px-6 font-semibold text-ink ring-1 ring-line hover:ring-primary">
            {t("howPage.moreQuestions")}
          </Link>
        </div>
      </section>
    </div>
  );
}
