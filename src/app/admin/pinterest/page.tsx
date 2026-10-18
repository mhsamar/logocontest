import type { Metadata } from "next";
import Link from "next/link";
import { AdminAction } from "@/components/admin/admin-action";
import { AdminHead } from "@/components/admin/page-head";
import { AutoPin, BoardPicker, PinButtons } from "@/components/admin/pinterest-bits";
import { AdmCard, CardTitle, Pill } from "@/components/admin/ui";
import { buttonClasses } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { requirePermission } from "@/lib/admin/core";
import { hasPermission } from "@/lib/admin/permissions";
import { formatDate, timeAgo } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import { formatNumber } from "@/lib/money";
import { disconnectPinterest } from "@/lib/pinterest/actions";
import { boardsOf, pinterestConfigured, type Board } from "@/lib/pinterest/api";
import { pinCandidates } from "@/lib/pinterest/job";
import { CALLBACK_PATH, pinUrl } from "@/lib/pinterest/rules";
import { accessToken, connectionSummary, pinLog } from "@/lib/pinterest/store";
import { siteUrl } from "@/lib/seo";
import { getSettings } from "@/lib/settings";
import { designPath } from "@/lib/share/links";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("admin.pinterest.title"), robots: { index: false } };
}

const ERRORS = ["keys", "state", "denied", "connect"] as const;

/**
 * Admin › Pinterest (owner, 2026-10-19): connect the site's Pinterest account (Pinterest's own login), pick the board,
 * switch automatic pinning on and choose what is pinned. Winners only is the default.
 */
