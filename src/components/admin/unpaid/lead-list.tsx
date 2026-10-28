import Link from "@/components/ui/link";
import { AdminIcon } from "@/components/admin/icons";
import { AdmCard, IdChip, isNewSince, NewPill } from "@/components/admin/ui";
import type { Lead } from "@/lib/admin/unpaid-board";
import { AMOUNTS, PAID, SORTS, STAGES, STARTED, TABS, unpaidHref, type ShownStatus, type Tab, type UnpaidQuery } from "@/lib/admin/unpaid-rules";
import { cx } from "@/lib/cx";
import type { MessageKey, Translate } from "@/lib/i18n/translate";
import { Dropdown, LeadLink, LeadSearch, QuickReach } from "./actions";

/**
 * "People to follow up" (owner, 2026-10-25; Design/unpaid-contests §5): search, sort, tabs with counts, filters and a
 * card per person. Everything is in the address, so a view can be shared and the page works without JavaScript.
 */

export type Fmt = { t: Translate; num: (n: number) => string; taka: (n: number) => string; when: (d: Date) => string; day: (d: Date) => string; stepName: (n: number) => string };

const PILL: Record<string, string> = {
  new: "bg-[#111216] text-white",
  in_touch: "bg-[#F1F1F5] text-[#3A3C45]",
  promised: "bg-[#E4F5EC] text-[#14633C]",
  won: "bg-[#E4F5EC] text-[#14633C]",
  needs_help: "bg-[#E6EEF8] text-[#24406B]",
  not_reachable: "bg-[#FFF1D6] text-[#8A5A00]",
  overdue: "bg-[#FFE9E7] text-[#B3261E]",
  closed: "bg-[#F1F1F5] text-[#6A6D78]",
};
export function StatusPill({ status, t }: { status: ShownStatus; t: Translate }) {
  return <span className={cx("inline-flex items-center whitespace-nowrap rounded-full px-[9px] py-[3px] text-[12px] font-bold", PILL[status.startsWith("closed") ? "closed" : status])}>{t(`admin.unpaid.fu.status.${status}` as MessageKey)}</span>;
}

const AVATARS = ["bg-[#8B0000] text-white", "bg-[#5C0A0C] text-white", "bg-[#F4EFE4] text-[#7A1E12]", "bg-[#D9E6F7] text-[#24406B]", "bg-[#DDF1E3] text-[#1D5B37]", "bg-[#F0F1F4] text-[#3A3C45]"];
const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
export function LeadAvatar({ lead, size = "md" }: { lead: Lead; size?: "md" | "lg" }) {
  const letter = (lead.brand || lead.clientName || "?").trim().slice(0, 1).toUpperCase() || "?";
  return <span className={cx("lc-d flex shrink-0 items-center justify-center font-semibold", size === "lg" ? "size-14 rounded-[16px] text-[22px]" : "size-[38px] rounded-[12px] text-[15px]", AVATARS[hash(lead.key) % AVATARS.length])}>{letter}</span>;
}

/** The 10-part bar: done (green), where they stopped (red), not reached (grey). */
export function StageBar({ lead }: { lead: Lead }) {
  const paid = lead.stage >= PAID || Boolean(lead.wonBackAt);
  return (
    <span className="grid grid-cols-10 gap-0.5" aria-hidden>
      {Array.from({ length: STAGES }, (_, i) => i + 1).map((n) => (
        <span key={n} className={cx("h-[5px] rounded-[3px]", paid || n < lead.stage ? "bg-[#2BB673]" : n === lead.stage ? "bg-[#B3261E] ring-2 ring-[#FFD9D6]" : "bg-[#ECEDF0]")} />
      ))}
    </span>
  );
}

export const deviceIcon = (d: string | null) => (d === "desktop" ? "computer" : d ? "device" : null);

