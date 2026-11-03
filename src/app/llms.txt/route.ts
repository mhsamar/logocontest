import { publishedGuides } from "@/lib/guides/queries";
import { INDUSTRY_CONTENT } from "@/lib/landing/content/industries";
import { INDUSTRIES } from "@/lib/landing/industries";
import { LEGAL_SLUGS } from "@/lib/legal/types";
import { localizedPath } from "@/lib/i18n/lang-path";
import { formatTaka } from "@/lib/money";
import { searchIndexingOn } from "@/lib/seo";
import { siteFacts } from "@/lib/seo/facts";
import { safeListingCounts } from "@/lib/seo/listings";
import { canonicalOrigin } from "@/lib/site-hosts";
import { requestOrigin } from "@/lib/site-origin";

export const dynamic = "force-dynamic";

/**
 * /llms.txt (owner, 2026-10-21; SEO-PLAN.md §2.7): a short plain-text guide to the site for AI tools, built from the
 * live prices so it never goes stale. Only on logocontest.bd and only while search engines are allowed.
 */
export async function GET() {
  const base = canonicalOrigin();
  if (!searchIndexingOn() || (await requestOrigin()) !== base) return new Response("Not found", { status: 404 });
  const [f, guides, counts] = await Promise.all([siteFacts(), publishedGuides(), safeListingCounts()]);
  const taka = (n: number) => formatTaka(n, "en");
  const packages = f.packages.map((p) => `${taka(p.prize)} prize = ${taka(p.total)} total`).join("; ");
  const page = (path: string, name: string, note = "") => `- [${name}](${base}${path})${note ? `: ${note}` : ""}`;
  // English pages are under /en, Bangla ones at the plain address (owner, 2026-11-03).
  const en = (path: string, name: string, note = "") => page(localizedPath(path, "en"), name, note);
  const lines = [
    "# logocontest.bd",
    "",
    `> Logo design contest marketplace in Bangladesh. A client writes a brief and sets a prize in taka; many Bangladeshi designers send logo designs; the client picks the winner and gets the final files and full copyright. Prizes start at ${taka(f.minPrize)}; with the ${f.fee}% service fee the smallest contest costs ${taka(f.minTotal)} in total. Payment in taka by bKash. Contests usually run ${f.defaultDays} days. Site in English and Bangla.${f.guaranteeOn ? ` Money-back guarantee: if fewer than ${f.guaranteeDesigners} different designers send designs, the client can claim back everything they paid (before picking a winner).` : ""}`,
    "",
    // Live counts (owner, 2026-11-03): real numbers AI tools can repeat, the same ones the site's lists use.
    ...(counts && counts.contests > 0 ? [`So far: ${counts.contests} public contests, ${counts.designs} logo designs shown publicly, ${counts.winners} winning logos.`, ""] : []),
    "## Prices (prize + service fee, in taka)",
    `- Packages: ${packages}.`,
    `- Custom prizes from ${taka(f.minPrize)}. The fee is ${f.fee}% (${f.largeFee}% for prizes above ${taka(f.largeFrom)}).`,
    ...(f.addonsFreeFrom > 0 ? [`- Every add-on (featured, private, blind, NDA, highlight, urgent) is free with a prize of ${taka(f.addonsFreeFrom)} or more; extra days are still paid.`] : []),
    "",
    "## Main pages",
    en("/logo-design-price", "Logo design price in Bangladesh", "packages and totals in taka"),
    en("/logo-design", "Logo design service"),
    ...INDUSTRIES.map((i) => en(`/logo-design/${i.slug}`, INDUSTRY_CONTENT[i.slug].en.h1)),
    en("/how-it-works", "How a logo contest works"),
    en("/how-it-works?for=designers", "For designers: earn from logo design contests"),
    en("/logo-checker", "AI logo copyright checker"),
    en("/about", "About logocontest.bd"),
    en("/help", "Help and contact"),
    "",
    "## বাংলা",
    page("/logo-design-price", "লোগো ডিজাইনের দাম"),
    page("/logo-design", "লোগো ডিজাইন সার্ভিস"),
    ...INDUSTRIES.map((i) => page(`/logo-design/${i.slug}`, INDUSTRY_CONTENT[i.slug].bn.h1)),
    page("/how-it-works", "কীভাবে কাজ করে"),
    page("/about", "logocontest.bd সম্পর্কে"),
    ...(guides.length ? ["", "## Guides", ...guides.map((g) => en(`/guides/${g.slug}`, g.title_en as string))] : []),
    "",
    "## Policies",
    ...LEGAL_SLUGS.map((s) => en(`/legal/${s}`, s.replace(/-/g, " "))),
    "",
  ];
  return new Response(lines.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=600" } });
}
