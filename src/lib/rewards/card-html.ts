/**
 * The picture cards (owner, 2026-10-11; Design/rewards/designer-win-card.html): one HTML page per card, drawn at its
 * real size (1080 × 1080 for a square post, 1080 × 1920 for a story) and turned into a PNG by headless Chrome.
 * Every size inside is a share of the card's width (cqw), so both sizes come from the same layout.
 */

export type CardSize = "square" | "story";
export const CARD_SIZES: Record<CardSize, { width: number; height: number }> = { square: { width: 1080, height: 1080 }, story: { width: 1080, height: 1920 } };
export const isCardSize = (v: unknown): v is CardSize => v === "square" || v === "story";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export type WinCardContent = {
  size: CardSize;
  origin: string;
  lang: "en" | "bn";
  /** "Winner" on the yellow pill. */
  badge: string;
  /** "Congratulations" above the name. */
  kicker: string;
  name: string;
  /** "Winner of the <strong>Favliy</strong> logo contest", already escaped where it holds a name. */
  lineHtml: string;
  footer: string;
  photoUrl: string | null;
  logo: { url: string | null; hidden: boolean; hiddenLabel: string };
};

/** Gold dots in the same places as the design. */
const DOTS: [number, number, number, number][] = [
  [8, 18, 2.2, 0.5],
  [90, 14, 1.6, 0.6],
  [84, 30, 2.6, 0.7],
  [14, 40, 1.4, 0.8],
  [6, 70, 2, 0.5],
  [93, 62, 1.5, 0.6],
  [72, 8, 1.2, 0.7],
  [30, 9, 1.5, 0.8],
];

/** The two looks: red (contest win, the client's gift box) and gold (the designer's gift box), as in the design files. */
type Theme = { bg: string; ink: string; dot: string; pillBg: string; pillInk: string; ring: string; kick: string; soft: string; strong: string };
const RED: Theme = { bg: "linear-gradient(150deg,#A30F0F,#8B0000 52%,#4A0709)", ink: "#fff", dot: "#FFE27A", pillBg: "#FFE27A", pillInk: "#111216", ring: "#FFE27A", kick: "#FFE27A", soft: "#F6DAD8", strong: "#fff" };
const GOLD: Theme = { bg: "linear-gradient(150deg,#FFF3D6,#FFDF9C)", ink: "#111216", dot: "#D08A1E", pillBg: "#8B0000", pillInk: "#fff", ring: "#D08A1E", kick: "#8B0000", soft: "#4A3700", strong: "#111216" };

type Shell = { size: CardSize; origin: string; lang: "en" | "bn"; theme: Theme; pill: string; kicker: string; name: string; lineHtml: string; footer: string; photoUrl: string | null; art: string; css: string };

