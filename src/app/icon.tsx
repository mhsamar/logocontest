import { iconResponse } from "@/lib/content/icon-route";

export const contentType = "image/png";
export const dynamic = "force-dynamic";

// Browser tab icon: the admin's app icon (Brand & notice), or the built-in one.
export default function Icon() {
  return iconResponse("/brand/app-icon.png");
}
