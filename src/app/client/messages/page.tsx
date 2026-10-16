import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ClientAvatar } from "@/components/client/avatar-menu";
import { ClientChat } from "@/components/client/chat";
import { CwIcon } from "@/components/client/icons";
import { CheckChip, Empty, Picture, ProChip, Stars } from "@/components/client/parts";
import { RateStars, ShortlistButton } from "@/components/client/review-buttons";
import { ClientShell } from "@/components/client/shell";
import { getCurrentUser } from "@/lib/auth/session";
import { agoParts, contestHref } from "@/lib/client/rules";
import { judgedEntries } from "@/lib/client/workspace";
import { getContestBySlug } from "@/lib/contests/browse";
import { isFinished } from "@/lib/contests/public-statuses";
import { formatDate } from "@/lib/dates";
import { designerById } from "@/lib/designers/profile";
import { designerProfileData } from "@/lib/designers/public-profile";
import { getI18n } from "@/lib/i18n/server";
import { formatNumber } from "@/lib/money";
import { chatContext, chatMessages, chatThreads } from "@/lib/pro/chat";
import { getProSettings } from "@/lib/pro/settings";
import { proIdsAmong, proKind, trialIdsAmong } from "@/lib/pro/status";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("cw.chat.metaTitle"), robots: { index: false } };
}

