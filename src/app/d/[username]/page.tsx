import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShareProfileButton } from "@/components/designers/share-profile-button";
import { Avatar } from "@/components/ui/avatar";
import { formatDate } from "@/lib/dates";
import { designerByUsername } from "@/lib/designers/profile";
import { siteOrigin } from "@/lib/email";
import { getI18n } from "@/lib/i18n/server";
import { formatNumber, formatTaka } from "@/lib/money";
import { qrSvg } from "@/lib/profile/qr";

export async function generateMetadata({ params }: PageProps<"/d/[username]">): Promise<Metadata> {
  const { username } = await params;
  const [{ t }, designer] = await Promise.all([getI18n(), designerByUsername(username)]);
  if (!designer) return { title: t("notFound.title"), robots: { index: false } };
  return {
    title: t("designerProfile.metaTitle", { name: designer.name }),
    description: designer.bio ?? undefined,
    openGraph: designer.avatarUrl ? { images: [designer.avatarUrl] } : undefined,
  };
}

// P-06 Designer public profile. No contact details anywhere (BLUEPRINT §8.3).
export default async function DesignerProfilePage({ params, searchParams }: PageProps<"/d/[username]">) {
  const [{ username }, sp] = await Promise.all([params, searchParams]);
  const [{ t, locale }, designer] = await Promise.all([getI18n(), designerByUsername(username)]);
  if (!designer) notFound();
  const url = `${await siteOrigin()}/d/${designer.username}`;
  const qr = await qrSvg(url);
  const tab = sp.tab === "all" ? "all" : "wins";

  const stats = [
    { value: formatNumber(designer.stats.wins, locale), label: t("designerProfile.wins") },
    { value: formatNumber(designer.stats.designs, locale), label: t("designerProfile.designs") },
    { value: formatTaka(designer.stats.totalEarned, locale), label: t("designerProfile.earned"), accent: true },
  ];

  return (
    <div className="mx-auto w-full max-w-page px-4 pb-16 pt-4">
      <section className="relative overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-line">
        <div className="bg-aurora h-24 sm:h-32" aria-hidden />
        <div className="px-5 pb-6 sm:px-8">
          {/* Only the photo rises over the banner; the name sits fully below it. */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <Avatar name={designer.name} url={designer.avatarUrl} tone="cream" className="-mt-12 size-24 text-3xl ring-4 ring-surface sm:-mt-14 sm:size-28" />
              <div className="min-w-0 pt-3">
                <h1 className="truncate text-h2 font-bold leading-tight text-ink lg:text-h2-lg">{designer.name}</h1>
                <p className="font-mono text-sm text-muted">@{designer.username}</p>
              </div>
            </div>
            <div className="sm:pt-3">
              <ShareProfileButton url={url} qrSvg={qr} qrDownloadHref={`/d/${designer.username}/qr?download=1`} name={designer.name} />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {designer.isTopDesigner && <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-white">{t("designerProfile.topDesigner")}</span>}
            <span className="text-sm text-muted">{t("dashboard.memberSince", { date: formatDate(designer.memberSince, locale, "month") })}</span>
          </div>
          {designer.bio && <p className="mt-3 max-w-2xl whitespace-pre-line leading-relaxed text-ink">{designer.bio}</p>}

          <dl className="mt-5 grid max-w-xl grid-cols-3 gap-3">
            {stats.map((s) => (
              <div key={s.label} className="flex flex-col-reverse rounded-xl bg-canvas px-3 py-3 text-center sm:px-4">
                <dt className="mt-0.5 text-xs text-muted">{s.label}</dt>
                <dd className={`truncate text-lg font-bold tabular-nums sm:text-2xl ${s.accent ? "text-accent" : "text-ink"}`}>{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <nav aria-label={t("designerProfile.tabsLabel")} className="mt-8 border-b border-line">
        <ul className="flex gap-6">
          {(["wins", "all"] as const).map((key) => (
            <li key={key}>
              <a
                href={key === "wins" ? `/d/${designer.username}` : `/d/${designer.username}?tab=all`}
                aria-current={tab === key ? "page" : undefined}
                className={`-mb-px flex min-h-11 items-center border-b-2 text-sm font-semibold ${tab === key ? "border-primary text-primary" : "border-transparent text-muted hover:text-ink"}`}
              >
                {t(key === "wins" ? "designerProfile.tabWins" : "designerProfile.tabAll")}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      {/* TODO(milestone 4/7): winning logos and all public designs with their stars. */}
      <p className="mx-auto mt-8 max-w-xl rounded-lg border border-dashed border-line bg-surface px-4 py-10 text-center text-muted">
        {t(tab === "wins" ? "designerProfile.noWins" : "designerProfile.noDesigns")}
      </p>
    </div>
  );
}
