import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageShell } from "@/components/ui/panel";
import { durationText, Icon, ProBadge, type ProIconName } from "@/components/pro/parts";
import { UpgradeLink } from "@/components/pro/upgrade-link";
import "@/components/pro/pro.css";
import "@/components/pro/go-pro.css";
import { getCurrentUser } from "@/lib/auth/session";
import { formatDate } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import type { Translate } from "@/lib/i18n/translate";
import { formatTaka } from "@/lib/money";
import { isProActive, priceQuote, type ProSettings } from "@/lib/pro/rules";
import { getProSettings } from "@/lib/pro/settings";
import { getSubscription } from "@/lib/pro/status";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("pro.go.metaTitle"), description: t("pro.go.metaDescription") };
}

const BENEFITS: { key: "b1" | "b2" | "b3" | "b4" | "b5" | "b6" | "b7" | "b8"; icon: ProIconName; color: string; feature?: keyof ProSettings["features"] }[] = [
  { key: "b1", icon: "eye", color: "#8B0000" },
  { key: "b2", icon: "crown", color: "#D9A52B", feature: "highlighted_entries" },
  { key: "b3", icon: "chat", color: "#1F6FB2", feature: "client_chat" },
  { key: "b4", icon: "shield", color: "#14633C" },
  { key: "b5", icon: "bolt", color: "#C2410C", feature: "early_access" },
  { key: "b6", icon: "image", color: "#7C3AED" },
  { key: "b7", icon: "chart", color: "#0F7A73", feature: "insights" },
  { key: "b8", icon: "help", color: "#A3121B", feature: "priority_support" },
];

type Cell = { kind: "yes"; text?: string } | { kind: "no" } | { kind: "text"; text: string } | { kind: "dash" };

function cell(c: Cell) {
  if (c.kind === "yes")
    return (
      <span className="gp-y">
        <Icon name="check" size={22} strokeWidth={2.6} />
        {c.text && <em>{c.text}</em>}
      </span>
    );
  if (c.kind === "no")
    return (
      <span className="gp-n">
        <Icon name="x" size={22} strokeWidth={2.6} />
      </span>
    );
  if (c.kind === "dash") return <span className="gp-d">—</span>;
  return <span className="gp-tx">{c.text}</span>;
}

