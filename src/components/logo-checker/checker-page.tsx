import Link from "@/components/ui/link";
import type { CSSProperties, ReactNode } from "react";
import { getI18n } from "@/lib/i18n/server";
import { HERO_SAMPLES, pctColour, RADAR_FIND_COUNT, RADAR_FINDS, radarRadius, radarSpot, SAMPLE_SCORES, sampleLogo, VERDICT_COLOURS, type SampleVerdict } from "@/lib/logo-checker/samples";
import { formatNumber } from "@/lib/money";

/** perThousand: free checks for each ৳1,000 of prize (owner, 2026-10-14). */
/** basicChecks / proChecks: a designer's own logo checks a month (owner, 2026-10-15: the checker is for designers too). */
export type CheckerNumbers = { perThousand: number; freeFrom: number; price: number; freeChecks: number; paidChecks: number; closeFrom: number; basicChecks: number; proChecks: number };

type Css = CSSProperties & Record<`--${string}`, string | number>;

function Logo({ n, className }: { n: number; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={sampleLogo(n)} alt="" className={className ?? "lk-li"} loading="lazy" decoding="async" />;
}

const Tick = () => (
  <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);
const Arrow = () => (
  <svg aria-hidden width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

/** A score ring: the coloured part is the score out of 100. */
function Ring({ size, stroke, score, colour, children }: { size: number; stroke: number; score: number; colour: string; children: ReactNode }) {
  const r = size / 2 - stroke / 2 - 0.5;
  const len = 2 * Math.PI * r;
  return (
    <span className="lk-rg" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#ECEDF0" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colour} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={len.toFixed(1)} strokeDashoffset={(len * (1 - score / 100)).toFixed(1)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <b>{children}</b>
    </span>
  );
}

/**
 * Public Logo Checker page (owner, 2026-10-13; Design/logo-checker/logo-checker.html): hero with a "Try a sample"
 * demo, four clickable steps, the five checks, a sample report (verdict tabs, similarity radar, scores), price and
 * rules from Settings, what it can and can't do, questions and a closing call to action. Every logo and number in
 * the demo and the report is a sample (lib/logo-checker/samples.ts), never a real client's check. The clickable
 * parts are radio buttons with CSS, so they work without JavaScript; all motion stops with reduced motion.
 */
export async function LogoCheckerPage({ numbers }: { numbers: CheckerNumbers }) {
  const { t, locale, price } = await getI18n();
  const num = (n: number) => formatNumber(n, locale);
  const pct = (n: number) => `${num(n)}%`;
  const taka = price;
  const verdictLabel = (v: SampleVerdict) => t(`checker.verdicts.${v}`);
  const steps = ["choose", "check", "result", "certificate"] as const;
  const checks = [
    { k: "reads", c: "#8B0000", icon: <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></> },
    { k: "lens", c: "#1F4E8C", icon: <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" /></> },
    { k: "site", c: "#0F7A73", icon: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></> },
    { k: "shape", c: "#D9480F", icon: <path d="M4 18L10 6l4 8 2-4 4 8z" /> },
    { k: "font", c: "#5B3FA8", icon: <path d="M5 20L11 4h2l6 16M8 14h8" /> },
  ] as const;
  const decos = [
    { n: 4, l: 3, tp: 5, w: 70, r: -10, d: 6 },
    { n: 7, l: 86, tp: 4, w: 64, r: 8, d: 7 },
    { n: 9, l: 2, tp: 70, w: 62, r: 6, d: 8 },
    { n: 10, l: 88, tp: 74, w: 72, r: -6, d: 6.5 },
    { n: 11, l: 46, tp: -4, w: 46, r: 4, d: 7.5 },
    { n: 12, l: 48, tp: 90, w: 50, r: -4, d: 8.5 },
    { n: 6, l: 92, tp: 40, w: 44, r: 10, d: 7 },
    { n: 8, l: -1, tp: 38, w: 46, r: -8, d: 6 },
  ];
  const closeCount = RADAR_FINDS.filter((f) => f.pct >= numbers.closeFrom).length;
  const [first, second] = RADAR_FINDS;
  const zone = radarRadius(numbers.closeFrom) * 2;
  const verdictTabs: SampleVerdict[] = ["no_match", "similar", "high_risk"];

  return (
    <div className="lk">
      {/* 1. Hero with the sample demo */}
      <section className="lk-ch">
        <div className="lk-chl">
          <span className="lk-kick">
            <span className="lk-kd" />
            {t("checkerPage.hero.kicker")}
          </span>
          <h1>
            {t("checkerPage.hero.title")} <span className="lk-hl2">{t("checkerPage.hero.titleAccent")}</span>
          </h1>
          <p>{t("checkerPage.hero.lead")}</p>
          <div className="lk-btns">
            <Link href="/start" className="lk-b1">
              {t("checkerPage.startContest")}
              <Arrow />
            </Link>
            <a href="#sample" className="lk-b2">
              {t("checkerPage.hero.sample")}
            </a>
          </div>
          <div className="lk-tr3">
            <span>
              <Tick />
              {t("checkerPage.hero.free")}
            </span>
            <span>
              <Tick />
              {t("checkerPage.hero.upTo", { n: num(numbers.perThousand) })}
            </span>
            <span>
              <Tick />
              {t("checkerPage.hero.pdf")}
            </span>
          </div>
        </div>

        <div className="lk-chr">
          {HERO_SAMPLES.map((s, i) => (
            <input key={s.id} type="radio" className="lk-vh" name="lk-hd" id={`lk-hd${i}`} defaultChecked={i === 0} aria-label={t(`checkerPage.samples.${s.id}`)} />
          ))}
          <div className="lk-hdc">
            <span className="lk-hdl">{t("checkerPage.hero.try")}</span>
            {HERO_SAMPLES.map((s, i) => (
              <label key={s.id} htmlFor={`lk-hd${i}`} className={`lk-hch lk-h${i}`}>
                <span className="lk-hct">
                  <Logo n={s.logo} />
                </span>
                {t(`checkerPage.samples.${s.id}`)}
              </label>
            ))}
          </div>
          <div className="lk-hgrid">
            <div>
              {HERO_SAMPLES.map((s, i) => (
                <div key={s.id} className={`lk-hs2 lk-x${i}`}>
                  <div className="lk-slogo">
                    <Logo n={s.logo} />
                    <i className="lk-sline" />
                    <i className="lk-grid2" />
                    <i className="lk-db lk-di">
                      <em>{t("checkerPage.hero.boxLetters")}</em>
                    </i>
                    <i className="lk-db lk-dtx">
                      <em>{t(`checkerPage.hero.boxShape.${s.id}`)}</em>
                    </i>
                    <i className="lk-cb lk-a" />
                    <i className="lk-cb lk-b" />
                    <i className="lk-cb lk-c" />
                    <i className="lk-cb lk-d" />
                  </div>
                  <div className="lk-tags">
                    {(["shape", "reads", "colours"] as const).map((k, j) => (
                      <span key={k} style={{ "--d": `${j * 0.5}s` } as Css}>
                        <em>{t(`checkerPage.hero.tag.${k}`)}</em>
                        {t(`checkerPage.hero.tags.${s.id}.${k}`)}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="lk-hres">
              {HERO_SAMPLES.map((s, i) => {
                const vc = VERDICT_COLOURS[s.verdict];
                return (
                  <div key={s.id} className={`lk-fpan lk-x${i}`}>
                    <div className="lk-vbadge" style={{ background: vc.bg, color: vc.fg }}>
                      <i style={{ background: vc.fg }} />
                      {verdictLabel(s.verdict)}
                    </div>
                    <ul className="lk-hst2">
                      {(["read", "lens", "site", "shape", "font"] as const).map((k, j) => (
                        <li key={k} style={{ "--d": `${j * 0.35}s` } as Css}>
                          <i />
                          {t(`checkerPage.hero.step.${k}`)}
                        </li>
                      ))}
                    </ul>
                    <div className="lk-finds">
                      {s.finds.map((f) => (
                        <div key={f.logo} className="lk-fd">
                          <span className="lk-lt2">
                            <Logo n={f.logo} />
                          </span>
                          <div className="lk-fdb">
                            <div className="lk-fdt">
                              <span>{t(f.source === "web" ? "checkerPage.onWeb" : "checkerPage.onSite")}</span>
                              <b style={{ color: pctColour(f.pct) }}>{pct(f.pct)}</b>
                            </div>
                            <span className="lk-fb">
                              <i style={{ width: `${f.pct}%`, background: pctColour(f.pct) }} />
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="lk-ov">
                      <Ring size={58} stroke={7} score={s.overall} colour={vc.fg}>
                        {num(s.overall)}
                      </Ring>
                      <div className="lk-ovt">
                        <b>{t("checkerPage.overall")}</b>
                        <span>{t("checkerPage.hero.sampleOf", { name: t(`checkerPage.samples.${s.id}`) })}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* 2. How it works: four clickable steps */}
      <section className="lk-card lk-sec" id="how" aria-labelledby="lk-how">
        <div className="lk-sh2">
          <span className="lk-kick2">{t("checkerPage.how.kicker")}</span>
          <h2 id="lk-how">{t("checkerPage.how.title")}</h2>
          <p>{t("checkerPage.how.lead")}</p>
        </div>
        {steps.map((k, i) => (
          <input key={k} type="radio" className="lk-vh" name="lk-st" id={`lk-st${i + 1}`} defaultChecked={i === 0} aria-label={t(`checkerPage.how.steps.${k}.title`)} />
        ))}
        <div className="lk-stw">
          <div className="lk-stl">
            {steps.map((k, i) => (
              <label key={k} htmlFor={`lk-st${i + 1}`} className={`lk-sti lk-s${i + 1}`}>
                <span className="lk-stn">{num(i + 1)}</span>
                <span className="lk-stx">
                  <b>{t(`checkerPage.how.steps.${k}.title`)}</b>
                  <small>{t(`checkerPage.how.steps.${k}.body`)}</small>
                </span>
                <i className="lk-stp2" />
              </label>
            ))}
          </div>
          <div className="lk-stpn">
            <div className="lk-deco" aria-hidden>
              {decos.map((d) => (
                <span key={d.n} className="lk-dl" style={{ left: `${d.l}%`, top: `${d.tp}%`, width: d.w, "--r": `${d.r}deg`, "--d": `${d.d}s` } as Css}>
                  <Logo n={d.n} />
                </span>
              ))}
            </div>
            <div className="lk-pn lk-p1">
              <div className="lk-spv">
                <div className="lk-pick">
                  {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                    <span key={n} className={n === 3 ? "lk-on" : undefined}>
                      <Logo n={n === 3 ? 1 : n === 1 ? 3 : n} />
                      <small>{t("checker.choose.design", { n: num(n) })}</small>
                    </span>
                  ))}
                  <span className="lk-up">
                    <b>+</b>
                    <small>{t("checkerPage.how.upload")}</small>
                  </span>
                </div>
                <span className="lk-spb">
                  {t("checkerPage.how.startCheck")}
                  <Arrow />
                </span>
              </div>
            </div>
            <div className="lk-pn lk-p2">
              <div className="lk-spv">
                <ul className="lk-prog">
                  {(["read", "lens", "site", "shape", "font"] as const).map((k, i) => (
                    <li key={k} className={i < 2 ? "lk-dn" : i === 2 ? "lk-go" : undefined}>
                      <i />
                      <span>{t(`checkerPage.how.progress.${k}`)}</span>
                      <em>{t(i < 2 ? "checkerPage.how.done" : i === 2 ? "checkerPage.how.searching" : "checkerPage.how.waiting")}</em>
                    </li>
                  ))}
                </ul>
                <span className="lk-spn">{t("checkerPage.how.closeWindow")}</span>
              </div>
            </div>
            <div className="lk-pn lk-p3">
              <div className="lk-spv">
                <div className="lk-vd" style={{ background: VERDICT_COLOURS.high_risk.bg, color: VERDICT_COLOURS.high_risk.fg }}>
                  <b>{verdictLabel("high_risk")}</b>
                  <span>{t("checkerPage.how.resultLine", { n: num(closeCount), pct: pct(first.pct) })}</span>
                </div>
                <div className="lk-sc4">
                  {(
                    [
                      ["uniqueness", SAMPLE_SCORES.uniqueness, "#C0161F"],
                      ["legibility", SAMPLE_SCORES.legibility, "#1F9D57"],
                      ["colour", SAMPLE_SCORES.colour, "#1F4E8C"],
                      ["overall", SAMPLE_SCORES.overall, "#A3121B"],
                    ] as const
                  ).map(([k, v, c]) => (
                    <div key={k}>
                      <Ring size={52} stroke={6} score={v} colour={c}>
                        {num(v)}
                      </Ring>
                      <span>{t(`checkerPage.scores.${k}`)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="lk-pn lk-p4">
              <div className="lk-spv">
                <div className="lk-cert">
                  <div className="lk-certh">
                    <span className="lk-brand">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/brand/logo-icon-tile.png" alt="" width={22} height={22} />
                      logocontest.bd
                    </span>
                    <span className="lk-mono">CC-0000</span>
                  </div>
                  <strong>{t("checkerPage.how.certTitle")}</strong>
                  <div className="lk-certb">
                    <span className="lk-cl">
                      <Logo n={1} />
                    </span>
                    <div className="lk-certl">
                      <span>
                        <b>{t("checkerPage.how.certResult")}</b> {t("checkerPage.how.certSimilar", { n: num(closeCount) })}
                      </span>
                      <span>
                        <b>{t("checkerPage.overall")}:</b> {num(SAMPLE_SCORES.overall)} / {num(100)}
                      </span>
                      <span>{t("checkerPage.how.certDate")}</span>
                    </div>
                    <span className="lk-qr">
                      <svg aria-hidden width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM18 18h3v3h-3z" />
                      </svg>
                    </span>
                  </div>
                  <span className="lk-certn">{t("checker.note")}</span>
                </div>
                <div className="lk-btns">
                  <span className="lk-spb">{t("checkerPage.how.pdf")}</span>
                  <span className="lk-spb lk-g">{t("checkerPage.how.image")}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Five checks */}
      <section className="lk-sec2" aria-labelledby="lk-five">
        <div className="lk-sh2">
          <span className="lk-kick2">{t("checkerPage.five.kicker")}</span>
          <h2 id="lk-five">{t("checkerPage.five.title")}</h2>
        </div>
        <div className="lk-cks">
          {checks.map((c, i) => (
            <div key={c.k} className="lk-ck" tabIndex={0} style={{ "--c": c.c } as Css}>
              <span className="lk-cki">
                <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {c.icon}
                </svg>
              </span>
              <b>{t(`checkerPage.five.${c.k}.title`)}</b>
              <span>{t(`checkerPage.five.${c.k}.body`)}</span>
              <em aria-hidden>{num(i + 1)}</em>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Sample report */}
      <section className="lk-card lk-sec" id="sample" aria-labelledby="lk-sample">
        <div className="lk-sh2">
          <span className="lk-kick2">{t("checkerPage.report.kicker")}</span>
          <h2 id="lk-sample">{t("checkerPage.report.title")}</h2>
          <p>{t("checkerPage.report.lead")}</p>
        </div>
        {verdictTabs.map((v) => (
          <input key={v} type="radio" className="lk-vh" name="lk-vr" id={`lk-vr-${v}`} defaultChecked={v === "high_risk"} aria-label={verdictLabel(v)} />
        ))}
        <div className="lk-vtb">
          {verdictTabs.map((v) => (
            <label key={v} htmlFor={`lk-vr-${v}`} className={`lk-vt2 lk-v-${v}`} style={{ "--c": VERDICT_COLOURS[v].fg, "--b": VERDICT_COLOURS[v].bg } as Css}>
              <i />
              {verdictLabel(v)}
            </label>
          ))}
        </div>
        {verdictTabs.map((v) => (
          <div key={v} className={`lk-vb lk-vb-${v}`} style={{ background: VERDICT_COLOURS[v].bg, color: VERDICT_COLOURS[v].fg }}>
            <b>{verdictLabel(v)}</b>
            <span>{t(`checkerPage.report.banner.${v}`)}</span>
          </div>
        ))}
        <div className="lk-sgrid">
          <div className="lk-you">
            <span className="lk-yl">{t("checkerPage.report.yourLogo")}</span>
            <span className="lk-ylg">
              <Logo n={1} />
            </span>
            <div className="lk-ai">
              <span>
                <em>{t("checkerPage.hero.tag.shape")}</em>
                {t("checkerPage.report.shape")}
              </span>
              <span>
                <em>{t("checkerPage.report.type")}</em>
                {t("checker.types.lettermark")}
              </span>
              <span>
                <em>{t("checkerPage.hero.tag.reads")}</em>
                NK
              </span>
              <span>
                <em>{t("checkerPage.hero.tag.colours")}</em>
                <span className="lk-sw">
                  <i style={{ background: "#8B0000" }} />
                  <i style={{ background: "#E2B13C" }} />
                </span>
              </span>
            </div>
          </div>

          <div className="lk-sims">
            <div className="lk-simh">
              <strong>{t("checkerPage.report.map")}</strong>
              <span>{t("checkerPage.report.mapHint")}</span>
            </div>
            <div className="lk-radar2">
              <div className="lk-rad">
                <span className="lk-rzone" style={{ width: `${zone}%`, height: `${zone}%` }}>
                  <em>{t("checkerPage.report.zone", { n: num(numbers.closeFrom) })}</em>
                </span>
                {[75, 50, 25].map((p) => (
                  <i key={p} className="lk-rr" style={{ width: `${radarRadius(p) * 2}%`, height: `${radarRadius(p) * 2}%` }}>
                    <em>{pct(p)}</em>
                  </i>
                ))}
                <span className="lk-rsweep" />
                <span className="lk-rme">
                  <Logo n={1} />
                </span>
                <div className="lk-rspin">
                  {RADAR_FINDS.map((f) => {
                    const spot = radarSpot(f.pct, f.angle);
                    return (
                      <span key={f.id} className={`lk-rd${f.pct >= numbers.closeFrom ? " lk-close" : ""}`} style={{ left: `${spot.left}%`, top: `${spot.top}%` }} tabIndex={0}>
                        <span className="lk-rdi">
                          <Logo n={f.logo} />
                        </span>
                        <span className="lk-rdt">
                          <b>
                            {t(`checkerPage.finds.${f.id}`)} · {pct(f.pct)}
                          </b>
                          {t(f.source === "web" ? "checkerPage.onWeb" : "checkerPage.onSite")}
                        </span>
                      </span>
                    );
                  })}
                </div>
              </div>
              <div className="lk-slist">
                <span className="lk-slh">{t("checkerPage.report.found", { n: num(RADAR_FIND_COUNT), close: num(closeCount) })}</span>
                {RADAR_FINDS.map((f) => (
                  <div key={f.id} className={`lk-sl${f.pct >= numbers.closeFrom ? " lk-close" : ""}`}>
                    <span className="lk-rdi lk-sm">
                      <Logo n={f.logo} />
                    </span>
                    <div className="lk-slb2">
                      <div className="lk-slt">
                        <b>{t(`checkerPage.finds.${f.id}`)}</b>
                        <b className="lk-slp">{pct(f.pct)}</b>
                      </div>
                      <span className="lk-slb">
                        <i style={{ width: `${f.pct}%` }} />
                      </span>
                      <span className="lk-sls">{t(f.source === "web" ? "checkerPage.onWeb" : "checkerPage.onSite")}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lk-scp">
            <div className="lk-sch">
              <span className="lk-yl">{t("checkerPage.report.scores")}</span>
              <span className="lk-grd">{t("checkerPage.report.risky")}</span>
            </div>
            <div className="lk-gw">
              <svg viewBox="0 0 200 120" className="lk-gsv" aria-hidden>
                <defs>
                  <linearGradient id="lk-gg" x1="0" x2="1">
                    <stop offset="0" stopColor="#C0161F" />
                    <stop offset=".5" stopColor="#E2B13C" />
                    <stop offset="1" stopColor="#1F9D57" />
                  </linearGradient>
                </defs>
                <path d="M20 105A80 80 0 0 1 180 105" fill="none" stroke="#ECEDF0" strokeWidth="16" strokeLinecap="round" />
                <path d="M20 105A80 80 0 0 1 180 105" fill="none" stroke="url(#lk-gg)" strokeWidth="16" strokeLinecap="round" pathLength="100" strokeDasharray="100" strokeDashoffset={100 - SAMPLE_SCORES.overall} />
                <g className="lk-gnd" style={{ transformOrigin: "100px 105px", transform: `rotate(${(SAMPLE_SCORES.overall / 100) * 180 - 90}deg)` }}>
                  <path d="M100 105L100 40" stroke="#111216" strokeWidth="4" strokeLinecap="round" />
                  <circle cx="100" cy="105" r="8" fill="#111216" />
                </g>
              </svg>
              <div className="lk-gv">
                <strong>{num(SAMPLE_SCORES.overall)}</strong>
                <span>{t("checkerPage.report.outOf")}</span>
              </div>
            </div>
            {(
              [
                ["uniqueness", SAMPLE_SCORES.uniqueness, "#C0161F"],
                ["legibility", SAMPLE_SCORES.legibility, "#1F9D57"],
                ["colour", SAMPLE_SCORES.colour, "#1F4E8C"],
              ] as const
            ).map(([k, v, c]) => (
              <div key={k} className="lk-sbr" tabIndex={0} style={{ "--c": c } as Css}>
                <div className="lk-sbh">
                  <b>{t(`checkerPage.scores.${k}`)}</b>
                  <strong>
                    {num(v)}
                    <small>/{num(100)}</small>
                  </strong>
                </div>
                <span className="lk-sbt">
                  <i style={{ width: `${v}%` }} />
                </span>
                <span className="lk-sbd">{t(`checkerPage.report.scoreLine.${k}`)}</span>
              </div>
            ))}
            <div className="lk-tip">
              <b>{t("checkerPage.report.todo")}</b>
              <span>{t("checkerPage.report.todoLine", { a: pct(first.pct), b: pct(second.pct) })}</span>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Price and rules, can and can't */}
      <section className="lk-rl2">
        <div className="lk-card lk-rcard" aria-labelledby="lk-price">
          <span className="lk-kick2">{t("checkerPage.price.kicker")}</span>
          <h2 id="lk-price">{t("checkerPage.price.title")}</h2>
          <div className="lk-pl">
            <div className="lk-pc1 lk-fr">
              <em className="lk-rib">{t("checkerPage.price.best")}</em>
              <span>{t("checkerPage.price.freeFor")}</span>
              <b>{t("checkerPage.price.free")}</b>
              <small>{t("checkerPage.price.included", { n: num(numbers.perThousand) })}</small>
              <i className="lk-pbig" aria-hidden>
                {num(numbers.perThousand)}
              </i>
            </div>
            <div className="lk-pc1 lk-pd">
              <span>{t("checkerPage.price.paidFor", { amount: taka(3000) })}</span>
              <b>{t("checkerPage.price.free")}</b>
              <small>{t("checkerPage.price.addon", { n: num(numbers.perThousand * 3) })}</small>
              <i className="lk-pbig" aria-hidden>
                {num(numbers.perThousand * 3)}
              </i>
            </div>
          </div>
          <ul className="lk-rls">
            {[
              t("checkerPage.price.rule1", { basic: num(numbers.basicChecks), pro: num(numbers.proChecks) }),
              t("checkerPage.price.rule2", { n: num(numbers.perThousand) }),
              t("checkerPage.price.rule3"),
              t("checkerPage.price.rule4"),
            ].map((r) => (
              <li key={r}>
                <Tick />
                {r}
              </li>
            ))}
          </ul>
        </div>
        <div className="lk-card lk-rcard" aria-labelledby="lk-honest">
          <span className="lk-kick2 lk-gold">{t("checkerPage.honest.kicker")}</span>
          <h2 id="lk-honest">{t("checkerPage.honest.title")}</h2>
          <div className="lk-cc2">
            <div>
              <b className="lk-can">{t("checkerPage.honest.can")}</b>
              <ul>
                <li>{t("checkerPage.honest.can1")}</li>
                <li>{t("checkerPage.honest.can2")}</li>
                <li>{t("checkerPage.honest.can3")}</li>
              </ul>
            </div>
            <div>
              <b className="lk-cant">{t("checkerPage.honest.cant")}</b>
              <ul>
                <li>{t("checkerPage.honest.cant1")}</li>
                <li>{t("checkerPage.honest.cant2")}</li>
                <li>{t("checkerPage.honest.cant3")}</li>
              </ul>
            </div>
          </div>
          <p className="lk-disc">{t("checkerPage.honest.disclaimer")}</p>
        </div>
      </section>

      {/* 6. Questions */}
      <section className="lk-card lk-sec" aria-labelledby="lk-faq">
        <div className="lk-sh2">
          <span className="lk-kick2">{t("checkerPage.faq.kicker")}</span>
          <h2 id="lk-faq">{t("checkerPage.faq.title")}</h2>
        </div>
        <div className="lk-fq">
          {(["who", "which", "percent", "own", "verify"] as const).map((k, i) => (
            <details key={k} open={i === 0}>
              <summary>
                {t(`checkerPage.faq.${k}.q`)}
                <i aria-hidden />
              </summary>
              <p>{t(`checkerPage.faq.${k}.a`, { n: num(numbers.closeFrom), basic: num(numbers.basicChecks), pro: num(numbers.proChecks) })}</p>
            </details>
          ))}
        </div>
      </section>

      {/* 7. Call to action */}
      <section className="lk-cta2">
        <div>
          <h2>{t("checkerPage.cta.title")}</h2>
          <p>{t("checkerPage.cta.lead")}</p>
        </div>
        <div className="lk-btns">
          <Link href="/start" className="lk-b1 lk-white">
            {t("checkerPage.startContest")}
            <Arrow />
          </Link>
          <a href="#how" className="lk-b2 lk-ghost">
            {t("checkerPage.cta.how")}
          </a>
        </div>
      </section>
      <p className="lk-foot">{t("checkerPage.footnote")}</p>
    </div>
  );
}
