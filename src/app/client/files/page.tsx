import type { Metadata } from "next";
import Link from "@/components/ui/link";
import { redirect } from "next/navigation";
import { CwIcon } from "@/components/client/icons";
import { Empty, Picture } from "@/components/client/parts";
import { getCurrentUser } from "@/lib/auth/session";
import { contestHref } from "@/lib/client/rules";
import { clientFiles } from "@/lib/client/workspace";
import { formatDate } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import { certNumber } from "@/lib/logo-check/rules";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("cw.files.metaTitle"), robots: { index: false } };
}

// Premium client workspace › Files & certificates (owner, 2026-10-16): every contest's final files (in the contest's
// Payment & files tab) and the logo check certificates, from the existing handovers and checks.
export default async function ClientFilesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?as=client&next=%2Fclient%2Ffiles");
  if (user.role !== "client") redirect("/dashboard");
  const [{ t, locale }, f] = await Promise.all([getI18n(), clientFiles(user.id)]);
  return (
    <>
      <div className="phd2">
        <div>
          <div className="dnl">
            <h1>{t("cw.menu.files")}</h1>
          </div>
          <p>{t("cw.files.lead")}</p>
        </div>
      </div>
      <div className="cg2">
        <section className="dcard">
          <div className="dch">
            <h2>{t("cw.files.finals")}</h2>
          </div>
          {f.finals.length === 0 ? (
            <Empty title={t("cw.home.filesNone")} lead={t("cw.home.filesNoneLead")} />
          ) : (
            f.finals.map((x) => (
              <div key={x.slug} className="cfl">
                <span className="psvi sm2">
                  <Picture url={x.cover} name={x.brand} />
                </span>
                <div>
                  <b>{x.brand}</b>
                  <em>{t(`cw.files.${x.status === "approved" ? "ready" : x.status === "submitted" ? "check" : x.status === "no_result" ? "noResult" : "waiting"}`)}</em>
                </div>
                <Link href={`${contestHref(x.slug, "payment")}#files`} className="dic sm" aria-label={t("cw.files.open", { brand: x.brand })}>
                  <CwIcon name="download" size={18} />
                </Link>
              </div>
            ))
          )}
        </section>
        <section className="dcard">
          <div className="dch">
            <h2>{t("cw.files.certs")}</h2>
          </div>
          {f.certificates.length === 0 ? (
            <Empty title={t("cw.files.certsNone")} lead={t("cw.home.checksRule")} />
          ) : (
            f.certificates.map((c) => (
              <div key={c.id} className="cfl">
                <span className="pni w">
                  <CwIcon name="shield" size={16} />
                </span>
                <div>
                  <b>
                    {certNumber(c.number)} · {c.brand}
                  </b>
                  <em>
                    {c.verdict ? t(`checker.verdicts.${c.verdict}` as Parameters<typeof t>[0]) : ""} · {formatDate(c.at, locale, "short")}
                  </em>
                </div>
                <a href={`/api/logo-checks/${c.id}/certificate`} className="dic sm" aria-label={t("cw.files.cert", { n: certNumber(c.number) })}>
                  <CwIcon name="download" size={18} />
                </a>
              </div>
            ))
          )}
        </section>
      </div>
    </>
  );
}
