import Link from "@/components/ui/link";
import { AdminAction } from "@/components/admin/admin-action";
import { AdminIcon, type AdminIconName } from "@/components/admin/icons";
import { AdmCard, IdChip } from "@/components/admin/ui";
import { closeLead, reopenLead } from "@/lib/admin/unpaid-followup-actions";
import type { HistoryItem, Lead } from "@/lib/admin/unpaid-board";
import type { RemindWay } from "@/lib/admin/unpaid-alert-rules";
import { PAID, STAGES, type ShownStatus } from "@/lib/admin/unpaid-rules";
import { cx } from "@/lib/cx";
import type { MessageKey } from "@/lib/i18n/translate";
import { CloseFakeButton, CopyResume, LogFollowUp, NextFollowUpActions, ReachButtons, RevealContact } from "./actions";
import { ContestFacts, LeadAvatar, StatusPill, V2Chip, v2StepName, type Fmt } from "./lead-list";

/**
 * One lead's details (owner, 2026-10-25; Design/unpaid-contests §6): who, how to reach them (Unpaid · Manage only, each
 * reach logged), where they stopped, the next follow-up, the Log form, History and the close options.
 */

const TONE: Record<HistoryItem["tone"], string> = {
  good: "bg-[#E4F5EC] text-[#14633C]",
  bad: "bg-[#FFE9E7] text-[#B3261E]",
  info: "bg-[#E6EEF8] text-[#24406B]",
  amber: "bg-[#FFF1D6] text-[#8A5A00]",
  neutral: "bg-[#F1F1F5] text-[#6A6D78]",
};
const KIND_ICON: Record<HistoryItem["kind"], AdminIconName> = { call: "phone", whatsapp: "whatsapp", sms: "sms", email: "mail", note: "note", system: "flag", chat: "chat" };

function duration(ms: number, t: Fmt["t"], num: Fmt["num"]) {
  const m = Math.max(0, Math.floor(ms / 60_000));
  if (m < 60) return t("admin.unpaid.fu.details.minutes", { m: num(m) });
  const h = Math.floor(m / 60);
  if (h < 24) return t("admin.unpaid.fu.details.hoursMinutes", { h: num(h), m: num(m % 60) });
  return t("admin.unpaid.fu.details.dayHours", { d: num(Math.floor(h / 24)), h: num(h % 24) });
}

