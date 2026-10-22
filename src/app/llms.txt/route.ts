import { publishedGuides } from "@/lib/guides/queries";
import { LEGAL_SLUGS } from "@/lib/legal/types";
import { formatTaka } from "@/lib/money";
import { searchIndexingOn } from "@/lib/seo";
import { siteFacts } from "@/lib/seo/facts";
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
  const [f, guides] = await Promise.all([siteFacts(), publishedGuides()]);
  const taka = (n: number) => formatTaka(n, "en");
  const packages = f.packages.map((p) => `${taka(p.prize)} prize = ${taka(p.total)} total`).join("; ");
  const page = (path: string, name: string, note = "") => `- [${name}](${base}${path})${note ? `: ${note}` : ""}`;
  const lines = [
    "# logocontest.bd",
    "",
    `> Logo design contest marketplace in Bangladesh. A client writes a brief and sets a prize in taka; many Bangladeshi designers send logo designs; the client picks the winner and gets the final files and full copyright. Prizes start at ${taka(f.minPrize)}; with the ${f.fee}% service fee the smallest contest costs ${taka(f.minTotal)} in total. Payment in taka by bKash. Contests usually run ${f.defaultDays} days. Site in English and Bangla.${f.guaranteeOn ? ` Money-back guarantee: if fewer than ${f.guaranteeDesigners} different designers send designs, the client can claim back everything they paid (before picking a winner).` : ""}`,
    "",
    "## Prices (prize + service fee, in taka)",
    `- Packages: ${packages}.`,
    `- Custom prizes from ${taka(f.minPrize)}. The fee is ${f.fee}% (${f.largeFee}% for prizes above ${taka(f.largeFrom)}).`,
    "",
    "## Main pages",
    page("/logo-design-price", "Logo design price in Bangladesh", "packages and totals in taka"),
    page("/logo-design", "Logo design service"),
    page("/how-it-works", "How a logo contest works"),
    page("/how-it-works?for=designers", "For designers: earn from logo design contests"),
    page("/logo-checker", "AI logo copyright checker"),
    page("/about", "About logocontest.bd"),
    page("/help", "Help and contact"),
    "",
    "## বাংলা",
    page("/logo-design-price?lang=bn", "লোগো ডিজাইনের দাম"),
    page("/logo-design?lang=bn", "লোগো ডিজাইন সার্ভিস"),
    page("/how-it-works?lang=bn", "কীভাবে কাজ করে"),
    page("/about?lang=bn", "logocontest.bd সম্পর্কে"),
    ...(guides.length ? ["", "## Guides", ...guides.map((g) => page(`/guides/${g.slug}`, g.title_en as string))] : []),
    "",
    "## Policies",
    ...LEGAL_SLUGS.map((s) => page(`/legal/${s}`, s.replace(/-/g, " "))),
    "",
  ];
  return new Response(lines.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
