import type { Metadata } from "next";
import { BroadcastForm } from "@/components/admin/broadcast-form";
import { AdminHead } from "@/components/admin/page-head";
import { UUID, requirePermission } from "@/lib/admin/core";
import { isSupabaseConfigured } from "@/lib/env";
import { getI18n } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { formatNumber } from "@/lib/money";
import { recentBroadcasts } from "@/lib/support/queries";
import { createAdminClient } from "@/lib/supabase/admin";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.messages.title"), robots: { index: false } };
}

// A-25 Send message (BLUEPRINT §13.2 item 6): to all designers, all clients, everyone or one person.
export default async function AdminMessagesPage({ searchParams }: PageProps<"/admin/messages">) {
  await requirePermission("messages.view");
  const sp = await searchParams;
  const to = typeof sp.to === "string" && UUID.test(sp.to) ? sp.to : null;
  const [{ t, locale }, history, person] = await Promise.all([
    getI18n(),
    recentBroadcasts(),
    to && isSupabaseConfigured() ? createAdminClient().from("profiles").select("id, name, role, username").eq("id", to).maybeSingle().then((r) => r.data) : null,
  ]);
  const when = (iso: string) => new Date(iso).toLocaleString(locale === "bn" ? "bn-BD" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" });
  return (
    <div className="space-y-4">
      <AdminHead title={t("admin.messages.title")} lead={t("admin.messages.lead")} />
      <BroadcastForm
        toPerson={
          person && (person.role === "client" || person.role === "designer")
            ? { id: person.id as string, name: person.name as string, role: person.role, username: (person.username as string | null) ?? null }
            : null
        }
      />
      <section className="space-y-3">
        <h2 className="font-semibold text-ink">{t("admin.messages.history")}</h2>
        {history.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-surface px-4 py-8 text-center text-muted">{t("admin.messages.none")}</p>
        ) : (
          <ul className="space-y-2">
            {history.map((b) => (
              <li key={b.id} className="rounded-2xl bg-surface p-4 text-sm shadow-card ring-1 ring-line">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                  <span className="rounded-full bg-canvas px-2 py-0.5 font-semibold text-ink">{b.audience === "one" ? (b.targetName ?? "—") : t(`admin.messages.audiences.${b.audience}` as MessageKey)}</span>
                  <span>{t("admin.messages.recipients", { n: formatNumber(b.recipients, locale) })}</span>
                  {b.adminName && <span>· {t("admin.messages.by", { name: b.adminName })}</span>}
                  <span className="ml-auto">{when(b.createdAt)}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-ink">{b.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
