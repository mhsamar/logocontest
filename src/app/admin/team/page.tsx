import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminHead } from "@/components/admin/page-head";
import { AddStaffForm, StaffCard, type StaffRow } from "@/components/admin/staff-form";
import { AdmCard, CardTitle, KpiGrid, KpiTile, Pill } from "@/components/admin/ui";
import { superAdmin } from "@/lib/admin/core";
import { AREA_LIST, cleanPermissions, PRESET_NAMES } from "@/lib/admin/permissions";
import { isSupabaseConfigured } from "@/lib/env";
import { getI18n } from "@/lib/i18n/server";
import { formatNumber } from "@/lib/money";
import { getSetting } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.team.title"), robots: { index: false } };
}

// A-23 Admins & roles (BLUEPRINT §13.2 item 2; design/admin/admins-roles.html, owner 2026-10-10): Super admin only.
export default async function AdminTeamPage() {
  const me = await superAdmin();
  if (!me) notFound();
  const [{ t, locale }, passwordMin, { data }] = await Promise.all([
    getI18n(),
    getSetting("auth.password_min_length"),
    isSupabaseConfigured()
      ? createAdminClient().from("profiles").select("id, name, email, mobile, admin_title, admin_permissions, admin_active").eq("role", "admin").eq("is_super_admin", false).order("created_at")
      : Promise.resolve({ data: [] }),
  ]);
  const num = (n: number) => formatNumber(n, locale);
  const staff: StaffRow[] = (data ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    email: (r.email as string | null) ?? null,
    mobile: r.mobile as string,
    title: (r.admin_title as string | null) ?? null,
    permissions: cleanPermissions(r.admin_permissions),
    active: r.admin_active !== false,
  }));
  const active = staff.filter((s) => s.active).length;

  return (
    <div className="flex flex-col gap-5">
      <AdminHead title={t("admin.team.title")} lead={t("admin.team.leadNew")} />

      <KpiGrid>
        <KpiTile label={t("admin.shell.superAdmin")} value={num(1)} hint={t("admin.team.kpi.you")} icon="team" accent />
        <KpiTile label={t("admin.team.staff")} value={num(staff.length)} hint={staff.length ? t("admin.team.kpi.active", { n: num(active) }) : t("admin.team.kpi.noStaff")} icon="users" />
        <KpiTile label={t("admin.team.kpi.areas")} value={num(AREA_LIST.length)} hint={t("admin.team.kpi.areasHint")} icon="dashboard" />
        <KpiTile label={t("admin.team.kpi.presets")} value={num(PRESET_NAMES.length)} hint={PRESET_NAMES.map((p) => t(`admin.team.presets.${p}`)).join(" · ")} icon="check" />
      </KpiGrid>

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-4 xl:max-w-[440px]">
          <AdmCard className="overflow-hidden">
            <div className="p-5 pb-3">
              <CardTitle title={t("admin.team.yourTeam")} />
            </div>
            <div className="flex items-center gap-3 border-t border-adm-line-soft bg-adm-row px-5 py-4">
              <span className="lc-d flex size-11 shrink-0 items-center justify-center rounded-[12px] bg-primary text-[17px] font-semibold text-white">{me.name.trim().slice(0, 1).toUpperCase()}</span>
              <div className="min-w-0 flex-1">
                <p className="m-0 flex flex-wrap items-center gap-2 font-bold">
                  {me.name}
                  <Pill tone="brand">{t("admin.team.youPill")}</Pill>
                </p>
                <p className="m-0 text-sm text-muted">{t("admin.team.kpi.you")}</p>
              </div>
            </div>
            {staff.length === 0 ? (
              <div className="border-t border-adm-line-soft px-5 py-6 text-center">
                <p className="m-0 font-bold">{t("admin.team.kpi.noStaff")}</p>
                <p className="m-0 mt-1 text-sm text-muted">{t("admin.team.noneHint")}</p>
              </div>
            ) : (
              <ul className="m-0 list-none border-t border-adm-line-soft p-0">
                {staff.map((s) => (
                  <StaffCard key={`${s.id}-${s.permissions.join()}-${s.active}`} staff={s} passwordMin={passwordMin} />
                ))}
              </ul>
            )}
          </AdmCard>

          <AdmCard className="flex flex-col gap-3 p-5">
            <h2 className="m-0 text-[17px] font-semibold">{t("admin.team.how")}</h2>
            {(["view", "manage", "empty"] as const).map((k) => (
              <p key={k} className="m-0 text-[15px]">
                <strong>{t(`admin.team.howWords.${k}`)}</strong> <span className="text-muted">{t(`admin.team.howLines.${k}`)}</span>
              </p>
            ))}
          </AdmCard>
        </div>

        <div className="min-w-0 flex-[2_1_520px]">
          <AddStaffForm passwordMin={passwordMin} />
        </div>
      </div>
    </div>
  );
}
