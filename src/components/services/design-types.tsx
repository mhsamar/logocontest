import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import { getI18n } from "@/lib/i18n/server";
import type { MessageKey, Translate } from "@/lib/i18n/translate";
import { allServices } from "@/lib/services/store";
import { LOGO, sizeText, type Lang, type ServiceDef } from "@/lib/services/types";
import "./design-types.css";

/*
 * "What do you need designed?" (owner, 2026-10-13; Design/home-page/home.html and start-contest.html). One card per
 * contest service, in the order set in Admin → Services. A service that is on is a coloured card that opens
 * /start/<key>; a service that is off stays on the page, grey, with "Coming soon", no link and aria-disabled. The
 * pictures are drawn samples with invented brands (public/design-types), never a real client's work.
 */

/** Sample logo n (1–14) from public/design-types. */
const logo = (n: number) => `/design-types/sample-logo-${String(n).padStart(2, "0")}.svg`;
const Img = ({ n }: { n: number }) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img src={logo(n)} alt="" width={400} height={400} loading="lazy" decoding="async" />
);
/** The scrolling logo wall on the logo card: four columns, each list written twice so it loops without a jump. */
const WALL = [
  [1, 2, 3, 4, 5],
  [6, 7, 8, 9, 10],
  [3, 11, 12, 4, 1],
  [10, 13, 6, 9, 14],
];

