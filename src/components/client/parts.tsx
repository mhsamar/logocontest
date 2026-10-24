/* eslint-disable @next/next/no-img-element */
import type { Badge } from "@/lib/logo-check/entry-rules";
import type { Translate } from "@/lib/i18n/translate";
import { cx } from "@/lib/cx";
import { CwIcon, CwStar } from "./icons";

/** Small pieces of the premium client workspace (Design/client-premium), shared by the pages. Server-safe. */

const STATUS_CLASS: Record<string, string> = {
  draft: "dr",
  pending_payment: "dr",
  open: "op",
  judging: "win",
  winner_selected: "win",
  handover: "win",
  completed: "dn",
  no_result: "dn",
  cancelled: "dn",
};

/** The status chip on a contest picture: Open, Pick a winner, Not paid, Completed… */
export function StatusPill({ status, t, className, waiting = false }: { status: string; t: Translate; className?: string; /** bKash payment sent, an admin is checking it. */ waiting?: boolean }) {
  if (waiting && (status === "draft" || status === "pending_payment")) return <span className={cx("clst", "win", className)}>{t("cw.status.awaiting")}</span>;
  return <span className={cx("clst", STATUS_CLASS[status] ?? "dn", className)}>{t(`cw.status.${status in STATUS_CLASS ? status : "completed"}` as Parameters<Translate>[0])}</span>;
}

/** "PRO" (or "PRO TRIAL") next to a designer's name. */
export function ProChip({ trial, t, large = false }: { trial: boolean; t: Translate; large?: boolean }) {
  return (
    <span className={cx("dpro", !large && "sm")}>
      <CwIcon name="crown" size={large ? 13 : 11} strokeWidth={2.4} />
      {trial ? t("pro.trial.badge") : "PRO"}
    </span>
  );
}

/** "PRO" on a design's picture. */
export function ProOnPicture() {
  return (
    <span className="enp">
      <CwIcon name="crown" size={11} strokeWidth={2.4} />
      PRO
    </span>
  );
}

export function BasicChip({ t }: { t: Translate }) {
  return <span className="enbs">{t("entryCheck.judge.basic")}</span>;
}

/** The logo check result on a design: Low / Medium / High match, or Not checked. */
export function CheckChip({ badge, t }: { badge: Badge; t: Translate }) {
  const cls = badge.kind === "checked" ? (badge.level === "low" ? "low" : badge.level === "medium" ? "med" : "high") : "none";
  return (
    <span className={cx("ckb", cls)}>
      <CwIcon name="shield" size={12} strokeWidth={2.4} />
      {badge.kind === "checked" ? t(`entryCheck.badge.${badge.level}`) : t("entryCheck.badge.none")}
    </span>
  );
}

/** The client's stars on a design (read only; rating happens in the design view). */
export function Stars({ rating, label }: { rating: number | null; label?: string }) {
  return (
    <span className="dstars" aria-label={label} role={label ? "img" : undefined}>
      {[1, 2, 3, 4, 5].map((n) => (
        <CwStar key={n} on={(rating ?? 0) >= n} />
      ))}
    </span>
  );
}

/** A contest's or design's picture; without one, the brand's first letter on green. */
export function Picture({ url, name, className }: { url: string | null; name: string; className?: string }) {
  if (url) return <img src={url} alt="" loading="lazy" className={className} />;
  return (
    <span className={cx("tile", className)} aria-hidden style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#0F3D27,#14633C 60%,#2BB673)", color: "#fff", fontWeight: 800, fontSize: 40 }}>
      {name.trim().slice(0, 1).toUpperCase() || "?"}
    </span>
  );
}

/** A friendly empty state inside a card. */
export function Empty({ title, lead, children }: { title: string; lead?: string; children?: React.ReactNode }) {
  return (
    <div className="dempty">
      <b>{title}</b>
      {lead}
      {children && <div style={{ marginTop: 12 }}>{children}</div>}
    </div>
  );
}
