import type { Metadata } from "next";
import Link from "next/link";
import { RemoveInvite } from "@/components/pro/admin-pro-client";
import "@/components/pro/admin-pro.css";
import { requirePermission } from "@/lib/admin/core";
import { hasPermission } from "@/lib/admin/permissions";
import { formatDate } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import { formatNumber } from "@/lib/money";
import { inviteOverview, type AdminInviteStatus } from "@/lib/pro/invite-admin";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("pro.invitesAdmin.title"), robots: { index: false } };
}

const CHIPS = ["all", "pending", "accepted", "declined", "removed", "unsent"] as const;
type Chip = (typeof CHIPS)[number];
const TONE: Record<AdminInviteStatus, string> = { unsent: "off", pending: "warn", accepted: "ok", declined: "off", removed: "fail" };

// Admin › Pro plan › Invitations (owner, 2026-10-14): every invitation to a Pro designer, the answer and its date, and
// whether the designer took part; an admin can take one back.
export default async function AdminInvitationsPage({ searchParams }: PageProps<"/admin/pro/invitations">) {
  const admin = await requirePermission("pro.view");
  const canManage = hasPermission(admin, "pro.manage");
  const sp = await searchParams;
  const chip: Chip = CHIPS.find((c) => c === sp.s) ?? "all";
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase().slice(0, 40) : "";
  const [{ t, locale }, o] = await Promise.all([getI18n(), inviteOverview()]);
  const n = (v: number) => formatNumber(v, locale);
  const rows = o.rows.filter(
    (r) => (chip === "all" || r.status === chip) && (!q || r.contest.brand.toLowerCase().includes(q) || r.client.name.toLowerCase().includes(q) || r.designer.name.toLowerCase().includes(q) || (r.designer.username ?? "").includes(q)),
  );
  const href = (c: Chip) => `/admin/pro/invitations${c === "all" && !q ? "" : `?${new URLSearchParams({ ...(c === "all" ? {} : { s: c }), ...(q ? { q } : {}) })}`}`;

  return (
    <div className="ap">
      <div className="ap-top">
        <div style={{ flex: "1 1 360px" }}>
          <Link href="/admin/pro" className="pr-link" style={{ fontSize: 14, fontWeight: 700 }}>
            ← {t("pro.admin.title")}
          </Link>
          <h1 className="lc-d m-0 text-[32px] font-semibold leading-[1.1] tracking-[-0.035em] text-ink">{t("pro.invitesAdmin.title")}</h1>
          <p className="m-0 text-[15.5px] text-muted">{t("pro.invitesAdmin.lead")}</p>
        </div>
      </div>

      <div className="ap-k four">
        {[
          [t("pro.invitesAdmin.kSent"), o.sent],
          [t("pro.invitesAdmin.kAccepted"), o.accepted],
          [t("pro.invitesAdmin.kDeclined"), o.declined],
          [t("pro.invitesAdmin.kJoined"), o.joined],
        ].map(([label, v]) => (
          <div key={label as string} className="ap-kc">
            <span>{label}</span>
            <b>{n(v as number)}</b>
          </div>
        ))}
      </div>

      <section className="ap-c" aria-labelledby="ap-inv">
        <div className="ap-h">
          <h2 id="ap-inv" className="sr-only">
            {t("pro.invitesAdmin.title")}
          </h2>
          <nav className="ap-chips" aria-label={t("pro.invitesAdmin.title")}>
            {CHIPS.map((c) => (
              <Link key={c} href={href(c)} className={chip === c ? "on" : undefined}>
                {t(`pro.invitesAdmin.chips.${c}`)} {n(o.counts[c])}
              </Link>
            ))}
          </nav>
        </div>
        <form action="/admin/pro/invitations" className="ap-search">
          {chip !== "all" && <input type="hidden" name="s" value={chip} />}
          <input name="q" defaultValue={q} placeholder={t("pro.invitesAdmin.search")} aria-label={t("pro.invitesAdmin.search")} />
        </form>
        {rows.length === 0 ? (
          <p className="ap-hint">{t("pro.invitesAdmin.none")}</p>
        ) : (
          <div className="ap-t">
            <div className="ap-r iv th">
              <span>{t("pro.invitesAdmin.colContest")}</span>
              <span>{t("pro.invitesAdmin.colClient")}</span>
              <span>{t("pro.invitesAdmin.colDesigner")}</span>
              <span>{t("pro.invitesAdmin.colStatus")}</span>
              <span>{t("pro.invitesAdmin.colJoined")}</span>
              <span />
            </div>
            {rows.map((r) => (
              <div key={`${r.contest.id}:${r.designer.id}`} className="ap-r iv">
                <span className="ap-nm">
                  <b>
                    <Link href={`/admin/contests/${r.contest.slug}`}>{r.contest.brand}</Link>
                  </b>
                  <em>
                    {r.contest.number ? `LC-${String(r.contest.number).padStart(4, "0")} · ` : ""}
                    {r.notifiedAt ? t("pro.invitesAdmin.sentOn", { date: formatDate(new Date(r.notifiedAt), locale, "short") }) : t("pro.invitesAdmin.notSent")}
                  </em>
                </span>
                <span>
                  <Link href={`/admin/users/${r.client.id}`}>{r.client.name}</Link>
                </span>
                <span className="ap-nm">
                  <b>
                    <Link href={`/admin/users/${r.designer.id}`}>{r.designer.name}</Link>
                  </b>
                  <em>{r.designer.username ? `@${r.designer.username}` : ""}</em>
                </span>
                <span>
                  <i className={`ap-st ${TONE[r.status]}`}>{t(`pro.invitesAdmin.chips.${r.status}`)}</i>
                  {(r.respondedAt || r.removedAt) && <em style={{ display: "block", fontStyle: "normal", fontSize: 12.5, color: "#6a6d76", marginTop: 3 }}>{formatDate(new Date((r.removedAt ?? r.respondedAt)!), locale, "short")}</em>}
                </span>
                <span>{r.designs === 0 ? t("pro.invitesAdmin.joinedNo") : r.designs === 1 ? t("pro.invitesAdmin.joinedOne") : t("pro.invitesAdmin.joinedYes", { n: n(r.designs) })}</span>
                <span>{r.status !== "removed" && <RemoveInvite contestId={r.contest.id} designerId={r.designer.id} canManage={canManage} />}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