/** The parts every card shares: dots, the site logo and the pill, the photo beside a picture, the words, the footer. */
function cardHtml(c: Shell): string {
  const { width, height } = CARD_SIZES[c.size];
  const th = c.theme;
  const photoSize = c.size === "story" ? 46 : 34;
  const initial = esc(c.name.replace(/^@/, "").charAt(0).toUpperCase() || "?");
  const photo = c.photoUrl
    ? `<img class="photo" src="${esc(c.photoUrl)}" alt="">`
    : `<span class="photo initial d">${initial}</span>`;
  return `<!doctype html><html lang="${c.lang}"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@500;600&family=Urbanist:wght@400;500;600;700&family=Hind+Siliguri:wght@500;600&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box}html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden}
body{font-family:'Urbanist','Hind Siliguri',sans-serif;-webkit-font-smoothing:antialiased}
.d{font-family:'Instrument Sans','Hind Siliguri',sans-serif}
.pc{container-type:inline-size;position:relative;overflow:hidden;width:${width}px;height:${height}px;background:${th.bg};color:${th.ink}}
.dot{position:absolute;border-radius:50%;background:${th.dot}}
.in{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:6cqw 6cqw 5cqw;text-align:center}
.top{display:flex;align-items:center;justify-content:space-between;width:100%}
.brand{display:flex;align-items:center;gap:2.2cqw;font-size:5cqw;font-weight:600;letter-spacing:-.03em}
.brand img{width:10cqw;height:10cqw;border-radius:2.4cqw;box-shadow:0 0 0 .4cqw rgba(255,255,255,.35)}
.pill{padding:1.2cqw 3cqw;border-radius:99px;background:${th.pillBg};color:${th.pillInk};font-size:3cqw;font-weight:700;letter-spacing:.06em;text-transform:uppercase}
.pair{display:flex;align-items:center;justify-content:center}
.photo{display:block;width:${photoSize}cqw;height:${photoSize}cqw;flex:none;border-radius:50%;object-fit:cover;object-position:50% 20%;border:1.2cqw solid ${th.ring};box-shadow:0 3cqw 6cqw rgba(0,0,0,.28)}
.initial{display:flex;align-items:center;justify-content:center;background:#FFF1CF;color:#8B0000;font-size:${photoSize / 2.4}cqw;font-weight:600}
.words{display:flex;flex-direction:column;align-items:center;gap:1.2cqw}
.kick{font-size:3.6cqw;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:${th.kick}}
.name{font-size:9.5cqw;line-height:1;font-weight:600;letter-spacing:-.04em;max-width:88cqw;overflow-wrap:anywhere}
.line{max-width:80cqw;font-size:4.1cqw;line-height:1.3;font-weight:600;color:${th.soft}}.line strong{color:${th.strong}}
.foot{font-size:3.2cqw;font-weight:700;letter-spacing:.04em;color:${th.soft}}
${c.css}
</style></head><body><div class="pc">
${DOTS.map(([x, y, s, o]) => `<span class="dot" style="left:${x}cqw;top:${y}cqw;width:${s}cqw;height:${s}cqw;opacity:${o}"></span>`).join("")}
<div class="in">
<div class="top"><span class="brand d"><img src="${esc(c.origin)}/brand/logo-icon-tile.png" alt="">logocontest.bd</span><span class="pill">${esc(c.pill)}</span></div>
<div class="pair">${photo}${c.art}</div>
<div class="words"><span class="kick">${esc(c.kicker)}</span><span class="name d">${esc(c.name)}</span><span class="line">${c.lineHtml}</span></div>
<span class="foot">${esc(c.footer)}</span>
</div></div></body></html>`;
}

/** The contest win card: the photo beside the winning design (blurred for blind, private and NDA contests). */
export function winCardHtml(c: WinCardContent): string {
  const logo = c.logo.hidden
    ? `<span class="logo hidden">${c.logo.url ? `<img src="${esc(c.logo.url)}" alt="">` : ""}<span class="lock"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>${esc(c.logo.hiddenLabel)}</span></span>`
    : `<span class="logo">${c.logo.url ? `<img src="${esc(c.logo.url)}" alt="">` : ""}</span>`;
  return cardHtml({
    ...c,
    theme: RED,
    pill: c.badge,
    art: logo,
    css: `.logo{position:relative;margin-left:-5cqw;display:flex;align-items:center;justify-content:center;width:34cqw;height:34cqw;padding:4cqw;border-radius:6cqw;background:#fff;box-shadow:0 3cqw 6cqw rgba(0,0,0,.28);transform:rotate(4deg);overflow:hidden}
.logo img{max-width:100%;max-height:100%}
.logo.hidden img{filter:blur(2.6cqw);opacity:.55;transform:scale(1.1)}
.lock{position:absolute;inset:auto 2.4cqw 2.4cqw;display:flex;align-items:center;justify-content:center;gap:1.2cqw;padding:1.4cqw 2cqw;border-radius:99px;background:#111216;color:#fff;font-size:2.8cqw;font-weight:700;white-space:nowrap}
.lock svg{width:3.4cqw;height:3.4cqw}`,
  });
}

export type MonthlyCardContent = {
  size: CardSize;
  origin: string;
  lang: "en" | "bn";
  kind: "smartphone" | "gift_box";
  /** "October 2026" on the pill. */
  month: string;
  kicker: string;
  name: string;
  line: string;
  footer: string;
  photoUrl: string | null;
};

/**
 * The monthly prize cards (owner, 2026-10-11; Design/rewards/client-smartphone-claim.html and
 * designer-gift-box-claim.html): red with a drawn gold gift box for the top client, gold with a drawn red gift box for
 * the top designer (owner, 2026-10-20: the client's smartphone became a gift box too). Drawn shapes only: what is
 * inside stays a surprise. ("smartphone" stays the client prize's name inside the code and the database.)
 */
