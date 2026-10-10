"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ADMIN_AREAS, AREA_LIST, PRESET_NAMES, PRESETS, type AdminArea, type Permission, type Preset } from "@/lib/admin/permissions";
import { createStaff, setStaffActive, updateStaff } from "@/lib/admin/team-actions";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/translate";
import { AdmCheckbox, ADM_INPUT, Pill } from "./ui";

/** The permission rows, grouped as in the sidebar (design/admin/admins-roles.html). */
const GROUPS: { key: "overview" | "work" | "people" | "money" | "messages" | "site"; areas: AdminArea[] }[] = [
  { key: "overview", areas: ["dashboard", "live"] },
  { key: "work", areas: ["contests", "designs", "reports", "claims", "copyright", "unpaid", "monthly"] },
  { key: "people", areas: ["users", "agreements"] },
  { key: "money", areas: ["payments", "withdrawals"] },
  { key: "messages", areas: ["support", "messages"] },
  { key: "site", areas: ["content", "settings", "audit"] },
];

/** The View / Manage checkbox grid, with the ready-made roles and a live count. */
function PermissionGrid({ value, onChange }: { value: Permission[]; onChange: (v: Permission[]) => void }) {
  const { t } = useI18n();
  const has = (p: Permission) => value.includes(p);
  const toggle = (p: Permission, on: boolean) => {
    const set = new Set(value);
    if (on) {
      set.add(p);
      if (p.endsWith(".manage")) set.add(p.replace(".manage", ".view") as Permission);
    } else {
      set.delete(p);
      if (p.endsWith(".view")) set.delete(p.replace(".view", ".manage") as Permission);
    }
    onChange([...set]);
  };
  const viewing = AREA_LIST.filter((a) => has(`${a}.view`)).length;
  const managing = AREA_LIST.filter((a) => ADMIN_AREAS[a].manage && has(`${a}.manage` as Permission)).length;
  const same = (p: Preset) => PRESETS[p].length === value.length && PRESETS[p].every((x) => value.includes(x));
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="text-[15px] font-bold">{t("admin.team.startFrom")}</span>
        <div className="grid gap-2 sm:grid-cols-3">
          {PRESET_NAMES.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onChange([...PRESETS[p]])}
              aria-pressed={same(p)}
              className={cx("flex flex-col gap-1 rounded-[14px] border p-3.5 text-left transition-colors hover:border-primary hover:bg-adm-row", same(p) ? "border-primary bg-adm-row" : "border-[#e3e4e8] bg-surface")}
            >
              <strong className="text-[15.5px]">{t(`admin.team.presets.${p}`)}</strong>
              <span className="text-[13.5px] text-muted">{t(`admin.team.presetHints.${p}`)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-[14px] border border-adm-line">
        <div className="grid grid-cols-[minmax(0,1fr)_58px_58px] bg-adm-bg px-3 py-2.5 text-xs font-bold uppercase tracking-[0.06em] text-muted sm:grid-cols-[minmax(0,1fr)_76px_76px]">
          <span>{t("admin.team.whatTheyCanDo")}</span>
          <span className="text-center">{t("admin.team.view")}</span>
          <span className="text-center">{t("admin.team.manage")}</span>
        </div>
        {GROUPS.map((g) => (
          <div key={g.key}>
            <p className="m-0 border-t border-adm-line-soft bg-[#fafafb] px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] text-adm-soft">{t(`admin.team.groups.${g.key}`)}</p>
            <ul className="m-0 list-none p-0">
              {g.areas.map((area) => (
                <li key={area} className="grid grid-cols-[minmax(0,1fr)_58px_58px] items-center border-t border-adm-line-soft px-3 py-1 sm:grid-cols-[minmax(0,1fr)_76px_76px]">
                  <span className="flex min-w-0 flex-col py-1.5">
                    <span className="text-[15px] font-semibold">{t(`admin.team.areas.${area}`)}</span>
                    <span className="text-[13px] text-muted">{ADMIN_AREAS[area].manage ? t(`admin.team.areaHints.${area}` as MessageKey) : t("admin.team.viewOnly")}</span>
                  </span>
                  <span className="flex justify-center">
                    <AdmCheckbox aria-label={`${t(`admin.team.areas.${area}`)}: ${t("admin.team.view")}`} checked={has(`${area}.view`)} onChange={(e) => toggle(`${area}.view`, e.target.checked)} />
                  </span>
                  <span className="flex justify-center">
                    {ADMIN_AREAS[area].manage && (
                      <AdmCheckbox aria-label={`${t(`admin.team.areas.${area}`)}: ${t("admin.team.manage")}`} checked={has(`${area}.manage` as Permission)} onChange={(e) => toggle(`${area}.manage` as Permission, e.target.checked)} />
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[15px] font-bold" aria-live="polite">
          {t("admin.team.liveCount", { view: viewing, all: AREA_LIST.length, manage: managing })}
        </span>
        <button type="button" onClick={() => onChange([])} className="inline-flex min-h-11 items-center rounded-[12px] px-3 text-[15px] font-bold text-primary hover:bg-tint">
          {t("admin.team.clearAll")}
        </button>
      </div>
    </div>
  );
}

/** A-23 Add admin. */
export function AddStaffForm({ passwordMin }: { passwordMin: number }) {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const blank = { name: "", mobile: "", email: "", password: "", title: "" };
  const [f, setF] = useState(blank);
  const [perms, setPerms] = useState<Permission[]>([...PRESETS.support]);
  const [error, setError] = useState<{ text: string; field?: string } | null>(null);
  const [busy, run] = useTransition();
  const field = (name: keyof typeof blank, label: string, type = "text", hint?: string) => (
    <label className="flex flex-col gap-1.5 text-[15px]">
      <span className="font-semibold text-adm-strong">{label}</span>
      <input
        type={type}
        value={f[name]}
        onChange={(e) => setF((v) => ({ ...v, [name]: e.target.value }))}
        autoComplete={type === "password" ? "new-password" : "off"}
        minLength={type === "password" ? passwordMin : undefined}
        className={cx(ADM_INPUT, error?.field === name && "outline-2 outline-danger")}
      />
      {hint && <span className="text-[13px] text-muted">{hint}</span>}
    </label>
  );
  const save = () =>
    run(async () => {
      setError(null);
      const res = await createStaff({ ...f, permissions: perms });
      if (!res.ok) return setError({ text: t(res.error), field: res.field });
      setF(blank);
      toast(t("admin.team.created"));
      router.refresh();
    });
  return (
    <section className="flex flex-col gap-5 rounded-[16px] border border-adm-line bg-surface p-5 shadow-[0_1px_2px_rgb(17_18_22/0.03)] sm:p-6">
      <div>
        <h2 className="m-0 text-[21px] font-semibold tracking-[-0.025em]">{t("admin.team.add")}</h2>
        <p className="m-0 mt-1 text-[14.5px] text-muted">{t("admin.team.addLead")}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {field("name", t("admin.team.name"))}
        {field("title", t("admin.team.titleLabel"))}
        {field("mobile", t("admin.team.mobile"), "tel")}
        {field("email", t("admin.team.email"), "email", t("admin.team.emailHint"))}
        <div className="md:col-span-2">{field("password", t("admin.team.password"), "password", t("admin.team.passwordHint"))}</div>
      </div>
      <PermissionGrid value={perms} onChange={setPerms} />
      {error && <Alert tone="danger">{error.text}</Alert>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[13.5px] text-muted">{t("admin.team.changeLater")}</span>
        <Button size="lg" onClick={save} loading={busy}>
          {t("admin.team.add")}
        </Button>
      </div>
    </section>
  );
}

export type StaffRow = { id: string; name: string; email: string | null; mobile: string; title: string | null; permissions: Permission[]; active: boolean };

/** A-23 One staff member: summary, on/off, and an edit panel. */
export function StaffCard({ staff, passwordMin }: { staff: StaffRow; passwordMin: number }) {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(staff.title ?? "");
  const [perms, setPerms] = useState<Permission[]>(staff.permissions);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, run] = useTransition();
  const viewing = AREA_LIST.filter((a) => staff.permissions.includes(`${a}.view` as Permission)).length;
  const managing = AREA_LIST.filter((a) => ADMIN_AREAS[a].manage && staff.permissions.includes(`${a}.manage` as Permission)).length;
  const save = () =>
    run(async () => {
      setError(null);
      const res = await updateStaff(staff.id, { title, permissions: perms, password: password || undefined });
      if (!res.ok) return setError(t(res.error));
      setPassword("");
      setOpen(false);
      toast(t("admin.team.saved"));
      router.refresh();
    });
  const toggle = () =>
    run(async () => {
      const res = await setStaffActive(staff.id, !staff.active);
      if (!res.ok) return toast(t(res.error), "danger");
      router.refresh();
    });
  return (
    <li className={cx("border-t border-adm-line-soft px-5 py-4 first:border-t-0", !staff.active && "bg-[#fafafb]")}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className={cx("lc-d flex size-11 shrink-0 items-center justify-center rounded-[12px] text-[17px] font-semibold", staff.active ? "bg-tint text-primary" : "bg-[#f0f1f4] text-muted")}>{staff.name.trim().slice(0, 1).toUpperCase()}</span>
        <div className="min-w-0 flex-1">
          <p className="m-0 flex flex-wrap items-center gap-2 font-bold">
            {staff.name}
            {staff.title && <Pill>{staff.title}</Pill>}
            {!staff.active && <Pill tone="bad">{t("admin.team.off")}</Pill>}
          </p>
          <p className="m-0 truncate text-sm text-muted">
            {staff.email ?? "—"} · {t("admin.team.liveCount", { view: viewing, all: AREA_LIST.length, manage: managing })}
          </p>
        </div>
        <Button variant="secondary" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          {t("admin.team.edit")}
        </Button>
        <Button variant={staff.active ? "danger" : "primary"} onClick={toggle} loading={busy && !open}>
          {t(staff.active ? "admin.team.turnOff" : "admin.team.turnOn")}
        </Button>
      </div>
      {open && (
        <div className="mt-4 flex flex-col gap-4 border-t border-adm-line-soft pt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-[15px]">
              <span className="font-semibold text-adm-strong">{t("admin.team.titleLabel")}</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className={ADM_INPUT} />
            </label>
            <label className="flex flex-col gap-1.5 text-[15px]">
              <span className="font-semibold text-adm-strong">{t("admin.team.newPassword")}</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={passwordMin} className={ADM_INPUT} />
            </label>
          </div>
          <PermissionGrid value={perms} onChange={setPerms} />
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="flex gap-2">
            <Button onClick={save} loading={busy}>
              {t("admin.team.save")}
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
