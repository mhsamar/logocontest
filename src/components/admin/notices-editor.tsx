"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/translate";
import { DESIGNER_TIERS, SETTINGS_KEYS, type DesignerTier, type OptionalKey, type TierOff } from "@/lib/email/catalog";
import { saveNotifications } from "@/lib/notifications/admin-actions";
import { AUDIENCES, NOTICE_ROWS, type Audience, type Channel, type ChannelsOff, type NoticeRow, type TimingKey } from "@/lib/notifications/admin-catalog";
import { TIMING_INFO, timingLabelKey } from "@/lib/notifications/timing";
import { useReadOnly } from "./read-only";
import { ADM_INPUT } from "./ui";

const ICON: Record<Channel, string> = { bell: "🔔", push: "📲", email: "✉️" };

/**
 * Admin › Notifications (owner, 2026-10-15): every notice, by who gets it, with a switch for each way it goes and its
 * timings. Saved together, with a reason, like Settings.
 */
export function NoticesEditor({
  off: startOff,
  tierOff: startTierOff,
  timings: startTimings,
  earlyAccess,
  autoRemind,
}: {
  off: ChannelsOff;
  tierOff: TierOff;
  timings: Record<string, string>;
  earlyAccess: { on: boolean; minutes: number };
  autoRemind: boolean;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const readOnly = useReadOnly();
  const [tab, setTab] = useState<Audience>("designer");
  const [off, setOff] = useState<ChannelsOff>(startOff);
  const [timings, setTimings] = useState<Record<string, string>>(startTimings);
  const [tierOff, setTierOff] = useState<TierOff>(startTierOff);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, run] = useTransition();
  const norm = (o: ChannelsOff) => JSON.stringify(Object.fromEntries(Object.entries(o).filter(([, v]) => v.length).map(([k, v]) => [k, [...v].sort()]).sort()));
  const normTier = (o: TierOff) => JSON.stringify(DESIGNER_TIERS.map((x) => [...o[x]].sort()));
  const dirty = norm(off) !== norm(startOff) || normTier(tierOff) !== normTier(startTierOff) || Object.keys(timings).some((k) => timings[k] !== startTimings[k]);
  const tierOn = (tier: DesignerTier, k: OptionalKey) => !tierOff[tier].includes(k);
  const toggleTier = (tier: DesignerTier, k: OptionalKey) => setTierOff((cur) => ({ ...cur, [tier]: cur[tier].includes(k) ? cur[tier].filter((x) => x !== k) : [...cur[tier], k] }));
  const isOn = (r: NoticeRow, c: Channel) => r.locked || !(off[r.id] ?? []).includes(c);
  const toggle = (r: NoticeRow, c: Channel) =>
    setOff((cur) => {
      const now = cur[r.id] ?? [];
      return { ...cur, [r.id]: now.includes(c) ? now.filter((x) => x !== c) : [...now, c] };
    });

  const save = () =>
    run(async () => {
      setError(null);
      setErrors({});
      const changed = Object.fromEntries(Object.keys(timings).filter((k) => timings[k] !== startTimings[k]).map((k) => [k, timings[k]]));
      const res = await saveNotifications({ off, tierOff, timings: changed }, reason);
      if (!res.ok) {
        setErrors(res.errors ?? {});
        return setError(t(res.error));
      }
      setReason("");
      toast(t("admin.notices.saved"));
      router.refresh();
    });
  const cancel = () => {
    setOff(startOff);
    setTierOff(startTierOff);
    setTimings(startTimings);
    setErrors({});
    setError(null);
  };

  const rows = NOTICE_ROWS.filter((r) => r.audience === tab);
  const offCount = (a: Audience) => NOTICE_ROWS.filter((r) => r.audience === a && r.channels.some((c) => !isOn(r, c))).length;

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label={t("admin.notices.title")} className="flex flex-wrap gap-2">
        {AUDIENCES.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setTab(a)}
            aria-current={tab === a ? "page" : undefined}
            className={cx("min-h-10 rounded-full px-4 text-[14.5px] font-bold ring-1", tab === a ? "bg-ink text-white ring-ink" : "bg-surface text-ink ring-[#dcdee3] hover:bg-[#F7F8FA]")}
          >
            {t(`admin.notices.audiences.${a}.label` as MessageKey)}
            {offCount(a) > 0 && <span className="ml-1.5 rounded-full bg-[#FDECEC] px-1.5 text-[12px] text-[#A3121B]">{t("admin.notices.offCount", { n: String(offCount(a)) })}</span>}
          </button>
        ))}
      </nav>
      <p className="m-0 text-[14.5px] text-muted">{t(`admin.notices.audiences.${tab}.lead` as MessageKey)}</p>

      {/* Designer emails by plan (owner, 2026-10-15): Basic and Pro side by side; only the ones on are sent. */}
      {(tab === "designer" || tab === "pro") && (
        <section aria-labelledby="tier-emails" className="rounded-[16px] border border-adm-line bg-surface p-4 sm:p-5">
          <h3 id="tier-emails" className="m-0 text-[17px] font-semibold text-ink">
            ✉️ {t("admin.notices.tiers.title")}
          </h3>
          <p className="m-0 mt-1 text-[14px] text-muted">{t("admin.notices.tiers.lead")}</p>
          <div className="mt-3 hidden grid-cols-[minmax(0,1fr)_7.5rem_7.5rem] gap-2 px-1 text-[13px] font-bold uppercase tracking-wide text-adm-soft sm:grid">
            <span>{t("admin.notices.tiers.email")}</span>
            {DESIGNER_TIERS.map((tier) => (
              <span key={tier} className="text-center">
                {t(`admin.notices.tiers.${tier}`)}
              </span>
            ))}
          </div>
          <ul className="m-0 mt-1 flex list-none flex-col p-0">
            {SETTINGS_KEYS.designer.map((k) => (
              <li key={k} className="grid grid-cols-2 gap-2 border-t border-adm-line px-1 py-3 first:border-t-0 sm:grid-cols-[minmax(0,1fr)_7.5rem_7.5rem] sm:items-center">
                <span className="col-span-2 min-w-0 sm:col-span-1">
                  <span className="block text-[15px] font-semibold text-ink">{t(`email.prefs.types.${k}.label` as MessageKey)}</span>
                  <span className="block text-[13.5px] text-muted">{t(`email.prefs.types.${k}.hint` as MessageKey)}</span>
                </span>
                {DESIGNER_TIERS.map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    role="switch"
                    aria-checked={tierOn(tier, k)}
                    aria-label={`${t(`admin.notices.tiers.${tier}`)}: ${t(`email.prefs.types.${k}.label` as MessageKey)}`}
                    disabled={readOnly}
                    onClick={() => toggleTier(tier, k)}
                    className={cx(
                      "inline-flex min-h-9 items-center justify-center gap-1 rounded-full px-3 text-[13.5px] font-bold ring-1 disabled:cursor-default",
                      tierOn(tier, k) ? "bg-[#E8F5EE] text-[#1F7A4D] ring-[#BFE3CE]" : "bg-surface text-muted line-through ring-[#dcdee3]",
                    )}
                  >
                    <span className="sm:hidden">{t(`admin.notices.tiers.${tier}`)} ·</span> {tierOn(tier, k) ? t("admin.notices.on") : t("admin.notices.off")}
                  </button>
                ))}
              </li>
            ))}
          </ul>
          <p className="m-0 mt-2 text-[12.5px] text-muted">{t("admin.notices.tiers.note")}</p>
        </section>
      )}

      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {rows.map((r) => (
          <li key={r.id} className="rounded-[16px] border border-adm-line bg-surface p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1 basis-[260px]">
                <h3 className="m-0 text-[16px] font-semibold text-ink">{t(`admin.notices.rows.${r.id}.label` as MessageKey)}</h3>
                <p className="m-0 mt-1 text-[14px] text-muted">{t(`admin.notices.rows.${r.id}.when` as MessageKey)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {r.channels.map((c) =>
                  r.locked ? (
                    <span key={c} className="inline-flex min-h-9 items-center gap-1 rounded-full bg-[#F1F2F4] px-3 text-[13.5px] font-semibold text-muted ring-1 ring-[#E6E7EB]">
                      {ICON[c]} {t(`admin.notices.channels.${c}` as MessageKey)} · {t("admin.notices.always")}
                    </span>
                  ) : (
                    <button
                      key={c}
                      type="button"
                      role="switch"
                      aria-checked={isOn(r, c)}
                      disabled={readOnly}
                      onClick={() => toggle(r, c)}
                      className={cx(
                        "inline-flex min-h-9 items-center gap-1 rounded-full px-3 text-[13.5px] font-bold ring-1 disabled:cursor-default",
                        isOn(r, c) ? "bg-[#E8F5EE] text-[#1F7A4D] ring-[#BFE3CE]" : "bg-surface text-muted line-through ring-[#dcdee3]",
                      )}
                    >
                      {ICON[c]} {t(`admin.notices.channels.${c}` as MessageKey)} · {isOn(r, c) ? t("admin.notices.on") : t("admin.notices.off")}
                    </button>
                  ),
                )}
              </div>
            </div>

            {(r.timing?.length || r.earlyAccess) && (
              <div className="mt-3 flex flex-wrap gap-3 rounded-[12px] bg-[#F7F8FA] p-3">
                {(r.timing ?? []).map((k: TimingKey) => (
                  <label key={k} className="flex min-w-[200px] flex-1 flex-col gap-1 text-[13.5px] font-semibold text-ink">
                    {t(timingLabelKey(k) as MessageKey)}
                    <span className="flex items-center gap-2">
                      <input
                        value={timings[k] ?? ""}
                        readOnly={readOnly}
                        inputMode={TIMING_INFO[k].list ? "text" : "numeric"}
                        onChange={(e) => setTimings((cur) => ({ ...cur, [k]: e.target.value }))}
                        className={cx(ADM_INPUT, "max-w-[160px]", timings[k] !== startTimings[k] && "ring-2 ring-primary", errors[k] && "ring-2 ring-danger")}
                        aria-invalid={Boolean(errors[k])}
                      />
                      <span className="text-[13.5px] font-medium text-muted">{t(`admin.notices.units.${TIMING_INFO[k].unit}` as MessageKey)}</span>
                    </span>
                    {TIMING_INFO[k].list && <span className="text-[12.5px] font-medium text-muted">{t("admin.notices.listHint")}</span>}
                    {errors[k] && <span className="text-[12.5px] font-semibold text-danger">{t(`admin.notices.errors.${errors[k]}` as MessageKey)}</span>}
                  </label>
                ))}
                {r.earlyAccess && (
                  <p className="m-0 flex-1 basis-[240px] text-[13.5px] text-ink">
                    {earlyAccess.on ? t("admin.notices.earlyAccess", { n: String(earlyAccess.minutes) }) : t("admin.notices.earlyAccessOff")}{" "}
                    <Link href="/admin/pro" className="font-bold text-primary hover:underline">
                      {t("admin.notices.changeInPro")}
                    </Link>
                  </p>
                )}
              </div>
            )}

            {r.alsoIn === "user" && r.channels.includes("email") && !r.locked && <p className="m-0 mt-2 text-[12.5px] text-muted">{t("admin.notices.alsoUser")}</p>}
            {r.alsoIn === "unpaid" && (
              <p className="m-0 mt-2 text-[12.5px] text-muted">
                {t("admin.notices.alsoUnpaid")}{" "}
                <Link href="/admin/unpaid#unot" className="font-bold text-primary hover:underline">
                  {t("admin.notices.changeInUnpaid")}
                </Link>
              </p>
            )}
            {r.alsoIn === "pro" && (
              <p className="m-0 mt-2 text-[12.5px] text-muted">
                {t(autoRemind ? "admin.notices.alsoProOn" : "admin.notices.alsoProOff")}{" "}
                <Link href="/admin/pro" className="font-bold text-primary hover:underline">
                  {t("admin.notices.changeInPro")}
                </Link>
              </p>
            )}
          </li>
        ))}
      </ul>

      {dirty && !readOnly && (
        <div className="sticky bottom-3 z-10 flex flex-col gap-2 rounded-[16px] bg-surface p-3 shadow-card ring-1 ring-line sm:flex-row sm:flex-wrap sm:items-end">
          <label className="flex flex-1 flex-col gap-1 text-[14px] font-bold text-ink">
            {t("admin.reason")}
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("admin.settings.reasonPlaceholder")} className={ADM_INPUT} />
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={cancel} className="min-h-11 rounded-[12px] px-4 text-[15px] font-bold text-ink ring-1 ring-[#dcdee3]">
              {t("common.cancel")}
            </button>
            <button type="button" disabled={busy || reason.trim().length < 3} onClick={save} className="min-h-11 rounded-[12px] bg-success px-5 text-[15px] font-bold text-white disabled:opacity-40">
              {t("admin.notices.save")}
            </button>
          </div>
          {error && (
            <div className="sm:basis-full">
              <Alert tone="danger">{error}</Alert>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