/** The Basic vs Pro table, built from Admin › Pro plan (a switched-off feature isn't promised). */
function rows(s: ProSettings, t: Translate): { group: string; items: { label: string; basic: Cell; pro: Cell }[] }[] {
  const f = s.features;
  const early = durationText(s.earlyAccessMinutes, t);
  return [
    {
      group: t("pro.go.cmp.groups.contests"),
      items: [
        { label: t("pro.go.cmp.send"), basic: { kind: "yes" }, pro: { kind: "yes" } },
        { label: t("pro.go.cmp.perContest"), basic: { kind: "text", text: t("pro.go.cmp.upTo", { n: s.basicEntriesPerContest }) }, pro: { kind: "yes", text: s.proEntriesPerContest ? t("pro.go.cmp.upTo", { n: s.proEntriesPerContest }) : t("pro.go.cmp.unlimited") } },
        ...(f.early_access && s.earlyAccessMinutes > 0
          ? [
              { label: t("pro.go.cmp.early"), basic: { kind: "text", text: t("pro.go.cmp.earlyBasic", { time: early }) } as Cell, pro: { kind: "yes", text: t("pro.go.cmp.earlyPro", { time: early }) } as Cell },
              { label: t("pro.go.cmp.notifications"), basic: { kind: "text", text: t("pro.go.cmp.standard") } as Cell, pro: { kind: "yes", text: t("pro.go.cmp.instant") } as Cell },
            ]
          : []),
        ...(f.invitations
          ? [
              { label: t("pro.go.cmp.invites"), basic: { kind: "no" } as Cell, pro: { kind: "yes" } as Cell },
              { label: t("pro.go.cmp.invitedAlerts"), basic: { kind: "no" } as Cell, pro: { kind: "yes", text: t("pro.go.cmp.priority") } as Cell },
            ]
          : []),
        ...(f.highlighted_entries ? [{ label: t("pro.go.cmp.entries"), basic: { kind: "text", text: t("pro.go.cmp.normalEntry") } as Cell, pro: { kind: "yes", text: t("pro.go.cmp.highlighted") } as Cell }] : []),
        { label: t("pro.go.cmp.badge"), basic: { kind: "dash" }, pro: { kind: "yes", text: t("pro.go.cmp.proBadge") } },
      ],
    },
    {
      group: t("pro.go.cmp.groups.profile"),
      items: [
        { label: t("pro.go.cmp.public"), basic: { kind: "no" }, pro: { kind: "yes" } },
        { label: t("pro.go.cmp.portfolio"), basic: { kind: "text", text: t("pro.go.cmp.onlyContest") }, pro: { kind: "yes", text: t("pro.go.cmp.ownUpTo", { n: s.proPortfolioLimit }) } },
        { label: t("pro.go.cmp.search"), basic: { kind: "text", text: t("pro.go.cmp.normal") }, pro: { kind: "yes", text: t("pro.go.cmp.higher") } },
        ...(f.show_contact_on_profile ? [{ label: t("pro.go.cmp.contact"), basic: { kind: "dash" } as Cell, pro: { kind: "yes", text: t("pro.go.cmp.byPrivacy") } as Cell }] : []),
      ],
    },
    {
      group: t("pro.go.cmp.groups.tools"),
      items: [
        ...(f.client_chat ? [{ label: t("pro.go.cmp.messages"), basic: { kind: "no" } as Cell, pro: { kind: "yes", text: t("pro.go.cmp.ownEntries") } as Cell }] : []),
        { label: t("pro.go.cmp.checker"), basic: { kind: "text", text: t("pro.go.cmp.checksMonth", { n: s.basicLogoChecks }) }, pro: { kind: "yes", text: t("pro.go.cmp.checksMonth", { n: s.proLogoChecks }) } },
        ...(f.insights ? [{ label: t("pro.go.cmp.insights"), basic: { kind: "no" } as Cell, pro: { kind: "yes", text: t("pro.go.cmp.insightsPro") } as Cell }] : []),
      ],
    },
    {
      group: t("pro.go.cmp.groups.billing"),
      items: [
        { label: t("pro.go.cmp.support"), basic: { kind: "text", text: t("pro.go.cmp.standard") }, pro: { kind: "yes", text: f.priority_support ? t("pro.go.cmp.prioritySupport") : t("pro.go.cmp.standard") } },
        { label: t("pro.go.cmp.renewal"), basic: { kind: "dash" }, pro: { kind: "yes", text: t("pro.go.cmp.renewalPro") } },
      ],
    },
  ];
}

