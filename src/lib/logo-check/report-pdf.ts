import "server-only";
import QRCode from "qrcode";
import { LOGO_ON_LIGHT } from "@/lib/cards/logos";
import { printedOrigin } from "@/lib/site-hosts";
import { renderCertificate } from "./certificate";
import type { EntryReport } from "./entry-check";
import type { MatchLevel } from "./entry-rules";

/**
 * The originality report PDF (owner, 2026-10-14; Design/logo-check). English, A4, made with the same headless
 * Chrome as the Logo Research Certificate. Closest results are a source name, a link and the similarity only.
 */

export const REPORT_NOTE = "AI research report, not a legal guarantee.";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const dhaka = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }).format(d);

const LOOK: Record<MatchLevel, { label: string; line: string; bar: string; bg: string; ink: string }> = {
  low: { label: "Low match", line: "No logo found that looks close to this one.", bar: "#14633C", bg: "#E3F3EA", ink: "#14633C" },
  medium: { label: "Medium match", line: "Some parts look like an existing logo. Look closer.", bar: "#D08A1E", bg: "#FFF7ED", ink: "#9A3412" },
  high: { label: "High match", line: "This looks a lot like an existing logo.", bar: "#A3121B", bg: "#FDE3E1", ink: "#A3121B" },
};

export async function reportHtml(r: EntryReport, origin: string): Promise<string> {
  const verifyUrl = `${printedOrigin(origin)}/verify/${r.reportId}`;
  const qr = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 220, color: { dark: "#111216", light: "#FFFDF8" } });
  const look = LOOK[r.level];
  const row = (k: string, v: string) => `<div class="row"><span class="k">${esc(k)}</span><strong>${esc(v)}</strong></div>`;
  const results = r.results.length
    ? r.results
        .map((m) => `<div class="res"><span class="n">${esc(m.name)}</span><span class="u">${esc(m.url ?? "")}</span><span class="p">${m.similarity}% similar</span></div>`)
        .join("")
    : `<p class="none">Nothing similar was found in the places we searched.</p>`;
  return `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@500;600&family=Urbanist:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
@page{size:A4;margin:0}*{box-sizing:border-box}
html,body{margin:0;width:794px;background:#fff}
body{font-family:'Urbanist',sans-serif;color:#111216;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.d{font-family:'Instrument Sans',sans-serif}
.page{width:794px;height:1123px;padding:22px}
.frame{height:100%;display:flex;flex-direction:column;gap:18px;padding:32px 36px;border:2px solid #8B0000;outline:1px solid #E6C9C7;outline-offset:-8px;background:#FFFDF8}
.top{display:flex;align-items:center;justify-content:space-between}
.brand{display:flex;align-items:center;gap:10px;font-size:20px;font-weight:600;letter-spacing:-.03em}.brand img{width:34px;height:34px}
.no{display:flex;flex-direction:column;align-items:flex-end;gap:3px;font-size:12.5px;color:#6B6557}
.cid{padding:2px 8px;border:1px solid #E3E4E8;border-radius:7px;background:#fff;font:600 13.5px ui-monospace,Menlo,monospace;letter-spacing:.04em;color:#3A3C45}
.kick{font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#14633C}
h1{margin:6px 0 0;font-size:34px;line-height:1.08;font-weight:600;letter-spacing:-.035em}
.score{display:flex;align-items:center;gap:18px;padding:18px 20px;border-left:5px solid ${look.bar};background:${look.bg}}
.pct{font-size:40px;font-weight:600;letter-spacing:-.03em;color:${look.ink}}
.score .l{font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${look.ink}}
.score p{margin:4px 0 0;font-size:15px;color:#3A3C45}
.row{display:flex;justify-content:space-between;gap:14px;padding:9px 0;border-top:1px solid #E9E2D2;font-size:14px}
.row:last-child{border-bottom:1px solid #E9E2D2}.row .k{color:#6B6557}.row strong{text-align:right}
.sec{font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#6B6557}
.res{display:grid;grid-template-columns:1fr auto;gap:2px 14px;padding:10px 0;border-top:1px solid #E9E2D2}
.res .n{font-weight:600;font-size:14.5px}.res .u{grid-column:1;font-size:12px;color:#6B6557;word-break:break-all}
.res .p{grid-row:1/3;grid-column:2;align-self:center;font-weight:700;font-size:14px}
.none,.hint{margin:6px 0 0;font-size:13.5px;color:#3A3C45}.hint{color:#6B6557;font-size:12.5px}
.foot{margin-top:auto;display:flex;align-items:flex-end;justify-content:space-between;gap:18px}
.note{display:flex;flex-direction:column;gap:5px;font-size:12.5px;line-height:1.5;color:#6B6557}.note .w{color:#8A5A00;font-weight:700}
.qr{width:92px;height:92px;flex:none}
</style></head><body><div class="page"><div class="frame">
<div class="top"><span class="brand d"><img src="${LOGO_ON_LIGHT}" alt="">logocontest.bd</span><span class="no">Report ID<span class="cid">${esc(r.reportId)}</span></span></div>
<div><span class="kick">Originality report</span><h1 class="d">Entry #${r.entry.number} · ${esc(r.contest.brand)}</h1></div>
<div class="score"><span class="pct d">${r.score}%</span><div><span class="l">${look.label}</span><p>${look.line}</p></div></div>
<div>${row("Designer", r.designer.username ? `${r.designer.name} (@${r.designer.username})` : r.designer.name)}${row("Checked on", `${dhaka(new Date(r.checkedAt))} · before submit`)}${row("Searched", `${r.sourcesCount} image sources and logo collections`)}${row("File fingerprint", `${r.fileSha256.slice(0, 4)}…${r.fileSha256.slice(-4)} — ${r.sameFile ? "matches the entry file" : "the entry file has changed"}`)}${row("Status", r.sameFile ? "Entry still uses this file" : "File changed — report no longer applies")}</div>
<div><span class="sec">Closest results</span>${results}<p class="hint">We show links to the sources, not copies of other people's logos.</p></div>
<div class="foot"><div class="note"><span class="w">${REPORT_NOTE}</span><span>The score is the similarity of the closest logo found on the date above. New logos can appear after this date.</span><span>Check this report at <strong>${esc(verifyUrl.replace(/^https?:\/\//, ""))}</strong></span></div><img class="qr" src="${qr}" alt=""></div>
</div></div></body></html>`;
}

export async function reportPdf(r: EntryReport, origin: string): Promise<Uint8Array> {
  return (await renderCertificate(await reportHtml(r, origin))).pdf;
}