const Option = ({ href, on, children }: { href: string; on: boolean; children: React.ReactNode }) => (
  <li>
    <Link prefetch={false} href={href} scroll={false} aria-current={on ? "true" : undefined} className={cx("flex min-h-9 items-center rounded-[8px] px-2.5 text-[13.5px] font-semibold hover:bg-[#F4F5F7]", on && "text-primary")}>
      {children}
    </Link>
  </li>
);

export function LeadList({
  rows,
  counts,
  q,
  fmt,
  me,
  owners,
  canManage,
  since,
  selectedKey,
  status,
  totalOpen,
}: {
  rows: Lead[];
  counts: Record<Tab, number>;
  q: UnpaidQuery;
  fmt: Fmt;
  me: string;
  owners: { id: string; name: string }[];
  canManage: boolean;
  since: Date | null;
  selectedKey: string | null;
  status: (l: Lead) => ShownStatus;
  totalOpen: number;
}) {
  const { t, num, taka, when, day, stepName } = fmt;
  const filtered = Boolean(q.q || q.step || q.owner || q.amount || q.started || q.only);
  const ownerName = q.owner === "me" ? t("admin.unpaid.fu.list.filters.me") : q.owner === "none" ? t("admin.unpaid.fu.list.filters.none") : owners.find((o) => o.id === q.owner)?.name;
  return (
    <AdmCard as="section" className="flex min-w-0 scroll-mt-24 flex-col gap-3 p-5" id="ulist" data-unpaid-list>
      <h2 className="m-0 text-[20px] font-semibold tracking-[-0.02em]">{t("admin.unpaid.fu.list.title")}</h2>
      <div className="flex flex-wrap gap-2">
        <LeadSearch key={q.q} q={q} canManage={canManage} placeholder={t(canManage ? "admin.unpaid.fu.list.search" : "admin.unpaid.fu.list.searchView")} />
        <Dropdown label={t("admin.unpaid.fu.list.sort", { sort: t(`admin.unpaid.fu.list.sorts.${q.sort}`) })} active={false}>
          {SORTS.map((s) => (
            <Option key={s} href={unpaidHref(q, { sort: s })} on={q.sort === s}>
              {t(`admin.unpaid.fu.list.sorts.${s}`)}
            </Option>
          ))}
        </Dropdown>
      </div>
      <nav className="flex flex-wrap gap-1.5" aria-label={t("admin.unpaid.fu.list.title")}>
        {TABS.map((tab) => (
          <Link prefetch={false} key={tab} href={unpaidHref(q, { tab, sel: null })} scroll={false} aria-current={q.tab === tab ? "page" : undefined} className={cx("inline-flex min-h-8 items-center gap-1.5 rounded-[10px] px-2.5 text-[12.5px] font-bold", q.tab === tab ? "bg-[#111216] text-white" : "bg-[#F4F5F7] text-ink hover:bg-[#ECEDF0]")}>
            {t(`admin.unpaid.fu.list.tabs.${tab}`)}
            <i className="not-italic opacity-60 tabular-nums">{num(counts[tab])}</i>
          </Link>
        ))}
      </nav>
      <div className="flex flex-wrap items-center gap-1.5">
        <Dropdown label={q.step ? `${t("admin.unpaid.fu.list.filters.step")}: ${stepName(q.step)}` : t("admin.unpaid.fu.list.filters.step")} active={Boolean(q.step)}>
          <Option href={unpaidHref(q, { step: null })} on={!q.step}>
            {t("admin.unpaid.fu.list.filters.any")}
          </Option>
          {Array.from({ length: STAGES - 1 }, (_, i) => i + 1).map((n) => (
            <Option key={n} href={unpaidHref(q, { step: n })} on={q.step === n}>
              {num(n)} · {stepName(n)}
            </Option>
          ))}
        </Dropdown>
        <Dropdown label={ownerName ? `${t("admin.unpaid.fu.list.filters.owner")}: ${ownerName}` : t("admin.unpaid.fu.list.filters.owner")} active={Boolean(q.owner)}>
          <Option href={unpaidHref(q, { owner: null })} on={!q.owner}>
            {t("admin.unpaid.fu.list.filters.anyone")}
          </Option>
          <Option href={unpaidHref(q, { owner: "me" })} on={q.owner === "me"}>
            {t("admin.unpaid.fu.list.filters.me")}
          </Option>
          <Option href={unpaidHref(q, { owner: "none" })} on={q.owner === "none"}>
            {t("admin.unpaid.fu.list.filters.none")}
          </Option>
          {owners
            .filter((o) => o.id !== me)
            .map((o) => (
              <Option key={o.id} href={unpaidHref(q, { owner: o.id })} on={q.owner === o.id}>
                {o.name}
              </Option>
            ))}
        </Dropdown>
        <Dropdown label={q.amount ? `${t("admin.unpaid.fu.list.filters.amount")}: ${t(`admin.unpaid.fu.list.filters.amounts.${q.amount}`)}` : t("admin.unpaid.fu.list.filters.amount")} active={Boolean(q.amount)}>
          <Option href={unpaidHref(q, { amount: null })} on={!q.amount}>
            {t("admin.unpaid.fu.list.filters.any")}
          </Option>
          {AMOUNTS.map((a) => (
            <Option key={a} href={unpaidHref(q, { amount: a })} on={q.amount === a}>
              {t(`admin.unpaid.fu.list.filters.amounts.${a}`)}
            </Option>
          ))}
        </Dropdown>
        <Dropdown label={q.started ? `${t("admin.unpaid.fu.list.filters.started")}: ${t(`admin.unpaid.fu.list.filters.startedOptions.${q.started}`)}` : t("admin.unpaid.fu.list.filters.started")} active={Boolean(q.started)}>
          <Option href={unpaidHref(q, { started: null })} on={!q.started}>
            {t("admin.unpaid.fu.list.filters.any")}
          </Option>
          {STARTED.map((s) => (
            <Option key={s} href={unpaidHref(q, { started: s })} on={q.started === s}>
              {t(`admin.unpaid.fu.list.filters.startedOptions.${s}`)}
            </Option>
          ))}
        </Dropdown>
        {q.only && <span className="inline-flex min-h-8 items-center rounded-[9px] bg-[#111216] px-2.5 text-[12.5px] font-bold text-white">{t("admin.unpaid.fu.list.foundByContact")}</span>}
        {filtered && (
          <Link prefetch={false} href={unpaidHref({ ...q, q: "", step: null, owner: null, amount: null, started: null, only: null, sel: null })} scroll={false} className="text-[12.5px] font-bold text-primary hover:underline">
            {t("admin.unpaid.fu.list.filters.clear")}
          </Link>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="m-0 rounded-[14px] bg-[#F7F7F9] px-4 py-6 text-center text-[15px] text-muted">{t(filtered ? "admin.unpaid.fu.list.noMatch" : totalOpen === 0 && q.tab === "all" ? "admin.unpaid.fu.list.emptyAll" : "admin.unpaid.fu.list.empty")}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {rows.map((l) => {
            const on = l.key === selectedKey;
            const shown = status(l);
            const dev = deviceIcon(l.device);
            const overdue = shown === "overdue";
            return (
              <li key={l.key} className={cx("relative flex flex-col gap-2.5 rounded-[16px] border p-3", on ? "border-[#F3D2CF] bg-[#FDF6F5] shadow-[inset_3px_0_0_#8B0000]" : "border-adm-line-soft hover:bg-[#FAFAFB]")} data-lead-row>
                <div className="flex items-start gap-2.5">
                  <LeadAvatar lead={l} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <LeadLink href={unpaidHref(q, { sel: l.key })} label={l.brand || l.clientName || t("admin.unpaid.fu.list.guest")} className="truncate text-[15px] font-bold after:absolute after:inset-0 after:rounded-[16px] hover:text-primary">
                        {l.brand || l.clientName || t("admin.unpaid.fu.list.guest")}
                      </LeadLink>
                      {l.number && <IdChip prefix="LC" n={l.number} />}
                      {isNewSince(l.createdAt, since) && <NewPill label={t("admin.whatsNew.tag")} />}
                      {l.isTest && <span className="rounded-[6px] bg-adm-sample-bg px-1.5 text-[11px] font-bold text-adm-sample">{t("admin.unpaid.fu.list.test")}</span>}
                    </span>
                    <em className="flex flex-wrap items-center gap-x-1 text-[13px] not-italic text-muted">
                      {l.kind === "guest" ? `${l.clientName || t("admin.unpaid.fu.list.guest")} · ${t("admin.unpaid.fu.list.guestTag")}` : l.clientName || "—"}
                      <span>· {t("admin.unpaid.fu.list.started", { when: when(l.createdAt) })}</span>
                      {dev && <AdminIcon name={dev} size={12} />}
                    </em>
                  </span>
                  {l.amount ? (
                    <span className="flex shrink-0 flex-col items-end">
                      <b className="text-[15px] tabular-nums text-primary">{taka(l.amount)}</b>
                      <em className="text-[11px] not-italic text-muted">{t("admin.unpaid.fu.list.toPay")}</em>
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-col gap-1">
                  <StageBar lead={l} />
                  <span className="text-[12.5px] text-muted">
                    {t("admin.unpaid.fu.list.step", { n: num(Math.min(l.stage, STAGES)), all: num(STAGES), step: stepName(Math.min(l.stage, STAGES)) })}
                    {l.paymentFailed && <b className="text-[#B3261E]"> · {t("admin.unpaid.fu.list.failed")}</b>}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <span className={cx("flex min-w-0 flex-col rounded-[10px] px-2.5 py-1.5", on ? "bg-surface" : "bg-[#F7F7F9]")}>
                    <span className="text-[10.5px] font-extrabold uppercase tracking-[0.04em] text-[#8A8C96]">{t("admin.unpaid.fu.list.lastContact")}</span>
                    <b className="truncate text-[12.5px]">{l.lastContact ? `${t(`admin.unpaid.fu.type.${l.lastContact.type}` as MessageKey)} · ${when(l.lastContact.at)}` : t("admin.unpaid.fu.list.noContact")}</b>
                    <em className="truncate text-[11.5px] not-italic text-muted">{l.lastContact?.result ? t(`admin.unpaid.fu.results.${l.lastContact.result}` as MessageKey) : "—"}</em>
                  </span>
                  <span className={cx("flex min-w-0 flex-col rounded-[10px] px-2.5 py-1.5", on ? "bg-surface" : "bg-[#F7F7F9]")}>
                    <span className="text-[10.5px] font-extrabold uppercase tracking-[0.04em] text-[#8A8C96]">{t("admin.unpaid.fu.list.nextFollowUp")}</span>
                    <b className={cx("truncate text-[12.5px]", overdue && "text-[#B3261E]")}>{l.nextAt ? when(l.nextAt) : t("admin.unpaid.fu.list.none")}</b>
                    <em className="truncate text-[11.5px] not-italic text-muted">{l.contacts === 1 ? t("admin.unpaid.fu.list.contactOne") : t("admin.unpaid.fu.list.contactMany", { n: num(l.contacts) })}</em>
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex min-w-0 flex-wrap items-center gap-2">
                    <StatusPill status={shown} t={t} />
                    <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-muted">
                      <AdminIcon name="user" size={12} />
                      {l.owner?.name ?? "—"}
                    </span>
                    {l.wonBack && <span className="text-[12.5px] font-semibold text-adm-good">{taka(l.wonBack.amount)} · {day(l.wonBack.at)}</span>}
                  </span>
                  {canManage && l.status !== "closed" && !l.wonBackAt && <QuickReach leadKey={l.key} has={{ mobile: l.hasContact.mobile }} resume={l.kind === "contest" && Boolean(l.contestId) && l.stage < PAID} noteHref={unpaidHref(q, { sel: l.key }, "#log-note")} />}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </AdmCard>
  );
}
