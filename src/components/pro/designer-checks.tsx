/* eslint-disable @next/next/no-img-element */
import { after } from "next/server";
import { headers } from "next/headers";
import { PageShell } from "@/components/ui/panel";
import { SmallPageHeader } from "@/components/ui/section-heading";
import type { CurrentUser } from "@/lib/auth/policies";
import { formatDate } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import { formatNumber } from "@/lib/money";
import { runLogoCheck } from "@/lib/logo-check/run";
import { designerCheckUsage, designerChecks } from "@/lib/pro/logo-checks";
import { getProSettings } from "@/lib/pro/settings";
import { DesignerChecker } from "./designer-checker";
import { Icon, Slot } from "./parts";
import { ProWorkspace, WsHead } from "./workspace";
import "./pro.css";
import "./go-pro.css";

const VERDICT_TONE = { no_match: "op", similar: "warn", high_risk: "fail" } as const;

/**
 * A designer's own Logo Checker (owner, 2026-10-13): checks left this month and when they start again, a new check,
 * and earlier results. Basic designers get a few a month, Pro many more (Admin › Pro plan).
 */
export async function DesignerChecks({ user }: { user: CurrentUser }) {
  const [{ t, locale }, usage, list, { settings, ready }] = await Promise.all([getI18n(), designerCheckUsage(user.id), designerChecks(user.id), getProSettings()]);
  const stale = list.filter((c) => c.stale);
  if (stale.length) {
    const h = await headers();
    const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
    after(async () => {
      for (const c of stale) await runLogoCheck(c.id, origin);
    });
  }
  const n = (v: number) => formatNumber(v, locale);
  const basicNote = !usage.pro && ready && settings.isForSale ? t("pro.checker.limitBasic", { n: n(settings.basicLogoChecks), pro: n(settings.proLogoChecks) }) : null;
  const body = (
    <div className="pr" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <section className="pr-lc">
        <span className="ic">
          <Icon name="shield" size={26} />
        </span>
        <div>
          <b>{t("pro.checker.left", { left: n(usage.left), max: n(usage.limit) })}</b>
          <em>
            {t("pro.checker.resets", { date: formatDate(usage.resetsOn, locale, "long") })} · {t("pro.checker.lead")}
          </em>
          <Slot used={usage.used} max={usage.limit} />
        </div>
      </section>
      <section className="pr-card">
        {ready ? <DesignerChecker left={usage.left} basicNote={basicNote} /> : <p className="pr-empty">{t("pro.checker.notReady")}</p>}
      </section>
      <section className="pr-card">
        <div className="pr-ch">
          <h2>{t("pro.checker.mine")}</h2>
        </div>
        {list.length === 0 && <p className="pr-empty">{t("pro.checker.none")}</p>}
        {list.map((c) => (
          <div key={c.id} className="pr-li" style={{ alignItems: "flex-start" }}>
            <span className="pr-thumb" style={{ width: 64, height: 64 }}>
              {c.logoUrl ? <img src={c.logoUrl} alt="" /> : null}
            </span>
            <div style={{ gap: 6 }}>
              <b>
                CC-{String(c.number).padStart(4, "0")} · {formatDate(new Date(c.createdAt), locale, "short")}
              </b>
              {c.status === "done" && c.verdict ? (
                <>
                  <span style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    <i className={`pr-pill ${VERDICT_TONE[c.verdict]}`}>{t(`pro.checker.verdict.${c.verdict}`)}</i>
                    {c.overall !== null && <i className="pr-pill mu">{t("pro.checker.overall", { n: n(c.overall) })}</i>}
                    {c.uniqueness !== null && <i className="pr-pill mu">{t("pro.checker.uniqueness", { n: n(c.uniqueness) })}</i>}
                  </span>
                  {c.advice && <em style={{ whiteSpace: "normal" }}>{c.advice}</em>}
                  {c.matches.length > 0 && (
                    <span style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {c.matches.map((m, i) => (
                        <a key={i} href={m.pageUrl ?? undefined} target="_blank" rel="noopener noreferrer" className="pr-thumb" style={{ width: 64, height: 64, position: "relative", boxShadow: m.close ? "0 0 0 2px #A3121B" : undefined }} title={`${t("pro.checker.similar", { n: n(m.similarity) })} · ${m.site ?? t("pro.checker.onWeb")}`}>
                          {m.imageUrl ? <img src={m.imageUrl} alt="" /> : null}
                        </a>
                      ))}
                    </span>
                  )}
                </>
              ) : c.status === "failed" ? (
                <em>{t("pro.checker.failed")}</em>
              ) : (
                <em>{t("pro.checker.checking", { n: n(Math.max(1, c.step)) })}</em>
              )}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
  if (usage.pro)
    return (
      <ProWorkspace user={user} active="checker">
        <WsHead title={t("pro.checker.title")} lead={t("pro.checker.lead")} />
        {body}
      </ProWorkspace>
    );
  return (
    <PageShell>
      <SmallPageHeader title={t("pro.checker.title")} sub={t("pro.checker.lead")} back={{ href: "/dashboard", label: t("nav.dashboard") }} />
      {body}
    </PageShell>
  );
}
