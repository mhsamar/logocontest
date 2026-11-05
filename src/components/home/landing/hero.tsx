import { getContact } from "@/lib/content/contact";
import { siteImageUrl } from "@/lib/content/pictures";
import { homePayMethods } from "@/lib/home/pay-methods";
import { payKinds } from "@/lib/home/pricing-cards";
import { getI18n } from "@/lib/i18n/server";
import { formatNumber } from "@/lib/money";
import { siteFacts } from "@/lib/seo/facts";
import { getSettings } from "@/lib/settings";
import { HeroCtaLink, HeroVideo } from "./hero-video";
import "./hero-video.css";

const Arrow = () => (
  <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

/**
 * P-01 hero with the explainer video (owner, 2026-11-06; Design/logocontest-update/HomeHeroVideo, replacing the
 * showcase slider): the headline, three steps, the Start a contest button and the chips on one side, the YouTube
 * video set in Admin → Homepage with its chapters on the other (video first on phones). The words are the owner's;
 * the prize, the files deadline and the phone come from the settings.
 */
export async function LandingHero({ nav }: { nav: React.ReactNode }) {
  const { t, locale, currency, price } = await getI18n();
  const [contact, facts, methods, s] = await Promise.all([
    getContact(locale),
    siteFacts(),
    homePayMethods(currency.code).catch(() => []),
    getSettings(["hero.video", "hero.video_on", "hero.video_sound", "hero.video_poster", "hero.video_chapters", "timers.files_strike_hours"]),
  ]);
  const n = (v: number) => formatNumber(v, locale);
  const video = s["hero.video"].kind === "youtube" ? s["hero.video"].id : null;
  const poster = siteImageUrl(s["hero.video_poster"]) ?? (video ? `https://i.ytimg.com/vi/${video}/maxresdefault.jpg` : null);
  // "Files in 24 hours" (owner, 2026-11-06): the winner sends the files within this many hours, or gets a suspension;
  // the 3-day deadline after it is only the last chance before another winner is picked.
  const hours = s["timers.files_strike_hours"];
  const bkash = payKinds(methods).bkash;

  return (
    <header className="lc-hero hv-hero">
      {nav}
      <div className="hv-grid">
        <div className="hv-txt">
          <a href="#hero-video" className="hv-badge">
            <span aria-hidden>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
            {t("heroVideo.badge")}
          </a>
          <h1 className="hv-title hv-bn">
            {t("heroVideo.titleA")}
            <br />
            <em>{t("heroVideo.titleB")}</em>
            {t("heroVideo.titleC")}
          </h1>
          <p className="hv-lead">{t("heroVideo.lead")}</p>
          <ol className="hv-steps">
            {(["step1", "step2", "step3"] as const).map((k, i) => (
              <li key={k}>
                <b aria-hidden>{n(i + 1)}</b>
                {t(`heroVideo.${k}`)}
              </li>
            ))}
          </ol>
          <div className="hv-row">
            <HeroCtaLink href="/start" className="hv-go">
              {t("heroVideo.cta")}
              <i>
                <Arrow />
              </i>
            </HeroCtaLink>
            <span className="hv-from">
              {t("heroVideo.from", { min: price(facts.minPrize) })}
              {bkash && ` · ${t("heroVideo.pay")}`}
            </span>
          </div>
          <div className="hv-chips">
            <span className="hv-safe">
              <svg aria-hidden width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" />
              </svg>
              {t("heroVideo.held")}
            </span>
            <span>{hours === 24 ? t("heroVideo.files24") : t("heroVideo.filesHours", { n: n(hours) })}</span>
            {contact.phone && <a href={contact.phoneHref}>{t("heroVideo.call", { phone: contact.phone })}</a>}
          </div>
        </div>
        <div className="hv-vidcol" id="hero-video">
          <HeroVideo id={video} on={s["hero.video_on"]} sound={s["hero.video_sound"]} poster={poster} chapters={s["hero.video_chapters"]} demoPrize={price(5000)} />
        </div>
      </div>
    </header>
  );
}
