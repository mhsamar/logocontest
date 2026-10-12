"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { StudioCard, useMode } from "@/components/studio/studio-board";
import { StudioViewer } from "@/components/studio/studio-viewer";
import { timeAgo } from "@/lib/dates";
import { loadProfileFiles } from "@/lib/designers/profile-actions";
import type { ProfileDesign } from "@/lib/designers/public-profile";
import { useI18n } from "@/lib/i18n/client";
import { formatNumber } from "@/lib/money";
import type { StudioDesign, StudioFile } from "@/lib/studio/queries";

export type PortfolioTab = "wins" | "all" | "rated";
const TABS: PortfolioTab[] = ["wins", "all", "rated"];
const PAGE = 12;

/** This page's address with one value set (or removed), keeping the rest. */
function withParam(set: Record<string, string | null>): string {
  const p = new URLSearchParams(window.location.search);
  for (const [k, v] of Object.entries(set)) {
    if (v === null) p.delete(k);
    else p.set(k, v);
  }
  const s = p.toString();
  return s ? `${window.location.pathname}?${s}` : window.location.pathname;
}

function Stars({ n, label }: { n: number; label: string }) {
  return (
    <span className="dp-rs" role="img" aria-label={label}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} viewBox="0 0 20 20" fill="currentColor" className={i <= n ? "on" : undefined} aria-hidden>
          <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.8l-5.2 2.8 1-5.8L1.5 7.7l5.9-.9Z" />
        </svg>
      ))}
    </span>
  );
}

/**
 * Designer profile portfolio (owner, 2026-10-12; Design/designer-profile): Winning logos, All designs (default) and
 * Top rated, switching at once. The cards, hover preview and full preview are the Design Studio ones; the line under a
 * card shows the contest, where the design stands, when, and the client's stars. The open design is in the URL
 * (?design=ID&file=3). Files of designs further down load when they are shown.
 */
