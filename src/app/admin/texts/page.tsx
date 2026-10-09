import type { Metadata } from "next";
import Link from "next/link";
import { AdminHead } from "@/components/admin/page-head";
import { TextRow, type TextItem } from "@/components/admin/text-row";
import { flattenTexts, groupOf, isTextGroup, placeholders, TEXT_GROUPS, type TextGroup, type TextTree } from "@/lib/content/rules";
import { textOverrides } from "@/lib/content/texts";
import { cx } from "@/lib/cx";
import { MESSAGES } from "@/lib/i18n/messages";
import { getI18n } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { requirePermission } from "@/lib/admin/core";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.texts.title"), robots: { index: false } };
}

const PER_PAGE = 25;

function href(p: { group?: TextGroup; q?: string; changed?: boolean; page?: number }) {
  const s = new URLSearchParams();
  if (p.group) s.set("group", p.group);
  if (p.q) s.set("q", p.q);
  if (p.changed) s.set("changed", "1");
  if (p.page && p.page > 1) s.set("page", String(p.page));
  const q = s.toString();
  return q ? `/admin/texts?${q}` : "/admin/texts";
}

// A-14 Texts (BLUEPRINT §13.1): every text on the site, by page, with search; English and Bangla side by side.
export default async function AdminTextsPage({ searchParams }: PageProps<"/admin/texts">) {
  await requirePermission("content.view");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const changedOnly = sp.changed === "1";
  const group: TextGroup = typeof sp.group === "string" && isTextGroup(sp.group) ? sp.group : "home";
  const [{ t }, overrides] = await Promise.all([getI18n(), textOverrides()]);

  const en = flattenTexts(MESSAGES.en as unknown as TextTree);
  const bn = flattenTexts(MESSAGES.bn as unknown as TextTree);
  const all = Object.keys(en)
    .map((key) => ({ key, group: groupOf(key) }))
    .filter((k): k is { key: string; group: TextGroup } => k.group !== null)
    .map(({ key, group: g }) => {
      const builtIn = { en: en[key], bn: bn[key] ?? en[key] };
      const current = { en: overrides.en[key] ?? builtIn.en, bn: overrides.bn[key] ?? builtIn.bn };
      return { key, group: g, builtIn, current, changed: current.en !== builtIn.en || current.bn !== builtIn.bn };
    });

  const counts = new Map<TextGroup, { all: number; changed: number }>();
  for (const i of all) {
    const c = counts.get(i.group) ?? { all: 0, changed: 0 };
    c.all++;
    if (i.changed) c.changed++;
    counts.set(i.group, c);
  }

  const needle = q.toLocaleLowerCase();
  const matches = all.filter(
    (i) =>
      (q ? [i.key, i.builtIn.en, i.builtIn.bn, i.current.en, i.current.bn].some((s) => s.toLocaleLowerCase().includes(needle)) : i.group === group) &&
      (!changedOnly || i.changed),
  );
  const pages = Math.max(1, Math.ceil(matches.length / PER_PAGE));
  const page = Math.min(pages, Math.max(1, Number(sp.page) || 1));
  const shown: TextItem[] = matches.slice((page - 1) * PER_PAGE, page * PER_PAGE).map((i) => ({
    key: i.key,
    builtIn: i.builtIn,
    current: i.current,
    names: placeholders(i.builtIn.en),
  }));

  return (
    <div className="space-y-4">
      <AdminHead title={t("admin.texts.title")} lead={t("admin.texts.lead")} />

      <form action="/admin/texts" className="flex flex-wrap items-center gap-2">
        <label htmlFor="texts-q" className="sr-only">
          {t("admin.texts.search")}
        </label>
        <input
          id="texts-q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder={t("admin.texts.searchPlaceholder")}
          className="min-h-11 min-w-0 flex-1 rounded-full bg-surface px-4 text-sm text-ink ring-1 ring-line focus:outline-none focus:ring-2 focus:ring-primary"
        />
        {!q && <input type="hidden" name="group" value={group} />}
        <label className="inline-flex min-h-11 items-center gap-2 rounded-full bg-surface px-4 text-sm text-ink ring-1 ring-line">
          <input type="checkbox" name="changed" value="1" defaultChecked={changedOnly} className="size-4 accent-[var(--color-primary)]" />
          {t("admin.texts.changedOnly")}
        </label>
        <button className="min-h-11 rounded-full bg-ink px-5 text-sm font-semibold text-white">{t("admin.texts.search")}</button>
      </form>

      <nav aria-label={t("admin.texts.title")} className="-mx-4 overflow-x-auto px-4">
        <ul className="flex gap-1.5 pb-1">
          {TEXT_GROUPS.map(({ id }) => {
            const c = counts.get(id);
            if (!c) return null;
            const active = !q && id === group;
            return (
              <li key={id} className="shrink-0">
                <Link
                  href={href({ group: id, changed: changedOnly })}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-sm font-medium ring-1",
                    active ? "bg-ink text-white ring-ink" : "bg-surface text-ink ring-line hover:ring-primary",
                  )}
                >
                  {t(`admin.texts.groups.${id}` as MessageKey)}
                  {c.changed > 0 && <span className={cx("rounded-full px-1.5 text-xs font-bold", active ? "bg-white/20" : "bg-primary text-white")}>{c.changed}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <p className="text-sm text-muted">{t("admin.texts.count", { n: matches.length })}</p>

      {shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-surface px-4 py-10 text-center text-muted">{t("admin.texts.none")}</p>
      ) : (
        <ul className="space-y-3">
          {shown.map((item) => (
            <TextRow key={item.key} item={item} />
          ))}
        </ul>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between gap-2 text-sm">
          {page > 1 ? (
            <Link href={href({ group: q ? undefined : group, q, changed: changedOnly, page: page - 1 })} className="inline-flex min-h-11 items-center rounded-full bg-surface px-4 font-semibold ring-1 ring-line">
              ← {t("admin.prev")}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted">{t("admin.texts.page", { page, pages })}</span>
          {page < pages ? (
            <Link href={href({ group: q ? undefined : group, q, changed: changedOnly, page: page + 1 })} className="inline-flex min-h-11 items-center rounded-full bg-surface px-4 font-semibold ring-1 ring-line">
              {t("admin.next")} →
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}