export function monthlyCardHtml(c: MonthlyCardContent): string {
  // The picture grows with the photo on the story size.
  const k = c.size === "story" ? 46 / 34 : 1;
  const u = (n: number) => `${(n * k).toFixed(2)}cqw`;
  const gold = c.kind === "smartphone";
  const box = `<span class="art" style="padding-left:${u(7)}"><span class="gb${gold ? " gold" : ""}"><span class="body"></span><span class="lid"></span><span class="rib"></span><span class="bow l"></span><span class="bow r"></span></span></span>`;
  return cardHtml({
    size: c.size,
    origin: c.origin,
    lang: c.lang,
    theme: c.kind === "smartphone" ? RED : GOLD,
    pill: c.month,
    kicker: c.kicker,
    name: c.name,
    lineHtml: esc(c.line),
    footer: c.footer,
    photoUrl: c.photoUrl,
    art: box,
    css: `.art{margin-left:-5cqw;display:flex;align-items:center;justify-content:center}
.gb{position:relative;display:block;width:${u(27)};height:${u(28.27)};transform:rotate(-6deg);filter:drop-shadow(0 3cqw 4cqw rgba(92,10,12,.3))}
.gb span{position:absolute}
.gb .body{left:${u(1.27)};right:${u(1.27)};top:${u(9.85)};bottom:0;border-radius:${u(0.95)} ${u(0.95)} ${u(2.22)} ${u(2.22)};background:linear-gradient(180deg,#A30F0F,#8B0000)}
.gb .lid{left:0;right:0;top:${u(5.4)};height:${u(5.72)};border-radius:${u(1.59)};background:#B3201B}
.gb .rib{left:50%;top:${u(5.4)};bottom:0;width:${u(4.13)};margin-left:-${u(2.06)};background:#D08A1E}
.gb .bow{left:50%;top:0;width:${u(7.31)};height:${u(6.04)};border:${u(1.43)} solid #D08A1E}
.gb .bow.l{margin-left:-${u(7.62)};border-radius:50% 50% 0 50%}.gb .bow.r{margin-left:${u(0.32)};border-radius:50% 50% 50% 0}
.gb.gold{filter:drop-shadow(0 3cqw 4cqw rgba(0,0,0,.38))}.gb.gold .body{background:linear-gradient(180deg,#FFD65C,#F2A33A)}.gb.gold .lid{background:#FFE27A}.gb.gold .rib{background:#fff}.gb.gold .bow{border-color:#fff}`,
  });
}

export type PayoutCardContent = {
  size: CardSize;
  origin: string;
  lang: "en" | "bn";
  /** "Payment sent" on the pill. */
  pill: string;
  kicker: string;
  name: string;
  /** "<strong>৳5,000</strong> sent to your bKash", already escaped. */
  lineHtml: string;
  /** "৳5,000" on the drawn badge. */
  amount: string;
  footer: string;
  photoUrl: string | null;
};

/**
 * The "Payment sent" card (owner, 2026-10-12): when an admin pays a withdrawal, the designer gets this congratulations
 * card, gold like the gift box card, with a drawn taka badge beside the photo. Private: only the designer sees it.
 */
export function payoutCardHtml(c: PayoutCardContent): string {
  const k = c.size === "story" ? 46 / 34 : 1;
  const u = (n: number) => `${(n * k).toFixed(2)}cqw`;
  return cardHtml({
    size: c.size,
    origin: c.origin,
    lang: c.lang,
    theme: GOLD,
    pill: c.pill,
    kicker: c.kicker,
    name: c.name,
    lineHtml: c.lineHtml,
    footer: c.footer,
    photoUrl: c.photoUrl,
    art: `<span class="coin"><span class="sym d">৳</span><span class="amt d">${esc(c.amount)}</span></span>`,
    css: `.coin{position:relative;margin-left:-5cqw;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${u(0.6)};width:${u(30)};height:${u(30)};border-radius:50%;background:linear-gradient(160deg,#A30F0F,#8B0000 60%,#5C0A0C);color:#FFE27A;border:${u(1.4)} solid #D08A1E;box-shadow:0 3cqw 6cqw rgba(92,10,12,.35);transform:rotate(-6deg)}
.sym{font-size:${u(12)};line-height:1;font-weight:600}
.amt{max-width:${u(25)};font-size:${u(4)};font-weight:600;letter-spacing:-.02em;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}`,
  });
}

export { esc as escapeHtml };
