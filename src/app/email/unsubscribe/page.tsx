import type { Metadata } from "next";
import Link from "next/link";
import { UnsubscribeBox } from "@/components/settings/email-prefs";
import { PageShell, Panel } from "@/components/ui/panel";
import { readUnsubscribe } from "@/lib/email/prefs";
import { getI18n } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("email.unsub.metaTitle"), robots: { index: false, follow: false } };
}

// The Unsubscribe link in every email except codes and security emails (owner, 2026-10-15). It works without
// logging in (the link is signed for one person and one kind of email) and asks before changing anything.
export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ t }, sp] = await Promise.all([getI18n(), searchParams]);
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const link = { u: one(sp.u), k: one(sp.k), s: one(sp.s) };
  const who = readUnsubscribe(link.u, link.k, link.s);
  return (
    <PageShell>
      <Panel tone="grey" className="flex flex-1 items-start justify-center">
        <div className="lc-card w-full max-w-lg space-y-4 p-6 sm:p-8">
          <h1 className="m-0 text-[24px] font-semibold tracking-[-0.02em] text-ink">{t("email.unsub.title")}</h1>
          {who ? <UnsubscribeBox link={link} type={t(`email.prefs.types.${who.key}.label` as MessageKey)} /> : <p className="m-0 text-[16px] text-ink">{t("email.unsub.invalid")}</p>}
          <Link href="/dashboard/profile#emails" className="inline-block text-[15px] font-semibold text-primary hover:underline">
            {t("email.unsub.settings")}
          </Link>
        </div>
      </Panel>
    </PageShell>
  );
}
