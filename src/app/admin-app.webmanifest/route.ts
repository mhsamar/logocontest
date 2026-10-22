// The admin panel as a Home Screen app (owner, 2026-10-22). On iPhone and iPad, web notifications (the team's payment
// alerts) only work for a site added to the Home Screen. Linked from the admin pages only, so public visitors see no
// install prompts; served outside /admin so the browser's cookie-less fetch isn't sent to the sign-in page.
export const dynamic = "force-static";

export function GET() {
  const manifest = {
    id: "/admin",
    name: "logocontest.bd admin",
    short_name: "LC admin",
    start_url: "/admin",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#8b0000",
    icons: [{ src: "/apple-icon", sizes: "501x501", type: "image/png" }],
  };
  return new Response(JSON.stringify(manifest), { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" } });
}
