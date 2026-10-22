import { appManifest } from "@/lib/push/app-manifest";

// The admin panel as a Home Screen app (owner, 2026-10-22): the team's payment alerts on iPhone and iPad.
export const dynamic = "force-static";

export function GET() {
  return appManifest({ id: "/admin", name: "logocontest.bd admin", shortName: "LC admin", startUrl: "/admin" });
}
