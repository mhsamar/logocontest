import { iconResponse } from "@/lib/content/icon-route";

export const contentType = "image/png";
export const dynamic = "force-dynamic";

// Home-screen icon on phones: the admin's app icon (Brand & notice), or the built-in one.
export default function AppleIcon() {
  return iconResponse("/brand/apple-icon.png");
}
