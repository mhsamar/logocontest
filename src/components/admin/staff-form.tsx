"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ADMIN_AREAS, AREA_LIST, PRESET_NAMES, PRESETS, type Permission, type Preset } from "@/lib/admin/permissions";
import { createStaff, setStaffActive, updateStaff } from "@/lib/admin/team-actions";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";

const INPUT = "block w-full min-h-11 rounded-xl bg-canvas px-3 text-sm text-ink ring-1 ring-inset ring-line focus:outline-none focus:ring-2 focus:ring-primary";

/** The View / Manage checkbox grid, with preset buttons. */
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
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">{t("admin.team.preset")}</span>
        {PRESET_NAMES.map((p: Preset) => (
          <button key={p} type="button" onClick={() => onChange([...PRESETS[p]])} className="min-h-9 rounded-full bg-surface px-3.5 text-sm font-semibold text-ink ring-1 ring-line hover:ring-primary">
            {t(`admin.team.presets.${p}`)}
          </button>
        ))}
      </div>
      <div className="overflow-hidden rounded-xl ring-1 ring-line">
        <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem] bg-canvas px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted">
          <span>{t("admin.team.permissions")}</span>
          <span className="text-center">{t("admin.team.view")}</span>
          <span className="text-center">{t("admin.team.manage")}</span>
        </div>
        <ul className="divide-y divide-line">
          {AREA_LIST.map((area) => (
            <li key={area} className="grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem] items-center px-3 py-2 text-sm">
              <span className="text-ink">{t(`admin.team.areas.${area}`)}</span>
              <span className="flex justify-center">
                <input type="checkbox" aria-label={`${t(`admin.team.areas.${area}`)}: ${t("admin.team.view")}`} checked={has(`${area}.view`)} onChange={(e) => toggle(`${area}.view`, e.target.checked)} className="size-5 accent-[var(--color-primary)]" />
              </span>
              <span className="flex justify-center">
                {ADMIN_AREAS[area].manage && (
                  <input type="checkbox" aria-label={`${t(`admin.team.areas.${area}`)}: ${t("admin.team.manage")}`} checked={has(`${area}.manage`)} onChange={(e) => toggle(`${area}.manage`, e.target.checked)} className="size-5 accent-[var(--color-primary)]" />
                )}
              </span>
            </li>
          ))}
        </ul>
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
    <label className="block text-sm">
      <span className="font-medium text-ink">{label}</span>
      <input
        type={type}
        value={f[name]}
        onChange={(e) => setF((v) => ({ ...v, [name]: e.target.value }))}
        autoComplete={type === "password" ? "new-password" : "off"}
        minLength={type === "password" ? passwordMin : undefined}
        className={cx(INPUT, "mt-1", error?.field === name && "ring-2 ring-danger")}
      />
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
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
    <section className="rounded-2xl bg-surface p-5 shadow-card ring-1 ring-line">
      <h2 className="font-semibold text-ink">{t("admin.team.add")}</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {field("name", t("admin.team.name"))}
        {field("title", t("admin.team.titleLabel"))}
        {field("mobile", t("admin.team.mobile"), "tel")}
        {field("email", t("admin.team.email"), "email")}
        {field("password", t("admin.team.password"), "password", t("admin.team.passwordHint"))}
      </div>
      <div className="mt-5">
        <PermissionGrid value={perms} onChange={setPerms} />
      </div>
      {error && (
        <div className="mt-4">
          <Alert tone="danger">{error.text}</Alert>
        </div>
      )}
      <div className="mt-4">
        <Button onClick={save} loading={busy}>
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
    <li className={cx("rounded-2xl bg-surface p-4 shadow-card ring-1 ring-line", !staff.active && "opacity-70")}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink">
            {staff.name} {staff.title && <span className="ml-1 rounded-full bg-canvas px-2 py-0.5 text-xs font-medium text-muted">{staff.title}</span>}
          </p>
          <p className="truncate text-sm text-muted">
            {staff.email ?? "—"} · {t("admin.team.count", { n: staff.permissions.length })}
          </p>
          {!staff.active && <p className="text-xs text-danger">{t("admin.team.offNote")}</p>}
        </div>
        <Button variant="secondary" onClick={() => setOpen((v) => !v)}>
          {t("admin.team.edit")}
        </Button>
        <Button variant={staff.active ? "danger" : "primary"} onClick={toggle} loading={busy && !open}>
          {t(staff.active ? "admin.team.turnOff" : "admin.team.turnOn")}
        </Button>
      </div>
      {open && (
        <div className="mt-4 space-y-4 border-t border-line pt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium text-ink">{t("admin.team.titleLabel")}</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className={cx(INPUT, "mt-1")} />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-ink">{t("admin.team.newPassword")}</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={passwordMin} className={cx(INPUT, "mt-1")} />
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
