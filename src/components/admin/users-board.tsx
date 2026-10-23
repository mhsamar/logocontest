"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { QuickDelete } from "@/components/admin/quick-delete";
import { isNewSince, NewPill } from "@/components/admin/ui";
import { ProfileFacts, RemindButtons } from "@/components/admin/remind-buttons";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { giveStrike, setUserStatus } from "@/lib/admin/user-actions";
import type { UserCard } from "@/lib/admin/users";
import { cx } from "@/lib/cx";
import { formatDate, timeAgo } from "@/lib/dates";
import { useI18n } from "@/lib/i18n/client";
import { formatNumber, formatTaka } from "@/lib/money";
import { formatMobile } from "@/lib/phone";

const ROLE_PILL = { client: "bg-[#E1ECFA] text-[#1F4E8C]", designer: "bg-[#FBECEB] text-primary", admin: "bg-[#111216] text-white" } as const;
const STATUS_PILL = { active: "bg-[#E3F3EA] text-[#14633C]", suspended: "bg-[#FFEDD5] text-[#9A3412]", banned: "bg-[#FDE3E1] text-[#A3121B]" } as const;
const AVATAR = { client: "bg-[#E1ECFA] text-[#1F4E8C]", designer: "bg-[#FBECEB] text-primary", admin: "bg-[#F0F1F4] text-[#3A3C45]" } as const;
const PILL = "inline-flex items-center whitespace-nowrap rounded-full px-[9px] py-0.5 text-[12.5px] font-bold";

type Action = "suspend" | "unsuspend" | "ban" | "unban";

