import Link from "next/link";
import { MyContestDesigns } from "@/components/dashboard/my-designs";
import type { CurrentUser } from "@/lib/auth/policies";
import { formatDate } from "@/lib/dates";
import { designerContests } from "@/lib/designers/profile";
import { getI18n } from "@/lib/i18n/server";
import type { Translate } from "@/lib/i18n/translate";
import { formatNumber } from "@/lib/money";
import { listNotifications } from "@/lib/notifications";
import { renderNotification } from "@/lib/notifications/render";
import { designerCheckUsage } from "@/lib/pro/logo-checks";
import { getProSettings } from "@/lib/pro/settings";
import { earlyContests, newContests, myContestRows, myInvitations, profileStrength, serviceNames, weekNumbers, type MiniContest } from "@/lib/pro/workspace";
import { durationText, Icon, Slot, type ProIconName } from "./parts";
import { ProWorkspace, WsHead } from "./workspace";
import { InviteResponse } from "./invite-response";

const ICON_OF: Record<string, { icon: ProIconName; cls: string }> = {
  newContest: { icon: "bolt", cls: "g" },
  reply: { icon: "chat", cls: "m" },
  comment: { icon: "chat", cls: "m" },
  winner: { icon: "trophy", cls: "w" },
  rating: { icon: "star", cls: "w" },
  ending: { icon: "clock", cls: "g" },
  money: { icon: "wallet", cls: "b" },
};

export function contestTypeLabel(c: Pick<MiniContest, "service" | "type">, t: Translate, names: Map<string, string>): string {
  return c.service && c.service !== "logo" ? (names.get(c.service) ?? c.service) : t(`wizard.businessTypes.${c.type}` as never);
}

/** "3 days" / "5h" left until a date (or "Ended"). */
export function leftText(end: Date | null, t: Translate): string {
  if (!end) return "—";
  const m = (end.getTime() - Date.now()) / 60_000;
  return m <= 0 ? t("pro.dash.ended") : durationText(m, t);
}

/**
 * The Pro dashboard (owner, 2026-10-13; Design/pro/pro-dashboard.html): early access, notifications, invitations, this
 * week's numbers, the Logo Checker, my contests and profile strength.
 */
