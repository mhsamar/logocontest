/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { AgreementPhotos } from "@/components/admin/agreement-photos";
import { AgreementReview, AskPhotoButton } from "@/components/admin/agreement-review";
import { AgreementSwitch } from "@/components/admin/agreement-switch";
import { RevealId } from "@/components/admin/reveal-id";
import { describeDevice } from "@/lib/agreements/device";
import { adminAgreements, type AdminAgreement, type ReviewStatus } from "@/lib/agreements/queries";
import { requirePermission } from "@/lib/admin/core";
import { hasPermission } from "@/lib/admin/permissions";
import { cx } from "@/lib/cx";
import { formatDate } from "@/lib/dates";
import type { Locale } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import type { Translate } from "@/lib/i18n/translate";
import { formatNumber } from "@/lib/money";
import { formatBdMobile } from "@/lib/phone";
import { getSetting } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.agreements.title"), robots: { index: false } };
}

const TABS = ["all", "needs_review", "approved", "no_photo", "rejected"] as const;
type Tab = (typeof TABS)[number];
/** Needs review first, then the rest, newest first inside each (owner, 2026-10-12). */
const ORDER: Record<ReviewStatus, number> = { needs_review: 0, no_photo: 1, rejected: 2, approved: 3 };

const STATUS_PILL: Record<ReviewStatus, string> = {
  needs_review: "bg-[#FFEDD5] text-[#9A3412]",
  approved: "bg-[#E3F3EA] text-[#14633C]",
  no_photo: "bg-[#F0F1F4] text-[#3A3C45]",
  rejected: "bg-[#FDE3E1] text-[#A3121B]",
};
const AVATAR_TONES = ["bg-[#FBECEB] text-primary", "bg-[#E1ECFA] text-[#1F4E8C]", "bg-[#FFF1CF] text-[#8A5A00]", "bg-[#E3F3EA] text-[#14633C]"];

const CARD = "rounded-2xl border border-[#E9EAEE] bg-white shadow-[0_1px_2px_rgba(17,18,22,.03)]";

