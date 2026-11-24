import { AdminAction } from "@/components/admin/admin-action";
import { EntryThumb } from "@/components/admin/entry-thumb";
import Link from "@/components/ui/link";
import { entriesByIds } from "@/lib/admin/moderation";
import { homeShowcase } from "@/lib/home/showcase";
import { refreshShowcase, saveShowcasePins, setContestHomeShow, setEntryHomeHidden, setShowcaseOn } from "@/lib/home/showcase-actions";
import { homeHiddenEntryIds, showcaseContestRows, type ShowcaseContestRow } from "@/lib/home/showcase-admin";
import { getI18n } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { getSettings } from "@/lib/settings";

/**
 * Admin → Homepage, "Home showcase" (owner, 2026-11-20): on or off, Refresh now, the pinned contests, every public
 * contest's "হোমে দেখাবে" switch, the designs showing now (each can be hidden) and the hidden ones (each can come back).
 */
export async function HomeShowcaseCard() {
  const { t } = await getI18n();
  const s = await getSettings(["home.showcase_on", "home.showcase_live_pins", "home.showcase_finished_pin"]);
  let rows: ShowcaseContestRow[] = [];
  let hiddenIds: string[] = [];
  let ready = true;
  try {
    [rows, hiddenIds] = await Promise.all([showcaseContestRows(), homeHiddenEntryIds()]);
  } catch {
    // Migration 0091 not run yet: its columns are missing.
    ready = false;
  }
  const showcase = ready && s["home.showcase_on"] ? await homeShowcase() : null;
  const showingIds = showcase ? [...new Set([...showcase.wall.flat(), ...showcase.live.flatMap((c) => c.logos), ...(showcase.featured?.logos ?? [])].map((l) => l.id))] : [];
  const [showing, hidden] = await Promise.all([entriesByIds(showingIds), entriesByIds(hiddenIds)]);

  const open = rows.filter((r) => r.status === "open" && r.homeShow);
  const finished = rows.filter((r) => r.status === "completed" && r.homeShow);
  const auto = { value: "", label: t("admin.homepage.showcase.auto") };
  const pins = s["home.showcase_live_pins"];
  const name = (id: string) => rows.find((r) => r.id === id)?.brand ?? id.slice(0, 8);
  const status = (st: string) => t(`status.${st}` as MessageKey);

  return (
    <section className="rounded-2xl bg-surface p-5 shadow-card ring-1 ring-line" id="home-showcase">
      <h2 className="font-semibold text-ink">{t("admin.homepage.showcase.title")}</h2>
      <p className="mt-1 text-sm text-muted">{t("admin.homepage.showcase.lead")}</p>
      {!ready ? (
        <p className="mt-3 rounded-xl border border-[#f1e3a8] bg-[#fffbea] px-4 py-3 text-sm text-gold-ink">{t("admin.homepage.showcase.runSql")}</p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className={s["home.showcase_on"] ? "rounded-full bg-[#E7F6EC] px-3 py-1 text-sm font-semibold text-[#15803D]" : "rounded-full bg-canvas px-3 py-1 text-sm font-semibold text-muted"}>
              {t(s["home.showcase_on"] ? "admin.homepage.showcase.isOn" : "admin.homepage.showcase.isOff")}
            </span>
            <AdminAction label={t(s["home.showcase_on"] ? "admin.homepage.showcase.turnOff" : "admin.homepage.showcase.turnOn")} fields={[]} run={setShowcaseOn.bind(null, !s["home.showcase_on"])} />
            <AdminAction label={t("admin.homepage.showcase.refresh")} title={t("admin.homepage.showcase.refreshHint")} fields={[]} tone="ghost" run={refreshShowcase} done={t("admin.homepage.showcase.refreshed")} />
          </div>

          <div className="mt-5">
            <h3 className="text-sm font-bold text-ink">{t("admin.homepage.showcase.pins")}</h3>
            <p className="mt-1 text-sm text-muted">
              {t("admin.homepage.showcase.pinsNow", {
                live: pins.length ? pins.map(name).join(", ") : t("admin.homepage.showcase.auto"),
                finished: s["home.showcase_finished_pin"] ? name(s["home.showcase_finished_pin"]) : t("admin.homepage.showcase.auto"),
              })}
            </p>
            <div className="mt-2">
              <AdminAction
                label={t("admin.homepage.showcase.choosePins")}
                body={t("admin.homepage.showcase.pinsHint")}
                fields={[
                  ...[0, 1, 2].map((i) => ({ name: `live${i + 1}`, kind: "select" as const, label: t("admin.homepage.showcase.livePin", { n: String(i + 1) }), options: [auto, ...open.map((r) => ({ value: r.id, label: r.brand }))], defaultValue: pins[i] ?? "" })),
                  { name: "finished", kind: "select" as const, label: t("admin.homepage.showcase.finishedPin"), options: [auto, ...finished.map((r) => ({ value: r.id, label: r.brand }))], defaultValue: s["home.showcase_finished_pin"] },
                ]}
                run={saveShowcasePins}
              />
            </div>
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-bold text-ink">{t("admin.homepage.showcase.contests")}</h3>
            <p className="mt-1 text-xs text-muted">{t("admin.homepage.showcase.contestsHint")}</p>
            {rows.length === 0 ? (
              <p className="mt-3 text-sm text-muted">{t("admin.homepage.showcase.noContests")}</p>
            ) : (
              <ul className="mt-3 divide-y divide-line rounded-xl ring-1 ring-line">
                {rows.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                    <Link href={`/admin/contests/${r.slug}`} className="mr-auto min-w-0 truncate font-semibold text-ink hover:underline">
                      {r.brand}
                    </Link>
                    <span className="text-xs text-muted">{status(r.status)}</span>
                    <span className={r.homeShow ? "text-xs font-semibold text-[#15803D]" : "text-xs font-semibold text-muted"}>{t(r.homeShow ? "admin.homepage.showcase.shown" : "admin.homepage.showcase.notShown")}</span>
                    <AdminAction label={t(r.homeShow ? "admin.homepage.showcase.hideContest" : "admin.homepage.showcase.showContest")} fields={[]} tone="ghost" run={setContestHomeShow.bind(null, r.id, !r.homeShow)} />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-bold text-ink">
              {t("admin.homepage.showcase.showing")} <span className="text-muted">({showing.length})</span>
            </h3>
            {showing.length === 0 ? (
              <p className="mt-3 text-sm text-muted">{t("admin.homepage.showcase.nothing")}</p>
            ) : (
              <ul className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-8">
                {showing.map((e) => (
                  <li key={e.id}>
                    <EntryThumb entry={e} />
                    <div className="mt-1">
                      <AdminAction label={t("admin.homepage.showcase.hideDesign")} fields={[]} tone="ghost" run={setEntryHomeHidden.bind(null, e.id, true)} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {hidden.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-bold text-ink">
                {t("admin.homepage.showcase.hidden")} <span className="text-muted">({hidden.length})</span>
              </h3>
              <ul className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-8">
                {hidden.map((e) => (
                  <li key={e.id}>
                    <EntryThumb entry={e} />
                    <div className="mt-1">
                      <AdminAction label={t("admin.homepage.showcase.showDesign")} fields={[]} tone="ghost" run={setEntryHomeHidden.bind(null, e.id, false)} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
