import type { Metadata } from "next";
import { NoticesEditor } from "@/components/admin/notices-editor";
import { AdminHead } from "@/components/admin/page-head";
import { requirePermission } from "@/lib/admin/core";
import { getI18n } from "@/lib/i18n/server";
import { NOTICE_ROWS, type TimingKey } from "@/lib/notifications/admin-catalog";
import { sentToday } from "@/lib/email/send";
import { channelsOff, designerEmailsOff, roleEmailsOff } from "@/lib/notifications/switches";
import { timingText } from "@/lib/notifications/timing";
import { getProSettings } from "@/lib/pro/settings";
import { getSettings } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.notices.title"), robots: { index: false } };
}

// Admin › Notifications (owner, 2026-10-15): who gets which notice, how (bell, push, email) and when.
export default async function AdminNotificationsPage() {
  await requirePermission("notifications.view");
  const keys = [...new Set(NOTICE_ROWS.flatMap((r) => r.timing ?? []))] as TimingKey[];
  const [{ t }, off, tierOff, roleOff, values, pro, limit, today] = await Promise.all([
    getI18n(),
    channelsOff(),
    designerEmailsOff(),
    roleEmailsOff(),
    getSettings(keys),
    getProSettings(),
    getSettings(["email.daily_limit"]),
    sentToday(new Date()).catch(() => 0),
  ]);
  const timings = Object.fromEntries(keys.map((k) => [k, timingText(values[k])]));
  return (
    <div className="flex flex-col gap-4">
      <AdminHead title={t("admin.notices.title")} lead={t("admin.notices.lead")} />
      <NoticesEditor
        off={off}
        tierOff={tierOff}
        roleOff={roleOff}
        limit={{ value: limit["email.daily_limit"], today }}
        timings={timings}
        earlyAccess={{ on: pro.ready && pro.settings.features.early_access && pro.settings.earlyAccessMinutes > 0, minutes: pro.settings.earlyAccessMinutes }}
        autoRemind={pro.settings.autoRemind}
      />
    </div>
  );
}
