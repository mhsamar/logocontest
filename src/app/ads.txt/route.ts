import { getSettings } from "@/lib/settings";

// ads.txt for Google AdSense (owner, 2026-10-14): filled from Admin › Settings › Ads.
export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSettings(["ads.enabled", "ads.adsense_client"]).catch(() => null);
  const client = s?.["ads.adsense_client"] ?? "";
  const body = s?.["ads.enabled"] && client ? `google.com, ${client.replace(/^ca-/, "")}, DIRECT, f08c47fec0942fa0\n` : "";
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
