import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminHead } from "@/components/admin/page-head";
import { AddStaffForm, StaffCard, type StaffRow } from "@/components/admin/staff-form";
import { superAdmin } from "@/lib/admin/core";
import { cleanPermissions } from "@/lib/admin/permissions";
import { isSupabaseConfigured } from "@/lib/env";
import { getI18n } from "@/lib/i18n/server";
import { getSetting } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.team.title"), robots: { index: false } };
}

// A-23 Admins & roles (BLUEPRINT §13.2 item 2): Super admin only.
export default async function AdminTeamPage() {
  const me = await superAdmin();
  if (!me) notFound();
  const [{ t }, passwordMin, { data }] = await Promise.all([
    getI18n(),
    getSetting("auth.password_min_length"),
    isSupabaseConfigured()
      ? createAdminClient().from("profiles").select("id, name, email, mobile, admin_title, admin_permissions, admin_active").eq("role", "admin").eq("is_super_admin", false).order("created_at")
      : Promise.resolve({ data: [] }),
  ]);
  const staff: StaffRow[] = (data ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    email: (r.email as string | null) ?? null,
    mobile: r.mobile as string,
    title: (r.admin_title as string | null) ?? null,
    permissions: cleanPermissions(r.admin_permissions),
    active: r.admin_active !== false,
  }));
  return (
    <div className="space-y-4">
      <AdminHead title={t("admin.team.title")} lead={t("admin.team.lead")} />
      <p className="rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white">
        {me.name} — {t("admin.team.you")}
      </p>
      <section className="space-y-3">
        <h2 className="font-semibold text-ink">{t("admin.team.staff")}</h2>
        {staff.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-surface px-4 py-8 text-center text-muted">{t("admin.team.none")}</p>
        ) : (
          <ul className="space-y-3">
            {staff.map((s) => (
              <StaffCard key={`${s.id}-${s.permissions.join()}-${s.active}`} staff={s} passwordMin={passwordMin} />
            ))}
          </ul>
        )}
      </section>
      <AddStaffForm passwordMin={passwordMin} />
    </div>
  );
}
