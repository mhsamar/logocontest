import type { Metadata } from "next";
import Link from "next/link";
import { AccountArt, BriefArt, DesignsArt, FilesArt, UploadArt, WinArt } from "@/components/how/how-art";
import { HowVideoPlayer } from "@/components/how/how-video";
import { getContact } from "@/lib/content/contact";
import { visibleList } from "@/lib/content/lists";
import { pictureUrl } from "@/lib/content/pictures";
import { cx } from "@/lib/cx";
import { faqParams } from "@/lib/home/faq-params";
import { getI18n, pageAlternates } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { fillLegal } from "@/lib/legal/types";
import { formatNumber } from "@/lib/money";
import { visibleOffers } from "@/lib/rewards/visible";
import { getSettings } from "@/lib/settings";

type StepFaq = { q: string; a: string };

// Line icons for the four "why" cards: shield, people, chat, badge.
const WHY_ICONS = [
  "M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3z",
  "M16 19v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1M9.5 10a3 3 0 100-6 3 3 0 000 6zM21 19v-1a4 4 0 00-3-3.9M16 4.1a3 3 0 010 5.8",
  "M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z",
  "M12 15a6 6 0 100-12 6 6 0 000 12zM8.5 14l-1.5 7 5-3 5 3-1.5-7",
];
const PHONE = "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2";

const CARD = "rounded-[24px] border border-[#E9EAEE] bg-white";
const BTN = "inline-flex min-h-[50px] items-center justify-center gap-2 rounded-full px-[22px] text-base font-bold transition-opacity hover:opacity-90";
const RED = "bg-[linear-gradient(180deg,#B3201B,#8B0000)] text-white";

