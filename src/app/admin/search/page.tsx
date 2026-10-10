import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminIcon } from "@/components/admin/icons";
import { AdminHead } from "@/components/admin/page-head";
import { contestTone, StatusPill, str } from "@/components/admin/table-bits";
import { AdmCard, AdmEmpty, ADM_INPUT, CardTitle, IdChip } from "@/components/admin/ui";
import { listAdminContests } from "@/lib/admin/contests";
import { adminUser } from "@/lib/admin/core";
import { listPayments } from "@/lib/admin/misc";
import { hasPermission } from "@/lib/admin/permissions";
import { listUsers } from "@/lib/admin/users";
import { getI18n } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { formatTaka } from "@/lib/money";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.search.title"), robots: { index: false } };
}

const SHOW = 6;

// Top-bar search (owner, 2026-10-10): contests, users and payments in one place, each only with its permission.
// It reuses the searches of the Contests, Users and Payments lists.
export default async function AdminSearchPage({ searchParams }: PageProps<"/admin/search">) {
  const me = await adminUser();
  if (!me) notFound();
  const canContests = hasPermission(me, "contests.view");
  const canUsers = hasPermission(me, "users.view");
  const canPayments = hasPermission(me, "payments.view");
  if (!canContests && !canUsers && !canPayments) notFound();

  const q = str((await searchParams).q).trim().slice(0, 80);
  // "LC-0005" or "0005" finds contest number 5.
  const contestTerm = q.replace(/^lc-?/i, "").replace(/^0+(?=\d)/, "");
  const [{ t, locale }, contests, users, payments] = await Promise.all([
    getI18n(),
    q && canContests ? listAdminContests({ search: contestTerm, status: "", page: 1 }) : null,
    q && canUsers ? listUsers({ search: q, role: "", status: "", page: 1 }) : null,
    q && canPayments ? listPayments({ status: "", purpose: "", search: q, page: 1 }) : null,
  ]);
  const enc = encodeURIComponent(q);
  const seeAll = (href: string, total: number) =>
    total > SHOW ? (
      <Link href={href} className="inline-flex min-h-11 items-center gap-1.5 text-[15px] font-bold text-primary">
        {t("admin.search.seeAll", { n: total })}
        <AdminIcon name="arrow" size={16} />
      </Link>
    ) : undefined;
  const row = "flex items-center gap-3 border-t border-adm-line-soft px-5 py-3.5 first:border-t-0 hover:bg-[#fafafb]";

  return (
    <div className="flex flex-col gap-5">
      <AdminHead title={t("admin.search.title")} lead={q ? t("admin.search.lead", { q }) : t("admin.search.hint")} />

      <form action="/admin/search" role="search" className="flex max-w-xl gap-2">
        <label htmlFor="search-page-q" className="sr-only">
          {t("admin.shell.searchLabel")}
        </label>
        <input id="search-page-q" name="q" type="search" defaultValue={q} placeholder={t("admin.shell.search")} className={ADM_INPUT} />
        <button type="submit" className="h-12 shrink-0 rounded-[12px] bg-primary px-5 text-[15px] font-bold text-white hover:bg-adm-deep">
          {t("admin.search.go")}
        </button>
      </form>

      {q && (
        <div className="grid gap-4 xl:grid-cols-3">
          {contests && (
            <AdmCard className="overflow-hidden">
              <div className="p-5">
                <CardTitle title={t("admin.nav.contests")} action={seeAll(`/admin/contests?q=${encodeURIComponent(contestTerm)}`, contests.total)} />
              </div>
              {contests.rows.length === 0 ? (
                <div className="px-5 pb-5">
                  <AdmEmpty>{t("admin.search.none")}</AdmEmpty>
                </div>
              ) : (
                <ul className="m-0 list-none p-0">
                  {contests.rows.slice(0, SHOW).map((c) => (
                    <li key={c.id}>
                      <Link href={`/admin/contests/${c.slug}`} className={row}>
                        <span className="flex min-w-0 flex-1 flex-col gap-1">
                          <strong className="truncate text-[15.5px]">{c.brand}</strong>
                          <IdChip prefix="LC" n={c.number} />
                        </span>
                        <StatusPill tone={contestTone(c.status)}>{t(`status.${c.status}` as MessageKey)}</StatusPill>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </AdmCard>
          )}

          {users && (
            <AdmCard className="overflow-hidden">
              <div className="p-5">
                <CardTitle title={t("admin.nav.users")} action={seeAll(`/admin/users?q=${enc}`, users.total)} />
              </div>
              {users.rows.length === 0 ? (
                <div className="px-5 pb-5">
                  <AdmEmpty>{t("admin.search.none")}</AdmEmpty>
                </div>
              ) : (
                <ul className="m-0 list-none p-0">
                  {users.rows.slice(0, SHOW).map((u) => (
                    <li key={u.id}>
                      <Link href={`/admin/users/${u.id}`} className={row}>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <strong className="truncate text-[15.5px]">{u.name}</strong>
                          <span className="truncate text-sm text-muted">{u.username ? `@${u.username}` : u.email ?? u.mobile}</span>
                        </span>
                        <span className="text-sm font-semibold text-adm-strong">{t(`admin.users.roles.${u.role}`)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </AdmCard>
          )}

          {payments && (
            <AdmCard className="overflow-hidden">
              <div className="p-5">
                <CardTitle title={t("admin.nav.payments")} sub={t("admin.search.paymentsHint")} action={seeAll(`/admin/payments?q=${enc}`, payments.total)} />
              </div>
              {payments.rows.length === 0 ? (
                <div className="px-5 pb-5">
                  <AdmEmpty>{t("admin.search.none")}</AdmEmpty>
                </div>
              ) : (
                <ul className="m-0 list-none p-0">
                  {payments.rows.slice(0, SHOW).map((p) => (
                    <li key={p.id}>
                      <Link href={`/admin/payments?q=${encodeURIComponent(p.txnId ?? "")}`} className={row}>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <strong className="truncate font-mono text-[14px]">{p.txnId ?? "—"}</strong>
                          <span className="truncate text-sm text-muted">{p.contest?.brand ?? p.client?.name ?? ""}</span>
                        </span>
                        <span className="lc-d text-[15.5px] font-semibold tabular-nums">{formatTaka(p.amount, locale)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </AdmCard>
          )}
        </div>
      )}
    </div>
  );
}
