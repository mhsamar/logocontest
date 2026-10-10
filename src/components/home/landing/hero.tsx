/* eslint-disable @next/next/no-img-element */
import { getContact } from "@/lib/content/contact";
import { getI18n } from "@/lib/i18n/server";
import { formatTaka } from "@/lib/money";
import { HeroForm } from "../hero-form";
import { LcMark, LogoTile } from "./logo-tile";

const ICON = {
  card: "M3 6h18v13H3zM3 10.5h18M7 15h3",
  shield: "M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6zM8.5 12l2.5 2.5 4.5-5",
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2C10.3 21 3 13.7 3 6a2 2 0 0 1 2-2z",
  pen: "M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19zM14 7l3 3",
  trophy: "M7 4h10v5a5 5 0 0 1-10 0zM7 6H4c0 3 1.5 4.5 3.5 4.5M17 6h3c0 3-1.5 4.5-3.5 4.5M12 14v4M8.5 20h7",
  check: "M5 12.5l4.5 4.5L19 7.5",
};

export const Svg = ({ d, size = 18, stroke = "currentColor", width = 2 }: { d: string; size?: number; stroke?: string; width?: number }) => (
  <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

/** A floating "notification" chip in the hero (illustration, marked as an example). */
function Chip({ icon, iconBg, title, sub, style }: { icon: React.ReactNode; iconBg: string; title: string; sub: string; style: React.CSSProperties }) {
  return (
    <span className="lc-fl lc-sh gap-3 rounded-[18px] border border-[var(--lc-line)] bg-white py-[9px] pl-[9px] pr-[18px]" style={{ aspectRatio: "auto", ...style }}>
      <span className="flex h-[42px] w-[42px] items-center justify-center rounded-xl" style={{ background: iconBg }}>
        {icon}
      </span>
      <span className="flex flex-col whitespace-nowrap leading-tight">
        <strong className="text-[15px] font-bold">{title}</strong>
        <span className="text-[13px] text-[var(--lc-muted)]">{sub}</span>
      </span>
    </span>
  );
}

/**
 * Hero (design file): floating example tiles, the headline word by word, the business-name form
 * (same checks and /start redirect as before) and the three trust points.
 */
export async function LandingHero({ logos, premiumPrize, nav, picture }: { logos: string[]; premiumPrize: number; nav: React.ReactNode; picture: string | null }) {
  const { t, locale } = await getI18n();
  const contact = await getContact(locale);
  const lead = t("home.titleLead").split(/\s+/).filter(Boolean);
  const accent = t("home.titleAccent").split(/\s+/).filter(Boolean);
  const tile = (i: number, fallback: number, style: React.CSSProperties) => <LogoTile src={logos[i]} fallback={fallback} className="lc-fl" style={{ borderRadius: "24%", ...style }} />;
  const trust = [
    { d: ICON.card, title: t("home.trustBar.payTitle"), sub: t("home.trustBar.paySub") },
    { d: ICON.shield, title: t("home.trustBar.heldTitle"), sub: t("home.trustBar.heldSub") },
  ];

  return (
    <header className="lc-hero relative isolate z-10 flex flex-col items-center overflow-hidden rounded-[32px] bg-white px-6 pb-[104px] pt-[150px]">
      <div className="lc-wide lc-par pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <Chip
          style={{ left: "3.5%", top: "44%", ["--r" as string]: "3deg", animationDuration: "8.5s", animationDelay: "-3s" }}
          iconBg="#D9E6F7"
          icon={<Svg d={ICON.pen} size={22} stroke="#24406B" width={2.2} />}
          title={t("home.landing.float.newDesign")}
          sub={t("home.landing.float.entry", { n: 4 })}
        />
        {tile(0, 0, { left: "7%", top: "19%", width: 116, ["--r" as string]: "-4deg", animationDuration: "9s", animationDelay: "-4s" })}
        {tile(1, 2, { left: "11%", top: "60%", width: 84, ["--r" as string]: "-9deg", animationDuration: "8.5s", animationDelay: "-5s" })}
        <Chip
          style={{ left: "3.5%", top: "77%", ["--r" as string]: "-3deg", animationDuration: "8s", animationDelay: "-1.5s" }}
          iconBg="var(--lc-red)"
          icon={<LcMark width={22} />}
          title={t("home.landing.float.winner")}
          sub={t("home.landing.float.entry", { n: 1 })}
        />
        <Chip
          style={{ right: "3.5%", top: "77%", ["--r" as string]: "3deg", animationDuration: "9s", animationDelay: "-4s" }}
          iconBg="#FFE27A"
          icon={<Svg d={ICON.trophy} size={22} stroke="#5B4300" width={2.2} />}
          title={t("home.landing.float.prize", { amount: formatTaka(premiumPrize, locale) })}
          sub={t("home.landing.float.prizeSub")}
        />
        {tile(2, 4, { right: "7%", top: "19%", width: 116, ["--r" as string]: "6deg", animationDuration: "9.5s", animationDelay: "-3s" })}
        <Chip
          style={{ right: "3.5%", top: "44%", ["--r" as string]: "-3deg", animationDuration: "7.5s", animationDelay: "-5s" }}
          iconBg="#DDF1E3"
          icon={<Svg d={ICON.check} size={22} stroke="#1D5B37" width={2.6} />}
          title={t("home.landing.float.files")}
          sub="AI · SVG · PNG"
        />
        {tile(3, 9, { right: "11%", top: "60%", width: 84, ["--r" as string]: "-5deg", animationDuration: "10s", animationDelay: "-4.5s" })}
      </div>

      {nav}

      <span className="lc-hi inline-flex items-center gap-[9px] rounded-full border border-[var(--lc-line)] px-4 py-[7px] text-[15px] font-semibold text-[var(--lc-muted)]" style={{ ["--dl" as string]: ".05s" }}>
        <span className="h-2 w-2 rounded-full bg-[var(--lc-red)]" />
        {t("home.eyebrow")}
      </span>
      <h1 className="mx-0 mb-0 mt-[22px] max-w-[860px] text-center text-[clamp(40px,6vw,82px)] font-semibold leading-[1.02] tracking-[-0.045em]">
        {lead.map((w, i) => (
          <span key={`l${i}`}>
            <span className="lc-w" style={{ ["--i" as string]: i }}>
              {w}
            </span>{" "}
          </span>
        ))}
        <span className="text-[var(--lc-red)]">
          {accent.map((w, i) => (
            <span key={`a${i}`}>
              <span className="lc-w" style={{ ["--i" as string]: lead.length + i }}>
                {w}
              </span>
              {i < accent.length - 1 ? " " : ""}
            </span>
          ))}
        </span>
      </h1>
      <p className="lc-hi mx-0 mb-0 mt-5 max-w-[460px] text-center text-xl text-[var(--lc-muted)]" style={{ ["--dl" as string]: ".75s" }}>
        {t("home.subtitle")}
      </p>

      <div className="lc-hi mt-8 w-full max-w-[520px]" style={{ ["--dl" as string]: ".9s" }}>
        <HeroForm />
      </div>

      <div className="lc-hi lc-tc mt-7 flex flex-wrap justify-center gap-2.5 text-[15px]" style={{ ["--dl" as string]: "1.05s" }}>
        {trust.map((x) => (
          <span key={x.title} className="inline-flex min-h-11 items-center gap-2.5 rounded-[14px] bg-[var(--lc-chip)] px-[18px]">
            <Svg d={x.d} stroke="var(--lc-red)" />
            <strong className="font-bold">{x.title}</strong>
            <span className="text-[var(--lc-muted)]">{x.sub}</span>
          </span>
        ))}
        <a href={contact.phoneHref} className="inline-flex min-h-11 items-center gap-2.5 rounded-[14px] bg-[var(--lc-chip)] px-[18px]">
          <Svg d={ICON.phone} stroke="var(--lc-red)" />
          <strong className="font-bold">{contact.phone}</strong>
          <span className="text-[var(--lc-muted)]">{t("home.trustBar.callSub")}</span>
        </a>
      </div>

      {/* An admin's own home picture (Brand & notice, A-17), under the trust points. */}
      {picture && <img src={picture} alt="" className="lc-hi mt-10 block w-full max-w-5xl rounded-[28px] object-cover lc-sh" style={{ ["--dl" as string]: "1.2s" }} />}
    </header>
  );
}
