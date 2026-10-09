import type { Metadata } from "next";
import { AdminAction } from "@/components/admin/admin-action";
import { BlockedTest } from "@/components/admin/blocked-test";
import { AdminHead } from "@/components/admin/page-head";
import { listBlockedTerms } from "@/lib/admin/misc";
import { addBlockedTerm, removeBlockedTerm } from "@/lib/admin/site-actions";
import { getI18n } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.terms.title"), robots: { index: false } };
}

// A-10 Blocked terms (BLUEPRINT §10, §13.9): extra words the no-contact filter blocks, plus a test box.
export default async function AdminBlockedTermsPage() {
  const [{ t }, terms] = await Promise.all([getI18n(), listBlockedTerms()]);
  return (
    <div className="space-y-4">
      <AdminHead
        title={t("admin.terms.title")}
        lead={t("admin.terms.lead")}
        actions={
          <AdminAction
            label={t("admin.terms.add")}
            tone="primary"
            fields={[
              { name: "term", kind: "text", label: t("admin.terms.term"), hint: t("admin.terms.termHint") },
              { name: "type", kind: "select", label: t("admin.terms.type"), options: (["custom", "social", "phone", "email", "link"] as const).map((v) => ({ value: v, label: t(`admin.terms.types.${v}`) })) },
              { name: "language", kind: "select", label: t("admin.terms.language"), options: (["any", "en", "bn"] as const).map((v) => ({ value: v, label: t(`admin.terms.languages.${v}`) })) },
            ]}
            run={addBlockedTerm}
          />
        }
      />
      <BlockedTest />
      <section className="rounded-2xl bg-surface p-5 shadow-card ring-1 ring-line">
        <h2 className="font-semibold text-ink">
          {t("admin.terms.list")} <span className="text-muted">({terms.length})</span>
        </h2>
        {terms.length === 0 ? (
          <p className="mt-4 text-sm text-muted">{t("admin.terms.empty")}</p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {terms.map((term) => (
              <li key={term.id} className="flex items-center gap-1 rounded-full bg-canvas py-1 pl-3 pr-1 text-sm ring-1 ring-line">
                <span className="font-medium text-ink">{term.term}</span>
                <span className="text-xs text-muted">
                  {t(`admin.terms.types.${term.type}` as MessageKey)} · {t(`admin.terms.languages.${term.language}` as MessageKey)}
                </span>
                <AdminAction label="×" title={t("admin.terms.removeTitle", { term: term.term })} confirm={t("admin.terms.remove")} tone="ghost" fields={[]} run={removeBlockedTerm.bind(null, term.id)} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
