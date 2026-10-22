/**
 * A web app manifest for one signed-in area (owner, 2026-10-22). On iPhone and iPad, web notifications only work for
 * a site added to the Home Screen, so the admin panel and the designer and client dashboards each link one; public
 * pages link none, so visitors see no install prompts. Served outside the signed-in areas: the browser fetches it
 * without cookies.
 */
export function appManifest(app: { id: string; name: string; shortName: string; startUrl: string }): Response {
  const manifest = {
    id: app.id,
    name: app.name,
    short_name: app.shortName,
    start_url: app.startUrl,
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#8b0000",
    icons: [{ src: "/apple-icon", sizes: "501x501", type: "image/png" }],
  };
  return new Response(JSON.stringify(manifest), { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" } });
}