export function LeadDetails({
  lead,
  status,
  history,
  fmt,
  now,
  canManage,
  isSuperAdmin,
  owners,
  me,
  masked,
  resumeDays,
  gone = false,
  remindDefault = ["alert"],
}: {
  lead: Lead | null;
  status: ShownStatus | null;
  history: HistoryItem[];
  fmt: Fmt;
  now: Date;
  canManage: boolean;
  isSuperAdmin: boolean;
  owners: { id: string; name: string }[];
  me: string;
  masked: string | null;
  /** How long the client's resume link works, when there is one (an unpaid draft). */
  resumeDays: number | null;
  /** "Remind me by" when the follow-up has no choice of its own: the team's Instant alerts (phase 3). */
  remindDefault?: RemindWay[];
  /** A link named a lead that is no longer on the list. */
  gone?: boolean;
}) {
  const { t, num, taka, when, day, stepName } = fmt;
  if (!lead || !status) {
    return (
      <AdmCard as="section" id="lead" className="scroll-mt-24 p-5" data-unpaid-lead>
        <p className="m-0 text-[15px] text-muted">{t(gone ? "admin.unpaid.fu.details.gone" : "admin.unpaid.fu.details.pick")}</p>
      </AdmCard>
    );
  }
  const open = lead.status !== "closed" && !lead.wonBackAt;
  // Only admins who can follow up can be picked; a lead whose owner lost that falls back to you.
  const ownerList = owners;
  const ownerId = lead.owner && owners.some((o) => o.id === lead.owner!.id) ? lead.owner.id : owners.some((o) => o.id === me) ? me : (owners[0]?.id ?? me);
  const stage = Math.min(lead.stage, STAGES);
  const paid = lead.stage >= PAID || Boolean(lead.wonBackAt);
  // The new wizard's own step (owner, 2026-10-29); the bar below keeps the shared 1..10.
  const stuck = lead.v2Step ? v2StepName(lead.v2Step, t, lead.package) : t("admin.unpaid.fu.details.stuck", { n: num(stage), all: num(STAGES), step: stepName(stage) });
  const failure = lead.paymentFailed ? (lead.paymentFailed.kind === "card" ? t("admin.unpaid.fu.details.failedCard") : lead.paymentFailed.note ? t("admin.unpaid.fu.details.failedBkash", { note: lead.paymentFailed.note }) : t("admin.unpaid.fu.details.failedBkashNoNote")) : null;
  // A new-wizard step-1 sign-up (owner, 2026-10-29) is listed by its number like a guest, but has an account.
  const account = lead.kind === "guest" && Boolean(lead.clientId);
  const meta = [
    lead.kind === "guest" ? lead.clientName || t("admin.unpaid.fu.list.guest") : lead.clientName || "—",
    lead.kind === "guest" && !(account && lead.signedUpAt) ? t("admin.unpaid.fu.details.gaveNumber", { when: day(lead.createdAt) }) : lead.signedUpAt ? t("admin.unpaid.fu.details.signedUp", { when: day(lead.signedUpAt) }) : null,
    lead.device ? t("admin.unpaid.fu.details.startedOn", { device: t(`admin.unpaid.fu.devices.${lead.device}` as MessageKey) }) : null,
    lead.city,
  ].filter(Boolean);
  const facts: [string, string][] = [
    [t("admin.unpaid.fu.details.waiting"), duration(now.getTime() - lead.createdAt.getTime(), t, num)],
    [lead.kind === "guest" ? t("admin.unpaid.fu.details.visitsGuest") : t("admin.unpaid.fu.details.visits"), num(lead.visits)],
    [t("admin.unpaid.fu.details.lastSeen"), lead.lastSeen ? when(lead.lastSeen) : "—"],
    [t("admin.unpaid.fu.details.contactsSoFar"), lead.lastContact ? t("admin.unpaid.fu.details.contactsValue", { n: num(lead.contacts), type: t(`admin.unpaid.fu.type.${lead.lastContact.type}` as MessageKey).toLowerCase() }) : num(lead.contacts)],
  ];

  return (
    // Keyed by the lead: when the list (or the 20-second refresh) shows another person, every open dialog, form and
    // shown phone number starts over, so nothing is done to the wrong person.
    <AdmCard key={lead.key} as="section" id="lead" className="relative flex min-w-0 scroll-mt-24 flex-col gap-3.5 p-5" data-unpaid-lead>
      {/* Head */}
      <div className="flex flex-wrap items-start gap-3.5">
        <LeadAvatar lead={lead} size="lg" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h2 className="lc-d m-0 truncate text-[26px] font-semibold tracking-[-0.02em]">
              {lead.slug ? (
                <Link prefetch={false} href={`/admin/contests/${lead.slug}`} className="hover:text-primary">
                  {lead.brand || "—"}
                </Link>
              ) : (
                lead.brand || lead.clientName || t("admin.unpaid.fu.list.guest")
              )}
            </h2>
            {lead.number && <IdChip prefix="LC" n={lead.number} />}
            <StatusPill status={status} t={t} />
            {lead.v2 && <V2Chip t={t} />}
          </div>
          <em className="text-[14px] not-italic text-muted">{meta.join(" · ")}</em>
          {/* Onboarding v2 (owner, 2026-10-29; spec §4): business type, package and when the client (not the team) last did something. */}
          <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <ContestFacts lead={lead} t={t} />
            {lead.clientActivityAt && <span className="text-[13px] text-muted">{t("wizardV2.admin.unpaid.lastActive", { when: when(lead.clientActivityAt) })}</span>}
          </span>
        </div>
        {lead.amount ? (
          <div className="flex flex-col items-end max-[700px]:w-full max-[700px]:items-start">
            <span className="text-[13px] font-bold text-muted">{t("admin.unpaid.fu.details.amount")}</span>
            <b className="lc-d text-[30px] font-semibold tabular-nums text-primary">{taka(lead.amount)}</b>
            {lead.prize ? <em className="text-[12.5px] not-italic text-muted">{lead.addons ? t("admin.unpaid.fu.details.breakdownAddons", { prize: taka(lead.prize), addons: taka(lead.addons) }) : t("admin.unpaid.fu.details.breakdown", { prize: taka(lead.prize) })}</em> : null}
          </div>
        ) : lead.noPackage ? (
          // The new wizard's total is only the default package's until the client picks one.
          <div className="flex flex-col items-end max-[700px]:w-full max-[700px]:items-start">
            <span className="text-[13px] font-bold text-muted">{t("wizardV2.admin.unpaid.package")}</span>
            <b className="text-[18px] font-semibold text-muted">{t("wizardV2.admin.unpaid.noPackage")}</b>
          </div>
        ) : null}
      </div>

      {/* Contact */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 rounded-[12px] bg-[#F7F7F9] px-3.5 py-2.5">
        {canManage ? <RevealContact leadKey={lead.key} masked={masked} hasEmail={lead.hasContact.email} /> : <span className="text-[14px] font-semibold text-muted">{t("admin.unpaid.fu.details.hidden")}</span>}
        <span className="text-[12.5px] text-muted">{t("admin.unpaid.fu.details.contactHint")}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {canManage && <ReachButtons leadKey={lead.key} has={{ mobile: lead.hasContact.mobile, email: lead.hasContact.email }} />}
        {canManage && resumeDays !== null && open && <CopyResume leadKey={lead.key} big />}
        {lead.slug && (
          <Link prefetch={false} href={`/admin/contests/${lead.slug}`} className="inline-flex min-h-11 items-center gap-2 rounded-[12px] px-2 text-[14px] font-bold text-primary hover:underline">
            {t("admin.unpaid.fu.details.openContest")}
            <AdminIcon name="arrow" size={14} />
          </Link>
        )}
      </div>
      {canManage && resumeDays !== null && open && <p className="-mt-2 m-0 text-[12.5px] text-muted">{t("admin.unpaid.fu.details.resumeHint", { days: num(resumeDays) })}</p>}
      {lead.kind === "guest" && !account && <p className="m-0 text-[13.5px] text-muted">{lead.detailsSaved || lead.clientName ? t("admin.unpaid.fu.details.guestNote") : t("admin.unpaid.fu.details.oldGuest")}</p>}

      {/* Where they stopped */}
      <div className="flex flex-col gap-3 rounded-[16px] border border-[#F3D2CF] bg-[linear-gradient(180deg,#FFF8F7,#fff)] p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <b className="text-[15px]">{paid ? t("admin.unpaid.fu.status.won") : stuck}</b>
          {failure && (
            <span className="inline-flex items-center gap-1.5 text-[13.5px] font-bold text-[#B3261E]">
              <AdminIcon name="warning" size={15} />
              {t("admin.unpaid.fu.details.paymentFailed")} · {failure}
            </span>
          )}
        </div>
        <ol className="m-0 flex list-none gap-1 p-0" aria-label={stuck}>
          {Array.from({ length: STAGES }, (_, i) => i + 1).map((n) => {
            const done = paid || n < stage;
            const here = !paid && n === stage;
            return (
              <li key={n} title={stepName(n)} className={cx("flex h-[30px] min-w-0 items-center justify-center gap-1 rounded-[9px] text-[12px] font-bold", here ? "flex-[3.4] bg-[#FFE9E7] px-1.5 text-[#B3261E] ring-[1.5px] ring-inset ring-[#B3261E]" : done ? "flex-1 bg-[#E4F5EC]" : "flex-1 bg-[#F1F1F5] text-[#6A6D78]")}>
                {done ? (
                  <span className="flex size-5 items-center justify-center rounded-full bg-[#2BB673] text-white">
                    <AdminIcon name="check" size={12} />
                  </span>
                ) : (
                  <>
                    <span className={cx("flex size-5 shrink-0 items-center justify-center rounded-full text-[11px]", here ? "bg-[#B3261E] text-white" : "bg-white")}>{num(n)}</span>
                    {here && <span className="truncate max-[700px]:hidden">{stepName(n)}</span>}
                  </>
                )}
              </li>
            );
          })}
        </ol>
        <dl className="m-0 grid grid-cols-2 gap-2 min-[901px]:grid-cols-4">
          {facts.map(([k, v]) => (
            <div key={k} className="flex min-w-0 flex-col rounded-[12px] border border-[#F1E3E1] bg-surface px-3 py-2">
              <dt className="text-[12px] font-bold text-muted">{k}</dt>
              <dd className="m-0 truncate text-[14px] font-bold">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Next follow-up, won back or closed */}
      {open && (
        <div className="flex flex-wrap items-center gap-3 rounded-[14px] border border-[#F2D9A8] bg-[#FFF8EC] px-3.5 py-3">
          <span className="flex size-[38px] shrink-0 items-center justify-center rounded-[11px] bg-[#D9A52B] text-white">
            <AdminIcon name="calendar" size={18} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <b className={cx("text-[15px]", status === "overdue" && "text-[#B3261E]")}>{lead.nextAt ? t("admin.unpaid.fu.details.next", { when: when(lead.nextAt) }) : t("admin.unpaid.fu.details.noFollowUp")}</b>
            {lead.nextAt && <em className="text-[13px] not-italic text-[#6B4E00]">{t("admin.unpaid.fu.details.nextBy", { type: t(`admin.unpaid.fu.type.${lead.nextType ?? "call"}` as MessageKey), name: lead.owner?.name ?? "—" })}</em>}
          </span>
          {canManage && <NextFollowUpActions leadKey={lead.key} owners={ownerList} ownerId={ownerId} type={lead.nextType} planned={Boolean(lead.nextAt)} />}
        </div>
      )}
      {lead.wonBack && <p className="m-0 rounded-[12px] bg-[#E4F5EC] px-3.5 py-2.5 text-[14px] font-bold text-[#14633C]">{t("admin.unpaid.fu.details.wonBack", { when: day(lead.wonBack.at), amount: taka(lead.wonBack.amount) })}</p>}
      {lead.status === "closed" && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] bg-[#F1F1F5] px-3.5 py-2.5">
          <span className="flex min-w-0 flex-col">
            <b className="text-[14px]">
              {t("admin.unpaid.fu.details.closedLine", {
                reason: lead.closedReason === "fake" && lead.fakeReason ? `${t(`admin.unpaid.fu.status.closed_fake`)} · ${t(`admin.unpaid.fu.fake.reasons.${lead.fakeReason}` as MessageKey)}` : t(`admin.unpaid.fu.status.closed_${lead.closedReason ?? "not_interested"}` as MessageKey),
                when: lead.closedAt ? when(lead.closedAt) : "—",
                name: lead.closedBy ?? "—",
              })}
            </b>
            {lead.closeNote && <em className="text-[13px] not-italic text-muted">“{lead.closeNote}”</em>}
          </span>
          {isSuperAdmin && <AdminAction label={t("admin.unpaid.fu.close.reopen")} body={t("admin.unpaid.fu.close.reopenBody")} done={t("admin.unpaid.fu.close.reopened")} run={reopenLead.bind(null, lead.key)} />}
        </div>
      )}
      {open && !canManage && <p className="m-0 text-[13.5px] text-muted">{t("admin.unpaid.fu.details.viewOnly")}</p>}

      {/* Log a follow-up | History */}
      <div className="grid gap-4 min-[901px]:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        {canManage && open ? <LogFollowUp key={lead.key} leadKey={lead.key} owners={ownerList} ownerId={ownerId} planned={Boolean(lead.nextAt)} remindBy={lead.remindBy ?? remindDefault} /> : null}
        <div className={cx("flex min-w-0 flex-col gap-2", !(canManage && open) && "min-[901px]:col-span-2")}>
          <h3 className="m-0 text-[17px] font-semibold">{t("admin.unpaid.fu.history.title")}</h3>
          {history.length === 0 ? (
            <p className="m-0 text-[14px] text-muted">{t("admin.unpaid.fu.history.empty")}</p>
          ) : (
            <ol className="m-0 flex list-none flex-col p-0">
              {history.map((h, i) => (
                <li key={i} className="relative flex gap-3 pb-3.5 before:absolute before:bottom-0 before:left-[14px] before:top-[32px] before:w-0.5 before:bg-adm-line-soft last:before:hidden">
                  <span className={cx("flex size-[30px] shrink-0 items-center justify-center rounded-[10px]", TONE[h.tone])}>
                    <AdminIcon name={h.event === "payment_failed" || h.event === "proof_rejected" ? "warning" : KIND_ICON[h.kind]} size={15} />
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[12.5px] text-muted">
                      <b className="text-adm-strong">{h.by ?? (h.visitor ? (lead.clientName ?? t("admin.unpaid.fu.list.guest")) : t("admin.unpaid.fu.history.system"))}</b> · {when(h.at)}
                    </span>
                    <p className="m-0 text-[14px]">
                      <b>
                        {h.event === "contact"
                          ? h.kind === "note"
                            ? t("admin.unpaid.fu.history.note")
                            : t("admin.unpaid.fu.history.contact", { how: t(`admin.unpaid.fu.type.${h.kind}` as MessageKey), result: h.result ? t(`admin.unpaid.fu.results.${h.result}` as MessageKey).toLowerCase() : "" })
                          : h.event === "old_note"
                            ? t("admin.unpaid.fu.history.old_note", { result: h.result ? t(`admin.unpaid.fu.results.${h.result}` as MessageKey).toLowerCase() : "" })
                            : t(`admin.unpaid.fu.history.${h.event}` as MessageKey)}
                      </b>
                      {h.note ? <> — “{h.note}”</> : null}
                    </p>
                    {h.next && (
                      <em className="inline-flex items-center gap-1 text-[12px] font-bold not-italic text-[#8A5A00]">
                        <AdminIcon name="calendar" size={12} />
                        {t("admin.unpaid.fu.history.next", { when: when(h.next) })}
                      </em>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {/* Close */}
      {canManage && open && (
        <div className="flex flex-wrap items-center gap-2 border-t border-adm-line-soft pt-3">
          <span className="text-[14px] text-muted">{t("admin.unpaid.fu.close.label")}</span>
          <AdminAction label={t("admin.unpaid.fu.close.notInterested")} body={t("admin.unpaid.fu.close.notInterestedBody")} done={t("admin.unpaid.fu.close.closed")} fields={[{ name: "note", kind: "text", label: t("admin.unpaid.fu.close.note") }]} run={closeLead.bind(null, lead.key, "not_interested")} />
          <AdminAction label={t("admin.unpaid.fu.close.paidOther")} body={t("admin.unpaid.fu.close.paidOtherBody")} done={t("admin.unpaid.fu.close.closed")} fields={[{ name: "note", kind: "text", label: t("admin.unpaid.fu.close.note") }]} run={closeLead.bind(null, lead.key, "paid_other")} />
          <CloseFakeButton leadKey={lead.key} />
        </div>
      )}
    </AdmCard>
  );
}