// Premium client workspace › Messages (owner, 2026-10-16; Design/client-premium/client-messages.html): chats grouped by
// contest, the thread with the design it is about, and the designer's details. The chat itself is the existing contest
// chat: only the contest's client and a designer who sent a design to that contest (and, as before, a Pro designer who
// takes client messages).
export default async function ClientMessagesPage({ searchParams }: PageProps<"/client/messages">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?as=client&next=%2Fclient%2Fmessages");
  if (user.role !== "client") redirect("/dashboard/messages");
  const sp = await searchParams;
  const [{ t, locale }, { settings, ready }] = await Promise.all([getI18n(), getProSettings()]);
  const chatOn = ready && settings.features.client_chat;
  const q = (typeof sp.q === "string" ? sp.q : "").trim().toLowerCase();
  const onlyContest = typeof sp.contest === "string" ? sp.contest : null;

  const all = chatOn ? await chatThreads(user) : [];
  const wanted = typeof sp.entry === "string" ? sp.entry : (all.find((x) => !onlyContest || x.contestSlug === onlyContest)?.entryId ?? null);
  const ctx = chatOn && wanted ? await chatContext(wanted, user) : null;
  const messages = ctx ? await chatMessages(ctx, user.id) : [];
  // A chat just opened from a design has no messages yet: it shows at the top.
  const threads = ctx && !all.some((x) => x.entryId === ctx.entryId) ? [{ entryId: ctx.entryId, entryNumber: ctx.entryNumber, brand: ctx.brand, contestSlug: ctx.contestSlug, other: { id: ctx.designerId, name: ctx.other.name, avatarUrl: ctx.other.avatarUrl }, last: "", lastAt: new Date().toISOString(), unread: 0 }, ...all] : all;
  const shown = threads.filter((x) => (!onlyContest || x.contestSlug === onlyContest) && (!q || x.other.name.toLowerCase().includes(q) || x.brand.toLowerCase().includes(q)));
  const groups = [...new Set(shown.map((x) => x.contestSlug))].map((slug) => ({ slug, brand: shown.find((x) => x.contestSlug === slug)!.brand, list: shown.filter((x) => x.contestSlug === slug) }));
  const [pro, trial] = await Promise.all([proIdsAmong(shown.map((x) => x.other.id)), trialIdsAmong(shown.map((x) => x.other.id))]);

  // The designer's details and their designs in this contest.
  const contest = ctx ? await getContestBySlug(ctx.contestSlug, user) : null;
  const theirs = ctx && contest ? (await judgedEntries({ id: contest.id, ownerId: contest.ownerId, isBlind: contest.isBlind, status: contest.status, winnerIsPublic: contest.winnerIsPublic }, user)).filter((e) => e.designerId === ctx.designerId) : [];
  const current = theirs.find((e) => e.id === ctx?.entryId) ?? null;
  const designer = ctx ? await designerById(ctx.designerId) : null;
  const kind = ctx ? await proKind(ctx.designerId) : null;
  const stats = designer ? (await designerProfileData({ id: designer.id, username: designer.username, avatarUrl: designer.avatarUrl, winsCount: designer.stats.wins, skills: designer.skills, tools: designer.tools })).stats : null;
  const num = (n: number) => formatNumber(n, locale);
  const now = new Date();
  const ago = (iso: string) => {
    const p = agoParts(new Date(iso), now);
    return t(`cw.time.ago.${p.unit}`, { n: num(p.n) });
  };
  const canReview = contest ? (contest.status === "open" || contest.status === "judging") && !isFinished(contest.rawStatus) : false;
  const profileHref = designer ? (kind ? `/designer/${designer.username}` : `/d/${designer.username}`) : null;
  const files = messages.filter((m) => m.file).length;

  return (
    <ClientShell user={user} active="messages">
      <div className="phd2">
        <div>
          <div className="dnl">
            <h1>{t("cw.menu.messages")}</h1>
          </div>
          <p>{t("cw.chat.lead")}</p>
        </div>
      </div>

      {!chatOn ? (
        <Empty title={t("cw.chat.off")} />
      ) : (
        <section className="pchat cch">
          {/* Chats, grouped by contest */}
          <div className="pcl">
            <form action="/client/messages" className="psr" role="search">
              {onlyContest && <input type="hidden" name="contest" value={onlyContest} />}
              <CwIcon name="search" />
              <input type="search" name="q" defaultValue={q} placeholder={t("cw.chat.search")} aria-label={t("cw.chat.search")} />
            </form>
            {onlyContest && (
              <Link href="/client/messages" className="dlink sm">
                {t("cw.chat.allContests")}
              </Link>
            )}
            {groups.length === 0 && <p className="dempty">{t(threads.length ? "cw.chat.noMatch" : "cw.chat.none")}</p>}
            {groups.map((g) => (
              <div key={g.slug} className="cgp" data-chat-group={g.slug}>
                <span>{t("cw.chat.contest", { brand: g.brand })}</span>
                {g.list.map((th) => (
                  <Link key={th.entryId} href={`/client/messages?entry=${th.entryId}${onlyContest ? `&contest=${onlyContest}` : ""}`} className={`pcv${ctx?.entryId === th.entryId ? " on" : ""}`} aria-current={ctx?.entryId === th.entryId ? "true" : undefined} data-thread={th.entryId}>
                    <span className="psav sm">
                      <span className="dring" />
                      <ClientAvatar name={th.other.name} url={th.other.avatarUrl} />
                    </span>
                    <div>
                      <b>
                        {th.other.name} {pro.has(th.other.id) && <ProChip trial={trial.has(th.other.id)} t={t} />}
                      </b>
                      <em>{th.last || t("pro.chat.about", { brand: th.brand, n: th.entryNumber })}</em>
                    </div>
                    <span className="pct">
                      {th.last && <em>{ago(th.lastAt)}</em>}
                      {th.unread > 0 && <i>{num(th.unread)}</i>}
                    </span>
                  </Link>
                ))}
              </div>
            ))}
          </div>

          {/* The thread */}
          <div className="pth">
            {ctx ? (
              <>
                <div className="pthh">
                  <span className="psav sm">
                    <span className="dring" />
                    <ClientAvatar name={ctx.other.name} url={ctx.other.avatarUrl} />
                  </span>
                  <div>
                    <b>
                      {ctx.other.name} {kind && <ProChip trial={kind === "trial"} t={t} />}
                    </b>
                    {ctx.other.online && (
                      <em className="on">
                        <b />
                        {t("pro.chat.online")}
                      </em>
                    )}
                  </div>
                  <Link href={contestHref(ctx.contestSlug, "designs", { entry: ctx.entryNumber })} className="dout sm">
                    {t("cw.chat.viewEntry", { n: num(ctx.entryNumber) })}
                  </Link>
                </div>
                <ClientChat
                  entryId={ctx.entryId}
                  messages={messages}
                  context={
                    <div className="cctx" data-entry-context>
                      <span className="peth">
                        <Picture url={ctx.thumb} name={ctx.brand} />
                      </span>
                      <div>
                        <b>{t("cw.chat.entry", { n: num(ctx.entryNumber), brand: ctx.brand })}</b>
                        <em style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                          {current && <CheckChip badge={current.badge} t={t} />}
                          <span>{t("cw.chat.yourRating")}</span>
                          <Stars rating={current?.rating ?? null} />
                        </em>
                      </div>
                      <Link href={contestHref(ctx.contestSlug, "designs", { entry: ctx.entryNumber })} className="dlink sm">
                        {t("cw.home.open")}
                      </Link>
                    </div>
                  }
                />
              </>
            ) : (
              <div className="dempty" style={{ margin: 22 }}>
                <b>{threads.length ? t("cw.chat.pick") : t("cw.chat.none")}</b>
                {t("cw.chat.noneLead")}
              </div>
            )}
          </div>

          {/* The designer's details */}
          <aside className="cdp" data-designer-panel>
            {ctx && designer ? (
              <>
                <div className="cdph">
                  <span className="psav lg">
                    <span className="dring" />
                    <ClientAvatar name={designer.name} url={designer.avatarUrl} large />
                  </span>
                  <b>{designer.name}</b>
                  {kind && <ProChip trial={kind === "trial"} t={t} large />}
                  <em>@{designer.username}</em>
                </div>
                {stats && (
                  <div className="cdk">
                    <div>
                      <b>{stats.rating !== null ? num(stats.rating) : "—"}</b>
                      <span>{t("cw.chat.rating")}</span>
                    </div>
                    <div>
                      <b>{stats.contests ? `${num(stats.winRate)}%` : "—"}</b>
                      <span>{t("cw.chat.winRate")}</span>
                    </div>
                    <div>
                      <b>{num(stats.wins)}</b>
                      <span>{t("cw.chat.wins")}</span>
                    </div>
                  </div>
                )}
                <span className="psub">{t("cw.chat.theirEntries")}</span>
                <div className="cde">
                  {theirs.map((e) => (
                    <Link key={e.id} href={`/client/messages?entry=${e.id}`} className={e.id === ctx.entryId ? "on" : undefined} aria-label={t("entry.open", { n: num(e.number) })}>
                      <Picture url={e.previews[0] ?? null} name={ctx.brand} />
                      <em>#{num(e.number)}</em>
                    </Link>
                  ))}
                </div>
                <span className="psub">{t("cw.chat.yourActions")}</span>
                <div className="cda">
                  {current && <ShortlistButton entryId={current.id} number={num(current.number)} on={current.isShortlisted} disabled={!canReview || current.status !== "active"} />}
                  {current && <RateStars entryId={current.id} rating={current.rating} disabled={!canReview || current.status !== "active"} />}
                  {profileHref && (
                    <Link href={profileHref} className="dout sm wide">
                      <CwIcon name="eye" size={15} />
                      {t("cw.chat.publicProfile")}
                    </Link>
                  )}
                </div>
                <span className="psub">{t("cw.chat.details")}</span>
                <div className="cdl">
                  <div>
                    <span>{t("cw.chat.started")}</span>
                    <b>{messages[0] ? formatDate(new Date(messages[0].at), locale, "short") : "—"}</b>
                  </div>
                  <div>
                    <span>{t("cw.chat.messages")}</span>
                    <b>{num(messages.length)}</b>
                  </div>
                  <div>
                    <span>{t("cw.chat.files")}</span>
                    <b>{num(files)}</b>
                  </div>
                  <div>
                    <span>{t("cw.chat.contestEnds")}</span>
                    <b>{contest?.endsAt ? formatDate(contest.endsAt, locale, "short") : "—"}</b>
                  </div>
                </div>
              </>
            ) : (
              <p className="dempty">{t("cw.chat.panelEmpty")}</p>
            )}
          </aside>
        </section>
      )}
    </ClientShell>
  );
}
