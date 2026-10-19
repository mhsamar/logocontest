import { CARD_CSS } from "./card-css";
import { LOGO_ON_DARK, LOGO_ON_LIGHT } from "./logos";
import { CARD_SIZES, nameSize, prizeText, type CardSizeKey, type CardStyle } from "./rules";

/**
 * Fills Design/contest-cards/card-template.html with one contest (owner, 2026-10-19). Everything that comes from the
 * contest is HTML-escaped. Never on a card: the client's name, photo, phone, email or payment details.
 */

export type CardData = {
  brand: string;
  /** "Logo design · Matrimony website" */
  kicker: string;
  lineBn: string;
  /** Up to 2 style words and up to 3 colours from the brief (hidden when none). */
  words: string[];
  colors: string[];
  prize: number;
  daysLeft: number;
  endText: string;
  code: string;
  link: string;
  last24: boolean;
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const HEX = /^#[0-9a-f]{3}([0-9a-f]{3})?$/i;
const STYLE_CLASS: Record<CardStyle, string> = { maroon: "t-mn", light: "t-lt", big: "t-bp" };

const SHAPES =
  '<svg class="psh" viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><circle cx="350" cy="70" r="120" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".35"/><circle cx="350" cy="70" r="80" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".25"/><circle cx="350" cy="70" r="40" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".2"/><path d="M-20 420 Q120 330 230 420 T470 410" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".25"/><path d="M-20 450 Q120 360 230 450 T470 440" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".18"/><rect x="290" y="300" width="70" height="70" rx="18" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".2" transform="rotate(18 325 335)"/></svg>';
const ICON = (d: string, w = 15) => `<svg aria-hidden="true" width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const CLOCK = ICON('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>');
const CAL = ICON('<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>');
const ARROW = '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const TROPHY = '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4h10v5a5 5 0 0 1-10 0zM7 6H4c0 3 1.5 4.5 3.5 4.5M17 6h3c0 3-1.5 4.5-3.5 4.5M12 14v4M8.5 20h7"/></svg>';

/** The card itself (no page around it), at one size. */
export function cardMarkup(d: CardData, style: CardStyle, size: CardSizeKey): string {
  const s = CARD_SIZES.find((x) => x.key === size)!;
  const prize = `৳${prizeText(d.prize)}`;
  const ribbon = d.last24
    ? `<span class="prib l24">${ICON('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', 14)}Last 24 hours</span>`
    : style === "big"
      ? `<span class="prib">${TROPHY}Big prize</span>`
      : "";
  const words = d.words.slice(0, 2).map((w) => `<span>${esc(w)}</span>`).join("");
  const dots = d.colors.filter((c) => HEX.test(c)).slice(0, 3);
  const chips = words || dots.length ? `<div class="pst">${words}${dots.length ? `<span class="pdt">${dots.map((c) => `<i style="background: ${c}"></i>`).join("")}</span>` : ""}</div>` : "";
  const left = d.daysLeft === 1 ? "1 day left" : `${d.daysLeft} days left`;
  return `<div class="frame" style="width:${s.width}px;height:${s.height}px"><div class="pcd ${s.ratio} ${STYLE_CLASS[style]}" role="img" aria-label="${esc(`Contest post card for ${d.brand}, prize ${prize}`)}"><i class="pbg"></i>${SHAPES}<i class="pgl"></i><i class="pgr"></i><div class="pin"><div class="ptop"><span class="pbr"><img src="${style === "light" ? LOGO_ON_LIGHT : LOGO_ON_DARK}" alt="">logocontest.bd</span><span class="ptag"><i></i>New contest</span></div><div class="pmid">${ribbon}<span class="pkk">${esc(d.kicker)}</span><h3 class="pnm ${nameSize(d.brand)}">${esc(d.brand)}</h3>${d.lineBn ? `<p class="pbn">${esc(d.lineBn)}</p>` : ""}${chips}</div><div class="ppz"><span>Prize money</span><b>${prize}</b><em>Paid to the winner</em></div><div class="pmt"><span>${CLOCK}${left}</span><span>${CAL}Ends ${esc(d.endText)}</span><span class="pid">${esc(d.code)}</span></div><div class="pct"><div><b>Join the contest</b><em>${esc(d.link)}</em></div><span>${ARROW}</span></div></div></div></div>`;
}

/**
 * Bumped whenever the card's look changes; cards not posted yet are drawn again with the new look by the job
 * (owner, 2026-10-20: 2 fixed the ৳ sign on the server).
 */
export const CARD_TEMPLATE_VERSION = 2;

/** A whole page for the renderer: the fonts (Latin, Bangla and the link's typewriter font), the card's look and one card. */
export function cardPage(d: CardData, style: CardStyle, size: CardSizeKey): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Urbanist:wght@400;500;600;700;800&family=Hind+Siliguri:wght@500;600;700&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet"><style>${CARD_CSS}</style></head><body>${cardMarkup(d, style, size)}</body></html>`;
}
