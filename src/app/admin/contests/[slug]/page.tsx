import type { Metadata } from "next";
import { DesignLink } from "@/components/admin/design-viewer";
import Link from "next/link";
import { AdminIcon } from "@/components/admin/icons";
import { notFound } from "next/navigation";
import { AdminAction } from "@/components/admin/admin-action";
import { contestTone, StatusPill } from "@/components/admin/table-bits";
import { cancelContest, extendContest, forceAward } from "@/lib/admin/contest-actions";
import { getAdminContest, getContestClient } from "@/lib/admin/contests";
import { hasPermission } from "@/lib/admin/permissions";
import { ONLINE_MS } from "@/lib/admin/users-query";
import { formatDate, timeAgo } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { formatNumber, formatTaka } from "@/lib/money";
import { requirePermission } from "@/lib/admin/core";
import { showMobile } from "@/lib/payments/manual-rules";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.contests.title"), robots: { index: false } };
}

const UNPAID = ["draft", "pending_payment"];

// A-02 Contest detail: summary, designs, payments, the client; Edit brief, Extend, Force-award, Cancel.
export default async function AdminContestPage({ params }: PageProps<"/admin/contests/[slug]">) {
  const me = await requirePermission("contests.view");
  const { slug } = await params;
  const [{ t, locale }, c] = await Promise.all([getI18n(), getAdminContest(slug)]);
  if (!c) notFound();
  // Contact details only for Users · manage, as in the Users list (owner, 2026-10-14: the client panel).
  const client = c.client.id ? await getContestClient(c.client.id, { canSeeContact: hasPermission(me, "users.manage") }) : null;
  const unpaid = UNPAID.includes(c.status);
  const taka = (n: number) => formatTaka(n, locale);
  const when = (d: Date | null) => (d ? d.toLocaleString(locale === "bn" ? "bn-BD" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" }) : "—");
  const active = c.entriesList.filter((e) => e.status === "active");
  const canAward = (c.status === "open" || c.status === "judging") && active.length > 0;
  const canCancel = !["completed", "no_result", "cancelled"].includes(c.status);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/contests" className="text-sm font-semibold text-primary hover:underline">
          ← {t("admin.contests.title")}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-h2 font-bold tracking-tight text-ink lg:text-h2-lg">{c.brand}</h1>
          <StatusPill tone={contestTone(c.status)}>{t(`status.${c.status}` as MessageKey)}</StatusPill>
          {c.number && <span className="font-mono text-sm text-muted">#{String(c.number).padStart(5, "0")}</span>}
        </div>
        <p className="mt-1 text-sm text-muted">
          {t("admin.contests.byClient")}{" "}
          <Link href={`/admin/users/${c.client.id}`} className="font-semibold text-ink hover:text-primary">
            {c.client.name}
          </Link>
          {" · "}
          <a href={`/contest/${c.slug}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-primary hover:underline">
            {t("admin.contests.publicPage")}
            <AdminIcon name="external" size={14} />
          </a>
          {/* An unpaid contest has no client page yet: the client sees the wizard or the pay page (owner, 2026-10-14). */}
          {!unpaid ? (
            <>
              {" · "}
              <a href={`/dashboard/contests/${c.slug}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-primary hover:underline">
                {t("admin.contests.clientView")}
                <AdminIcon name="external" size={14} />
              </a>
            </>
          ) : (
            hasPermission(me, "unpaid.view") && (
              <>
                {" · "}
                <Link href="/admin/unpaid" className="text-primary hover:underline">
                  {t("admin.contests.unpaidLink")}
                </Link>
              </>
            )
          )}
        </p>
        {c.cancelReason && <p className="mt-2 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{t("admin.contests.cancelledBecause", { reason: c.cancelReason })}</p>}
      </div>

      <div className="flex flex-wrap gap-2">
        {c.status === "open" && (
          <Link href={`/dashboard/contests/${c.slug}/edit`} className="inline-flex min-h-11 items-center rounded-full bg-surface px-4 text-[0.9375rem] font-semibold text-ink ring-1 ring-inset ring-line hover:bg-canvas">
            {t("admin.contests.editBrief")}
          </Link>
        )}
        {c.status === "open" && (
          <AdminAction
            label={t("admin.contests.extend")}
            body={t("admin.contests.extendBody")}
            fields={[
              { name: "days", kind: "number", label: t("admin.contests.extendDays"), min: 1, max: 30, defaultValue: "3" },
              { name: "reason", kind: "reason" },
            ]}
            run={extendContest.bind(null, c.id)}
          />
        )}
        {canAward && (
          <AdminAction
            label={t("admin.contests.forceAward")}
            body={t("admin.contests.forceAwardBody")}
            fields={[
              {
                name: "entry",
                kind: "select",
                label: t("admin.contests.winningDesign"),
                options: active.map((e) => ({ value: e.id, label: `#${e.number} · ${e.designer.username ? `@${e.designer.username}` : e.designer.name}${e.rating ? ` · ${"★".repeat(e.rating)}` : ""}` })),
              },
              { name: "reason", kind: "reason" },
            ]}
            run={forceAward.bind(null, c.id)}
          />
        )}
        {canCancel && <AdminAction label={t("admin.contests.cancel")} body={t("admin.contests.cancelBody")} tone="danger" fields={[{ name: "reason", kind: "reason" }, { name: "adult", kind: "select", label: t("admin.contests.adult.label"), options: [{ value: "0", label: t("admin.contests.adult.no") }, { value: "1", label: t("admin.contests.adult.yes") }] }]} run={cancelContest.bind(null, c.id)} />}
      </div>

      <dl className="grid gap-3 rounded-2xl bg-surface p-5 text-sm shadow-card ring-1 ring-line sm:grid-cols-2 xl:grid-cols-4">
        {[
          [t("admin.contests.prize"), taka(c.prize)],
          [t("admin.contests.paid"), `${taka(c.total)} (${t("admin.contests.feeAddons", { fee: taka(c.serviceFee), addons: taka(c.upgrades) })})`],
          [t("admin.contests.started"), when(c.startsAt)],
          [t("admin.contests.ends"), when(c.endsAt)],
          [t("admin.contests.judgingEnds"), when(c.judgingEndsAt)],
          [t("admin.contests.length"), t("admin.contests.lengthValue", { days: String(c.durationDays), ext: String(c.extensions) })],
          [t("admin.contests.addons"), c.flags.length ? c.flags.map((f) => t(`admin.contests.flags.${f}` as MessageKey)).join(", ") : "—"],
          [t("admin.contests.handover"), c.handover ? `${t(`admin.claims.handover.${c.handover.status}` as MessageKey)} · ${c.handover.designer}` : "—"],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{k}</dt>
            <dd className="mt-0.5 text-ink">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl bg-surface p-5 shadow-card ring-1 ring-line">
          <h2 className="font-semibold text-ink">
            {t("admin.contests.designs")} <span className="text-muted">({c.entriesList.length})</span>
          </h2>
          {c.entriesList.length === 0 ? (
            <p className="mt-4 text-sm text-muted">{t("admin.users.none")}</p>
          ) : (
            <ul className="mt-3 divide-y divide-line text-sm">
              {c.entriesList.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-2">
                  <span>
                    <DesignLink entryId={e.id} className="font-semibold text-ink hover:text-primary">
                      #{e.number}
                    </DesignLink>{" "}
                    <Link href={`/admin/users/${e.designer.id}`} className="text-muted hover:text-primary">
                      {e.designer.username ? `@${e.designer.username}` : e.designer.name}
                    </Link>
                  </span>
                  <span className="text-xs text-muted">
                    {e.rating ? `${"★".repeat(e.rating)} · ` : ""}
                    {t(`admin.entries.statuses.${e.status}` as MessageKey)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-2xl bg-surface p-5 shadow-card ring-1 ring-line">
          <h2 className="font-semibold text-ink">{t("admin.payments.title")}</h2>
          {c.payments.length === 0 ? (
            <p className="mt-4 text-sm text-muted">{t("admin.users.none")}</p>
          ) : (
            <ul className="mt-3 divide-y divide-line text-sm">
              {c.payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="text-ink">
                    {t(`admin.payments.purposes.${p.purpose}` as MessageKey)} · <b className="tabular-nums">{taka(p.amount)}</b>
                    <span className="block text-xs text-muted">
                      {p.gateway}
                      {p.txnId && ` · ${p.txnId}`} · {formatDate(p.paidAt ?? p.createdAt, locale, "short")}
                    </span>
                  </span>
                  <StatusPill tone={p.status === "paid" ? "ok" : p.status === "failed" ? "bad" : "muted"}>{t(`admin.payments.statuses.${p.status}` as MessageKey)}</StatusPill>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {client && <ClientPanel client={client} slug={c.slug} me={me} t={t} locale={locale} />}
    </div>
  );
}

type T = Awaited<ReturnType<typeof getI18n>>["t"];
type Locale = Awaited<ReturnType<typeof getI18n>>["locale"];
type Client = NonNullable<Awaited<ReturnType<typeof getContestClient>>>;

const BUTTON = "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-surface px-4 text-[0.9375rem] font-semibold text-ink ring-1 ring-inset ring-line hover:bg-canvas";

function countryName(code: string, locale: Locale): string {
  try {
    return new Intl.DisplayNames([locale === "bn" ? "bn" : "en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** The client panel (owner, 2026-10-14): who they are, how to reach them, and every contest they ran. */
function ClientPanel({ client, slug, me, t, locale }: { client: Client; slug: string; me: Parameters<typeof hasPermission>[0]; t: T; locale: Locale }) {
  const now = new Date();
  const online = Boolean(client.lastSeenAt && now.getTime() - client.lastSeenAt.getTime() <= ONLINE_MS);
  const seen = online ? t("admin.contests.clientCard.online") : client.lastSeenAt ? t("admin.contests.clientCard.lastSeen", { when: timeAgo(client.lastSeenAt, now, locale) }) : t("admin.contests.clientCard.never");
  const contact = client.contact;
  const digits = contact ? contact.mobile.replace(/\D/g, "") : "";
  const canMessage = hasPermission(me, "messages.manage");
  const canChat = hasPermission(me, "support.view");
  const fact = (label: string, value: React.ReactNode) => (
    <div className="flex items-baseline justify-between gap-3 border-t border-line py-2 first:border-t-0">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="m-0 min-w-0 text-right font-semibold text-ink [overflow-wrap:anywhere]">{value}</dd>
    </div>
  );
  return (
    <section className="rounded-2xl bg-surface p-5 shadow-card ring-1 ring-line">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-ink">{t("admin.contests.clientCard.title")}</h2>
        <Link href={`/admin/users/${client.id}`} className="text-sm font-semibold text-primary hover:underline">
          {t("admin.contests.clientCard.openProfile")} →
        </Link>
      </div>

      <div className="mt-4 grid gap-6 xl:grid-cols-2">
        {/* Who they are and how to reach them */}
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex items-center gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-[14px] bg-tint text-lg font-semibold text-primary">{client.name.trim().slice(0, 1).toUpperCase()}</span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/admin/users/${client.id}`} className="truncate text-lg font-semibold text-ink hover:text-primary">
                  {client.name}
                </Link>
                <StatusPill tone={client.status === "active" ? "ok" : client.status === "banned" ? "bad" : "warn"}>{t(`admin.users.statuses.${client.status}`)}</StatusPill>
                {client.isTest && <StatusPill tone="muted">{t("admin.users.testAccount")}</StatusPill>}
              </div>
              <p className="m-0 text-sm text-muted">
                {client.username && `@${client.username} · `}
                <span className={online ? "font-semibold text-success" : undefined}>{seen}</span>
              </p>
            </div>
          </div>

          <dl className="m-0 text-sm">
            {client.businessName && fact(t("admin.contests.clientCard.business"), client.businessName)}
            {contact &&
              fact(
                t("admin.contests.clientCard.mobile"),
                <a href={`tel:${contact.mobile}`} className="font-mono hover:text-primary">
                  {showMobile(contact.mobile)}
                </a>,
              )}
            {contact &&
              fact(
                t("admin.contests.clientCard.email"),
                contact.email ? (
                  <span>
                    <a href={`mailto:${contact.email}`} className="hover:text-primary">
                      {contact.email}
                    </a>
                    <span className={client.emailVerified ? "ml-1.5 text-xs font-semibold text-success" : "ml-1.5 text-xs font-semibold text-warning"}>
                      {t(client.emailVerified ? "admin.contests.clientCard.verified" : "admin.contests.clientCard.notVerified")}
                    </span>
                  </span>
                ) : (
                  "—"
                ),
              )}
            {contact && contact.bkash.length > 0 && fact(t("admin.contests.clientCard.bkash"), <span className="font-mono">{contact.bkash.map(showMobile).join(", ")}</span>)}
            {fact(t("admin.contests.clientCard.joined"), formatDate(client.joinedAt, locale, "long"))}
            {client.country && fact(t("admin.contests.clientCard.country"), countryName(client.country, locale))}
            {fact(t("admin.contests.clientCard.strikes"), formatNumber(client.strikes, locale))}
            {client.suspendedUntil && fact(t("admin.users.statuses.suspended"), t("admin.contests.clientCard.until", { date: formatDate(client.suspendedUntil, locale, "long") }))}
          </dl>
          {!contact && <p className="m-0 rounded-xl bg-canvas px-3 py-2 text-sm text-muted">{t("admin.users.x.quick.noContact")}</p>}

          <div className="flex flex-wrap gap-2">
            {contact && (
              <a href={`tel:${contact.mobile}`} className={BUTTON}>
                {t("admin.contests.clientCard.call")}
              </a>
            )}
            {contact && digits && (
              <a href={`https://wa.me/${digits}`} target="_blank" rel="noopener noreferrer" className={BUTTON}>
                {t("admin.contests.clientCard.whatsapp")}
                <AdminIcon name="external" size={14} />
              </a>
            )}
            {canMessage && (
              <Link href={`/admin/messages?to=${client.id}`} className={BUTTON}>
                {t("admin.activity.message")}
              </Link>
            )}
            {canChat && (
              <Link href={`/admin/support?user=${client.id}`} className={BUTTON}>
                {t("admin.users.openChat")}
              </Link>
            )}
          </div>
        </div>

        {/* What they ran */}
        <div className="flex min-w-0 flex-col gap-4">
          <div className="grid grid-cols-3 gap-2">
            {[
              { n: formatNumber(client.contests.length, locale), label: t("admin.contests.clientCard.contests") },
              { n: formatTaka(client.spent, locale), label: t("admin.contests.clientCard.spent") },
              { n: formatNumber(client.picked, locale), label: t("admin.contests.clientCard.picked") },
            ].map((x) => (
              <div key={x.label} className="min-w-0 rounded-xl bg-canvas px-3 py-2.5">
                <p className="m-0 truncate text-lg font-semibold tabular-nums text-ink">{x.n}</p>
                <p className="m-0 text-xs text-muted">{x.label}</p>
              </div>
            ))}
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{t("admin.contests.clientCard.theirContests")}</h3>
            <ul className="mt-1 max-h-80 divide-y divide-line overflow-y-auto text-sm">
              {client.contests.map((x) => (
                <li key={x.slug} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0">
                    {x.slug === slug ? (
                      <span className="font-semibold text-ink">{x.brand}</span>
                    ) : (
                      <Link href={`/admin/contests/${x.slug}`} className="font-semibold text-ink hover:text-primary">
                        {x.brand}
                      </Link>
                    )}
                    <span className="block text-xs text-muted">
                      {x.number ? `#${String(x.number).padStart(5, "0")} · ` : ""}
                      {formatDate(x.createdAt, locale, "short")}
                      {x.slug === slug && ` · ${t("admin.contests.clientCard.thisOne")}`}
                    </span>
                  </span>
                  <StatusPill tone={contestTone(x.status)}>{t(`status.${x.status}` as MessageKey)}</StatusPill>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
