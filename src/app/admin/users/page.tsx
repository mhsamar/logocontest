import type { Metadata } from "next";
import Link from "next/link";
import { UsersBoard } from "@/components/admin/users-board";
import { requirePermission } from "@/lib/admin/core";
import { hasPermission } from "@/lib/admin/permissions";
import { adminUsersPage } from "@/lib/admin/users";
import { parseUsersQuery, toggleShow, USER_ROLES, USER_SHOWS, USER_SORTS, USER_STATUSES, usersHref } from "@/lib/admin/users-query";
import { cx } from "@/lib/cx";
import { getI18n } from "@/lib/i18n/server";
import { formatNumber } from "@/lib/money";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.users.title"), robots: { index: false } };
}

const CHIP = "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-bold";

// A-05 Users (redesign owner 2026-10-12, Design/users): counts, role tabs, status and "show" chips, search, sort and
// pages (all on the server and in the URL), the table and the Quick view. Users · view opens the page; contact
// details, actions and the CSV need Users · manage, checked again on the server.
export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  const admin = await requirePermission("users.view");
  const canManage = hasPermission(admin, "users.manage");
  const q = parseUsersQuery(await searchParams);
  const [{ t, locale }, data] = await Promise.all([getI18n(), adminUsersPage(q, { canManage })]);
  const fmt = (n: number) => formatNumber(n, locale);
  const c = data.counts;
  const page = Math.min(q.page, data.pages);

  const tiles = [
    { label: t("admin.users.x.counts.all"), n: c.all, sub: t("admin.users.x.counts.allSub", { n: fmt(c.newThisWeek) }), box: "", ink: "text-ink", soft: "text-muted", href: null },
    { label: t("admin.users.x.counts.clients"), n: c.clients, sub: t("admin.users.x.counts.clientsSub", { n: fmt(c.clientsRan) }), box: "bg-[#F3F7FD] border-[#D6E3F5]", ink: "text-[#1F4E8C]", soft: "text-[#1F4E8C]", href: null },
    { label: t("admin.users.x.counts.designers"), n: c.designers, sub: t("admin.users.x.counts.designersSub", { n: fmt(c.designersOnline) }), box: "bg-[#FDF6F5] border-[#F3D2CF]", ink: "text-primary", soft: "text-[#7A1010]", href: null },
    {
      label: t("admin.users.x.counts.look"),
      n: c.look,
      sub: t("admin.users.x.counts.lookSub", { s: fmt(c.lookSuspended), b: fmt(c.lookBanned) }),
      box: "bg-[#FFF7ED] border-[#F6D9B8]",
      ink: "text-[#9A3412]",
      soft: "text-[#7A3A0C]",
      href: usersHref(q, { show: q.show.includes("look") ? q.show : [...q.show, "look"] }),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="lc-d m-0 text-[32px] font-semibold leading-[1.1] tracking-[-0.035em] text-ink max-[640px]:text-[26px]">{t("admin.users.title")}</h1>
          <p className="m-0 max-w-[820px] text-[15.5px] text-muted">{t("admin.users.x.lead")}</p>
        </div>
        {canManage && (
          <a href={usersHref(q, {}, "/admin/users/export")} className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#DCDEE3] bg-white px-4 text-[15px] font-bold text-ink">
            <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M12 3v12M7 10l5 5 5-5M5 21h14" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {t("admin.users.x.export")}
          </a>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
        {tiles.map((x) => {
          const inner = (
            <>
              <span className={cx("text-[14.5px] font-semibold", x.soft)}>{x.label}</span>
              <span className={cx("lc-d text-[28px] font-semibold leading-none tracking-[-0.03em] sm:text-[34px]", x.ink)}>{fmt(x.n)}</span>
              <span className={cx("text-sm max-[640px]:text-[13px]", x.soft)}>{x.sub}</span>
            </>
          );
          const cls = cx("flex flex-col gap-1.5 rounded-2xl border border-[#E9EAEE] bg-white p-4 sm:p-5", x.box);
          return x.href ? (
            <Link key={x.label} href={x.href} className={cx(cls, "transition-shadow hover:shadow-card")}>
              {inner}
            </Link>
          ) : (
            <div key={x.label} className={cls}>
              {inner}
            </div>
          );
        })}
      </div>

      <section className="flex flex-col gap-3 rounded-2xl border border-[#E9EAEE] bg-white p-3.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <nav aria-label={t("admin.users.x.roles.label")} className="flex flex-wrap gap-2">
            {USER_ROLES.map((r) => {
              const on = r === q.role;
              return (
                <Link key={r} href={usersHref(q, { role: r })} aria-current={on ? "page" : undefined} className={cx("inline-flex h-[42px] items-center gap-2 rounded-[10px] px-4 text-[15px] font-bold max-[640px]:px-3", on ? "bg-primary text-white" : "bg-[#F4F5F7] text-[#3A3C45]")}>
                  {t(`admin.users.x.roles.${r}`)}
                  <span className={cx("rounded-full px-2 py-px text-[13px]", on ? "bg-white/20" : "bg-white")}>{fmt(c.role[r])}</span>
                </Link>
              );
            })}
          </nav>
          <form action="/admin/users" role="search" className="ml-auto flex h-[42px] min-w-[200px] max-w-[420px] flex-[1_1_260px] items-center gap-2.5 rounded-[10px] bg-[#F4F5F7] px-3.5 text-muted max-[640px]:ml-0 max-[640px]:max-w-none">
            {q.role !== "all" && <input type="hidden" name="role" value={q.role} />}
            {q.status !== "all" && <input type="hidden" name="status" value={q.status} />}
            {q.show.length > 0 && <input type="hidden" name="show" value={q.show.join(",")} />}
            {q.sort !== "newest" && <input type="hidden" name="sort" value={q.sort} />}
            <svg viewBox="0 0 24 24" className="size-[18px] flex-none" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
            </svg>
            <input type="search" name="q" defaultValue={q.q} maxLength={80} aria-label={t("admin.users.x.searchLabel")} placeholder={t("admin.users.x.search")} className="min-w-0 flex-1 border-0 bg-transparent text-[15px] text-ink outline-none" />
          </form>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-0.5 text-[13.5px] font-bold text-muted">{t("admin.users.x.statusLabel")}</span>
          {USER_STATUSES.map((s) => {
            const on = s === q.status;
            return (
              <Link key={s} href={usersHref(q, { status: s })} aria-current={on ? "true" : undefined} className={cx(CHIP, on ? "border-[#111216] bg-[#111216] text-white" : "border-[#E3E4E8] bg-white text-[#3A3C45]")}>
                {t(`admin.users.x.status.${s}`)}
                <span className={cx("text-[12.5px]", on ? "text-[#C9CCD3]" : "text-muted")}>{fmt(c.status[s])}</span>
              </Link>
            );
          })}
          <span aria-hidden className="mx-1 h-[22px] w-px bg-[#E3E4E8]" />
          <span className="mr-0.5 text-[13.5px] font-bold text-muted">{t("admin.users.x.showLabel")}</span>
          {USER_SHOWS.map((s) => {
            const on = q.show.includes(s);
            return (
              <Link key={s} href={usersHref(q, { show: toggleShow(q.show, s) })} aria-pressed={on} className={cx(CHIP, on ? "border-[#111216] bg-[#111216] text-white" : "border-[#E3E4E8] bg-white text-[#3A3C45]")}>
                {s === "online" && <span aria-hidden className="size-2 rounded-full bg-[#1F9D55]" />}
                {t(`admin.users.x.show.${s}`)}
                <span className={cx("text-[12.5px]", on ? "text-[#C9CCD3]" : "text-muted")}>{fmt(c.show[s])}</span>
              </Link>
            );
          })}
          <nav aria-label={t("admin.users.x.sortLabel")} className="ml-auto flex flex-wrap items-center gap-1.5 max-[640px]:ml-0">
            <span className="text-[13.5px] font-bold text-muted">{t("admin.users.x.sortLabel")}:</span>
            {USER_SORTS.map((s) => (
              <Link key={s} href={usersHref(q, { sort: s })} aria-current={s === q.sort ? "true" : undefined} className={cx("inline-flex h-9 items-center rounded-[10px] border px-3 text-sm font-bold", s === q.sort ? "border-primary bg-[#FBECEB] text-primary" : "border-[#E3E4E8] bg-white text-[#3A3C45]")}>
                {t(`admin.users.x.sort.${s}`)}
              </Link>
            ))}
          </nav>
        </div>
      </section>

      <UsersBoard rows={data.rows} canManage={canManage} meId={admin.id} />

      {data.total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
          <span>{t("admin.users.x.pageOf", { page: fmt(page), pages: fmt(data.pages), total: fmt(data.total) })}</span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={usersHref(q, { page: page - 1 })} className="inline-flex h-10 items-center rounded-[10px] border border-[#DCDEE3] bg-white px-4 font-bold text-ink">
                ← {t("admin.users.x.prev")}
              </Link>
            )}
            {page < data.pages && (
              <Link href={usersHref(q, { page: page + 1 })} className="inline-flex h-10 items-center rounded-[10px] border border-[#DCDEE3] bg-white px-4 font-bold text-ink">
                {t("admin.users.x.next")} →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
