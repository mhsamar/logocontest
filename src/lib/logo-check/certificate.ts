import "server-only";
import QRCode from "qrcode";
import { certNumber, type Verdict } from "./rules";

/**
 * The Logo Research Certificate (owner, 2026-10-10; Design/copyright-checker/certificate.html): one HTML
 * template, A4 portrait, rendered to PDF and PNG by headless Chrome. Fixed wording: the title and the note.
 */

export const CERT_TITLE = "Logo Research Certificate";
export const CERT_NOTE = "This is an AI research report made on the date above. It is not a legal guarantee and not a trademark registration. New logos can appear after this date.";

export type CertificateData = {
  number: number;
  origin: string;
  logoDataUri: string;
  contest: string;
  design: string;
  designer: string | null;
  checkedFor: string;
  checkedAt: Date;
  verdict: Verdict;
  headline: string;
  subline: string;
  matches: { dataUri: string; similarity: number; close: boolean; where: string }[];
  closest: { same: string[]; different: string[] } | null;
  scores: { label: string; score: number }[];
  searched: { label: string; found: string }[];
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const dhaka = (d: Date, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", ...opts }).format(d);

const TONE: Record<Verdict, { bar: string; bg: string; label: string }> = {
  no_match: { bar: "#14633C", bg: "#E3F3EA", label: "#14633C" },
  similar: { bar: "#D08A1E", bg: "#FFF7ED", label: "#9A3412" },
  high_risk: { bar: "#A3121B", bg: "#FDE3E1", label: "#A3121B" },
};

export async function certificateHtml(d: CertificateData): Promise<string> {
  const no = certNumber(d.number);
  const verifyUrl = `${d.origin}/verify/${no}`;
  const qr = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 220, color: { dark: "#111216", light: "#FFFDF8" } });
  const tone = TONE[d.verdict];
  const row = (k: string, v: string) =>
    `<div class="row"><span class="k">${esc(k)}</span><strong>${esc(v)}</strong></div>`;
  const matches = d.matches
    .map(
      (m) => `<div class="m"><div class="mi${m.close ? " close" : ""}"><img src="${m.dataUri}" alt=""><span class="pc${m.close ? " pcc" : ""}">${m.similarity}%</span></div><span class="mw">${esc(m.where)}</span></div>`,
    )
    .join("");
  const closest = d.closest
    ? `<div class="sd">${d.closest.same.length ? `<strong>Same:</strong> ${esc(d.closest.same.join(", "))}.` : ""}${d.closest.different.length ? `<strong class="dif">Different:</strong> ${esc(d.closest.different.join(", "))}.` : ""}</div>`
    : "";

  return `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@500;600&family=Urbanist:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
@page{size:A4;margin:0}
*{box-sizing:border-box}
html,body{margin:0;width:794px;background:#fff}
body{font-family:'Urbanist',sans-serif;color:#111216;-webkit-font-smoothing:antialiased;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.d{font-family:'Instrument Sans',sans-serif}
.page{width:794px;height:1123px;padding:22px;background:#fff;overflow:hidden}
.frame{height:100%;display:flex;flex-direction:column;gap:16px;padding:30px 34px;border:2px solid #8B0000;outline:1px solid #E6C9C7;outline-offset:-8px;background:#FFFDF8}
.top{display:flex;align-items:center;justify-content:space-between}
.brand{display:flex;align-items:center;gap:10px;font-size:20px;font-weight:600;letter-spacing:-.03em}
.brand img{width:34px;height:34px}
.no{display:flex;flex-direction:column;align-items:flex-end;gap:3px;font-size:12.5px;color:#6B6557}
.cid{padding:2px 8px;border:1px solid #E3E4E8;border-radius:7px;background:#fff;font:600 13.5px ui-monospace,Menlo,monospace;letter-spacing:.04em;color:#3A3C45}
.head{display:flex;flex-direction:column;align-items:center;gap:5px;text-align:center}
.kick{font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#6B6557}
h1{margin:0;font-size:36px;line-height:1.05;font-weight:600;letter-spacing:-.035em}
.lead{margin:0;font-size:14px;line-height:1.45;color:#3A3C45}
.who{display:flex;gap:18px;align-items:stretch}
.logo{flex:0 0 220px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:14px;border:1px solid #E9E2D2;border-radius:14px;background:#fff}
.logo img{width:170px;height:150px;object-fit:contain}
.logo span{font-size:12.5px;color:#6B6557}
.facts{flex:1;display:flex;flex-direction:column;justify-content:center}
.row{display:flex;justify-content:space-between;gap:14px;padding:7px 0;border-top:1px solid #E9E2D2;font-size:13.5px}
.row:last-child{border-bottom:1px solid #E9E2D2}
.row .k{color:#6B6557}.row strong{text-align:right}
.res{display:flex;flex-direction:column;gap:4px;padding:14px 18px;border-left:5px solid ${tone.bar};background:${tone.bg}}
.res .l{font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${tone.label}}
.res strong{font-size:22px;line-height:1.2;font-weight:600;letter-spacing:-.02em}
.res .sub{font-size:13.5px;color:#3A3C45}
.sec{font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#6B6557}
.ms{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:8px}
.m{display:flex;flex-direction:column;gap:4px;min-width:0}
.mi{position:relative;height:92px;border-radius:12px;background:#fff;border:1px solid #E9E2D2;overflow:hidden;display:flex;align-items:center;justify-content:center}
.mi.close{border:3px solid #D08A1E}
.mi img{max-width:100%;max-height:100%;object-fit:contain}
.pc{position:absolute;left:5px;bottom:5px;padding:1px 7px;border-radius:999px;font-size:11.5px;font-weight:700;background:#F0F1F4;color:#3A3C45}
.pcc{background:#FFEDD5;color:#9A3412}
.mw{font-size:11px;color:#6B6557;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sd{margin-top:8px;font-size:12.5px;line-height:1.45;color:#3A3C45}.sd .dif{margin-left:8px}
.none{margin-top:6px;font-size:13.5px;color:#3A3C45}
.sc{display:flex;gap:10px}
.s{flex:1;display:flex;flex-direction:column;gap:5px;padding:10px 12px;border:1px solid #E9E2D2;border-radius:12px;background:#fff}
.s .n{font-size:12px;font-weight:700;color:#6B6557}
.s .v{font-size:24px;line-height:1;font-weight:600;letter-spacing:-.03em}.s .v small{font-size:12.5px;color:#6B6557}
.bar{height:6px;border-radius:99px;background:#EFE9DB;overflow:hidden}.bar span{display:block;height:100%;background:#8B0000;border-radius:99px}
.foot{margin-top:auto;display:flex;align-items:flex-end;justify-content:space-between;gap:18px}
.note{display:flex;flex-direction:column;gap:5px;font-size:12px;line-height:1.5;color:#6B6557}
.note strong{color:#111216}
.qr{width:92px;height:92px;flex:none}
</style></head><body><div class="page"><div class="frame">
<div class="top"><span class="brand d"><img src="${esc(d.origin)}/brand/logo-icon-tile.png" alt="">logocontest.bd</span><span class="no">Certificate no.<span class="cid">${no}</span></span></div>
<div class="head"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#8B0000" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9 12l2.2 2.2L15.5 10"/></svg><span class="kick">AI logo research</span><h1 class="d">${CERT_TITLE}</h1><p class="lead">This logo was checked for similar logos on ${esc(dhaka(d.checkedAt, { day: "numeric", month: "long", year: "numeric" }))}. The findings are below.</p></div>
<div class="who"><div class="logo"><img src="${d.logoDataUri}" alt=""><span>The logo that was checked</span></div><div class="facts">${row("Contest", d.contest)}${row("Design", d.design)}${d.designer ? row("Designer", d.designer) : ""}${row("Checked for", d.checkedFor)}${row("Date and time", dhaka(d.checkedAt, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }))}</div></div>
<div class="res"><span class="l">Result</span><strong class="d">${esc(d.headline)}</strong><span class="sub">${esc(d.subline)}</span></div>
<div><span class="sec">Similar logos found</span>${d.matches.length ? `<div class="ms">${matches}</div>${closest}` : `<p class="none">No similar logo was found in the places we searched.</p>`}</div>
<div class="sc">${d.scores.map((s) => `<div class="s"><span class="n">${esc(s.label)}</span><span class="v d">${s.score}<small> / 100</small></span><div class="bar"><span style="width:${s.score}%"></span></div></div>`).join("")}</div>
<div><span class="sec">Where we searched</span><div style="margin-top:6px">${d.searched.map((s) => row(s.label, s.found)).join("")}</div></div>
<div class="foot"><div class="note"><span>${esc(CERT_NOTE)}</span><span>Check this certificate at <strong>${esc(verifyUrl.replace(/^https?:\/\//, ""))}</strong></span></div><img class="qr" src="${qr}" alt=""></div>
</div></div></body></html>`;
}

/** Headless Chrome: the serverless build on Vercel, the installed Chrome on a computer. */
async function launch() {
  const puppeteer = await import("puppeteer-core");
  if (process.env.VERCEL || process.platform === "linux") {
    const chromium = (await import("@sparticuz/chromium")).default;
    return puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: true });
  }
  const executablePath = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  return puppeteer.launch({ executablePath, headless: true });
}

/** Renders the certificate to an A4 PDF and a PNG (2x) from the same HTML. */
export async function renderCertificate(html: string): Promise<{ pdf: Uint8Array; png: Uint8Array }> {
  const browser = await launch();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: "load", timeout: 30_000 });
    // Web fonts and the brand image finish loading before the picture is taken.
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => ((i.onload = r), (i.onerror = r))))));
    });
    const pdf = await page.pdf({ format: "A4", printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 }, pageRanges: "1" });
    const png = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: 794, height: 1123 } });
    return { pdf: new Uint8Array(pdf), png: new Uint8Array(png) };
  } finally {
    await browser.close();
  }
}
