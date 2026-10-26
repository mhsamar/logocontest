import type { Metadata } from "next";
import { AdminAction } from "@/components/admin/admin-action";
import { EntryThumb } from "@/components/admin/entry-thumb";
import { HowVideosCard, type HowVideoTabData } from "@/components/admin/how-videos";
import { PictureField } from "@/components/admin/picture-field";
import { pictureUrl } from "@/lib/content/pictures";
import { translatorFor } from "@/lib/content/texts";
import type { MessageKey } from "@/lib/i18n/translate";
import { getSettings } from "@/lib/settings";
import { AdminHead } from "@/components/admin/page-head";
import { homepageLogos } from "@/lib/admin/misc";
import { entriesByIds } from "@/lib/admin/moderation";
import { featureLogo, moveFeaturedLogo, unfeatureLogo } from "@/lib/admin/site-actions";
import { getI18n } from "@/lib/i18n/server";
import { requirePermission } from "@/lib/admin/core";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.homepage.title"), robots: { index: false } };
}

// A-09 Homepage (BLUEPRINT §13.11): pick and order the winning logos shown on the home page.
export default async function AdminHomepagePage() {
  await requirePermission("content.view");
  const { t } = await getI18n();
  const { featured, candidates } = await homepageLogos();
  const [picked, available, s, en, bn] = await Promise.all([
    entriesByIds(featured.map((f) => f.entryId)),
    entriesByIds(candidates),
    getSettings(["how.video_client", "how.video_designer", "how.video_autoplay", "how.cover_client", "how.cover_designer", "how.video_start", "how.start_video_on", "how.start_video_autoplay"]),
    translatorFor("en"),
    translatorFor("bn"),
  ]);
  // How it works videos (owner, 2026-10-11): the points are site texts, shown here with their current wording.
  const point = (key: string) => ({ key, en: en(key as MessageKey), bn: bn(key as MessageKey) });
  const videoTabs: HowVideoTabData[] = (["client", "designer"] as const).map((tab) => {
    const side = tab === "client" ? "c" : "d";
    const kind = tab === "client" ? "how_client" : "how_designer";
    return {
      tab,
      title: t(`admin.homepage.videos.${tab}`),
      video: s[tab === "client" ? "how.video_client" : "how.video_designer"],
      points: [1, 2, 3, 4].map((n) => ({ title: point(`howPage.video.${side}.p${n}.title`), body: point(`howPage.video.${side}.p${n}.body`) })),
      cover: <PictureField kind={kind} url={pictureUrl(s[tab === "client" ? "how.cover_client" : "how.cover_designer"])} fallback={null} />,
    };
  });
  // The Start a contest corner video (owner, 2026-10-26): the clients' video until it has its own.
  const startVideo: HowVideoTabData = {
    tab: "start",
    title: t("admin.homepage.videos.start"),
    hint: t("admin.homepage.videos.startHint"),
    video: s["how.video_start"],
    fallback: { video: s["how.video_client"], note: t("admin.homepage.videos.usingClient") },
    none: t("admin.homepage.videos.startNone"),
  };
  return (
    <div className="space-y-6">
      <AdminHead title={t("admin.homepage.title")} lead={t("admin.homepage.lead")} />
      <HowVideosCard tabs={videoTabs} autoplay={s["how.video_autoplay"]} start={{ data: startVideo, on: s["how.start_video_on"], autoplay: s["how.start_video_autoplay"] }} />
      <section className="rounded-2xl bg-surface p-5 shadow-card ring-1 ring-line">
        <h2 className="font-semibold text-ink">
          {t("admin.homepage.featured")} <span className="text-muted">({picked.length})</span>
        </h2>
        {picked.length === 0 ? (
          <p className="mt-3 text-sm text-muted">{t("admin.homepage.none")}</p>
        ) : (
          <ol className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {picked.map((e, i) => (
              <li key={e.id} className="rounded-xl bg-canvas p-2">
                <EntryThumb entry={e} />
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  <span className="mr-auto text-xs font-semibold text-muted">{i + 1}</span>
                  {i > 0 && <AdminAction label="↑" title={t("admin.homepage.moveUp")} fields={[]} tone="ghost" run={moveFeaturedLogo.bind(null, e.id, "up")} />}
                  {i < picked.length - 1 && <AdminAction label="↓" title={t("admin.homepage.moveDown")} fields={[]} tone="ghost" run={moveFeaturedLogo.bind(null, e.id, "down")} />}
                  <AdminAction label="×" title={t("admin.homepage.remove")} fields={[]} tone="ghost" run={unfeatureLogo.bind(null, e.id)} />
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
      <section className="rounded-2xl bg-surface p-5 shadow-card ring-1 ring-line">
        <h2 className="font-semibold text-ink">{t("admin.homepage.available")}</h2>
        <p className="mt-1 text-xs text-muted">{t("admin.homepage.availableLead")}</p>
        {available.length === 0 ? (
          <p className="mt-3 text-sm text-muted">{t("admin.homepage.noWinners")}</p>
        ) : (
          <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {available.map((e) => (
              <li key={e.id}>
                <EntryThumb entry={e} />
                <div className="mt-2">
                  <AdminAction label={t("admin.homepage.add")} fields={[]} run={featureLogo.bind(null, e.id)} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
