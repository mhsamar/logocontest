import { ImageResponse } from "next/og";
import { getContestBySlug } from "@/lib/contests/browse";
import { contestStatusLine, isLatin, logoDataUrl, PIN_SIZE, PinFrame } from "@/lib/og";
import { contestIndexable } from "@/lib/seo";
import { isTestAccount } from "@/lib/seo/test-accounts";
import { pictureDataUrl, SHARE_PICTURE_HEADERS } from "@/lib/share/design";

// A contest's Pinterest picture (owner, 2026-10-18): its leading design (if any), brand, prize and state. Only for
// contests anyone may see; private and NDA contests are "not found".
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const contest = await getContestBySlug(slug, null);
  if (!contest || !contestIndexable({ status: contest.rawStatus, isPrivate: contest.isPrivate, isNda: contest.isNda, clientIsTest: await isTestAccount(contest.ownerId) }))
    return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  const [logoSrc, picture] = await Promise.all([logoDataUrl(), contest.cover ? pictureDataUrl(contest.cover.url) : null]);
  const brand = isLatin(contest.brandName) ? contest.brandName : "Logo design contest";
  const status = contestStatusLine(contest.rawStatus, contest.endsAt);
  return new ImageResponse(
    (
      <PinFrame logoSrc={logoSrc} picture={picture}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {contest.number && <span style={{ fontSize: 28, fontWeight: 600, letterSpacing: 4, color: "#8b0000", textTransform: "uppercase" }}>{`Contest #${String(contest.number).padStart(5, "0")}`}</span>}
          <span style={{ marginTop: 8, fontSize: picture ? (brand.length > 18 ? 64 : 84) : brand.length > 18 ? 96 : 128, fontWeight: 800, lineHeight: 1.02, letterSpacing: -2 }}>{brand}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 22, marginTop: 24 }}>
            <span style={{ display: "flex", fontSize: 40, fontWeight: 800, color: "#fff", background: "#8b0000", borderRadius: 20, padding: "8px 24px" }}>{`Prize BDT ${contest.prize.toLocaleString("en-US")}`}</span>
            {status && <span style={{ fontSize: 32, color: "#5c4a3d" }}>{status}</span>}
          </div>
        </div>
      </PinFrame>
    ),
    { ...PIN_SIZE, headers: SHARE_PICTURE_HEADERS },
  );
}