// Go Pro (owner, 2026-10-13; Design/pro/go-pro.html): the price and benefits from Admin › Pro plan, Basic vs Pro,
// and Upgrade. Pro designers see "You are Pro · Manage plan"; while the plan isn't for sale nobody can buy.
export default async function GoProPage() {
  const [{ t, locale }, user, { settings: s, ready }] = await Promise.all([getI18n(), getCurrentUser(), getProSettings()]);
  const designer = user?.role === "designer" ? user : null;
  const sub = designer ? await getSubscription(designer.id) : null;
  const pro = isProActive(sub);
  const forSale = ready && s.isForSale;
  const quote = priceQuote(s, { firstTime: !sub });
  const price = formatTaka(s.priceBdt, locale);
  const shown = forSale ? quote : { ...quote, amount: s.priceBdt, reason: "list" as const };
  const checkout = designer ? "/pro/checkout" : "/login?as=designer&next=%2Fpro%2Fcheckout";
  const n = (v: number) => new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US").format(v);

  const upgrade = (step: string, wide?: boolean): ReactNode => {
    if (pro)
      return (
        <div className="gp-pro-on">
          <span>
            {t("pro.go.youArePro")} · {t("pro.go.proUntil", { date: formatDate(sub!.currentPeriodEnd, locale, "long") })}
          </span>
          <Link href="/dashboard/profile#subscription" className="pr-link">
            {t("pro.go.manage")}
          </Link>
        </div>
      );
    if (!forSale) return <div className="gp-soon">{t("pro.go.soonTitle")}</div>;
    if (user && !designer) return <div className="gp-soon">{t("pro.go.clientNote")}</div>;
    return (
      <UpgradeLink href={checkout} step={step} className={`gp-up${wide ? " wide" : ""}`}>
        {user ? t("pro.go.upgrade") : t("pro.go.login")}
        <i>
          <Icon name="arrow" />
        </i>
      </UpgradeLink>
    );
  };

  return (
    <PageShell>
      <div className="pr gp-page">
        <section className="gp-hero">
          <div className="gp-l">
            <span className="gp-k">
              <Icon name="sparkle" size={16} />
              {t("pro.go.kicker")}
            </span>
            <h1>
              {t("pro.go.title")}
              <br />
              <span>{t("pro.go.accent")}</span>
            </h1>
            <p className="lead">{t("pro.go.lead")}</p>
            <div className="gp-price">
              <div className="gp-pt">
                <span className="gp-pk">
                  <Icon name="crown" size={16} />
                  {t("pro.go.planKicker")}
                </span>
                <span className="gp-pm">{t("pro.go.monthly")}</span>
              </div>
              <div className="gp-pp">
                <b>{formatTaka(shown.reason === "trial" ? s.priceBdt : shown.amount, locale)}</b>
                {shown.reason === "offer" && <s>{price}</s>}
                <span>{t("pro.go.perMonth")}</span>
              </div>
              {shown.reason === "offer" && <span className="gp-offer">{t(s.offerAudience === "all" ? "pro.go.offerAllLine" : "pro.go.offerLine", { amount: formatTaka(shown.amount, locale), price })}</span>}
              {shown.reason === "trial" && <span className="gp-offer">{t("pro.go.trialLine", { days: n(shown.trialDays), price })}</span>}
              {upgrade("hero")}
              <span className="gp-pc">{forSale || pro ? t("pro.go.cancelLine") : t("pro.go.soonLead")}</span>
              {!user && forSale && (
                <Link href="/designers/signup" className="pr-link" style={{ justifyContent: "center" }}>
                  {t("pro.go.join")}
                </Link>
              )}
            </div>
          </div>
          <div className="gp-v" aria-hidden>
            <span className="gp-glowv" />
            <div className="gp-pc2">
              <div className="gp-pch">
                <span className="gp-pca">{(designer?.name.trim()[0] ?? "D").toUpperCase()}</span>
                <div>
                  <b>{designer?.name ?? t("pro.go.example.name")}</b>
                  <span>{t("pro.go.example.role")}</span>
                </div>
                <ProBadge size="sm" />
              </div>
              <div className="gp-pce">
                <span className="gp-pcl">
                  <Icon name="crown" size={26} />
                </span>
                <div>
                  <span className="gp-tag">{t("pro.go.example.highlighted")}</span>
                  <b>{t("pro.go.example.entry")}</b>
                  <span>{t("pro.go.example.near")}</span>
                </div>
              </div>
              <div className="gp-pcs">
                <div>
                  <em>{t("pro.go.example.profileViews")}</em>
                  <b>—</b>
                </div>
                <div>
                  <em>{t("pro.go.example.designViews")}</em>
                  <b>—</b>
                </div>
                <div>
                  <em>{t("pro.go.example.shortlisted")}</em>
                  <b>—</b>
                </div>
              </div>
            </div>
            <div className="gp-fq q1">
              <span className="ic" style={{ background: "#E8F1FB", color: "#1F6FB2" }}>
                <Icon name="chat" />
              </span>
              <div>
                <b>{t("pro.go.example.q1")}</b>
                <span>{t("pro.go.example.q1Sub")}</span>
              </div>
            </div>
            <div className="gp-fq q2">
              <span className="ic" style={{ background: "#FFEDD5", color: "#C2410C" }}>
                <Icon name="bolt" />
              </span>
              <div>
                <b>{t("pro.go.example.q2")}</b>
                <span>{t("pro.go.example.q2Sub")}</span>
              </div>
            </div>
            <div className="gp-fq q3">
              <span className="ic" style={{ background: "#E4F5EC", color: "#14633C" }}>
                <Icon name="shield" />
              </span>
              <div>
                <b>{t("pro.go.example.q3")}</b>
                <span>{t("pro.go.example.q3Sub")}</span>
              </div>
            </div>
            <span className="gp-note">{t("pro.go.example.note")}</span>
          </div>
        </section>

        <section className="gp-b" aria-labelledby="gp-benefits">
          <div className="gp-bh">
            <h2 id="gp-benefits">{t("pro.go.benefitsTitle")}</h2>
            <span>{t("pro.go.benefitsSub", { price })}</span>
          </div>
          <div className="gp-bg">
            {BENEFITS.filter((b) => !b.feature || s.features[b.feature]).map((b) => (
              <div key={b.key} className="gp-bf" style={{ "--k": b.color } as React.CSSProperties}>
                <span className="gp-bfi">
                  <Icon name={b.icon} size={22} />
                </span>
                <div>
                  <b>
                    <i>
                      <Icon name="check" size={16} strokeWidth={2.8} />
                    </i>
                    {t(`pro.go.${b.key}.title`, { n: b.key === "b4" ? s.proLogoChecks : s.proPortfolioLimit })}
                  </b>
                  <span>{t(`pro.go.${b.key}.text`, { n: b.key === "b4" ? s.proLogoChecks : s.proPortfolioLimit })}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="gp-cmp" aria-labelledby="gp-cmp">
          <div>
            <h2 id="gp-cmp">{t("pro.go.cmpTitle")}</h2>
            <span className="sub">{t("pro.go.cmpSub")}</span>
          </div>
          <div className="gp-t" role="table">
            <div className="gp-r h" role="row">
              <span role="columnheader">{t("pro.go.cmp.feature")}</span>
              <span className="b" role="columnheader">
                <b>{t("pro.go.cmp.basic")}</b>
                <em>{t("pro.go.cmp.free")}</em>
              </span>
              <span className="p" role="columnheader">
                <b>
                  <Icon name="crown" size={16} />
                  {t("pro.go.cmp.pro")}
                </b>
                <em>{t("pro.go.cmp.price", { price })}</em>
              </span>
            </div>
            {rows(s, t).map((g) => (
              <div key={g.group} role="rowgroup">
                <div className="gp-g">{g.group}</div>
                {g.items.map((r) => (
                  <div key={r.label} className="gp-r" role="row">
                    <span className="f" role="rowheader">
                      {r.label}
                    </span>
                    <span role="cell" aria-label={r.basic.kind === "no" ? t("pro.go.cmp.no") : undefined}>
                      {cell(r.basic)}
                    </span>
                    <span className="p" role="cell">
                      {cell(r.pro)}
                    </span>
                  </div>
                ))}
              </div>
            ))}
            <div className="gp-r foot" role="row">
              <span />
              <span>{designer && !pro && <em>{t("pro.go.cmp.current")}</em>}</span>
              <span className="p">
                {pro ? (
                  <ProBadge />
                ) : forSale && (!user || designer) ? (
                  <UpgradeLink href={checkout} step="table" className="gp-cbtn">
                    {t("pro.go.upgrade")}
                  </UpgradeLink>
                ) : null}
              </span>
            </div>
          </div>
        </section>

        <section className="gp-end">
          <div>
            <h2>{t("pro.go.endTitle")}</h2>
            <p>{forSale ? t("pro.go.endLead", { price }) : t("pro.go.soonLead")}</p>
          </div>
          {upgrade("end", true)}
        </section>
      </div>
    </PageShell>
  );
}
