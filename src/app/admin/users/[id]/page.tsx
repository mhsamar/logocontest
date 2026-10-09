import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminAction } from "@/components/admin/admin-action";
import { StatusPill } from "@/components/admin/table-bits";
import { adminUser } from "@/lib/admin/core";
import { giveStrike, removeStrike, setUserStatus } from "@/lib/admin/user-actions";
import { getUser } from "@/lib/admin/users";
import { formatDate } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { formatTaka } from "@/lib/money";
import { formatBdMobile } from "@/lib/phone";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.users.title"), robots: { index: false } };
}

const TONE = { active: "ok", suspended: "warn", banned: "bad" } as const;

// A-05 User drawer as a page: profile, strikes (who gave each and why), contests or designs, wallet; actions.
export default async function AdminUserPage({ params }: PageProps<"/admin/users/[id]">) {
  const { id } = await params;
  const [{ t, locale }, u, me] = await Promise.all([getI18n(), getUser(id), adminUser()]);
  if (!u) notFound();
  const self = me?.id === u.id;
  const when = (d: Date) => d.toLocaleString(locale === "bn" ? "bn-BD" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/users" className="text-sm font-semibold text-primary hover:underline">
          ← {t("admin.users.title")}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-h2 font-bold tracking-tight text-ink lg:text-h2-lg">{u.name}</h1>
          <StatusPill tone={TONE[u.status]}>{t(`admin.users.statuses.${u.status}`)}</StatusPill>
          <StatusPill tone="muted">{t(`admin.users.roles.${u.role}`)}</StatusPill>
        </div>
        <p className="mt-1 text-sm text-muted">
          {u.username && <>@{u.username} · </>}
          {formatBdMobile(u.mobile)}
          {u.email && <> · {u.email}</>} · {t("admin.users.joinedOn", { date: formatDate(u.createdAt, locale, "long") })}
        </p>
        {u.status === "suspended" && u.suspendedUntil && <p className="mt-1 text-sm font-semibold text-[#8a5105]">{t("admin.users.suspendedUntil", { date: when(u.suspendedUntil) })}</p>}
      </div>

      {!self && (
        <div className="flex flex-wrap gap-2">
          <AdminAction label={t("admin.users.giveStrike")} body={t("admin.users.strikeBody")} tone="danger" run={giveStrike.bind(null, u.id)} done={t("admin.users.strikeGiven")} />
          {u.status !== "suspended" && u.status !== "banned" && (
            <AdminAction
              label={t("admin.users.suspend")}
              tone="secondary"
              fields={[
                { name: "days", kind: "number", label: t("admin.users.days"), min: 1, max: 365, defaultValue: "14" },
                { name: "reason", kind: "reason" },
              ]}
              run={setUserStatus.bind(null, u.id, "suspended")}
            />
          )}
          {u.status !== "banned" && <AdminAction label={t("admin.users.ban")} body={t("admin.users.banBody")} tone="danger" run={setUserStatus.bind(null, u.id, "banned")} />}
          {u.status !== "active" && <AdminAction label={t("admin.users.reactivate")} tone="primary" run={setUserStatus.bind(null, u.id, "active")} />}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl bg-surface p-5 shadow-card ring-1 ring-line">
          <h2 className="font-semibold text-ink">
            {t("admin.users.strikeHistory")} <span className="text-muted">({u.strikes})</span>
          </h2>
          <p className="mt-1 text-xs text-muted">{t("admin.users.ladder")}</p>
          {u.flagWarnings > 0 && <p className="mt-2 text-sm text-[#8a5105]">{t("admin.users.flagWarnings", { n: String(u.flagWarnings) })}</p>}
          {u.strikeHistory.length === 0 ? (
            <p className="mt-4 text-sm text-muted">{t("admin.users.noStrikes")}</p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {u.strikeHistory.map((s) => (
                <li key={s.id} className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm">
                  <div className={s.removedAt ? "opacity-60" : undefined}>
                    <p className="font-medium text-ink">{s.reason}</p>
                    <p className="text-xs text-muted">
                      {t(`admin.users.issuer.${s.issuerRole}` as MessageKey)}
                      {s.issuer && <> · {s.issuer}</>} · {when(s.createdAt)}
                      {s.contest && (
                        <>
                          {" · "}
                          <Link href={`/admin/contests/${s.contest.slug}`} className="text-primary hover:underline">
                            {s.contest.brand}
                          </Link>
                        </>
                      )}
                    </p>
                    {s.removedAt && <p className="text-xs font-semibold text-muted">{t("admin.users.removedOn", { date: when(s.removedAt) })}</p>}
                  </div>
                  {!s.removedAt && <AdminAction label={t("admin.users.removeStrike")} tone="ghost" run={removeStrike.bind(null, s.id)} />}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl bg-surface p-5 shadow-card ring-1 ring-line">
          {u.role === "designer" ? (
            <>
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-semibold text-ink">{t("admin.users.designs")}</h2>
                {u.balance !== null && <p className="text-sm text-muted">{t("admin.users.balance", { amount: formatTaka(u.balance, locale) })}</p>}
              </div>
              {u.entries.length === 0 ? (
                <p className="mt-4 text-sm text-muted">{t("admin.users.none")}</p>
              ) : (
                <ul className="mt-3 divide-y divide-line text-sm">
                  {u.entries.map((e, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 py-2">
                      <Link href={`/admin/contests/${e.slug}`} className="text-ink hover:text-primary">
                        {e.brand} · #{e.number}
                      </Link>
                      <span className="text-xs text-muted">
                        {t(`admin.entries.statuses.${e.status}` as MessageKey)} · {formatDate(e.createdAt, locale, "short")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <>
              <h2 className="font-semibold text-ink">{t("admin.users.contests")}</h2>
              {u.contests.length === 0 ? (
                <p className="mt-4 text-sm text-muted">{t("admin.users.none")}</p>
              ) : (
                <ul className="mt-3 divide-y divide-line text-sm">
                  {u.contests.map((c) => (
                    <li key={c.slug} className="flex items-center justify-between gap-3 py-2">
                      <Link href={`/admin/contests/${c.slug}`} className="text-ink hover:text-primary">
                        {c.brand}
                      </Link>
                      <span className="text-xs text-muted">
                        {t(`status.${c.status}` as MessageKey)} · {formatDate(c.createdAt, locale, "short")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
