import { appManifest } from "@/lib/push/app-manifest";

// The client workspace as a Home Screen app (owner, 2026-10-22): payment and support notifications on iPhone and iPad.
export const dynamic = "force-static";

export function GET() {
  return appManifest({ id: "/client", name: "logocontest.bd", shortName: "logocontest", startUrl: "/client" });
}
