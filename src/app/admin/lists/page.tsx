import type { Metadata } from "next";
import Link from "next/link";
import { ListEditor } from "@/components/admin/list-editor";
import { AdminHead } from "@/components/admin/page-head";
import { isListKey, LIST_KEYS, type ListKey } from "@/lib/content/list-defs";
import { FAQ_PLACEHOLDERS } from "@/lib/content/list-rules";
import { getList } from "@/lib/content/lists";
import { noticeId } from "@/lib/content/notice-rules";
import { cx } from "@/lib/cx";
import { getI18n } from "@/lib/i18n/server";
import { requirePermission } from "@/lib/admin/core";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.lists.title"), robots: { index: false } };
}

// A-15 Lists (BLUEPRINT §13.1 item 2): Q&A, menus, footer links, business types, colour choices.
export default async function AdminListsPage({ searchParams }: PageProps<"/admin/lists">) {
  await requirePermission("content.view");
  const sp = await searchParams;
  const key: ListKey = typeof sp.list === "string" && isListKey(sp.list) ? sp.list : "home_faq";
  const [{ t }, { items, edited }] = await Promise.all([getI18n(), getList(key)]);

  return (
    <div className="space-y-4">
      <AdminHead title={t("admin.lists.title")} lead={t("admin.lists.lead")} />
      <nav aria-label={t("admin.lists.title")} className="-mx-4 overflow-x-auto px-4">
        <ul className="flex gap-1.5 pb-1">
          {LIST_KEYS.map((k) => (
            <li key={k} className="shrink-0">
              <Link
                href={`/admin/lists?list=${k}`}
                aria-current={k === key ? "page" : undefined}
                className={cx(
                  "inline-flex min-h-9 items-center whitespace-nowrap rounded-full px-3.5 text-sm font-medium ring-1",
                  k === key ? "bg-ink text-white ring-ink" : "bg-surface text-ink ring-line hover:ring-primary",
                )}
              >
                {t(`admin.lists.names.${k}`)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="rounded-2xl bg-surface p-4 text-sm shadow-card ring-1 ring-line">
        <p className="text-ink">{t(`admin.lists.about.${key}`)}</p>
        <p className="mt-1 text-xs text-muted">{t(edited ? "admin.lists.isEdited" : "admin.lists.isBuiltIn")}</p>
      </div>
      {/* Remounts after a save so the editor starts from what was stored. */}
      <ListEditor key={`${key}-${noticeId(JSON.stringify(items))}`} listKey={key} initial={items} edited={edited} placeholders={key === "home_faq" ? FAQ_PLACEHOLDERS : []} />
    </div>
  );
}
