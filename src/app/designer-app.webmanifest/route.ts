import { appManifest } from "@/lib/push/app-manifest";

// The designer dashboard as a Home Screen app (owner, 2026-10-22): new-contest notifications on iPhone and iPad.
export const dynamic = "force-static";

export function GET() {
  return appManifest({ id: "/dashboard", name: "logocontest.bd", shortName: "logocontest", startUrl: "/dashboard" });
}
