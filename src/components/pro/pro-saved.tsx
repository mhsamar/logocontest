import Link from "@/components/ui/link";
import type { CurrentUser } from "@/lib/auth/policies";
import { getI18n } from "@/lib/i18n/server";
import { formatNumber } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { contestsByIdsMini, serviceNames } from "@/lib/pro/workspace";
import { durationText, Icon } from "./parts";
import { RemindToggle } from "./pref-toggles";
import { contestTypeLabel } from "./pro-dashboard";
import { ProWorkspace, WsHead } from "./workspace";

/** Pro › Saved (owner, 2026-10-13; Design/pro/pro-saved.html): saved contests by end time, each with "Remind me". */
export async function ProSaved({ user }: { user: CurrentUser }) {
  const { t, locale, price } = await getI18n();
  const { data: favs } = await createAdminClient().from("contest_favorites").select("contest_id, remind").eq("user_id", user.id).limit(500);
  const remind = new Map((favs ?? []).map((f) => [f.contest_id as string, f.remind !== false]));
  const [contests, names] = await Promise.all([contestsByIdsMini([...remind.keys()]), serviceNames(locale)]);
  const now = new Date().getTime();
  const list = contests
    .filter((c) => ["open", "judging"].includes(c.status))
    .sort((a, b) => (a.endsAt?.getTime() ?? Infinity) - (b.endsAt?.getTime() ?? Infinity));
  const n = (v: number) => formatNumber(v, locale);
  // When saved-contest reminders go (Admin › Notifications, owner 2026-10-15).
  const savedHours = (await getSettings(["notify.saved_reminder_hours"]))["notify.saved_reminder_hours"];
  return (
    <ProWorkspace user={user} active="saved">
      <WsHead title={t("pro.saved.title")} lead={t("pro.saved.lead")} />
      <section className="pr-card">
        <div className="pr-ch">
          <h2>{t("pro.saved.count", { n: n(list.length) })}</h2>
          <span className="pr-mut">{t("pro.saved.sorted")}</span>
        </div>
        {list.length === 0 && <p className="pr-empty">{t("pro.saved.empty")}</p>}
        {list.map((c) => {
          const left = c.endsAt ? (c.endsAt.getTime() - now) / 60_000 : null;
          const open = c.status === "open" && left !== null && left > 0;
          return (
            <div key={c.id} className="pr-sv">
              <span className="pr-thumb" aria-hidden style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "#8B0000" }}>
                <Icon name={c.isPrivate ? "lock" : "trophy"} size={22} />
              </span>
              <div>
                <b>{c.brand ?? t("pro.contests.privateContest")}</b>
                <em>{t(c.entries === 1 ? "pro.saved.lineOne" : "pro.saved.line", { type: contestTypeLabel(c, t, names), prize: price(c.prize), n: n(c.entries) })}</em>
              </div>
              <div className="when">
                <span className={open && left! < 24 * 60 ? "hot" : undefined}>{open ? t("pro.saved.endsIn", { time: durationText(left!, t) }) : t("pro.saved.ended")}</span>
                {open && <RemindToggle contestId={c.id} on={remind.get(c.id) ?? true} label={t("pro.saved.remind")} />}
              </div>
              {open ? (
                <Link href={`/contest/${c.slug}/submit`} className="pr-btn sm">
                  {t("pro.contests.send")}
                </Link>
              ) : (
                <Link href={`/contest/${c.slug}`} className="pr-out sm">
                  {t("pro.contests.open")}
                </Link>
              )}
            </div>
          );
        })}
      </section>
      <div className="pr-g3">
        <section className="pr-card pr-mini">
          <span className="pr-ic g">
            <Icon name="clock" />
          </span>
          <b>{t("pro.saved.timesTitle")}</b>
          <p>{t("pro.saved.times", { times: savedHours.map((h) => (h === 1 ? t("pro.time.h1") : t("pro.time.hn", { n: n(h) }))).join(` ${t("pro.saved.and")} `) })}</p>
        </section>
        <section className="pr-card pr-mini">
          <span className="pr-ic m">
            <Icon name="bell" />
          </span>
          <b>{t("pro.saved.similarTitle")}</b>
          <p>{t("pro.saved.similar")}</p>
        </section>
        <section className="pr-card pr-mini">
          <span className="pr-ic w">
            <Icon name="heart" />
          </span>
          <b>{t("pro.saved.noLimitTitle")}</b>
          <p>{t("pro.saved.noLimit")}</p>
        </section>
      </div>
    </ProWorkspace>
  );
}
