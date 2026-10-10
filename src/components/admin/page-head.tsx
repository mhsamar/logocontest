import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { AdminIcon } from "./icons";

/** Title row of an admin page (design/admin): breadcrumb, title, line under it, and actions on the right. */
export async function AdminHead({ title, lead, actions, crumbs = [] }: { title: string; lead?: string; actions?: React.ReactNode; crumbs?: { href: string; label: string }[] }) {
  const { t } = await getI18n();
  const trail = [{ href: "/admin", label: t("admin.shell.brand") }, ...crumbs];
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <nav aria-label={t("admin.shell.breadcrumb")} className="flex flex-wrap items-center gap-2 text-sm font-semibold text-adm-soft">
          {trail.map((c) => (
            <span key={c.href} className="inline-flex items-center gap-2">
              <Link href={c.href} className="hover:text-ink">
                {c.label}
              </Link>
              <AdminIcon name="chevron" size={14} />
            </span>
          ))}
          <span className="text-primary" aria-current="page">
            {title}
          </span>
        </nav>
        <h1 className="m-0 text-[28px] font-semibold leading-[1.1] tracking-[-0.035em] text-ink sm:text-[32px]">{title}</h1>
        {lead && <p className="m-0 max-w-3xl text-[15.5px] text-muted">{lead}</p>}
      </div>
      {actions}
    </div>
  );
}
