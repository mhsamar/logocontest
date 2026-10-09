/**
 * The plain-text format admins edit legal pages in (BLUEPRINT §13.1 item 3, A-16). Pure, used in the
 * browser (live preview) and on the server (publish, show).
 *
 *   # Title
 *   > One-line description (for Google and the page top)
 *
 *   - "In short" point
 *
 *   ## Section heading {#anchor}
 *   A paragraph. Lines next to each other join into one paragraph.
 *
 *   - A list item
 *
 * The agreement is a title, intro paragraph(s), a list of clauses, then closing paragraph(s).
 */
import type { AgreementText, LegalBlock, LegalDoc, LegalSection } from "./types";

export type FormatProblem = "noTitle" | "noSections" | "textOutsideSection" | "emptySection" | "badAnchor" | "sameAnchor" | "noClauses" | "tooLong";

export const LEGAL_TEXT_MAX = 100_000;

// ---- to text ---------------------------------------------------------------

const blockText = (b: LegalBlock) => (typeof b === "string" ? b : b.list.map((x) => `- ${x}`).join("\n"));

export function docToText(doc: LegalDoc): string {
  const head = [`# ${doc.title}`, `> ${doc.description}`];
  const summary = doc.summary.length ? [doc.summary.map((x) => `- ${x}`).join("\n")] : [];
  const sections = doc.sections.map((s) => [`## ${s.heading} {#${s.id}}`, ...s.blocks.map(blockText)].join("\n\n"));
  return [head.join("\n"), ...summary, ...sections].join("\n\n") + "\n";
}

export function agreementToText(a: AgreementText): string {
  return [`# ${a.title}`, a.intro, a.clauses.map((c) => `- ${c}`).join("\n"), a.closing].join("\n\n") + "\n";
}

// ---- from text -------------------------------------------------------------

/** Splits lines into paragraphs and lists. Lines side by side join; a line under a list item continues it. */
function blocksOf(lines: string[]): LegalBlock[] {
  const out: LegalBlock[] = [];
  let para: string[] = [];
  let list: string[] | null = null;
  const flush = () => {
    if (para.length) out.push(para.join(" "));
    if (list?.length) out.push({ list });
    para = [];
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    if (/^[-*] /.test(line)) {
      if (para.length) flush();
      (list ??= []).push(line.slice(2).trim());
    } else if (list) {
      list[list.length - 1] += ` ${line}`;
    } else {
      para.push(line);
    }
  }
  flush();
  return out;
}

const tooLong = (text: string) => text.length > LEGAL_TEXT_MAX;

export function textToDoc(text: string): { ok: true; doc: LegalDoc } | { ok: false; problem: FormatProblem } {
  if (tooLong(text)) return { ok: false, problem: "tooLong" };
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  while (i < lines.length && !lines[i].trim()) i++;
  const titleLine = lines[i]?.trim() ?? "";
  if (!/^# \S/.test(titleLine)) return { ok: false, problem: "noTitle" };
  const title = titleLine.slice(2).trim();
  i++;
  const description: string[] = [];
  while (i < lines.length && /^>\s?/.test(lines[i].trim())) description.push(lines[i++].trim().replace(/^>\s?/, ""));

  const intro: string[] = [];
  while (i < lines.length && !/^## /.test(lines[i].trim())) intro.push(lines[i++]);
  const introBlocks = blocksOf(intro);
  if (introBlocks.some((b) => typeof b === "string")) return { ok: false, problem: "textOutsideSection" };
  const summary = introBlocks.flatMap((b) => (typeof b === "string" ? [] : b.list));

  const sections: LegalSection[] = [];
  const anchors = new Set<string>();
  while (i < lines.length) {
    const m = /^## (.+?)(?:\s*\{#([^}]*)\})?\s*$/.exec(lines[i].trim());
    i++;
    const body: string[] = [];
    while (i < lines.length && !/^## /.test(lines[i].trim())) body.push(lines[i++]);
    if (!m) continue;
    const id = m[2] ?? `s${sections.length + 1}`;
    if (!/^[a-z0-9-]{1,40}$/.test(id)) return { ok: false, problem: "badAnchor" };
    if (anchors.has(id)) return { ok: false, problem: "sameAnchor" };
    anchors.add(id);
    const blocks = blocksOf(body);
    if (!blocks.length) return { ok: false, problem: "emptySection" };
    sections.push({ id, heading: m[1].trim(), blocks });
  }
  if (!sections.length) return { ok: false, problem: "noSections" };
  return { ok: true, doc: { title, description: description.join(" "), summary, sections } };
}

export function textToAgreement(text: string): { ok: true; agreement: AgreementText } | { ok: false; problem: FormatProblem } {
  if (tooLong(text)) return { ok: false, problem: "tooLong" };
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  while (i < lines.length && !lines[i].trim()) i++;
  const titleLine = lines[i]?.trim() ?? "";
  if (!/^# \S/.test(titleLine)) return { ok: false, problem: "noTitle" };
  const blocks = blocksOf(lines.slice(i + 1));
  const at = blocks.findIndex((b) => typeof b !== "string");
  if (at < 0) return { ok: false, problem: "noClauses" };
  const clauses = blocks.filter((b) => typeof b !== "string").flatMap((b) => (b as { list: string[] }).list);
  const text_ = (bs: LegalBlock[]) => bs.filter((b): b is string => typeof b === "string").join("\n\n");
  const lastList = blocks.length - 1 - [...blocks].reverse().findIndex((b) => typeof b !== "string");
  return {
    ok: true,
    agreement: { title: titleLine.slice(2).trim(), intro: text_(blocks.slice(0, at)), clauses, closing: text_(blocks.slice(lastList + 1)) },
  };
}

/** The `{name}` placeholders a text uses. */
export const usedPlaceholders = (text: string) => [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))];