const Arrow = () => (
  <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
    <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const Line = ({ d, className }: { d: string; className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);

export async function generateMetadata({ searchParams }: PageProps<"/how-it-works">): Promise<Metadata> {
  const [{ t }, sp] = await Promise.all([getI18n(), searchParams]);
  // The designers' side is its own page for search engines (it is in the sitemap too).
  return { title: t("howPage.meta.title"), description: t("howPage.meta.description"), alternates: await pageAlternates(sp.for === "designers" ? "/how-it-works?for=designers" : "/how-it-works") };
}

// P-08 How It Works (UI-JOURNEY; redesign owner 2026-10-11, Design/how-it-works): one page, For clients | For designers
// (?for=designers). Top with the 1-2-3 road, the tutorial video (Admin → Homepage), three step cards with their own
// questions, "So why us?", and the other side plus "Want to know more?".
export default async function HowItWorksPage({ searchParams }: PageProps<"/how-it-works">) {
  const sp = await searchParams;
  const designers = sp.for === "designers";
  const { t, locale, price } = await getI18n();
  const [{ params }, contact, homeFaq, s, offers] = await Promise.all([
    faqParams(t, locale, price),
    getContact(locale),
    visibleList("home_faq", locale),
    getSettings(["how.video_client", "how.video_designer", "how.video_autoplay", "how.cover_client", "how.cover_designer"]),
    visibleOffers(),
  ]);
  const tk = (key: string, p?: Record<string, string | number>) => t(key as MessageKey, p);
  const fmt = (n: number) => formatNumber(n, locale);

  // Clients: the real questions from the home page list (A-15); a hidden or deleted one is left out.
  // Designers: their own questions and answers from the page texts.
  const faqById = new Map(homeFaq.map((f) => [f.id, f.text]));
  const faq = (n: number): StepFaq[] => {
    const f = faqById.get(`q${n}`);
    return f ? [{ q: f.q, a: fillLegal(f.a, params) }] : [];
  };
  const dfaq = (step: number, n: number): StepFaq => ({ q: tk(`howPage.d${step}.q${n}.q`), a: tk(`howPage.d${step}.q${n}.a`, params) });

  const steps = designers
    ? [
        { key: "d1", faqs: [dfaq(1, 1), dfaq(1, 2), dfaq(1, 3)], art: <AccountArt t={t} /> },
        { key: "d2", faqs: [dfaq(2, 1), dfaq(2, 2), dfaq(2, 3)], art: <UploadArt t={t} fmt={fmt} /> },
        { key: "d3", faqs: [dfaq(3, 1), dfaq(3, 2), dfaq(3, 3)], art: <WinArt t={t} giftBox={offers.giftBox} /> },
      ]
    : [
        { key: "c1", faqs: [...faq(2), ...faq(3), ...faq(9)], art: <BriefArt t={t} /> },
        { key: "c2", faqs: [...faq(1), ...faq(4), ...faq(7)], art: <DesignsArt t={t} /> },
        { key: "c3", faqs: [...faq(6), ...faq(8), ...faq(5)], art: <FilesArt t={t} /> },
      ];

  const side = designers ? "d" : "c";
  const cta = designers ? { href: "/designers/signup", label: t("howPage.becomeDesigner") } : { href: "/start", label: t("howPage.band.startContest") };
  const whyKeys = designers ? ["d1", "d2", "d3", "d4"] : ["c1", "c2", "c3", "c4"];
  const video = designers ? s["how.video_designer"] : s["how.video_client"];
  const cover = pictureUrl(designers ? s["how.cover_designer"] : s["how.cover_client"]);

  return (
    <div className="flex w-full flex-1 flex-col gap-5 px-3.5 pb-3.5 max-[720px]:gap-3 max-[720px]:px-2 max-[720px]:pb-2">
      {/* Top: tabs, headline, the 1-2-3 road and the main button */}
      <header className={cx(CARD, "flex flex-col items-center gap-3.5 rounded-[28px] px-[34px] py-10 text-center max-[640px]:px-[18px] max-[640px]:py-[26px]")}>
        <nav aria-label={t("howPage.tabs.label")}>
          <ul className="m-0 flex list-none gap-1 rounded-full bg-[#F4F5F7] p-[5px]">
            {(["clients", "designers"] as const).map((tab) => {
              const active = (tab === "designers") === designers;
              return (
                <li key={tab}>
                  <Link
                    href={tab === "designers" ? "/how-it-works?for=designers" : "/how-it-works"}
                    aria-current={active ? "page" : undefined}
                    className={cx("flex min-h-[46px] items-center rounded-full px-5 text-base font-bold transition-colors", active ? "bg-[#111216] text-white" : "text-[#3A3C45] hover:text-ink")}
                  >
                    {t(`howPage.tabs.${tab}`)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <h1 className="lc-d m-0 text-[clamp(34px,4.2vw,56px)] font-semibold leading-[1.04] tracking-[-0.045em] text-ink">
          {/* "{accent}" marks where the red words go, so each language can put them where they belong. */}
          {tk(`howPage.head.${side}.line`, { accent: "\u0000" })
            .split("\u0000")
            .map((part, i) => (i === 0 ? part : [<span key={i} className="text-primary">{tk(`howPage.head.${side}.accent`)}</span>, part]))}
        </h1>
        <p className="m-0 max-w-[640px] text-lg text-muted">{designers ? t("howPage.introDesigners") : t("howPage.intro")}</p>
        <ol aria-label={t("howPage.stepsLabel")} className="m-0 mt-1.5 flex w-full max-w-[900px] list-none items-center gap-2 p-0 max-[640px]:flex-col max-[640px]:items-stretch">
          {steps.map((st, i) => (
            <li key={st.key} className="contents">
              {i > 0 && <i aria-hidden className="h-0.5 w-[18px] flex-none bg-[#D9DBE0] max-[640px]:hidden" />}
              <a href={`#step-${i + 1}`} className="flex flex-1 items-center gap-3 rounded-2xl bg-white px-4 py-3.5 text-left shadow-[0_6px_18px_rgba(17,18,22,.06)] ring-1 ring-[#EEF0F3] transition-shadow hover:ring-primary/40">
                <span className="lc-d flex size-10 flex-none items-center justify-center rounded-xl bg-[#FBECEB] text-lg font-semibold text-primary">{fmt(i + 1)}</span>
                <span className="flex flex-col leading-[1.3]">
                  <strong className="text-[16.5px] text-ink">{tk(`howPage.stepNav.${st.key}`)}</strong>
                  <span className="text-sm text-muted">{tk(`howPage.road.${st.key}`)}</span>
                </span>
              </a>
            </li>
          ))}
        </ol>
        <Link href={cta.href} className={cx(BTN, RED, "mt-1.5 min-h-[54px] px-7 text-[17px] shadow-[0_12px_24px_rgba(139,0,0,.25)]")}>
          {cta.label}
          <Arrow />
        </Link>
      </header>

      {/* The tutorial video (Admin → Homepage); hidden with its box while there is no link */}
      {video.kind && (
        <section aria-label={tk(`howPage.video.${side}.posterTitle`)} className={cx(CARD, "rounded-[28px] p-5 max-[640px]:p-3")}>
          <div className="grid items-center gap-7 min-[1021px]:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <HowVideoPlayer
              video={video}
              cover={cover}
              autoplay={s["how.video_autoplay"]}
              texts={{
                kicker: t("howPage.video.kicker"),
                title: tk(`howPage.video.${side}.posterTitle`),
                body: tk(`howPage.video.${side}.posterBody`),
                sound: t("howPage.video.sound"),
                play: t("howPage.video.play"),
                player: tk(`howPage.video.${side}.player`),
              }}
            />
            <div className="flex min-w-0 flex-col gap-3">
              <div className="flex flex-col gap-1">
                <span className="self-start rounded-full bg-[#FBECEB] px-3 py-[5px] text-[13.5px] font-bold text-primary">{t("howPage.video.label")}</span>
                <h2 className="lc-d m-0 text-[26px] font-semibold leading-[1.1] tracking-[-0.035em] text-ink">{tk(`howPage.video.${side}.title`)}</h2>
              </div>
              <ol className="m-0 flex list-none flex-col gap-2 p-0">
                {[1, 2, 3, 4].map((n) => (
                  <li key={n} className="flex items-center gap-3 rounded-[14px] bg-[#F4F5F7] px-3 py-2.5">
                    <span className="lc-d flex size-[34px] flex-none items-center justify-center rounded-[10px] bg-white text-[15px] font-semibold text-primary">{fmt(n)}</span>
                    <span className="flex min-w-0 flex-col leading-[1.3]">
                      <strong className="text-base text-ink">{tk(`howPage.video.${side}.p${n}.title`)}</strong>
                      <span className="text-sm text-muted">{tk(`howPage.video.${side}.p${n}.body`)}</span>
                    </span>
                  </li>
                ))}
              </ol>
              <div className="flex flex-wrap items-center justify-between gap-x-3.5 gap-y-2 rounded-[14px] border border-[#E9EAEE] px-3.5 py-3 text-[15px]">
                <span className="text-muted">{t("howPage.video.help")}</span>
                <a href={contact.phoneHref} className="font-bold text-primary">
                  {t("howPage.questions.call", { phone: contact.phone })}
                </a>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* The three steps, each with its own questions */}
      <div className="grid items-stretch gap-5 min-[1021px]:grid-cols-3 max-[1020px]:mx-auto max-[1020px]:w-full max-[1020px]:max-w-[480px] max-[1020px]:grid-cols-[minmax(0,1fr)]">
        {steps.map((st, i) => (
          <article key={st.key} id={`step-${i + 1}`} className={cx(CARD, "flex scroll-mt-28 flex-col gap-3.5 p-5 max-[640px]:p-[18px]")}>
            {st.art}
            <div className="flex items-center gap-2.5">
              <span className="lc-d flex size-9 flex-none items-center justify-center rounded-[11px] bg-primary text-[17px] font-semibold text-white">{fmt(i + 1)}</span>
              <h2 className="lc-d m-0 text-[23px] font-semibold leading-[1.1] tracking-[-0.03em] text-ink">
                {tk(`howPage.${st.key}.lead`)} {tk(`howPage.${st.key}.accent`)}
              </h2>
            </div>
            <p className="m-0 text-base text-muted">{tk(`howPage.${st.key}.body`, params)}</p>
            <ul className="m-0 flex list-none flex-col gap-[7px] p-0">
              {[1, 2, 3].map((p) => (
                <li key={p} className="flex items-start gap-2.5 text-base text-ink">
                  <span className="mt-0.5 flex size-[22px] flex-none items-center justify-center rounded-full bg-[#FBECEB] text-primary">
                    <Line d="M5 12.5l4.5 4.5L19 7.5" className="size-3.5" />
                  </span>
                  {tk(`howPage.${st.key}.p${p}`, params)}
                </li>
              ))}
            </ul>
            {st.faqs.length > 0 && (
              <div className="mt-auto flex flex-col gap-2">
                {st.faqs.map((f) => (
                  <details key={f.q} className="group rounded-xl border border-[#E9EAEE] bg-white">
                    <summary className="flex min-h-[46px] cursor-pointer list-none items-center justify-between gap-2.5 px-3.5 py-2 text-[15.5px] font-bold text-ink [&::-webkit-details-marker]:hidden">
                      {f.q}
                      <span aria-hidden className="text-xl font-medium text-primary group-open:hidden">+</span>
                      <span aria-hidden className="hidden text-xl font-medium text-primary group-open:inline">–</span>
                    </summary>
                    <p className="m-0 whitespace-pre-line px-3.5 pb-3 text-[15px] text-muted">{f.a}</p>
                  </details>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>

      {/* So why us? */}
      <section className="flex flex-col gap-[18px] rounded-[28px] bg-[linear-gradient(150deg,#A30F0F,#8B0000_55%,#5C0A0C)] px-[34px] py-[30px] text-white max-[640px]:px-[18px] max-[640px]:py-[26px]">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="lc-d m-0 text-[clamp(26px,3vw,38px)] font-semibold leading-[1.05] tracking-[-0.04em]">
            {t("howPage.why.lead")} {t("howPage.why.accent")}
          </h2>
          <Link href={cta.href} className={cx(BTN, "min-h-12 bg-white text-primary")}>
            {cta.label}
            <Arrow />
          </Link>
        </div>
        <ul className="m-0 grid list-none gap-3.5 p-0 min-[641px]:grid-cols-2 min-[1021px]:grid-cols-4">
          {whyKeys.map((k, i) => (
            <li key={k} className="flex flex-col gap-2 rounded-[18px] bg-white/10 p-[18px]">
              <span className="flex size-[42px] items-center justify-center rounded-xl bg-[#FFE27A] text-[#111216]">
                <Line d={WHY_ICONS[i % WHY_ICONS.length]} className="size-[22px]" />
              </span>
              <strong className="lc-d text-[18.5px] tracking-[-0.02em]">{tk(`howPage.why.${k}.title`)}</strong>
              <span className="text-[15px] text-[#F6DAD8]">{tk(`howPage.why.${k}.body`)}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* The other side, and "Want to know more?" */}
      <div className="grid gap-5 min-[1021px]:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section className={cx(CARD, "flex flex-wrap items-center justify-between gap-4 border-[#F3DFA8] bg-[#FFF1CF] px-7 py-[26px] max-[640px]:p-[18px]")}>
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="lc-d m-0 text-[26px] font-semibold leading-[1.1] tracking-[-0.035em] text-ink">{designers ? t("howPage.band.clientTitle") : t("howPage.band.designerTitle")}</h2>
            <p className="m-0 text-base text-[#4A3700]">{designers ? t("howPage.band.clientBody") : t("howPage.band.designerBody")}</p>
          </div>
          <Link href={designers ? "/start" : "/designers/signup"} className={cx(BTN, "bg-[#111216] text-white max-[640px]:w-full")}>
            {designers ? t("howPage.band.startContest") : t("howPage.becomeDesigner")}
            <Arrow />
          </Link>
        </section>
        <section className={cx(CARD, "flex flex-col gap-3 px-7 py-[26px] max-[640px]:p-[18px]")}>
          <div className="flex flex-col gap-1">
            <h2 className="lc-d m-0 text-[26px] font-semibold leading-[1.1] tracking-[-0.035em] text-ink">
              {t("howPage.questions.lead")} {t("howPage.questions.accent")}
            </h2>
            <p className="m-0 text-base text-muted">{t("howPage.questions.body")}</p>
          </div>
          <div className="flex flex-wrap gap-2.5 max-[640px]:flex-col max-[640px]:items-stretch">
            <a href={contact.phoneHref} className={cx(BTN, RED)}>
              <Line d={PHONE} className="size-4" />
              {t("howPage.questions.call", { phone: contact.phone })}
            </a>
            <Link href="/#faq" className={cx(BTN, "border border-[#DCDEE3] bg-white text-ink")}>
              {t("howPage.moreQuestions")}
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