export function ProfilePortfolio({ designs, username, initialTab, nowIso }: { designs: ProfileDesign[]; username: string; initialTab: PortfolioTab; nowIso: string }) {
  const { t, locale } = useI18n();
  const mode = useMode();
  const sp = useSearchParams();
  const [now] = useState(() => new Date(nowIso));
  const [tab, setTab] = useState<PortfolioTab>(initialTab);
  const [shown, setShown] = useState<Record<PortfolioTab, number>>({ wins: PAGE, all: PAGE, rated: PAGE });
  const [files, setFiles] = useState<Record<string, StudioFile[]>>(() => Object.fromEntries(designs.filter((d) => d.files.length > 0).map((d) => [d.id, d.files])));
  const [busy, start] = useTransition();
  const pushed = useRef(false);
  const lastCard = useRef<string | null>(null);

  const lists = useMemo(
    () => ({
      all: designs,
      wins: designs.filter((d) => d.isWinner),
      rated: designs.filter((d) => d.rating).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || (a.createdAt < b.createdAt ? 1 : -1)),
    }),
    [designs],
  );
  const list = lists[tab];
  const visible = list.slice(0, shown[tab]);
  const withFiles = useCallback((d: ProfileDesign): ProfileDesign => ({ ...d, files: files[d.id] ?? [] }), [files]);

  const openId = sp.get("design");
  const fileNo = Math.max(1, Number(sp.get("file")) || 1) - 1;
  const openedMeta = openId ? designs.find((d) => d.id === openId) ?? null : null;
  const opened = openedMeta ? withFiles(openedMeta) : null;

  // Load the files of designs on screen (and the open one) that we don't have yet.
  const needKey = [...visible, ...(openedMeta ? [openedMeta] : [])]
    .filter((d) => d.fileCount > 0 && !(d.id in files))
    .map((d) => d.id)
    .join(",");
  useEffect(() => {
    if (!needKey) return;
    const ids = needKey.split(",");
    start(async () => {
      const got = await loadProfileFiles(username, ids);
      // Every asked design gets an entry (even an empty one), so it is never asked for again.
      setFiles((cur) => ({ ...cur, ...Object.fromEntries(ids.map((id) => [id, got?.[id] ?? []])) }));
    });
  }, [needKey, username]);

  const onOpen = useCallback((d: StudioDesign, file: number) => {
    lastCard.current = d.id;
    window.history.pushState(null, "", withParam({ design: d.id, file: String(file + 1) }));
    pushed.current = true;
  }, []);
  useEffect(() => {
    const onPop = () => {
      pushed.current = false;
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (opened) wasOpen.current = true;
    else if (wasOpen.current) {
      wasOpen.current = false;
      if (lastCard.current) document.querySelector<HTMLElement>(`[data-card-tile="${lastCard.current}"]`)?.focus({ preventScroll: true });
    }
  }, [opened]);
  const close = () => {
    if (pushed.current) {
      pushed.current = false;
      window.history.back();
    } else window.history.replaceState(null, "", withParam({ design: null, file: null }));
  };
  const step = (dir: 1 | -1) => {
    if (!opened || list.length === 0) return;
    const at = list.findIndex((d) => d.id === opened.id);
    const next = list[(at === -1 ? 0 : at + dir + list.length) % list.length];
    lastCard.current = next.id;
    if (list.indexOf(next) >= shown[tab]) setShown((s) => ({ ...s, [tab]: s[tab] + PAGE }));
    window.history.replaceState(null, "", withParam({ design: next.id, file: "1" }));
  };
  const pickTab = (next: PortfolioTab) => {
    setTab(next);
    window.history.replaceState(null, "", withParam({ tab: next === "all" ? null : next }));
  };

  const place = (d: ProfileDesign) =>
    d.place === "won"
      ? d.entries > 0
        ? t("designerProfile.x.place.won", { n: formatNumber(d.entries, locale) })
        : t("designerProfile.x.place.wonPlain")
      : t(`designerProfile.x.place.${d.place}`);
  const byId = useMemo(() => new Map(designs.map((d) => [d.id, d])), [designs]);
  const renderMeta = useCallback(
    (sd: StudioDesign) => {
      const d = byId.get(sd.id);
      if (!d) return null;
      return (
        <div className="ds-meta justify-between">
          <div className="min-w-0">
            <strong>{d.brandName}</strong>
            <span className="ds-sub">
              {place(d)} · {timeAgo(new Date(d.createdAt), now, locale)}
            </span>
          </div>
          {d.rating ? (
            <Stars n={d.rating} label={t("designerProfile.x.ratingLabel", { n: formatNumber(d.rating, locale) })} />
          ) : (
            <span className="flex-none text-[12.5px] font-semibold text-[#8A8D96]">{t("designerProfile.x.notRated")}</span>
          )}
        </div>
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- place() only reads t/locale
    [byId, now, locale, t],
  );

  const emptyKey = tab === "wins" ? "designerProfile.x.noWins" : tab === "rated" ? "designerProfile.x.noRated" : "designerProfile.x.noDesigns";
  return (
    <section className="dp-pfw" aria-labelledby="dp-portfolio">
      <div className="dp-pfh">
        <h2 id="dp-portfolio" className="lc-d m-0 text-[26px] font-semibold tracking-[-0.035em]">
          {t("designerProfile.x.portfolio")}
        </h2>
        <div role="tablist" aria-label={t("designerProfile.x.tabs.label")} className="dp-ptb">
          {TABS.map((k) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} className="dp-tbx" onClick={() => pickTab(k)}>
              {k === "wins" && (
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4" />
                </svg>
              )}
              {k === "rated" && (
                <svg viewBox="0 0 20 20" width="15" height="15" fill="currentColor" aria-hidden>
                  <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.8l-5.2 2.8 1-5.8L1.5 7.7l5.9-.9Z" />
                </svg>
              )}
              {t(`designerProfile.x.tabs.${k}`)}
              <span>{formatNumber(lists[k].length, locale)}</span>
            </button>
          ))}
        </div>
      </div>

      {list.length > 0 && mode === "hover" && (
        <p className="ds-hint m-0">
          <span className="ds-hm" aria-hidden>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="7" y="3" width="10" height="18" rx="5" />
              <path d="M12 7v3" />
            </svg>
          </span>
          <span>
            <b>{t("designerProfile.x.hintTitle")}</b> {t("designerProfile.x.hintBody")}
          </span>
        </p>
      )}

      {list.length === 0 ? (
        <p className="m-0 rounded-[20px] border border-dashed border-[#DCDEE3] px-4 py-12 text-center text-[#5F626B]">{t(emptyKey)}</p>
      ) : (
        <ul className="ds-grid dp-pgr" data-no-fx>
          {visible.map((d, i) => (
            <StudioCard key={d.id} d={withFiles(d)} i={i} mode={mode} now={now} t={t} locale={locale} onOpen={onOpen} renderMeta={renderMeta} />
          ))}
        </ul>
      )}

      {list.length > 0 && (
        <div className="dp-pff">
          <span>{visible.length < list.length ? t("designerProfile.x.showing", { n: formatNumber(visible.length, locale) }) : t("designerProfile.x.showingAll", { n: formatNumber(list.length, locale) })}</span>
          {visible.length < list.length && (
            <button type="button" className="dp-b1" onClick={() => setShown((s) => ({ ...s, [tab]: s[tab] + PAGE }))} disabled={busy}>
              {busy ? t("designerProfile.x.loading") : t("designerProfile.x.seeMore")}
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          )}
        </div>
      )}

      {opened && mode !== "ssr" && (
        <StudioViewer
          key={opened.id}
          design={opened}
          file={Math.min(fileNo, Math.max(0, opened.files.length - 1))}
          now={now}
          canStep={list.length > 1}
          onFile={(i) => window.history.replaceState(null, "", withParam({ design: opened.id, file: String(i + 1) }))}
          onPrev={() => step(-1)}
          onNext={() => step(1)}
          onClose={close}
        />
      )}
    </section>
  );
}
