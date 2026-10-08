import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import sharp from "sharp";
import en from "@/lib/i18n/messages/en";
import { formatDate } from "@/lib/dates";
import { qrPng } from "@/lib/profile/qr";
import { isSkillKey, isToolKey } from "./portfolio-options";
import type { DesignerProfile, PublicDesign } from "./profile";

/**
 * The designer's portfolio as a PDF (BLUEPRINT §8.3, owner 2026-10-08). English labels
 * with the standard Latin font; text the font can't draw (e.g. a Bangla bio) is left out.
 */

const A4 = { w: 595.28, h: 841.89 };
const M = 40; // page margin
const INK = rgb(0.125, 0.055, 0.004);
const MUTED = rgb(0.42, 0.42, 0.47);
const MAROON = rgb(0.36, 0.043, 0.059);
const GOLD = rgb(0.6, 0.38, 0.03);
const LINE = rgb(0.9, 0.9, 0.92);
const CANVAS = rgb(0.965, 0.968, 0.98);

const canDraw = (font: PDFFont, text: string) => {
  try {
    font.encodeText(text);
    return true;
  } catch {
    return false;
  }
};

function wrap(font: PDFFont, text: string, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > width && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
  }
  return lines;
}

async function fetchBytes(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url);
    return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

/** A round PNG of the profile photo (any input format). */
async function roundPhoto(bytes: Buffer, size: number): Promise<Buffer> {
  const mask = Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`);
  return sharp(bytes).resize(size, size, { fit: "cover" }).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
}

export async function portfolioPdf(designer: DesignerProfile, designs: PublicDesign[], profileUrl: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${designer.name} — Logo designer portfolio`);
  doc.setAuthor(designer.name);
  doc.setCreator("logocontest.bd");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const p = en.portfolio;

  let page = doc.addPage([A4.w, A4.h]);
  const text = (pg: PDFPage, s: string, x: number, y: number, size: number, f: PDFFont = font, color = INK) => {
    if (s && canDraw(f, s)) pg.drawText(s, { x, y, size, font: f, color });
  };

  // ---- Header band ----
  page.drawRectangle({ x: 0, y: A4.h - 150, width: A4.w, height: 150, color: MAROON });
  const logo = await doc.embedPng(await readFile(path.join(process.cwd(), "public/brand/logo-full-white.png")));
  const logoW = 150;
  page.drawImage(logo, { x: A4.w - M - logoW, y: A4.h - 44, width: logoW, height: (logo.height / logo.width) * logoW });

  let textX = M;
  if (designer.avatarUrl) {
    const bytes = await fetchBytes(designer.avatarUrl);
    if (bytes) {
      const photo = await doc.embedPng(await roundPhoto(bytes, 240)).catch(() => null);
      if (photo) {
        page.drawCircle({ x: M + 45, y: A4.h - 95, size: 47, color: rgb(1, 1, 1) });
        page.drawImage(photo, { x: M, y: A4.h - 140, width: 90, height: 90 });
        textX = M + 110;
      }
    }
  }
  const name = canDraw(bold, designer.name) ? designer.name : `@${designer.username}`;
  text(page, name, textX, A4.h - 92, 26, bold, rgb(1, 1, 1));
  text(page, `@${designer.username}  ·  Logo designer`, textX, A4.h - 112, 11, font, rgb(1, 0.9, 0.85));
  text(page, `Member since ${formatDate(designer.memberSince, "en", "month")}`, textX, A4.h - 128, 9, font, rgb(1, 0.85, 0.8));

  let y = A4.h - 185;

  // ---- Bio ----
  if (designer.bio && canDraw(font, designer.bio)) {
    for (const line of wrap(font, designer.bio, 11, A4.w - 2 * M).slice(0, 6)) {
      text(page, line, M, y, 11, font, INK);
      y -= 16;
    }
    y -= 10;
  }

  // ---- Stats boxes ----
  const exp =
    designer.experienceYears === null ? null : designer.experienceYears === 0 ? p.newcomer : designer.experienceYears === 1 ? p.oneYear : p.years.replace("{n}", String(designer.experienceYears));
  // Experience only when the designer filled it in.
  const boxes = [
    ...(exp ? [{ label: p.experienceLabel, value: exp, gold: true }] : []),
    { label: "Wins", value: String(designer.stats.wins), gold: false },
    { label: "Designs", value: String(designer.stats.designs), gold: false },
  ];
  const gap = 12;
  const bw = (A4.w - 2 * M - gap * (boxes.length - 1)) / boxes.length;
  boxes.forEach((b, i) => {
    const x = M + i * (bw + gap);
    page.drawRectangle({ x, y: y - 50, width: bw, height: 56, color: CANVAS, borderColor: LINE, borderWidth: 1 });
    text(page, b.value, x + 12, y - 22, 18, bold, b.gold ? GOLD : INK);
    text(page, b.label.toUpperCase(), x + 12, y - 40, 8, bold, MUTED);
  });
  y -= 80;

  // ---- Skills and tools ----
  const list = (title: string, items: string[]) => {
    if (items.length === 0) return;
    text(page, title.toUpperCase(), M, y, 9, bold, MUTED);
    y -= 16;
    const joined = items.filter((s) => canDraw(font, s)).join("   ·   ");
    for (const line of wrap(font, joined, 11, A4.w - 2 * M)) {
      text(page, line, M, y, 11, font, INK);
      y -= 15;
    }
    y -= 12;
  };
  list(p.skillsTitle, designer.skills.map((k) => (isSkillKey(k) ? p.skills[k] : k)));
  list(p.toolsTitle, designer.tools.map((k) => (isToolKey(k) ? p.tools[k] : k)));

  // ---- Logos ----
  const shown = designs.filter((d) => d.coverUrl).slice(0, 12);
  if (shown.length > 0) {
    text(page, "LOGOS FROM CONTESTS ON LOGOCONTEST.BD", M, y, 9, bold, MUTED);
    y -= 14;
    const cols = 3;
    const cg = 14;
    const size = (A4.w - 2 * M - cg * (cols - 1)) / cols;
    for (const [i, d] of shown.entries()) {
      const col = i % cols;
      if (col === 0 && i > 0) y -= size + 34;
      if (col === 0 && y - size < 110) {
        page = doc.addPage([A4.w, A4.h]);
        y = A4.h - M;
      }
      const x = M + col * (size + cg);
      const bytes = await fetchBytes(d.coverUrl!);
      if (bytes) {
        const jpg = await doc.embedJpg(await sharp(bytes).resize(420, 420, { fit: "cover" }).jpeg({ quality: 82 }).toBuffer()).catch(() => null);
        if (jpg) page.drawImage(jpg, { x, y: y - size, width: size, height: size });
      }
      page.drawRectangle({ x, y: y - size, width: size, height: size, borderColor: LINE, borderWidth: 1 });
      const caption = `${canDraw(font, d.brandName) ? d.brandName : "Contest"}  #${d.number}${d.isWinner ? "  ·  Winner" : ""}`;
      text(page, caption.length > 34 ? `${caption.slice(0, 33)}…`.replace("…", "...") : caption, x, y - size - 13, 9, d.isWinner ? bold : font, d.isWinner ? GOLD : INK);
    }
    y -= size + 40;
  }

  // ---- Footer with link and QR (last page) ----
  if (y < 130) {
    page = doc.addPage([A4.w, A4.h]);
    y = A4.h - M;
  }
  const qr = await doc.embedPng(await qrPng(profileUrl, 300));
  page.drawLine({ start: { x: M, y: 112 }, end: { x: A4.w - M, y: 112 }, thickness: 1, color: LINE });
  page.drawImage(qr, { x: A4.w - M - 76, y: 26, width: 76, height: 76 });
  text(page, "See the full portfolio online", M, 84, 11, bold, INK);
  text(page, profileUrl, M, 66, 10, font, MAROON);
  text(page, "Made on logocontest.bd — logo contests in Bangladesh", M, 40, 8, font, MUTED);

  return doc.save();
}