export async function ProDashboard({ user }: { user: CurrentUser }) {
  const { t, locale, price } = await getI18n();
  const [{ settings }, earlyList, fresh, notes, invitations, week, usage, mine, strength, names, pictures] = await Promise.all([
    getProSettings(),
    earlyContests(),
    newContests(),
    listNotifications(user.id, 4),
    myInvitations(user.id),
    weekNumbers(user.id, user.username),
    designerCheckUsage(user.id),
    myContestRows(user.id),
    profileStrength(user.id, Boolean(user.avatarUrl)),
    serviceNames(locale),
    // Owner, 2026-10-16: every picture of my designs in each contest, as on the Basic dashboard.
    designerContests(user.id),
  ]);
  const picturesOf = new Map(pictures.map((c) => [c.slug, c]));
  const now = new Date();
  // Owner, 2026-10-16: with Pro early access off, the panel shows the newest contests instead.
  const earlyOn = settings.features.early_access && settings.earlyAccessMinutes > 0;
  const early = earlyOn ? earlyList : fresh;
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Dhaka" }).format(now));
  const greet = hour < 12 ? "pro.dash.morning" : hour < 17 ? "pro.dash.afternoon" : "pro.dash.evening";
  const first = user.name.trim().split(/\s+/)[0] ?? user.name;
  const n = (v: number) => formatNumber(v, locale);
  const unreadNotes = notes.filter((x) => !x.read).length;
  const ring = 2 * Math.PI * 64;

  return (
    <ProWorkspace user={user} active="dashboard">
      <WsHead
        title={t(greet, { name: first })}
        lead={t("pro.dash.lead")}
        action={
          <Link href="/dashboard/contests" className="pr-btn">
            <Icon name="search" />
            {t("pro.dash.find")}
          </Link>
        }
      />
      <div className="pr-g2">
        <section className="pr-early" aria-labelledby="pr-early">
          <span className="pr-blob b1" aria-hidden />
          <div className="h">
            <div>
              <span className="pr-kick">
                <Icon name="bolt" size={14} />
                {t(earlyOn ? "pro.dash.earlyKicker" : "pro.dash.newKicker")}
              </span>
              <h2 id="pr-early">
                {earlyOn
                  ? early.length === 0
                    ? t("pro.dash.earlyNone")
                    : early.length === 1
                      ? t("pro.dash.earlyOne")
                      : t("pro.dash.earlyTitle", { n: n(early.length) })
                  : early.length === 0
                    ? t("pro.dash.newNone")
                    : t("pro.dash.newTitle", { n: n(early.length) })}
              </h2>
              <p>{t(earlyOn ? "pro.dash.earlyLead" : "pro.dash.newLead")}</p>
            </div>
            <Link href={earlyOn ? "/dashboard/contests?f=early" : "/dashboard/contests"} className="pr-white">
              {t("pro.dash.seeAll")}
            </Link>
          </div>
          {early.slice(0, 3).map((c) => (
            <Link key={c.id} href={`/contest/${c.slug}`} className="pr-ei">
              <span className="pr-thumb" aria-hidden style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,.2)" }}>
                <Icon name="trophy" size={20} />
              </span>
              <div>
                <b>{c.brand ?? t("pro.contests.privateContest")}</b>
                <em>{t("pro.dash.contestLine", { type: contestTypeLabel(c, t, names), prize: price(c.prize), left: leftText(c.endsAt, t) })}</em>
              </div>
              {c.opensToAll && <span className="tm">{t("pro.dash.headStart", { time: durationText((c.opensToAll.getTime() - now.getTime()) / 60_000, t) })}</span>}
            </Link>
          ))}
        </section>
        <section className="pr-card" aria-labelledby="pr-notes">
          <div className="pr-ch">
            <h2 id="pr-notes">{t("pro.dash.notifications")}</h2>
            {unreadNotes > 0 && <span className="pr-new">{t("pro.dash.newN", { n: n(unreadNotes) })}</span>}
          </div>
          {notes.length === 0 && <p className="pr-empty">{t("pro.dash.noNotifications")}</p>}
          {notes.map((note) => {
            const shown = renderNotification(note, t, locale, now);
            const look = ICON_OF[shown.category] ?? { icon: "bell" as ProIconName, cls: "b" };
            return (
              <Link key={note.id} href={note.link ?? "/notifications"} className="pr-li" style={{ color: "inherit" }}>
                <span className={`pr-ic ${look.cls}`}>
                  <Icon name={look.icon} />
                </span>
                <div>
                  <em style={{ color: "var(--pr-ink)", fontWeight: note.read ? 500 : 700, whiteSpace: "normal" }}>{shown.text}</em>
                </div>
                <span className="pr-time">{shown.ago}</span>
              </Link>
            );
          })}
          <Link href="/notifications" className="pr-link" style={{ marginTop: "auto", paddingTop: 12 }}>
            {t("pro.dash.allNotifications")}
            <Icon name="arrow" size={16} />
          </Link>
        </section>
      </div>

      {settings.features.invitations && (
        <section className="pr-inv" aria-labelledby="pr-inv">
          <div className="pr-ch" style={{ marginBottom: 6 }}>
            <div>
              <h2 id="pr-inv">
                {t("pro.dash.invTitle")}
                {invitations.filter((i) => !i.joined && i.status === "pending").length > 0 && <span className="pr-new">{t("pro.dash.newN", { n: n(invitations.filter((i) => !i.joined && i.status === "pending").length) })}</span>}
              </h2>
              <p className="pr-hint" style={{ margin: "6px 0 0" }}>
                {t("pro.dash.invLead")}
              </p>
            </div>
          </div>
          {invitations.length === 0 && <p className="pr-empty" style={{ marginTop: 10 }}>{t("pro.dash.invNone")}</p>}
          {invitations.slice(0, 4).map((i) => (
            <div key={i.contest.id} className="pr-ivr">
              <span className="pr-thumb" aria-hidden style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "#8B0000" }}>
                <Icon name="invite" size={22} />
              </span>
              <div>
                <b>{i.contest.brand ?? t("pro.contests.privateContest")}</b>
                <em>{t("pro.dash.invLine", { prize: price(i.contest.prize), left: leftText(i.contest.endsAt, t) })}</em>
              </div>
              {/* Accept or decline (owner, 2026-10-14); the full brief is on the invitations page. */}
              <Link href={`/dashboard/invitations#${i.contest.id}`} className="pr-out sm">
                {t("pro.invitations.see")}
              </Link>
              {i.joined ? (
                <i className="pr-pill win">{t("pro.invitations.sent")}</i>
              ) : i.status === "pending" ? (
                <InviteResponse contestId={i.contest.id} status="pending" />
              ) : i.status === "accepted" ? (
                <Link href={`/contest/${i.contest.slug}/submit`} className="pr-btn sm">
                  {t("pro.dash.join")}
                </Link>
              ) : (
                <i className="pr-pill mu">{t("pro.invitations.status.declined")}</i>
              )}
            </div>
          ))}
          {invitations.length > 4 && (
            <Link href="/dashboard/invitations" className="pr-link" style={{ marginTop: 8 }}>
              {t("pro.invitations.all")}
            </Link>
          )}
          <div className="pr-ben">
            <span>
              <Icon name="check" size={14} strokeWidth={2.8} />
              {t("pro.dash.ben1")}
            </span>
            <span>
              <Icon name="check" size={14} strokeWidth={2.8} />
              {t(earlyOn ? "pro.dash.ben2" : "pro.dash.ben2Off")}
            </span>
            <span>
              <Icon name="check" size={14} strokeWidth={2.8} />
              {t("pro.dash.ben3")}
            </span>
          </div>
        </section>
      )}

      <div className="pr-k4">
        {(
          [
            ["eye", week.profileViews, "pro.dash.kProfile"],
            ["image", week.designViews, "pro.dash.kDesigns"],
            ["star", week.shortlists, "pro.dash.kShortlists"],
            ["trophy", week.wins, "pro.dash.kWins"],
          ] as const
        ).map(([icon, value, label]) => (
          <div key={label} className="pr-k">
            <div className="pr-kh">
              <span className="pr-ic m">
                <Icon name={icon} />
              </span>
            </div>
            <b>{n(value)}</b>
            <span>{t(label)}</span>
          </div>
        ))}
      </div>

      <section className="pr-lc">
        <span className="ic">
          <Icon name="shield" size={26} />
        </span>
        <div>
          <b>{t("pro.dash.checkerTitle", { n: n(usage.limit) })}</b>
          <em>
            {t("pro.dash.checkerLead")} <b>{t("pro.dash.checkerLeft", { left: n(usage.left), date: formatDate(usage.resetsOn, locale, "short") })}</b>
          </em>
          <Slot used={usage.used} max={usage.limit} />
        </div>
        <Link href="/dashboard/logo-checks" className="pr-btn">
          {t("pro.dash.check")}
        </Link>
      </section>

      <div className="pr-g2">
        <section className="pr-card" aria-labelledby="pr-mine">
          <div className="pr-ch">
            <h2 id="pr-mine">{t("pro.dash.myContests")}</h2>
          </div>
          {mine.length === 0 ? (
            <p className="pr-empty">{t("pro.dash.noContests")}</p>
          ) : (
            <div className="pr-tbl">
              <div className="pr-tr th">
                <span />
                <span>{t("pro.dash.hContest")}</span>
                <span>{t("pro.dash.hDesigns")}</span>
                <span>{t("pro.dash.hStatus")}</span>
                <span>{t("pro.dash.hEnds")}</span>
              </div>
              {mine.map((r) => {
                const p = picturesOf.get(r.contest.slug);
                const cover = p ? (p.winningLogoUrl ?? p.latestCoverUrl) : null;
                const brand = r.contest.brand ?? t("pro.contests.privateContest");
                return (
                  <div key={r.contest.id} className="pr-mc">
                    <div className="pr-tr">
                      <Link href={`/contest/${r.contest.slug}?tab=entries`} className="pr-thumb" aria-hidden tabIndex={-1} style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "#8B0000", position: "relative" }}>
                        {cover ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={cover} alt="" loading="lazy" />
                        ) : (
                          <Icon name={r.place === "won" ? "trophy" : "image"} size={20} />
                        )}
                      </Link>
                      <span className="n">
                        <Link href={`/contest/${r.contest.slug}?tab=entries`} style={{ color: "inherit" }}>
                          <b>{brand}</b>
                        </Link>
                        <em>
                          {contestTypeLabel(r.contest, t, names)} · {price(r.contest.prize)}
                        </em>
                      </span>
                      <span>{n(r.designs)}</span>
                      <span>
                        <i className={`pr-pill ${r.place === "won" ? "win" : r.place === "shortlisted" ? "sl" : r.place === "open" ? "op" : "mu"}`}>{t(`pro.dash.status.${r.place}`)}</i>
                      </span>
                      <span>{r.contest.status === "open" ? leftText(r.contest.endsAt, t) : t("pro.dash.ended")}</span>
                    </div>
                    {/* Hover for a quick view, click to open the design right here (owner, 2026-10-16). */}
                    {p && p.designs.length > 0 && <MyContestDesigns slug={r.contest.slug} brand={brand} designs={p.designs} open={p.open} className="pr-mc-strip" />}
                  </div>
                );
              })}
            </div>
          )}
        </section>
        <section className="pr-card" aria-labelledby="pr-strength">
          <div className="pr-ch">
            <h2 id="pr-strength">{t("pro.dash.strength")}</h2>
          </div>
          <div className="pr-ring">
            <svg viewBox="0 0 150 150" aria-hidden>
              <defs>
                <linearGradient id="pr-ring-g" x1="0" x2="1">
                  <stop offset="0" stopColor="#8B0000" />
                  <stop offset="1" stopColor="#D9A52B" />
                </linearGradient>
              </defs>
              <circle cx="75" cy="75" r="64" fill="none" stroke="#F1F1F5" strokeWidth="12" />
              <circle cx="75" cy="75" r="64" fill="none" stroke="url(#pr-ring-g)" strokeWidth="12" strokeLinecap="round" strokeDasharray={`${(ring * strength.percent) / 100} ${ring}`} />
            </svg>
            <b>{n(strength.percent)}%</b>
          </div>
          <div className="pr-chk">
            {(
              [
                [strength.photoBio, "pro.dash.sPhoto"],
                [strength.featured, "pro.dash.sFeatured"],
                [strength.skills, "pro.dash.sSkills"],
                [strength.cover, "pro.dash.sCover"],
              ] as const
            ).map(([ok, label]) => (
              <span key={label} className={ok ? "ok" : undefined}>
                <Icon name={ok ? "check" : "x"} size={16} strokeWidth={2.6} />
                {t(label)}
              </span>
            ))}
          </div>
          {strength.percent < 100 ? (
            <Link href="/dashboard/profile#extras" className="pr-out" style={{ marginTop: "auto" }}>
              {t("pro.dash.finish")}
            </Link>
          ) : (
            <p className="pr-mut">{t("pro.dash.allDone")}</p>
          )}
        </section>
      </div>
    </ProWorkspace>
  );
}
