import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { InviteResponse } from "@/components/pro/invite-response";
import { Icon } from "@/components/pro/parts";
import { contestTypeLabel, leftText } from "@/components/pro/pro-dashboard";
import { ProWorkspace, WsHead } from "@/components/pro/workspace";
import { getCurrentUser } from "@/lib/auth/session";
import { formatDate } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import { formatTaka } from "@/lib/money";
import { isPro } from "@/lib/pro/status";
import { myInvitations, serviceNames } from "@/lib/pro/workspace";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("pro.invitations.title"), robots: { index: false } };
}

// Pro › Contest invitations (owner, 2026-10-14): each invitation with the brief, the prize, the deadline and the
// client's requirements, and Accept / Decline. Only to take part in the contest: no hiring, and no chat until the
// designer sends a design.
export default async function InvitationsPage() {
  const [{ t, locale }, user] = await Promise.all([getI18n(), getCurrentUser()]);
  if (!user) redirect("/login?as=designer&next=%2Fdashboard%2Finvitations");
  if (user.role !== "designer" || !(await isPro(user.id))) redirect("/dashboard");
  const [invitations, names] = await Promise.all([myInvitations(user.id), serviceNames(locale)]);
  const tone = { pending: "op", accepted: "win", declined: "mu" } as const;

  return (
    <ProWorkspace user={user} active="dashboard">
      <WsHead title={t("pro.invitations.title")} lead={t("pro.invitations.lead")} />
      <p className="pr-hint" style={{ margin: "0 0 14px" }}>
        {t("pro.invitations.rule")}
      </p>
      {invitations.length === 0 && <p className="pr-empty">{t("pro.invitations.none")}</p>}
      {invitations.map((i) => (
        <section key={i.contest.id} id={i.contest.id} className="pr-card" style={{ marginBottom: 14, scrollMarginTop: 120 }} aria-labelledby={`inv-${i.contest.id}`}>
          <div className="pr-ch">
            <div>
              <h2 id={`inv-${i.contest.id}`}>{i.contest.brand ?? t("pro.contests.privateContest")}</h2>
              <p className="pr-hint" style={{ margin: "4px 0 0" }}>
                {contestTypeLabel(i.contest, t, names)}
              </p>
            </div>
            <i className={`pr-pill ${tone[i.status]}`}>{t(`pro.invitations.status.${i.status}`)}</i>
          </div>
          <dl className="pr-g3" style={{ margin: "10px 0 0" }}>
            <div className="pr-mini">
              <dt className="pr-hint">{t("pro.invitations.prize")}</dt>
              <dd style={{ margin: 0, fontWeight: 800, fontSize: 20 }}>{formatTaka(i.contest.prize, locale)}</dd>
            </div>
            <div className="pr-mini">
              <dt className="pr-hint">{t("pro.invitations.ends")}</dt>
              <dd style={{ margin: 0, fontWeight: 800 }}>
                {i.contest.endsAt ? formatDate(i.contest.endsAt, locale, "long") : "—"} · {leftText(i.contest.endsAt, t)}
              </dd>
            </div>
            <div className="pr-mini">
              <dt className="pr-hint">{t("pro.invitations.type")}</dt>
              <dd style={{ margin: 0, fontWeight: 800 }}>{contestTypeLabel(i.contest, t, names)}</dd>
            </div>
          </dl>
          {i.brief ? (
            <dl style={{ margin: "12px 0 0", display: "grid", gap: 10 }}>
              {(
                [
                  ["brief", i.brief.description],
                  ["logoText", i.brief.logoText],
                  ["slogan", i.brief.slogan],
                  ["likes", i.brief.likes],
                  ["dislikes", i.brief.dislikes],
                ] as const
              )
                .filter(([, v]) => v && v.trim())
                .map(([k, v]) => (
                  <div key={k}>
                    <dt className="pr-hint" style={{ fontWeight: 700 }}>
                      {t(`pro.invitations.${k}`)}
                    </dt>
                    <dd style={{ margin: "2px 0 0", whiteSpace: "pre-line" }}>{v}</dd>
                  </div>
                ))}
            </dl>
          ) : (
            <p className="pr-hint" style={{ margin: "12px 0 0" }}>
              <Icon name="lock" size={14} /> {t("pro.invitations.nda")}
            </p>
          )}
          {i.respondedAt && i.status !== "pending" && (
            <p className="pr-hint" style={{ margin: "12px 0 0" }}>
              {t(i.status === "accepted" ? "pro.invitations.acceptedLine" : "pro.invitations.declinedLine", { date: formatDate(new Date(i.respondedAt), locale, "long") })}
            </p>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 14 }}>
            {i.joined ? <i className="pr-pill win">{t("pro.invitations.sent")}</i> : <InviteResponse contestId={i.contest.id} status={i.status} />}
            <Link href={`/contest/${i.contest.slug}?tab=brief`} className="pr-out sm">
              {t("pro.invitations.open")}
            </Link>
            {i.status !== "declined" && (
              <Link href={`/contest/${i.contest.slug}/submit`} className="pr-btn sm">
                {t("pro.invitations.send")}
              </Link>
            )}
          </div>
        </section>
      ))}
    </ProWorkspace>
  );
}