function Avatar({ u, size }: { u: UserCard; size: "sm" | "lg" }) {
  const box = size === "sm" ? "size-10 rounded-xl text-base" : "size-14 rounded-2xl text-[21px]";
  return (
    <span className="relative flex-none">
      {u.avatarUrl ? (
        <img src={u.avatarUrl} alt="" loading="lazy" className={cx(box, "object-cover")} />
      ) : (
        <span className={cx("lc-d flex items-center justify-center font-semibold", box, AVATAR[u.role])}>{u.name.trim().charAt(0).toUpperCase() || "?"}</span>
      )}
      {u.online && <span aria-hidden className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-[#1F9D55] ring-2 ring-white" />}
    </span>
  );
}

/** The 3-square strike meter (0/3 … 3/3). */
function Strikes({ n }: { n: number }) {
  const { t, locale } = useI18n();
  const shown = Math.min(3, n);
  return (
    <span className="inline-flex items-center gap-1" role="img" aria-label={t("admin.users.x.strikesLabel", { n: formatNumber(n, locale) })}>
      {[0, 1, 2].map((i) => (
        <span key={i} className={cx("size-2.5 rounded-[3px]", i < shown ? (shown >= 3 ? "bg-[#A3121B]" : "bg-[#D9480F]") : "bg-[#E3E4E8]")} />
      ))}
      <span className={cx("ml-1 text-[13.5px] font-bold", n > 0 ? "text-[#9A3412]" : "text-muted")}>{t("admin.users.x.strikes", { n: formatNumber(n, locale) })}</span>
    </span>
  );
}

function CheckLine({ u }: { u: UserCard }) {
  const { t, locale } = useI18n();
  if (u.role === "admin") return null;
  // A designer's agreement only matters while Settings asks for it (owner, 2026-10-22); otherwise their email, like clients.
  const agreement = u.role === "designer" && u.agreementOn;
  const good = agreement ? u.agreement === "approved" : u.emailVerified;
  const label = agreement ? t(`admin.users.x.check.${u.agreement}`) : t(u.emailVerified ? "admin.users.x.check.verified" : "admin.users.x.check.notVerified");
  // Designers: how complete the profile is; clients: a missing photo.
  const p = u.profile;
  const extra =
    p && p.percent !== null
      ? { ok: p.percent >= 100, text: t("admin.users.x.check.profile", { n: formatNumber(p.percent, locale) }) }
      : p && !p.hasPhoto
        ? { ok: false, text: t("admin.users.x.check.noPhoto") }
        : null;
  return (
    <span className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[12.5px] font-bold">
      <span className={cx("inline-flex items-center gap-1", good ? "text-[#14633C]" : "text-[#9A3412]")}>
        {good ? "✓" : "!"} {label}
      </span>
      {extra && <span className={extra.ok ? "text-[#14633C]" : "text-[#9A3412]"}>{extra.text}</span>}
    </span>
  );
}

/**
 * Admin → Users table with the Quick view (owner, 2026-10-12; Design/users). Pointing at a row previews it, clicking a
 * row pins it, leaving the table goes back to the pinned one; the name is a normal link to the full profile. On
 * touch screens a tap opens the Quick view as a bottom sheet. Everything shown was loaded with the list.
 */
export function UsersBoard({ rows, canManage, meId, since = null }: { rows: UserCard[]; canManage: boolean; meId: string; /** Joined after this: "New" tag (owner, 2026-10-23). */ since?: string | null }) {
  const { t } = useI18n();
  const [pinned, setPinned] = useState<string | null>(rows[0]?.id ?? null);
  const [hover, setHover] = useState<string | null>(null);
  const [sheet, setSheet] = useState<string | null>(null);
  const shownId = hover ?? pinned;
  const shown = rows.find((r) => r.id === shownId) ?? null;
  const sheetUser = rows.find((r) => r.id === sheet) ?? null;

  if (rows.length === 0) return <p className="m-0 rounded-2xl border border-dashed border-line bg-surface px-4 py-10 text-center text-muted">{t("admin.users.x.empty")}</p>;

  return (
    <div className="flex flex-wrap items-start gap-4">
      <section className="min-w-0 flex-[4_1_620px] overflow-hidden rounded-2xl border border-[#E9EAEE] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-[15.5px]" onMouseLeave={() => setHover(null)}>
            <thead>
              <tr className="text-left text-[13px] uppercase tracking-[.06em] text-muted">
                <th scope="col" className="py-3 pl-5 pr-2.5 font-bold">{t("admin.users.x.cols.user")}</th>
                <th scope="col" className="p-2.5 font-bold">{t("admin.users.x.cols.role")}</th>
                <th scope="col" className="p-2.5 font-bold">{t("admin.users.x.cols.status")}</th>
                <th scope="col" className="py-3 pl-2.5 pr-5 font-bold">{t("admin.users.x.cols.last")}</th>
                {canManage && (
                  <th scope="col" className="w-14 py-3 pr-4">
                    <span className="sr-only">{t("admin.trash.quick.actions")}</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => {
                const on = u.id === shownId;
                return (
                  <tr
                    key={u.id}
                    onMouseEnter={() => setHover(u.id)}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("a,button")) return;
                      // Touch screens and narrow windows: the Quick view opens as a bottom sheet.
                      if (window.matchMedia("(hover: none)").matches || window.innerWidth < 1020) setSheet(u.id);
                      else setPinned(u.id);
                    }}
                    aria-selected={u.id === pinned}
                    className={cx("cursor-pointer border-t border-[#EEEFF2] transition-colors", on && "bg-[#FDF6F5] shadow-[inset_3px_0_0_#8B0000]")}
                  >
                    <td className="py-3 pl-5 pr-2.5">
                      <div className="flex items-center gap-3">
                        <Avatar u={u} size="sm" />
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span className="flex items-center gap-2">
                            <Link href={`/admin/users/${u.id}`} className="whitespace-nowrap font-bold text-ink hover:text-primary hover:underline">
                              {u.name}
                            </Link>
                            {isNewSince(u.joinedAt, since ? new Date(since) : null) && <NewPill label={t("admin.whatsNew.tag")} />}
                          </span>
                          {u.username && <span className="text-[13.5px] text-muted">@{u.username}</span>}
                          <CheckLine u={u} />
                        </div>
                      </div>
                    </td>
                    <td className="p-2.5">
                      <RoleCell u={u} />
                    </td>
                    <td className="p-2.5">
                      <div className="flex flex-col items-start gap-1.5">
                        <span className={cx(PILL, STATUS_PILL[u.status])}>{t(`admin.users.x.status.${u.status}`)}</span>
                        {u.role !== "admin" && <Strikes n={u.strikes} />}
                      </div>
                    </td>
                    <td className="py-3 pl-2.5 pr-5">
                      <LastActive u={u} />
                    </td>
                    {/* One-click delete (owner, 2026-10-18): never for admins or yourself. */}
                    {canManage && <td className="py-3 pr-4 text-right">{u.role !== "admin" && u.id !== meId && <QuickDelete kind="user" id={u.id} name={u.name} />}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Quick view: beside the table on wide screens */}
      <aside className="sticky top-[84px] hidden max-h-[calc(100vh-100px)] min-w-0 flex-[2_1_330px] flex-col gap-3.5 overflow-y-auto rounded-2xl border border-[#E9EAEE] bg-white p-5 min-[1020px]:flex">
        <div className="flex items-center justify-between gap-2.5">
          <h2 className="lc-d m-0 text-[21px] font-semibold tracking-[-0.025em] text-ink">{t("admin.users.x.quick.title")}</h2>
          <span className="text-[13px] font-semibold text-muted">{t("admin.users.x.quick.hint")}</span>
        </div>
        {shown && <QuickView key={shown.id} u={shown} canManage={canManage} meId={meId} />}
      </aside>

      {/* Quick view as a bottom sheet on phones and tablets */}
      {sheetUser && (
        <div className="fixed inset-0 z-[90] flex items-end bg-[rgba(17,18,22,.45)] min-[1020px]:hidden" onClick={() => setSheet(null)}>
          <div role="dialog" aria-modal="true" aria-label={t("admin.users.x.quick.title")} className="max-h-[88vh] w-full overflow-y-auto rounded-t-[22px] bg-white p-5 pb-8" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="lc-d m-0 text-xl font-semibold text-ink">{t("admin.users.x.quick.title")}</h2>
              <button type="button" onClick={() => setSheet(null)} aria-label={t("admin.users.x.quick.close")} className="flex size-10 items-center justify-center rounded-xl bg-[#F4F5F7] text-xl text-ink">
                ×
              </button>
            </div>
            <QuickView key={sheetUser.id} u={sheetUser} canManage={canManage} meId={meId} />
          </div>
        </div>
      )}
    </div>
  );
}

function RoleCell({ u }: { u: UserCard }) {
  const { t, locale } = useI18n();
  const n = (v: number) => formatNumber(v, locale);
  return (
    <div className="flex flex-col items-start gap-1">
      <span className={cx(PILL, ROLE_PILL[u.role])}>{t(`admin.users.x.role.${u.role}`)}</span>
      <span className="whitespace-nowrap text-[13.5px] text-muted">
        {u.role === "client"
          ? u.stats.a === 1
            ? t("admin.users.x.clientOne", { b: formatTaka(u.stats.b, locale) })
            : t("admin.users.x.client", { a: n(u.stats.a), b: formatTaka(u.stats.b, locale) })
          : u.role === "designer"
            ? t("admin.users.x.designer", { a: n(u.stats.a), b: n(u.stats.b) })
            : u.superAdmin
              ? t("admin.users.x.superAdmin")
              : (u.adminTitle ?? t("admin.users.x.staff"))}
      </span>
    </div>
  );
}

function LastActive({ u }: { u: UserCard }) {
  const { t, locale } = useI18n();
  const now = new Date();
  return (
    <div className="flex flex-col gap-0.5 whitespace-nowrap">
      <strong className={cx("text-[14.5px]", u.online ? "text-[#14633C]" : "text-ink")}>
        {u.online ? t("admin.users.x.online") : u.lastSeenAt ? timeAgo(new Date(u.lastSeenAt), now, locale) : t("admin.users.x.never")}
      </strong>
      <span className="text-[13.5px] text-muted">{t("admin.users.x.joined", { date: formatDate(new Date(u.joinedAt), locale, "short") })}</span>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-t border-[#EEEFF2] py-2.5 text-[15px]">
      <span className="text-muted">{label}</span>
      <span className="min-w-0 text-right font-semibold text-ink [overflow-wrap:anywhere]">{children}</span>
    </div>
  );
}

function QuickView({ u, canManage, meId }: { u: UserCard; canManage: boolean; meId: string }) {
  const { t, locale } = useI18n();
  const [action, setAction] = useState<Action | null>(null);
  const n = (v: number) => formatNumber(v, locale);
  const now = new Date();
  const stats =
    u.role === "client"
      ? [
          [t("admin.users.x.quick.contests"), n(u.stats.a)],
          [t("admin.users.x.quick.spent"), formatTaka(u.stats.b, locale)],
          [t("admin.users.x.quick.picked"), n(u.stats.c)],
        ]
      : u.role === "designer"
        ? [
            [t("admin.users.x.quick.designs"), n(u.stats.a)],
            [t("admin.users.x.quick.wins"), n(u.stats.b)],
            [t("admin.users.x.quick.earned"), formatTaka(u.stats.c, locale)],
          ]
        : [];
  const when = u.online ? t("admin.users.x.online") : u.lastSeenAt ? t("admin.users.x.quick.lastActive", { when: timeAgo(new Date(u.lastSeenAt), now, locale) }) : t("admin.users.x.never");
  const canAct = canManage && u.role !== "admin" && !u.superAdmin && u.id !== meId;
  const BTN = "h-[42px] flex-1 rounded-xl border bg-white text-[14.5px] font-bold";

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center gap-3">
        <Avatar u={u} size="lg" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <strong className="text-lg text-ink">{u.name}</strong>
          <span className="text-sm text-muted">{[u.username && `@${u.username}`, t(`admin.users.x.role.${u.role}`), when].filter(Boolean).join(" · ")}</span>
          <CheckLine u={u} />
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <span className={cx(PILL, ROLE_PILL[u.role])}>{t(`admin.users.x.role.${u.role}`)}</span>
        <span className={cx(PILL, STATUS_PILL[u.status])}>{t(`admin.users.x.status.${u.status}`)}</span>
      </div>
      {stats.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {stats.map(([label, value]) => (
            <div key={label} className="flex-[1_1_90px] rounded-xl bg-[#F4F5F7] px-3 py-2.5">
              <span className="block text-[12.5px] font-bold text-muted">{label}</span>
              <strong className="lc-d text-xl text-ink">{value}</strong>
            </div>
          ))}
        </div>
      )}
      <div>
        {u.contact && <Row label={t("admin.users.x.quick.mobile")}>{formatMobile(u.contact.mobile)}</Row>}
        {u.contact?.email && <Row label={t("admin.users.x.quick.email")}>{u.contact.email}</Row>}
        <Row label={t("admin.users.x.quick.joined")}>{formatDate(new Date(u.joinedAt), locale, "long")}</Row>
        {u.role !== "admin" && (
          <Row label={t("admin.users.x.quick.strikes")}>
            <Strikes n={u.strikes} />
          </Row>
        )}
        {u.status === "suspended" && (
          <Row label={t("admin.users.x.status.suspended")}>
            {u.suspendedUntil ? t("admin.users.x.quick.until", { date: new Date(u.suspendedUntil).toLocaleString(locale === "bn" ? "bn-BD" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" }) }) : t("admin.users.x.quick.untilLifted")}
          </Row>
        )}
      </div>
      {u.profile && (
        <div className="flex flex-col gap-2.5 rounded-xl border border-[#EBECEF] p-3">
          <strong className="text-[15px] text-ink">{t("admin.users.x.remind.title")}</strong>
          <ProfileFacts profile={u.profile} />
          {canAct && u.status !== "banned" && <RemindButtons userId={u.id} profile={u.profile} reminded={u.reminded} />}
        </div>
      )}
      {!canManage ? (
        <p className="m-0 rounded-xl bg-[#F4F5F7] px-3 py-3 text-sm text-muted">{t("admin.users.x.quick.noContact")}</p>
      ) : u.role === "admin" ? (
        <p className="m-0 rounded-xl bg-[#F4F5F7] px-3 py-3 text-sm text-muted">{t("admin.users.x.quick.adminNote")}</p>
      ) : (
        <div className="flex flex-col gap-2">
          <Link href={`/admin/messages?to=${u.id}`} className="flex h-11 items-center justify-center rounded-xl bg-primary text-[15px] font-bold text-white">
            {t("admin.users.x.actions.message")}
          </Link>
          {canAct && (
            <div className="flex gap-2">
              {u.status === "active" && (
                <>
                  <button type="button" onClick={() => setAction("suspend")} className={cx(BTN, "border-[#F6D9B8] text-[#9A3412]")}>
                    {t("admin.users.x.actions.suspend")}
                  </button>
                  <button type="button" onClick={() => setAction("ban")} className={cx(BTN, "border-[#F3C4C0] text-[#A3121B]")}>
                    {t("admin.users.x.actions.ban")}
                  </button>
                </>
              )}
              {u.status === "suspended" && (
                <>
                  <button type="button" onClick={() => setAction("unsuspend")} className={cx(BTN, "border-[#DCDEE3] text-ink")}>
                    {t("admin.users.x.actions.unsuspend")}
                  </button>
                  <button type="button" onClick={() => setAction("ban")} className={cx(BTN, "border-[#F3C4C0] text-[#A3121B]")}>
                    {t("admin.users.x.actions.ban")}
                  </button>
                </>
              )}
              {u.status === "banned" && (
                <button type="button" onClick={() => setAction("unban")} className={cx(BTN, "border-[#DCDEE3] text-ink")}>
                  {t("admin.users.x.actions.unban")}
                </button>
              )}
            </div>
          )}
        </div>
      )}
      <Link href={`/admin/users/${u.id}`} className="self-start text-sm font-bold text-primary">
        {t("admin.users.x.quick.open")} →
      </Link>
      {action && <ActionDialog u={u} action={action} onClose={() => setAction(null)} />}
    </div>
  );
}

/**
 * Suspend for 48 hours (counts toward the ban: the 3rd within 30 days bans), lift a suspension early, ban (with a
 * confirm step) and unban, each with a required reason (owner, 2026-10-12).
 */
function ActionDialog({ u, action, onClose }: { u: UserCard; action: Action; onClose: () => void }) {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [sure, setSure] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const title = t(`admin.users.x.actions.${action}`);
  // The 3rd suspension within 30 days bans the account, so the sheet says so before it happens.
  const lastOne = action === "suspend" && u.strikes >= 2;
  const body = t(`admin.users.x.actions.${action === "suspend" ? (lastOne ? "suspendBans" : "suspendBody") : action === "ban" ? "banBody" : action === "unsuspend" ? "unsuspendBody" : "unbanBody"}`);

  const run = () =>
    start(async () => {
      setError(null);
      const res =
        action === "suspend" ? await giveStrike(u.id, { reason }) : await setUserStatus(u.id, action === "ban" ? "banned" : "active", { reason });
      if (!res.ok) return setError(t(res.error));
      toast(t("admin.users.x.actions.done"));
      onClose();
      router.refresh();
    });

  const ready = reason.trim().length >= 3 && (action !== "ban" || sure);
  return (
    <Modal
      open
      onClose={onClose}
      title={`${title} · ${u.name}`}
      closeLabel={t("admin.users.x.quick.close")}
      footer={
        <div className="w-full space-y-2">
          {error && <Alert tone="danger">{error}</Alert>}
          <Button block size="lg" variant={action === "ban" ? "danger" : "primary"} loading={busy} disabled={!ready} onClick={run}>
            {action === "ban" ? t("admin.users.x.actions.banConfirm", { name: u.name }) : t("admin.users.x.actions.confirm")}
          </Button>
        </div>
      }
    >
      <p className="m-0 text-sm text-muted">{body}</p>
      <label className="mt-3 flex flex-col gap-1.5 text-sm font-bold text-ink">
        {t("admin.users.x.actions.reason")}
        <textarea
          rows={3}
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t("admin.users.x.actions.reasonPlaceholder")}
          className="resize-y rounded-xl border border-[#DCDEE3] px-3 py-2.5 text-[15px] font-medium focus:outline-2 focus:outline-offset-1 focus:outline-primary"
        />
      </label>
      {action === "ban" && (
        <label className="mt-3 flex items-center gap-2 text-sm font-bold text-[#A3121B]">
          <input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} className="size-4 accent-[#A3121B]" />
          {t("admin.users.x.actions.banSure", { name: u.name })}
        </label>
      )}
    </Modal>
  );
}