const Arrow = ({ size = 15 }: { size?: number }) => (
  <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
const Lock = () => (
  <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);
const Check = () => (
  <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);
const GridIcon = () => (
  <svg aria-hidden width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);

const GROUP: Record<string, string> = {
  logo: "brand",
  youtube_thumbnail: "youtube",
  youtube_banner: "youtube",
  social_post: "social",
  facebook_cover: "social",
  x_header: "social",
  business_card: "print",
  flyer: "print",
  tshirt: "print",
};
const FILES: Record<string, string> = { business_card: "pdf", flyer: "pdf", tshirt: "pngSvg" };

/** The drawn sample for a service (a plain maroon tile with its name for services added later in the admin). */
function Mock({ slug, name }: { slug: string; name: string }): ReactNode {
  switch (slug) {
    case "youtube_thumbnail":
      return (
        <div className="dt-fr" style={{ aspectRatio: "16/9", background: "linear-gradient(135deg,#111216,#3A0D10)" }}>
          <b className="dt-tt">
            TOP 5
            <br />
            <span>BUDGET PHONES</span>
          </b>
          <i className="dt-tface" />
          <i className="dt-play" />
          <em className="dt-time">HD</em>
        </div>
      );
    case "social_post":
      return (
        <div className="dt-fr dt-sq" style={{ aspectRatio: "1/1", background: "linear-gradient(150deg,#FFE7A6,#F29A1A)" }}>
          <span className="dt-pl">
            <Img n={3} />
          </span>
          <b className="dt-pt2">
            EID OFFER
            <br />
            <span>SALE</span>
          </b>
          <i className="dt-likes">♥</i>
        </div>
      );
    case "facebook_cover":
      return (
        <div className="dt-fr" style={{ aspectRatio: "1640/624", background: "linear-gradient(120deg,#5C0A0C,#2A0507)" }}>
          <b className="dt-cv">
            Meghna Travels<span>Tours across Bangladesh</span>
          </b>
          <i className="dt-fbav">
            <Img n={12} />
          </i>
        </div>
      );
    case "youtube_banner":
      return (
        <div className="dt-fr" style={{ aspectRatio: "2560/1440", background: "linear-gradient(120deg,#8B0000,#C0262A)" }}>
          <i className="dt-safe">
            <b>Your channel</b>
            <span>New video every Friday</span>
          </i>
        </div>
      );
    case "x_header":
      return (
        <div className="dt-fr" style={{ aspectRatio: "3/1", background: "linear-gradient(90deg,#111216,#2B2E35)" }}>
          <b className="dt-xh">Build. Ship. Repeat.</b>
          <i className="dt-xav">
            <Img n={9} />
          </i>
        </div>
      );
    case "business_card":
      return (
        <div className="dt-cards2">
          <span className="dt-bc dt-bcf">
            <Img n={1} />
          </span>
          <span className="dt-bc dt-bcb">
            <b>Nodi Tea</b>
            <i />
            <i />
            <i />
          </span>
        </div>
      );
    case "flyer":
      return (
        <div className="dt-fr dt-fly" style={{ aspectRatio: "2480/3508", background: "linear-gradient(180deg,#FFF6DC,#FFE29A)" }}>
          <b>
            GRAND
            <br />
            OPENING
          </b>
          <span className="dt-fl1">
            <Img n={3} />
          </span>
          <i />
          <i />
        </div>
      );
    case "tshirt":
      return (
        <svg viewBox="0 0 120 110" className="dt-tee" aria-hidden>
          <path d="M38 6l-26 14 10 22 12-6v66h52V36l12 6 10-22-26-14c-4 8-12 12-22 12S42 14 38 6z" fill="#111216" />
          <g transform="translate(43 40) scale(.34)">
            <polygon points="50.0,8.0 61.8,37.8 93.7,39.8 69.0,60.2 77.0,91.2 50.0,74.0 23.0,91.2 31.0,60.2 6.3,39.8 38.2,37.8" fill="#FFE27A" />
            <circle cx="50" cy="54" r="10" fill="#111216" />
          </g>
        </svg>
      );
    default:
      return (
        <div className="dt-fr dt-generic" style={{ aspectRatio: "16/10" }}>
          {name}
        </div>
      );
  }
}

/** One card. The logo card is the big featured one (logo wall, steps, Good for, wide button). */
function Card({ s, t, l, price, home }: { s: ServiceDef; t: Translate; l: (x: Lang) => string; price: (bdt: number) => string; home: boolean }) {
  const name = l(s.name);
  const feat = s.slug === LOGO;
  const on = s.on;
  const prize = <span className="dt-chip dt-prize">{t("services.picker.from", { amount: price(s.minPrize) })}</span>;
  const tag = (
    <span className="dt-tag">
      <i aria-hidden />
      {t(`services.types.groups.${GROUP[s.slug] ?? "design"}` as MessageKey)}
    </span>
  );
  const soonBtn = (
    <span className="dt-soonbtn">
      <Lock />
      {t("services.types.soon")}
    </span>
  );

  const body = feat ? (
    <>
      <div className="dt-viz">
        <div className="dt-wall" aria-hidden>
          {WALL.map((col, c) => (
            <div key={c} className="dt-col">
              <div className="dt-track">
                {[...col, ...col].map((n, i) => (
                  <span key={i} className="dt-lw">
                    <Img n={n} />
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="dt-vignette" aria-hidden />
        {on && <span className="dt-open">● {t("services.types.openNow")}</span>}
      </div>
      <div className="dt-body">
        {tag}
        <h3>{name}</h3>
        <p>{l(s.short)}</p>
        <div className="dt-chips">{prize}</div>
        <div className="dt-flow">
          <div className="dt-steps" aria-hidden={home || undefined}>
            <span className="dt-step">
              <b>1</b>
              {t("services.types.steps.brief")}
            </span>
            <i className="dt-arrow" aria-hidden />
            <span className="dt-step">
              <b>2</b>
              {t("services.types.steps.ideas")}
            </span>
            <i className="dt-arrow" aria-hidden />
            <span className="dt-step">
              <b>3</b>
              {t("services.types.steps.pick")}
            </span>
          </div>
          <div className="dt-good">
            <span className="dt-good-l">{t("services.types.goodFor")}</span>
            <span className="dt-good-c">{t("services.types.good.shop")}</span>
            <span className="dt-good-c">{t("services.types.good.restaurant")}</span>
            <span className="dt-good-c">{t("services.types.good.startup")}</span>
          </div>
        </div>
        <div className="dt-foot2">
          {on ? (
            <span className="dt-go dt-go2">
              <span className="dt-go2t">
                <b>{t("services.types.startLogo")}</b>
                <small>{t("services.types.logoFiles")}</small>
              </span>
              <i>
                <Arrow size={22} />
              </i>
            </span>
          ) : (
            soonBtn
          )}
        </div>
      </div>
    </>
  ) : (
    <>
      <div className="dt-viz">
        <div className="dt-mk">
          <Mock slug={s.slug} name={name} />
        </div>
      </div>
      <div className="dt-body">
        {tag}
        <h3>{name}</h3>
        <p>{l(s.short)}</p>
        <div className="dt-chips">
          {sizeText(s) && <span className="dt-chip">{sizeText(s)}</span>}
          {prize}
        </div>
        <div className="dt-foot">
          <span className="dt-files">
            <Check />
            {t(`services.types.files.${FILES[s.slug] ?? "jpgPng"}` as MessageKey)}
          </span>
          {on ? (
            <span className="dt-go">
              {t("services.types.start")}
              <i>
                <Arrow />
              </i>
            </span>
          ) : (
            soonBtn
          )}
        </div>
      </div>
    </>
  );

  const cls = cx("dt-card", feat && "dt-feat", !on && "dt-soon");
  if (!on)
    return (
      <div className={cls} aria-disabled="true" title={t("services.types.soon")} data-service={s.slug} role="group" aria-label={t("services.types.soonLabel", { name })}>
        {body}
      </div>
    );
  return (
    <Link href={`/start/${s.slug}`} className={cls} data-service={s.slug}>
      {body}
    </Link>
  );
}

/**
 * The card grid. `home`: the logo card plus six more (services that are on come first) and "See all design types".
 * `start`: every service, the "Something else?" card, How it works and the samples note.
 */
export async function DesignTypes({ variant }: { variant: "home" | "start" }) {
  const { t, locale, price } = await getI18n();
  const l = (x: Lang) => (locale === "bn" ? x.bn || x.en : x.en);
  const services = await allServices();
  const logoDef = services.find((s) => s.slug === LOGO);
  const rest = services.filter((s) => s.slug !== LOGO);
  const home = variant === "home";
  // Home shows six besides the logo; a service the admin turns on always makes it into those six.
  const shown = home ? [...rest.filter((s) => s.on), ...rest.filter((s) => !s.on)].slice(0, 6).sort((a, b) => a.position - b.position) : rest;
  const cards = [...(logoDef ? [logoDef] : []), ...shown];

  return (
    <div className={cx("dt-grid", home && "dt-home")}>
      {cards.map((s) => (
        <Card key={s.slug} s={s} t={t} l={l} price={price} home={home} />
      ))}
      {!home && (
        <Link href="/support" className="dt-card dt-other">
          <span className="dt-otx" aria-hidden>
            {t("services.types.other.chips")
              .split(",")
              .map((c) => (
                <span key={c} className="dt-oc">
                  {c}
                </span>
              ))}
          </span>
          <span className="dt-oi" aria-hidden>
            +
          </span>
          <h3>{t("services.types.other.title")}</h3>
          <p>{t("services.types.other.text")}</p>
          <span className="dt-go">
            {t("services.types.other.go")}
            <i>
              <Arrow />
            </i>
          </span>
        </Link>
      )}
    </div>
  );
}

/** Home: the section that replaced "Your new logo in three steps" (owner, 2026-10-13). */
export async function DesignTypesSection() {
  const { t } = await getI18n();
  const services = await allServices();
  const onlyLogo = services.filter((s) => s.on).every((s) => s.slug === LOGO);
  return (
    <section id="how" className="rounded-[32px] bg-white px-6 py-[72px]">
      <div className="mx-auto flex max-w-[1160px] flex-col items-center gap-9">
        <div className="lc-rv flex flex-col items-center gap-3.5 text-center">
          <span aria-hidden className="flex size-[52px] items-center justify-center rounded-2xl bg-[linear-gradient(160deg,#B3201B,#8B0000)]">
            <GridIcon />
          </span>
          <h2 className="m-0 text-[clamp(32px,4.2vw,54px)] font-semibold leading-[1.05] tracking-[-0.04em]">
            {t("services.types.homeTitle")} <span className="text-[#8B0000]">{t("services.types.homeTitleAccent")}</span>
          </h2>
          <p className="m-0 max-w-[620px] text-[18px] text-[#5F626B]">{t(onlyLogo ? "services.types.homeLeadLogo" : "services.types.homeLead")}</p>
        </div>
        <DesignTypes variant="home" />
        <Link href="/start" className="dt-all">
          {t("services.types.seeAll")}
          <i>
            <Arrow />
          </i>
        </Link>
        <p className="dt-note">{t("services.types.samples")}</p>
      </div>
    </section>
  );
}

/** Start a contest: the How it works strip under the cards. */
export async function DesignTypesHow() {
  const { t } = await getI18n();
  const steps = ["s1", "s2", "s3", "s4"] as const;
  return (
    <section className="dt-how" aria-label={t("services.types.how.kicker")}>
      <div className="dt-hwt">
        <span>{t("services.types.how.kicker")}</span>
        <b>{t("services.types.how.title")}</b>
        <Link href="/how-it-works" className="dt-hwa">
          {t("services.types.how.more")}
          <i>
            <Arrow />
          </i>
        </Link>
      </div>
      {steps.map((k, i) => (
        <div key={k} className="dt-hw">
          <span className="dt-hwn">{i + 1}</span>
          <i className="dt-hwl" aria-hidden />
          <b>{t(`services.types.how.${k}.title`)}</b>
          <span>{t(`services.types.how.${k}.text`)}</span>
        </div>
      ))}
    </section>
  );
}
