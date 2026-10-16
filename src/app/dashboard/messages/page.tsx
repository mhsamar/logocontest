/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ChatThread } from "@/components/pro/chat-thread";
import { Icon, SmallAvatar } from "@/components/pro/parts";
import { ProWorkspace, WsHead } from "@/components/pro/workspace";
import { PageShell } from "@/components/ui/panel";
import { SmallPageHeader } from "@/components/ui/section-heading";
import "@/components/pro/pro.css";
import "@/components/pro/go-pro.css";
import { getCurrentUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { chatContext, chatMessages, chatThreads } from "@/lib/pro/chat";
import { getProSettings } from "@/lib/pro/settings";
import { isPro } from "@/lib/pro/status";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("pro.chat.title"), robots: { index: false } };
}

// Contest chat (owner, 2026-10-13; Design/pro/pro-messages.html): a client and a Pro designer, about one design in one
// contest only. Pro designers see it in the Pro workspace; clients on their dashboard. No hiring, no other chats.
export default async function MessagesPage({ searchParams }: PageProps<"/dashboard/messages">) {
  const [{ t, locale }, user, sp] = await Promise.all([getI18n(), getCurrentUser(), searchParams]);
  if (!user) redirect("/login?next=%2Fdashboard%2Fmessages");
  if (user.role !== "client" && user.role !== "designer") redirect("/dashboard");
  // Premium client workspace (owner, 2026-10-16): the client's messages are at /client/messages.
  if (user.role === "client") redirect(typeof sp.entry === "string" ? `/client/messages?entry=${encodeURIComponent(sp.entry)}` : "/client/messages");
  const { settings, ready } = await getProSettings();
  const pro = user.role === "designer" && (await isPro(user.id));
  if (user.role === "designer" && !pro) redirect("/pro");
  if (!ready || !settings.features.client_chat) redirect("/dashboard");

  const threads = await chatThreads(user);
  const wanted = typeof sp.entry === "string" ? sp.entry : (threads[0]?.entryId ?? null);
  const ctx = wanted ? await chatContext(wanted, user) : null;
  const messages = ctx ? await chatMessages(ctx, user.id) : [];
  const ago = (iso: string) => {
    const m = (new Date().getTime() - new Date(iso).getTime()) / 60_000;
    const f = (v: number) => new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US").format(v);
    return m < 60 ? t("pro.insights.minutes", { n: f(Math.max(1, Math.round(m))) }) : m < 1440 ? t("pro.insights.hours", { n: f(Math.round(m / 60)) }) : t("pro.insights.days", { n: f(Math.round(m / 1440)) });
  };
  // A thread that was just opened from a design has no messages yet: show it at the top of the list.
  const list = ctx && !threads.some((x) => x.entryId === ctx.entryId) ? [{ entryId: ctx.entryId, entryNumber: ctx.entryNumber, brand: ctx.brand, contestSlug: ctx.contestSlug, other: { id: ctx.other.id, name: ctx.other.name, avatarUrl: ctx.other.avatarUrl }, last: "", lastAt: new Date().toISOString(), unread: 0 }, ...threads] : threads;

  const chat: ReactNode = (
    <section className="pr-chat">
      <div className="pr-cl">
        {list.length === 0 && <p className="pr-empty">{t("pro.chat.empty")}</p>}
        {list.map((th) => (
          <Link key={th.entryId} href={`/dashboard/messages?entry=${th.entryId}`} className={`pr-cv${ctx?.entryId === th.entryId ? " on" : ""}`} aria-current={ctx?.entryId === th.entryId ? "true" : undefined}>
            <SmallAvatar name={th.other.name} url={th.other.avatarUrl} />
            <div>
              <b>{th.other.name}</b>
              <em>{th.last || t("pro.chat.about", { brand: th.brand, n: th.entryNumber })}</em>
            </div>
            <span className="r">
              {th.last && <span>{ago(th.lastAt)}</span>}
              {th.unread > 0 && <i>{th.unread}</i>}
            </span>
          </Link>
        ))}
      </div>
      <div className="pr-th">
        {ctx ? (
          <>
            <div className="pr-thh">
              <SmallAvatar name={ctx.other.name} url={ctx.other.avatarUrl} />
              <div>
                <b>{ctx.other.name}</b>
                <em className={ctx.other.online ? "on" : undefined}>
                  {ctx.other.online ? t("pro.chat.online") : null}
                  {ctx.other.business ? `${ctx.other.online ? " · " : ""}${ctx.other.business}` : null}
                </em>
              </div>
              <Link href={`/contest/${ctx.contestSlug}?tab=entries&entry=${ctx.entryNumber}`} className="pr-out sm">
                {t("pro.chat.viewContest")}
              </Link>
            </div>
            <div style={{ padding: "12px 18px 0", background: "#FBFBFC", display: "flex", justifyContent: "center" }}>
              <div className="pr-ctx">
                {ctx.thumb ? <img src={ctx.thumb} alt="" className="pr-thumb" style={{ width: 56, height: 42 }} /> : <Icon name="image" />}
                <div>
                  <span className="pr-kick dk">{t("pro.chat.kicker")}</span>
                  <b>{t("pro.chat.about", { brand: ctx.brand, n: ctx.entryNumber })}</b>
                  <p>{t("pro.chat.note")}</p>
                </div>
              </div>
            </div>
            <ChatThread entryId={ctx.entryId} messages={messages} />
          </>
        ) : (
          <div className="pr-nochat">{list.length ? t("pro.chat.pick") : t("pro.chat.emptyDesigner")}</div>
        )}
      </div>
    </section>
  );

  if (pro)
    return (
      <ProWorkspace user={user} active="messages">
        <WsHead title={t("pro.chat.title")} lead={t("pro.chat.lead")} />
        {chat}
      </ProWorkspace>
    );
  return (
    <PageShell>
      <SmallPageHeader title={t("pro.chat.title")} sub={t("pro.chat.clientLead")} back={{ href: "/dashboard", label: t("nav.dashboard") }} />
      <div className="pr">{chat}</div>
    </PageShell>
  );
}