// A-13 Designer agreements (redesign owner 2026-10-12, Design/agreements): one card per signed agreement with the
// designer, the ID (photos shown directly) and the agreement with its review. Agreements "manage" sees the photos,
// full numbers and actions; "view" sees the page without them. The server checks every action and photo again.
export default async function AdminAgreementsPage({ searchParams }: PageProps<"/admin/agreements">) {
  const admin = await requirePermission("agreements.view");
  const canManage = hasPermission(admin, "agreements.manage");
  const sp = await searchParams;
  const tab: Tab = TABS.find((x) => x === sp.tab) ?? "all";
  const q = (typeof sp.q === "string" ? sp.q : "").replace(/\s+/g, " ").trim().slice(0, 60);
  const [{ t, locale }, all, required] = await Promise.all([getI18n(), adminAgreements(), getSetting("legal.agreement_required")]);
  const fmt = (n: number) => formatNumber(n, locale);

  const count = (s: ReviewStatus) => all.filter((a) => a.reviewStatus === s).length;
  const counts: Record<Tab, number> = { all: all.length, needs_review: count("needs_review"), approved: count("approved"), no_photo: count("no_photo"), rejected: count("rejected") };
  const words = q.toLowerCase().replace(/^@/, "");
  const digits = q.replace(/\D/g, "").replace(/^0/, "");
  const list = all
    .filter((a) => tab === "all" || a.reviewStatus === tab)
    .filter((a) => !q || a.fullName.toLowerCase().includes(words) || (a.username ?? "").toLowerCase().includes(words) || (digits.length >= 4 && a.mobile.replace(/\D/g, "").includes(digits)))
    .sort((a, b) => ORDER[a.reviewStatus] - ORDER[b.reviewStatus] || b.signedAt.getTime() - a.signedAt.getTime());
  const href = (nextTab: Tab) => {
    const p = new URLSearchParams();
    if (nextTab !== "all") p.set("tab", nextTab);
    if (q) p.set("q", q);
    const s = p.toString();
    return s ? `/admin/agreements?${s}` : "/admin/agreements";
  };

  const tiles = [
    { label: t("admin.agreements.counts.all"), sub: t("admin.agreements.counts.allSub"), n: counts.all, box: "", ink: "text-ink", soft: "text-muted" },
    { label: t("admin.agreements.counts.needs"), sub: t("admin.agreements.counts.needsSub"), n: counts.needs_review, box: "bg-[#FFF7ED] border-[#F6D9B8]", ink: "text-[#9A3412]", soft: "text-[#7A3A0C]" },
    { label: t("admin.agreements.counts.approved"), sub: t("admin.agreements.counts.approvedSub"), n: counts.approved, box: "bg-[#F1FAF4] border-[#CDEBD8]", ink: "text-[#14633C]", soft: "text-[#14633C]" },
    { label: t("admin.agreements.counts.noPhoto"), sub: t("admin.agreements.counts.noPhotoSub"), n: counts.no_photo, box: "bg-[#F7F7F9]", ink: "text-ink", soft: "text-muted" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="lc-d m-0 text-[32px] font-semibold leading-[1.1] tracking-[-0.035em] text-ink max-[640px]:text-[26px]">{t("admin.agreements.title")}</h1>
        <p className="m-0 max-w-[820px] text-[15.5px] text-muted">{t("admin.agreements.leadNew")}</p>
      </div>
      <AgreementSwitch on={required} canManage={canManage} />

      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
        {tiles.map((x) => (
          <div key={x.label} className={cx("flex flex-col gap-1.5 rounded-2xl border border-[#E9EAEE] bg-white p-4 sm:p-5", x.box)}>
            <span className={cx("text-[14.5px] font-semibold", x.soft)}>{x.label}</span>
            <span className={cx("lc-d text-[28px] font-semibold leading-none tracking-[-0.03em] sm:text-[34px]", x.ink)}>{fmt(x.n)}</span>
            <span className={cx("text-sm max-[640px]:hidden", x.soft)}>{x.sub}</span>
          </div>
        ))}
      </div>

      <section className={cx(CARD, "flex flex-wrap items-center gap-2.5 px-3.5 py-3")}>
        <nav aria-label={t("admin.agreements.tabs.label")} className="flex flex-wrap gap-2">
          {TABS.map((k) => {
            const on = k === tab;
            return (
              <Link
                key={k}
                href={href(k)}
                aria-current={on ? "page" : undefined}
                className={cx("inline-flex h-[42px] items-center gap-2 rounded-[10px] px-4 text-[15px] font-bold max-[640px]:px-3", on ? "bg-primary text-white" : "bg-[#F4F5F7] text-[#3A3C45] hover:text-ink")}
              >
                {t(`admin.agreements.tabs.${k}`)}
                <span className={cx("rounded-full px-2 py-px text-[13px]", on ? "bg-white/20" : "bg-white")}>{fmt(counts[k])}</span>
              </Link>
            );
          })}
        </nav>
        <form action="/admin/agreements" role="search" className="ml-auto flex h-[42px] min-w-[200px] max-w-[320px] flex-[1_1_220px] items-center gap-2.5 rounded-[10px] bg-[#F4F5F7] px-3.5 text-muted max-[640px]:ml-0 max-[640px]:max-w-none">
          {tab !== "all" && <input type="hidden" name="tab" value={tab} />}
          <svg viewBox="0 0 24 24" className="size-[18px] flex-none" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input type="search" name="q" defaultValue={q} maxLength={60} aria-label={t("admin.agreements.searchLabel")} placeholder={t("admin.agreements.search")} className="min-w-0 flex-1 border-0 bg-transparent text-[15px] text-ink outline-none" />
        </form>
      </section>

      {all.length === 0 || list.length === 0 ? (
        <p className="m-0 rounded-2xl border border-dashed border-line bg-surface px-4 py-10 text-center text-muted">{t(all.length === 0 ? "admin.agreements.empty" : "admin.agreements.noMatch")}</p>
      ) : (
        <div className="flex flex-col gap-3.5">
          {list.map((a, i) => (
            <AgreementCard key={a.designerId} a={a} t={t} locale={locale} canManage={canManage} tone={AVATAR_TONES[i % AVATAR_TONES.length]} />
          ))}
        </div>
      )}
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5 text-[14.5px]">
      <span className="w-[92px] flex-none text-muted">{label}</span>
      <span className="min-w-0 font-semibold text-ink [overflow-wrap:anywhere]">{children}</span>
    </div>
  );
}

function AgreementCard({ a, t, locale, canManage, tone }: { a: AdminAgreement; t: Translate; locale: Locale; canManage: boolean; tone: string }) {
  const when = (d: Date) => d.toLocaleString(locale === "bn" ? "bn-BD" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" });
  const day = (d: Date) => formatDate(d, locale, "short");
  const device = describeDevice(a.userAgent);
  const sides = (["front", "back"] as const).filter((s) => a.idPhotos[s]);
  const name = a.fullName;
  const meta = [
    a.username && `@${a.username}`,
    a.designs === 1 ? t("admin.agreements.designOne") : t("admin.agreements.designs", { n: formatNumber(a.designs, locale) }),
    a.joinedAt && t("admin.agreements.joined", { date: day(a.joinedAt) }),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className={cx(CARD, "p-5 max-[640px]:p-4", a.reviewStatus === "needs_review" && "border-primary shadow-[0_0_0_1px_#8B0000]")}>
      <div className="grid gap-6 min-[701px]:grid-cols-2 min-[1181px]:grid-cols-[minmax(0,.95fr)_minmax(0,1.5fr)_minmax(0,1fr)]">
        {/* The designer */}
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex items-center gap-3">
            {a.avatarUrl ? (
              <img src={a.avatarUrl} alt="" loading="lazy" className="size-[52px] flex-none rounded-[14px] object-cover" />
            ) : (
              <span className={cx("lc-d flex size-[52px] flex-none items-center justify-center rounded-[14px] text-[19px] font-semibold", tone)}>{name.trim().charAt(0).toUpperCase() || "?"}</span>
            )}
            <div className="flex min-w-0 flex-col">
              <strong className="text-[17.5px] text-ink">
                {name}
                {a.accountStatus !== "active" && <span className="ml-2 rounded-full bg-danger/10 px-2 py-0.5 align-middle text-xs font-semibold text-danger">{a.accountStatus}</span>}
              </strong>
              <span className="text-sm text-muted">{meta}</span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Fact label={t("admin.agreements.mobile")}>{formatBdMobile(a.mobile)}</Fact>
            {a.email && <Fact label={t("admin.agreements.email")}>{a.email}</Fact>}
            <Fact label={t("admin.agreements.address")}>{a.address}</Fact>
          </div>
          <Link href={`/admin/users/${a.designerId}`} className="text-sm font-bold text-primary">
            {t("admin.agreements.openProfile")} →
          </Link>
        </div>

        {/* The ID */}
        <div className="flex min-w-0 flex-col gap-2.5 max-[700px]:border-t max-[700px]:border-[#EEEFF2] max-[700px]:pt-4 min-[701px]:border-l min-[701px]:border-[#EEEFF2] min-[701px]:pl-6">
          <div className="flex flex-col">
            <span className="text-[12.5px] font-bold uppercase tracking-[.06em] text-muted">{t(`agreement.idTypes.${a.idType}`)}</span>
            {canManage ? <RevealId designerId={a.designerId} masked={a.idMasked} /> : <span className="font-mono text-[17px] font-semibold tracking-[.06em] text-ink">{a.idMasked}</span>}
          </div>
          {!canManage ? (
            <p className="m-0 rounded-xl bg-[#F4F5F7] px-3.5 py-6 text-center text-sm font-semibold text-muted">{t("admin.agreements.hiddenBox")}</p>
          ) : sides.length > 0 ? (
            <AgreementPhotos designerId={a.designerId} name={name} sides={[...sides]} uploaded={a.photoAt ? t("admin.agreements.uploaded", { date: day(a.photoAt) }) : null} />
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#C9CCD3] p-3.5 text-center text-muted min-[701px]:min-h-[140px]">
              <strong className="text-[15px] text-ink">{t("admin.agreements.noPhotoTitle")}</strong>
              <span className="text-[13.5px]">{t("admin.agreements.noPhotoBody")}</span>
              {!a.photoRequestedAt && <AskPhotoButton designerId={a.designerId} label={t("admin.agreements.askPhoto")} />}
            </div>
          )}
          {canManage && a.photoRequestedAt && <p className="m-0 text-[13px] font-semibold text-[#9A3412]">{t("admin.agreements.asked", { date: day(a.photoRequestedAt) })}</p>}
        </div>

        {/* The agreement */}
        <div className="flex min-w-0 flex-col gap-2.5 max-[1180px]:col-span-full max-[1180px]:border-t max-[1180px]:border-[#EEEFF2] max-[1180px]:pt-4 min-[1181px]:border-l min-[1181px]:border-[#EEEFF2] min-[1181px]:pl-6">
          <div className="flex items-center justify-between gap-2">
            <span className={cx("rounded-full px-[9px] py-0.5 text-[12.5px] font-bold", STATUS_PILL[a.reviewStatus])}>{t(`admin.agreements.status.${a.reviewStatus}`)}</span>
            <Link href={`/admin/agreements/${a.designerId}`} className="text-sm font-bold text-primary">
              {t("admin.agreements.readSigned")} →
            </Link>
          </div>
          <div className="flex flex-col gap-1.5 rounded-xl bg-[#F4F5F7] p-3">
            <Fact label={t("admin.agreements.facts.signed")}>{when(a.signedAt)}</Fact>
            <Fact label={t("admin.agreements.facts.version")}>v{a.version}</Fact>
            {a.signedIp && <Fact label={t("admin.agreements.facts.ip")}>{a.signedIp}</Fact>}
            {device && (
              <Fact label={t("admin.agreements.facts.device")}>
                {t(`admin.agreements.device.${device.device}`)} · {device.browser}
              </Fact>
            )}
          </div>
          {a.reviewStatus === "approved" && a.reviewedAt && (
            <p className="m-0 rounded-[10px] bg-[#E3F3EA] px-3 py-2.5 text-sm text-[#14633C]">
              ✓ {a.reviewedBy ? t("admin.agreements.approvedBy", { name: a.reviewedBy, date: day(a.reviewedAt) }) : t("admin.agreements.approvedBySomeone", { date: day(a.reviewedAt) })}
            </p>
          )}
          {a.reviewStatus === "rejected" && a.reviewedAt && (
            <p className="m-0 rounded-[10px] bg-[#FDE3E1] px-3 py-2.5 text-sm text-[#A3121B]">{t("admin.agreements.rejectedBecause", { date: day(a.reviewedAt), reason: a.rejectReason ?? "—" })}</p>
          )}
          {canManage && <AgreementReview designerId={a.designerId} status={a.reviewStatus} hasPhoto={sides.length > 0} note={a.adminNote} />}
        </div>
      </div>
    </article>
  );
}