export default async function AdminPinterestPage({ searchParams }: PageProps<"/admin/pinterest">) {
  const admin = await requirePermission("content.view");
  const canManage = hasPermission(admin, "content.manage");
  const sp = await searchParams;
  const [{ t, locale }, { tableReady, conn }, s] = await Promise.all([getI18n(), connectionSummary(), getSettings(["pinterest.on", "pinterest.rule"])]);
  const configured = pinterestConfigured();
  const now = new Date();
  const num = (n: number) => formatNumber(n, locale);

  let boards: Board[] | null = null;
  let boardsError: string | null = null;
  if (configured && conn) {
    try {
      boards = await boardsOf(await accessToken(now));
    } catch (e) {
      boardsError = e instanceof Error ? e.message : String(e);
    }
  }
  const [log, waiting] = tableReady ? await Promise.all([pinLog(30), conn?.boardId ? pinCandidates(s["pinterest.rule"], now).then((c) => c.length, () => 0) : Promise.resolve(0)]) : [[], 0];
  const failed = log.filter((p) => p.status === "failed").length;
  const error = ERRORS.find((e) => e === sp.error);
  const ready = configured && tableReady;
  const connectHref = "/api/pinterest/connect";

  return (
    <div className="flex flex-col gap-5">
      <AdminHead title={t("admin.pinterest.title")} lead={t("admin.pinterest.lead")} />

      {sp.connected === "1" && <Alert tone="success">{t("admin.pinterest.connectedOk")}</Alert>}
      {error && <Alert tone="danger">{t(`admin.pinterest.errors.${error}`)}</Alert>}

      {/* What's still needed before it can work */}
      {!ready && (
        <AdmCard className="flex flex-col gap-3 p-5 sm:p-6" data-pinterest-setup>
          <CardTitle title={t("admin.pinterest.setup")} />
          {!configured && <Alert tone="warning">{t("admin.pinterest.keysMissing")}</Alert>}
          {!tableReady && <Alert tone="warning">{t("admin.pinterest.sqlMissing")}</Alert>}
          <p className="m-0 text-[14.5px] text-muted">
            {t("admin.pinterest.redirect")} <code className="rounded-md bg-[#F4F5F7] px-1.5 py-0.5 text-[13.5px] text-ink">{`${siteUrl()}${CALLBACK_PATH}`}</code>
          </p>
        </AdmCard>
      )}

      {/* The Pinterest account */}
      <AdmCard className="flex flex-col gap-4 p-5 sm:p-6">
        <CardTitle
          title={t("admin.pinterest.account")}
          action={
            canManage && ready ? (
              <div className="flex flex-wrap gap-2">
                <a href={connectHref} className={buttonClasses({ variant: conn ? "secondary" : "primary" })} data-pinterest-connect>
                  {t(conn ? "admin.pinterest.reconnect" : "admin.pinterest.connect")}
                </a>
                {conn && <AdminAction label={t("admin.pinterest.disconnect")} body={t("admin.pinterest.disconnectBody")} tone="danger" fields={[]} run={disconnectPinterest} />}
              </div>
            ) : undefined
          }
        />
        {conn ? (
          <div className="flex flex-col gap-1">
            <strong className="text-[16px] text-ink">{t("admin.pinterest.connectedAs", { name: conn.username ? `@${conn.username}` : "Pinterest" })}</strong>
            <span className="text-[14px] text-muted">{t("admin.pinterest.connectedOn", { date: formatDate(conn.connectedAt, locale, "short") })}</span>
            {conn.lastError && <span className="text-[14px] font-semibold text-danger">{t("admin.pinterest.lastError", { message: conn.lastError })}</span>}
          </div>
        ) : (
          <p className="m-0 text-[15px] text-muted">{t("admin.pinterest.notConnected")}</p>
        )}
        <p className="m-0 rounded-xl bg-[#FFF7E8] px-4 py-3 text-[14px] text-[#7A4A00]">{t("admin.pinterest.trial")}</p>
      </AdmCard>

      {conn && (
        <>
          {/* The board */}
          <AdmCard className="flex flex-col gap-3 p-5 sm:p-6">
            <CardTitle title={t("admin.pinterest.board")} sub={t("admin.pinterest.boardLead")} />
            {conn.boardName && <strong className="text-[15.5px] text-ink">{t("admin.pinterest.boardNow", { name: conn.boardName })}</strong>}
            {boardsError ? (
              <Alert tone="danger">{t("admin.pinterest.boardsError", { message: boardsError })}</Alert>
            ) : boards && boards.length === 0 ? (
              <Alert tone="warning">{t("admin.pinterest.noBoards")}</Alert>
            ) : boards ? (
              <BoardPicker boards={boards.map((b) => ({ id: b.id, name: b.name }))} current={conn.boardId} />
            ) : null}
          </AdmCard>

          {/* Automatic pinning */}
          <AdmCard className="flex flex-col gap-4 p-5 sm:p-6">
            <CardTitle title={t("admin.pinterest.auto")} />
            <AutoPin on={s["pinterest.on"]} rule={s["pinterest.rule"]} canTurnOn={Boolean(conn.boardId)} />
            <p className="m-0 text-[14px] text-muted">{t("admin.pinterest.never")}</p>
          </AdmCard>

          {/* Pin now and the log */}
          <AdmCard className="flex flex-col gap-4 p-5 sm:p-6">
            <CardTitle title={t("admin.pinterest.log")} sub={conn.boardId ? t("admin.pinterest.waiting", { n: num(waiting) }) : t("admin.pinterest.status.no_board")} />
            {conn.boardId && (
              <div className="flex flex-col gap-2">
                <PinButtons failed={failed} />
                <p className="m-0 text-[13.5px] text-muted">{t("admin.pinterest.pinNowLead")}</p>
              </div>
            )}
            {log.length === 0 ? (
              <p className="m-0 rounded-xl border border-dashed border-line px-4 py-6 text-center text-muted">{t("admin.pinterest.logEmpty")}</p>
            ) : (
              <ul className="m-0 flex list-none flex-col divide-y divide-[#EEEFF2] p-0" data-pin-log>
                {log.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 py-3">
                    <span className="flex min-w-0 flex-[1_1_220px] flex-col">
                      <strong className="truncate text-[15px] text-ink">
                        {p.brand} · #{num(p.number)}
                      </strong>
                      <span className="text-[13px] text-muted">
                        {timeAgo(p.at, now, locale)}
                        {p.status === "failed" && p.lastError ? ` · ${p.lastError}` : ""}
                      </span>
                    </span>
                    <Pill tone={p.kind === "winner" ? "gold" : "neutral"}>{t(`admin.pinterest.kinds.${p.kind}`)}</Pill>
                    <Pill tone={p.status === "posted" ? "good" : p.status === "failed" ? "bad" : "neutral"}>{t(`admin.pinterest.states.${p.status}`)}</Pill>
                    {p.attempts > 1 && <span className="text-[13px] text-muted">{t("admin.pinterest.tries", { n: num(p.attempts) })}</span>}
                    <span className="ml-auto flex gap-3 text-[14px] font-bold">
                      {p.pinId && (
                        <a href={pinUrl(p.pinId)} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          {t("admin.pinterest.view")}
                        </a>
                      )}
                      <Link href={designPath(p.slug, p.number)} className="text-ink hover:text-primary hover:underline">
                        {t("admin.pinterest.open")}
                      </Link>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </AdmCard>
        </>
      )}
    </div>
  );
}
