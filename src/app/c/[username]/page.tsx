import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ClientProfileView, profileTab } from "@/components/client/profile-view";
import "@/components/client/client.css";
import { hasPermission } from "@/lib/admin/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { profileVisible } from "@/lib/client/rules";
import { clientProfileData } from "@/lib/client/workspace";
import { linkOrigin } from "@/lib/site-origin";
import { getI18n, pageAlternates } from "@/lib/i18n/server";
import { currentUsernameFor } from "@/lib/profile/usernames";
import { openGraphFor } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/c/[username]">): Promise<Metadata> {
  const { username } = await params;
  const [{ t, locale }, p, viewer] = await Promise.all([getI18n(), clientProfileData({ username }), getCurrentUser()]);
  if (!p) return { title: t("notFound.title"), robots: { index: false } };
  if (!profileVisible({ hidden: p.hidden, viewerId: viewer?.id, ownerId: p.id, staff: hasPermission(viewer, "users.view") })) return { title: t("cw.profile.privateTitle"), robots: { index: false } };
  const title = t("clientProfile.metaTitle", { name: p.business });
  const path = `/c/${username.toLowerCase()}`;
  return { title, alternates: await pageAlternates(path), openGraph: openGraphFor({ title, path, locale }), robots: p.hidden ? { index: false } : undefined };
}

// P-12 Client public profile, premium (owner, 2026-10-16; Design/client-premium/client-profile.html). Business name,
// logo, contests and winning logos only; never phone, email or payment details. "Show my profile to designers" off:
// private for everyone but the client and the admin team.
export default async function ClientProfilePage({ params, searchParams }: PageProps<"/c/[username]">) {
  const [{ username }, sp] = await Promise.all([params, searchParams]);
  const [{ t, locale }, p, viewer, origin] = await Promise.all([getI18n(), clientProfileData({ username }), getCurrentUser(), linkOrigin()]);
  if (!p) {
    // An old username: on to the new one (owner, 2026-10-15).
    const moved = await currentUsernameFor(username);
    if (moved) permanentRedirect(`/c/${moved}`);
    notFound();
  }
  const owner = viewer?.id === p.id;
  const visible = profileVisible({ hidden: p.hidden, viewerId: viewer?.id, ownerId: p.id, staff: hasPermission(viewer, "users.view") });
  return (
    <div className="cwx" data-public-profile>
      <div className="pg">
        <div className="pgw">
          <div className="dp">
            {owner && (
              <p className="calert info">
                {t(p.hidden ? "cw.profile.ownerHidden" : "cw.profile.ownerShown")}{" "}
                <Link href="/client/profile" style={{ textDecoration: "underline" }}>
                  {t("cw.profile.ownerLink")}
                </Link>
              </p>
            )}
            {visible ? (
              <ClientProfileView p={p} owner={false} tab={profileTab(sp.tab)} base={`/c/${username.toLowerCase()}`} publicUrl={`${origin}/c/${p.username ?? username}`} t={t} locale={locale} />
            ) : (
              <section className="dcard" style={{ textAlign: "center", padding: 40 }} data-private-profile>
                <h1 style={{ fontSize: 28 }}>{t("cw.profile.privateTitle")}</h1>
                <p style={{ color: "var(--mu)" }}>{t("cw.profile.privateLead")}</p>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
