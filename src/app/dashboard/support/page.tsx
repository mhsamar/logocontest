import type { Metadata } from "next";
import Link from "@/components/ui/link";
import { redirect } from "next/navigation";
import { Icon } from "@/components/pro/parts";
import { ProWorkspace, WsHead } from "@/components/pro/workspace";
import { getCurrentUser } from "@/lib/auth/session";
import { getContact } from "@/lib/content/contact";
import { timeAgo } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import { formatNumber } from "@/lib/money";
import { getProSettings } from "@/lib/pro/settings";
import { isPro } from "@/lib/pro/status";
import { getSetting } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { myConversation } from "@/lib/support/queries";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("pro.support.title"), robots: { index: false } };
}

// Pro › Priority support (owner, 2026-10-13; Design/pro/pro-priority-support.html): the support chat (Pro chats go to
// the top of the admin inbox), WhatsApp, call and email, the designer's own support chat, and quick answers.
export default async function PrioritySupportPage() {
  const [{ t, locale }, user] = await Promise.all([getI18n(), getCurrentUser()]);
  if (!user) redirect("/login?as=designer&next=%2Fdashboard%2Fsupport");
  const { settings } = await getProSettings();
  if (user.role !== "designer" || !(await isPro(user.id)) || !settings.features.priority_support) redirect("/support");
  const since = new Date(new Date().getTime() - 5 * 60_000).toISOString();
  const [contact, whatsapp, chat, { data: online }] = await Promise.all([
    getContact(locale),
    getSetting("contact.whatsapp"),
    myConversation(user.id),
    createAdminClient().from("presence").select("user_id, user:profiles!user_id(role)").gte("updated_at", since).not("user_id", "is", null).limit(200),
  ]);
  const team = new Set((online ?? []).filter((p) => ((Array.isArray(p.user) ? p.user[0] : p.user) as { role?: string } | null)?.role === "admin").map((p) => p.user_id as string)).size;
  const n = (v: number) => formatNumber(v, locale);
  const thread = chat.thread;
  const status = !thread ? null : thread.status === "closed" ? "closed" : thread.unreadByUser > 0 || chat.messages.at(-1)?.fromAdmin ? "answered" : "open";
  const quick: [string, string][] = [
    // "How Pro early access works" only while early access is on (owner, 2026-10-16: it is off).
    ...(settings.features.early_access && settings.earlyAccessMinutes > 0 ? ([["pro.support.q1", "/pro"]] as [string, string][]) : []),
    ["pro.support.q2", "/dashboard/logo-checks"],
    ["pro.support.q3", "/pro"],
    ["pro.support.q4", "/dashboard/profile#subscription"],
    ["pro.support.q5", "/legal/payment-refund"],
    ["pro.support.q6", "/legal/designer-rules"],
  ];

  return (
    <ProWorkspace user={user} active="support">
      <WsHead title={t("pro.support.title")} lead={t("pro.support.lead")} />
      <section className="pr-early">
        <span className="pr-blob b1" aria-hidden />
        <span className="pr-blob b2" aria-hidden />
        <div className="h">
          <div>
            <span className="pr-kick">
              <Icon name="crown" size={14} />
              {t("pro.support.kicker")}
            </span>
            <h2>{t("pro.support.heroTitle")}</h2>
            <p>{t("pro.support.heroLead")}</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10 }}>
            <Link href="/support" className="pr-white">
              <Icon name="chat" />
              {t("pro.support.chat")}
            </Link>
            {team > 0 && <span style={{ fontSize: 13.5, fontWeight: 700 }}>{team === 1 ? t("pro.support.onlineOne") : t("pro.support.online", { n: n(team) })}</span>}
          </div>
        </div>
      </section>
      <div className="pr-g3">
        <section className="pr-card pr-mini">
          <span className="pr-ic m">
            <Icon name="chat" />
          </span>
          <b>{t("pro.support.whatsapp")}</b>
          <p>{t("pro.support.whatsappSub")}</p>
          <a href={`https://wa.me/88${whatsapp}`} target="_blank" rel="noopener" className="pr-out sm" style={{ alignSelf: "flex-start" }}>
            {t("pro.support.whatsappGo")}
          </a>
        </section>
        <section className="pr-card pr-mini">
          <span className="pr-ic w">
            <Icon name="phone" />
          </span>
          <b>{t("pro.support.call")}</b>
          <p>{t("pro.support.callSub")}</p>
          <a href={contact.phoneHref} className="pr-out sm" style={{ alignSelf: "flex-start" }}>
            {t("pro.support.callGo", { phone: contact.phone })}
          </a>
        </section>
        <section className="pr-card pr-mini">
          <span className="pr-ic g">
            <Icon name="mail" />
          </span>
          <b>{t("pro.support.mail")}</b>
          <p>{t("pro.support.mailSub")}</p>
          {contact.email && (
            <a href={`mailto:${contact.email}`} className="pr-out sm" style={{ alignSelf: "flex-start" }}>
              {t("pro.support.mailGo")}
            </a>
          )}
        </section>
      </div>
      <div className="pr-g2">
        <section className="pr-card">
          <div className="pr-ch">
            <h2>{t("pro.support.myTickets")}</h2>
          </div>
          {!thread ? (
            <p className="pr-empty">{t("pro.support.noTickets")}</p>
          ) : (
            <Link href="/support" className="pr-li" style={{ color: "inherit" }}>
              <span className="pr-ic g">
                <Icon name="chat" />
              </span>
              <div>
                <b>{chat.messages.at(-1)?.body ?? t("pro.support.myTickets")}</b>
                <em>{t("pro.support.lastMessage", { when: timeAgo(new Date(thread.lastMessageAt), new Date(), locale) })}</em>
              </div>
              <i className={`pr-pill ${status === "closed" ? "win" : status === "answered" ? "op" : "sl"}`}>{t(`pro.support.status.${status!}`)}</i>
            </Link>
          )}
        </section>
        <section className="pr-card">
          <div className="pr-ch">
            <h2>{t("pro.support.quick")}</h2>
          </div>
          {quick.map(([key, href]) => (
            <Link key={key} href={href} className="pr-li" style={{ color: "inherit" }}>
              <div>
                <b>{t(key as never)}</b>
              </div>
              <Icon name="arrow" size={16} />
            </Link>
          ))}
        </section>
      </div>
    </ProWorkspace>
  );
}
