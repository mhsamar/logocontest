import { isOwnUrl, ownOrigins } from "@/lib/site-hosts";
import { CATALOG, type EmailKey } from "./catalog";
import { TEMPLATES } from "./templates";

/**
 * render(key, data) (owner, 2026-10-15): fills a designed email with its data. `{{name}}` is always HTML-escaped,
 * `{{#if name}}…{{/if}}` keeps its part only when the value is set, and the plain-text version is made from the same
 * filled email. Pure, so every template is tested with sample data.
 */

export type EmailValue = string | number | boolean | null | undefined;
export type EmailData = Record<string, EmailValue>;
export type Rendered = { subject: string; html: string; text: string };

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "{": "&#123;", "}": "&#125;" };

/** Escapes text for HTML (braces too, so a person's text can never look like a template variable). */
export const escapeHtml = (s: string) => s.replace(/[&<>"'{}]/g, (c) => ESCAPES[c]);

const isSet = (v: EmailValue) => !(v === undefined || v === null || v === false || v === "" || v === "false");
const str = (v: EmailValue) => (v === undefined || v === null || v === false ? "" : String(v));

/** Fills `{{#if}}` blocks and variables in one pass, so text inside a value is never read as a variable. */
function fill(template: string, data: EmailData, escape: boolean): string {
  const kept = template.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, name: string, inner: string) => (isSet(data[name]) ? inner : ""));
  return kept.replace(/\{\{\{(\w+)\}\}\}|\{\{(\w+)\}\}/g, (_, raw: string | undefined, name: string | undefined) => {
    // Only the body built below is put in as HTML; everything else is escaped.
    if (raw) return raw === "body_html" ? str(data.body_html) : escapeHtml(str(data[raw]));
    const v = str(data[name!]);
    return escape ? escapeHtml(v) : v;
  });
}

/** One line of plain text for a subject or preview: no line breaks, at most `max` characters. */
const oneLine = (s: string, max: number) => {
  const flat = s.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
};

/**
 * A notification's text as HTML: escaped, line breaks kept, and links to this site made clickable (the main address,
 * the backup address and the one the email was sent with; an exact address match, so look-alikes stay plain text).
 */
export function bodyHtml(body: string, siteUrl: string): string {
  const site = siteUrl.replace(/\/$/, "");
  const own = [...(site ? [site] : []), ...ownOrigins()];
  return escapeHtml(body.trim())
    .replace(/https?:\/\/[^\s<]+/g, (url) => {
      const trail = url.match(/[.,;:!?)]+$/)?.[0] ?? "";
      const href = trail ? url.slice(0, -trail.length) : url;
      return isOwnUrl(href, own) ? `<a href="${href}" target="_blank" style="color:#8B0000;text-decoration:underline">${href}</a>${trail}` : url;
    })
    .replace(/\n/g, "<br>");
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', nbsp: " " };
const decode = (s: string) =>
  s.replace(/&(#\d+|#x[0-9a-f]+|\w+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });

/** The plain-text version of a filled email: headings, lines, "label: value" rows and "button: link". */
export function htmlToText(html: string): string {
  const s = html
    .replace(/<head[\s\S]*?<\/head>/i, "")
    .replace(/<div style="display:none[^"]*">[\s\S]*?<\/div>/i, "")
    // The logo row at the top is just the name in text.
    .replace(/<tr><td style="padding:0 4px 16px">[\s\S]*?<\/table>\s*<\/td><\/tr>/i, "logocontest.bd\n")
    .replace(/<a [^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href: string, inner: string) => {
      const label = inner.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      if (!label) return "";
      return decode(label) === decode(href) ? href : `${label}: ${href}`;
    })
    .replace(/<\/td>\s*<td align="right"[^>]*>/gi, ": ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h1|tr|table)>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  return decode(s)
    .replace(/[ ͏﻿]/g, "")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** The first line worth showing as the inbox preview: not the greeting, at most 120 characters. */
export function previewOf(body: string): string {
  const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);
  const greeting = /^(hi|hello|dear|প্রিয়|হ্যালো)[\s,]/i;
  const line = lines.find((l, i) => !(i === 0 && greeting.test(l) && l.endsWith(","))) ?? "";
  return oneLine(line, 120);
}

/** Fills one email. `data` holds its own variables and the shared ones (site_url, logo_url, settings_url…). */
export function render(key: EmailKey, data: EmailData): Rendered {
  const { subject, preheader } = CATALOG[key];
  const full: EmailData = { ...data };
  if (key === "notification" || key === "contest-reminder") full.body_html = bodyHtml(str(data.body), str(data.site_url));
  full.subject = oneLine(fill(subject, full, false), 150);
  full.preheader = oneLine(fill(preheader, full, false), 140);
  const html = fill(TEMPLATES[key], full, true);
  return { subject: str(full.subject), html, text: htmlToText(html) };
}
