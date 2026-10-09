import type { Metadata } from "next";
import Link from "next/link";
import { AdminAction } from "@/components/admin/admin-action";
import { EntryThumb } from "@/components/admin/entry-thumb";
import { AdminHead } from "@/components/admin/page-head";
import { StatusPill } from "@/components/admin/table-bits";
import { cx } from "@/lib/cx";
import { duplicatePairs, recentEntries } from "@/lib/admin/moderation";
import { clearDuplicate, removeEntry } from "@/lib/admin/moderation-actions";
import { getI18n } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.entries.title"), robots: { index: false } };
}

// A-03 Entries (BLUEPRINT §13.4): flagged near-duplicates side by side, and the latest designs.
export default async function AdminEntriesPage({ searchParams }: PageProps<"/admin/entries">) {
  const sp = await searchParams;
  const tab = sp.tab === "recent" ? "recent" : "duplicates";
  const { t } = await getI18n();
  const [pairs, recent] = await Promise.all([tab === "duplicates" ? duplicatePairs() : [], tab === "recent" ? recentEntries() : []]);
  const tabs = [
    { key: "duplicates", label: t("admin.entries.duplicates") },
    { key: "recent", label: t("admin.entries.recent") },
  ];
  return (
    <div className="space-y-4">
      <AdminHead title={t("admin.entries.title")} lead={t("admin.entries.lead")} />
      <div className="flex gap-1 rounded-full bg-surface p-1 ring-1 ring-line sm:w-fit">
        {tabs.map((x) => (
          <Link key={x.key} href={x.key === "duplicates" ? "/admin/entries" : "/admin/entries?tab=recent"} className={cx("inline-flex min-h-9 flex-1 items-center justify-center rounded-full px-4 text-sm font-semibold", tab === x.key ? "bg-ink text-white" : "text-ink hover:bg-canvas")}>
            {x.label}
          </Link>
        ))}
      </div>

      {tab === "duplicates" ? (
        pairs.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-surface px-4 py-10 text-center text-muted">{t("admin.entries.noDuplicates")}</p>
        ) : (
          <ul className="space-y-4">
            {pairs.map(({ entry, original }) => (
              <li key={entry.id} className="grid gap-4 rounded-2xl bg-surface p-4 shadow-card ring-1 ring-line md:grid-cols-[1fr_1fr_14rem]">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">{t("admin.entries.newDesign")}</p>
                  <EntryThumb entry={entry} />
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{t("admin.entries.looksLike")}</p>
                  <EntryThumb entry={original} />
                </div>
                <div className="flex flex-col gap-2">
                  <AdminAction label={t("admin.entries.remove")} body={t("admin.entries.removeBody")} tone="danger" run={removeEntry.bind(null, entry.id)} />
                  <AdminAction label={t("admin.entries.notCopy")} body={t("admin.entries.notCopyBody")} fields={[]} run={clearDuplicate.bind(null, entry.id)} />
                </div>
              </li>
            ))}
          </ul>
        )
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {recent.map((e) => (
            <li key={e.id} className="rounded-2xl bg-surface p-3 shadow-card ring-1 ring-line">
              <EntryThumb entry={e} />
              <div className="mt-2 flex items-center justify-between gap-2">
                <StatusPill tone={e.status === "active" || e.status === "winner" ? "ok" : e.status === "removed" ? "bad" : "muted"}>{t(`admin.entries.statuses.${e.status}` as MessageKey)}</StatusPill>
                {e.status !== "removed" && e.status !== "winner" && <AdminAction label={t("admin.entries.remove")} body={t("admin.entries.removeBody")} tone="ghost" run={removeEntry.bind(null, e.id)} />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
