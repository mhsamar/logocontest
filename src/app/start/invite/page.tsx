import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { InvitePicker } from "@/components/pro/invite-picker";
import { Icon } from "@/components/pro/parts";
import { PageShell } from "@/components/ui/panel";
import "@/components/pro/pro.css";
import "@/components/pro/go-pro.css";
import { getCurrentUser } from "@/lib/auth/session";
import { isSkillKey } from "@/lib/designers/portfolio-options";
import { getI18n } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { formatNumber } from "@/lib/money";
import { inviteCandidates } from "@/lib/pro/invites";
import { getProSettings } from "@/lib/pro/settings";
import { serviceNames } from "@/lib/pro/workspace";
import { createAdminClient } from "@/lib/supabase/admin";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("pro.invite.metaTitle"), robots: { index: false } };
}

const UUID = /^[0-9a-f-]{36}$/i;

// Contest creation, step "Invite Pro designers" (owner, 2026-10-13; Design/pro/client-invite-pro-designers.html):
// optional, between the brief/prize steps and Pay & publish. Skip goes straight on to paying.
export default async function InviteProPage({ searchParams }: PageProps<"/start/invite">) {
  const sp = await searchParams;
  const draftId = typeof sp.draft === "string" && UUID.test(sp.draft) ? sp.draft : null;
  if (!draftId) redirect("/start");
  const [{ t, locale, price }, user, { settings, ready }] = await Promise.all([getI18n(), getCurrentUser(), getProSettings()]);
  // Opened from onboarding v2's brief after paying (owner, 2026-10-29): it goes back there, and has no pay step.
  const fromHub = sp.from === "hub";
  if (!user) redirect(`/login?as=client&next=${encodeURIComponent(`/start/invite?draft=${draftId}${fromHub ? "&from=hub" : ""}`)}`);
  const data = await inviteCandidates(draftId);
  // Only the client who owns this draft.
  if (!data || user.role !== "client" || data.contest.clientId !== user.id) redirect("/start");
  const { contest } = data;
  const isLogo = contest.service === "logo";
  const next = fromHub ? `/start-v2/brief?c=${draftId}` : `/start?draft=${draftId}&step=${isLogo ? "11" : "pay"}`;
  if (!ready || !settings.features.invitations || !["draft", "pending_payment", "open"].includes(contest.status)) redirect(next);
  const [names, { data: notified }] = await Promise.all([serviceNames(locale), createAdminClient().from("contest_invites").select("designer_id").eq("contest_id", draftId).not("notified_at", "is", null)]);
  const sent = (notified ?? []).map((r) => r.designer_id as string);
  const n = (v: number) => formatNumber(v, locale);
  const skillKeys = [...new Set(data.list.flatMap((d) => d.skills))];
  const typeKeys = [...new Set(data.list.flatMap((d) => d.types))].slice(0, 8);
  const typeLabel = (k: string) => names.get(k) ?? t(`wizard.businessTypes.${k}` as MessageKey);

  return (
    <PageShell>
      <div className="pr" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {!fromHub && (
          <ol className="iv-steps">
            <li className="done">
              <i>
                <Icon name="check" size={14} strokeWidth={3} />
              </i>
              {t("pro.invite.steps.brief")}
            </li>
            <li className="done">
              <i>
                <Icon name="check" size={14} strokeWidth={3} />
              </i>
              {t("pro.invite.steps.prize")}
            </li>
            <li className="on" aria-current="step">
              <i>3</i>
              {t("pro.invite.steps.invite")}
            </li>
            <li>
              <i>4</i>
              {t("pro.invite.steps.pay")}
            </li>
          </ol>
        )}
        <div className="pr-head">
          <div>
            <div className="t">
              <h1>{t("pro.invite.title")}</h1>
              <span className="pr-pill mu">{t("pro.invite.optional")}</span>
            </div>
            <p>{t("pro.invite.lead")}</p>
          </div>
          <div className="iv-ctx">
            <span className="pr-ic m">
              <Icon name="trophy" />
            </span>
            <div>
              <b>{contest.brand}</b>
              <em>{t("pro.invite.contestLine", { type: isLogo ? (names.get("logo") ?? "Logo") : typeLabel(contest.service), prize: price(contest.prize), days: n(contest.days) })}</em>
            </div>
          </div>
        </div>
        {data.list.length === 0 ? (
          <div className="pr-card" style={{ alignItems: "center", gap: 14 }}>
            <p className="pr-empty" style={{ width: "100%" }}>
              {t("pro.invite.none")}
            </p>
            <a href={next} className="pr-btn">
              {t("pro.invite.skip")}
            </a>
          </div>
        ) : (
          <InvitePicker
            contestId={contest.id}
            list={data.list}
            sent={sent}
            max={settings.invitesPerContest}
            skills={skillKeys.map((k) => ({ key: k, label: isSkillKey(k) ? t(`portfolio.skills.${k}`) : k }))}
            types={typeKeys.map((k) => ({ key: k, label: typeLabel(k) }))}
            next={next}
          />
        )}
      </div>
    </PageShell>
  );
}
