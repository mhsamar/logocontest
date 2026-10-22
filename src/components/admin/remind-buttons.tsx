"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useToast } from "@/components/ui/toast";
import { remindUser } from "@/lib/admin/reminder-actions";
import { remindedRecently, remindersFor, type ProfileStatus, type ReminderKind } from "@/lib/admin/reminder-rules";
import { cx } from "@/lib/cx";
import { timeAgo } from "@/lib/dates";
import { useI18n } from "@/lib/i18n/client";
import { formatNumber } from "@/lib/money";

/** Email, photo and (designers) profile at a glance, for the person page and the Quick view (owner, 2026-10-22). */
export function ProfileFacts({ profile, pushOn }: { profile: ProfileStatus; pushOn?: boolean }) {
  const { t, locale } = useI18n();
  const good = "font-semibold text-[#14633C]";
  const warn = "font-semibold text-[#9A3412]";
  const rows: [string, string, string][] = [
    [
      t("admin.users.x.remind.email"),
      profile.emailOk === null ? t("admin.users.x.remind.emailNone") : t(profile.emailOk ? "admin.users.x.remind.emailOk" : "admin.users.x.remind.emailNot"),
      profile.emailOk === false ? warn : profile.emailOk ? good : "text-muted",
    ],
    [t("admin.users.x.remind.photo"), t(profile.hasPhoto ? "admin.users.x.remind.photoYes" : "admin.users.x.remind.photoNo"), profile.hasPhoto ? good : warn],
  ];
  if (profile.percent !== null) rows.push([t("admin.users.x.remind.profile"), t("admin.users.x.remind.percent", { n: formatNumber(profile.percent, locale) }), profile.percent >= 100 ? good : warn]);
  if (pushOn !== undefined) rows.push([t("admin.users.x.remind.push"), t(pushOn ? "admin.users.x.remind.pushOn" : "admin.users.x.remind.pushOff"), pushOn ? good : "text-muted"]);
  return (
    <div className="flex flex-col gap-1.5 text-[15px]">
      {rows.map(([label, value, tone]) => (
        <div key={label} className="flex items-baseline justify-between gap-3">
          <span className="text-muted">{label}</span>
          <span className={cx("text-right", tone)}>{value}</span>
        </div>
      ))}
      {profile.missing.length > 0 && (
        <p className="m-0 text-[13.5px] text-muted">{t("admin.users.x.remind.missing", { list: profile.missing.map((s) => t(`profileProgress.steps.${s}`)).join(", ") })}</p>
      )}
    </div>
  );
}

/**
 * One tap reminds the person (owner, 2026-10-22): in the app, on their phone if turned on, and by email. Each kind at
 * most once a day; the last time shows under the button.
 */
export function RemindButtons({ userId, profile, reminded }: { userId: string; profile: ProfileStatus | null; reminded: Partial<Record<ReminderKind, string>> }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [sent, setSent] = useState<Partial<Record<ReminderKind, string>>>({});
  // Also under the button: on phones the toast sits under the Quick view sheet.
  const [error, setError] = useState<{ kind: ReminderKind; text: string } | null>(null);
  const [busy, start] = useTransition();
  const kinds = remindersFor(profile);
  const now = new Date();
  if (!profile) return null;
  if (!kinds.length) return <p className="m-0 text-sm text-muted">{t("admin.users.x.remind.allDone")}</p>;

  return (
    <div className="flex flex-col gap-2">
      {kinds.map((k) => {
        const last = sent[k] ?? reminded[k];
        return (
          <div key={k} className="flex flex-col gap-1">
            <button
              type="button"
              disabled={busy || remindedRecently(last, now)}
              onClick={() =>
                start(async () => {
                  setError(null);
                  try {
                    const res = await remindUser(userId, k);
                    if (!res.ok) {
                      setError({ kind: k, text: t(res.error) });
                      return toast(t(res.error), "danger");
                    }
                    setSent((s) => ({ ...s, [k]: new Date().toISOString() }));
                    toast(t("admin.users.x.remind.sent"));
                    router.refresh();
                  } catch {
                    setError({ kind: k, text: t("admin.users.x.remind.errors.generic") });
                    toast(t("admin.users.x.remind.errors.generic"), "danger");
                  }
                })
              }
              className="flex min-h-11 items-center justify-center rounded-xl border border-[#DCDEE3] bg-white px-3.5 text-[14.5px] font-bold text-ink hover:bg-[#F4F5F7] disabled:cursor-not-allowed disabled:opacity-55"
            >
              {t(`admin.users.x.remind.button.${k}`)}
            </button>
            {last && <span className="text-[12.5px] text-muted">{t("admin.users.x.remind.reminded", { ago: timeAgo(new Date(last), now, locale) })}</span>}
            {error?.kind === k && (
              <span role="alert" className="text-[12.5px] font-semibold text-[#A3121B]">
                {error.text}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
