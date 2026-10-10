import { getI18n } from "@/lib/i18n/server";
import { LogoTile } from "./logo-tile";
import { Arrow, RedButton } from "./section-head";

// Where the eight tiles sit on each side (design file); real winning logos fill them first.
type Spot = { pos: React.CSSProperties; fb: number };
const LEFT: Spot[] = [
  { pos: { left: "4%", top: 0 }, fb: 10 },
  { pos: { left: "50%", top: 84 }, fb: 3 },
  { pos: { left: 0, top: 290 }, fb: 5 },
  { pos: { left: "46%", top: 262 }, fb: 6 },
];
const RIGHT: Spot[] = [
  { pos: { right: "50%", top: 70 }, fb: 0 },
  { pos: { right: "4%", top: 0 }, fb: 7 },
  { pos: { right: "46%", top: 262 }, fb: 8 },
  { pos: { right: 0, top: 290 }, fb: 2 },
];

/** "Work with designers you can trust" (design file). */
export async function Trusted({ logos }: { logos: string[] }) {
  const { t } = await getI18n();
  const side = (tiles: Spot[], offset: number, dir: "lc-sl" | "lc-sr") => (
    <div className="lc-wide relative h-[460px] min-w-0 flex-1" aria-hidden>
      {tiles.map((x, i) => (
        <LogoTile key={i} src={logos[offset + i]} fallback={x.fb} size="lg" className={`lc-rv ${dir} absolute h-[156px] w-[124px] rounded-[22px]`} style={x.pos} />
      ))}
    </div>
  );
  return (
    <section id="designers" className="overflow-hidden rounded-[32px] bg-[var(--lc-panel-alt)] px-6 py-[72px]">
      <div className="mx-auto flex max-w-[1240px] items-center justify-center gap-6">
        {side(LEFT, 0, "lc-sl")}
        <div className="lc-rv flex flex-[0_1_460px] flex-col items-center gap-[18px] text-center">
          <span className="lc-g flex h-[60px] w-[60px] items-center justify-center rounded-[18px] bg-[image:var(--lc-grad-icon)]">
            <svg aria-hidden width="28" height="28" viewBox="0 0 24 24" fill="#FFFFFF">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20a8 8 0 0 1 16 0z" />
            </svg>
          </span>
          <h2 className="m-0 text-[clamp(32px,4.2vw,54px)] font-semibold leading-[1.05] tracking-[-0.04em]">
            {t("home.trust.lead")} <span className="text-[var(--lc-red)]">{t("home.trust.accent")}</span>
          </h2>
          <p className="m-0 text-lg text-[var(--lc-muted)]">{t("home.trust.body")}</p>
          <RedButton href="/contests" className="mt-1.5">
            {t("home.trust.cta")}
            <Arrow />
          </RedButton>
        </div>
        {side(RIGHT, 4, "lc-sr")}
      </div>
    </section>
  );
}
