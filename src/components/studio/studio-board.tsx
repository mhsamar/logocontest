"use client";

/* eslint-disable @next/next/no-img-element -- signed, short-lived storage links */
import { useSearchParams } from "next/navigation";
import { memo, useCallback, useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { timeAgo } from "@/lib/dates";
import { useI18n } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/config";
import type { Translate } from "@/lib/i18n/translate";
import { formatNumber } from "@/lib/money";
import { loadMoreStudio } from "@/lib/studio/actions";
import { previewSide, STUDIO_NEW_MS, stripIndex, type StudioQuery } from "@/lib/studio/options";
import type { StudioDesign } from "@/lib/studio/queries";
import { FilesIcon, Segments, StudioAvatar, StudioBadge } from "./studio-bits";
import { StudioViewer } from "./studio-viewer";

/**
 * How the cards behave: "hover" (a mouse on a wide screen: hover preview), "touch" (swipe carousel), or "ssr" before
 * the page runs (only the first file, so nothing extra loads before we know).
 */
type Mode = "ssr" | "hover" | "touch";
const HOVER_QUERY = "(hover: hover) and (pointer: fine) and (min-width: 901px)";
const subscribe = (cb: () => void) => {
  const mq = window.matchMedia(HOVER_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
export const useMode = (): Mode => useSyncExternalStore(subscribe, () => (window.matchMedia(HOVER_QUERY).matches ? "hover" : "touch"), () => "ssr");
const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** This page's address with the open design and file set (or removed). */
function href(id: string | null, file: number): string {
  const p = new URLSearchParams(window.location.search);
  if (id) {
    p.set("design", id);
    p.set("file", String(file + 1));
  } else {
    p.delete("design");
    p.delete("file");
  }
  const s = p.toString();
  return s ? `${window.location.pathname}?${s}` : window.location.pathname;
}

type CardProps = {
  d: StudioDesign;
  i: number;
  mode: Mode;
  now: Date;
  t: Translate;
  locale: Locale;
  onOpen: (d: StudioDesign, file: number) => void;
  /** The line under the tile; the designer profile shows the contest, status and stars instead of the designer. */
  renderMeta?: (d: StudioDesign) => React.ReactNode;
};

/**
 * One design (owner, 2026-10-12; Design/design-studio). With a mouse: the card lifts; after 0.2 s a large preview opens
 * on the side with more room (upward near the bottom); moving across the card flips through the files, one equal
 * strip per file (state changes only when the strip changes). The files load only once the card is hovered.
 * On touch screens the tile is a swipe carousel. Click or Enter opens the full preview.
 */
export const StudioCard = memo(function StudioCard({ d, i, mode, now, t, locale, onOpen, renderMeta }: CardProps) {
  const n = d.files.length;
  const [hot, setHot] = useState(false);
  const [armed, setArmed] = useState(false);
  const [idx, setIdx] = useState(0);
  const [side, setSide] = useState<{ x: "left" | "right"; y: "up" | "down" } | null>(null);
  const timer = useRef(0);
  const tile = useRef<HTMLDivElement>(null);
  const who = d.designer?.username ? `@${d.designer.username}` : t("studio.hiddenDesigner");
  const ago = timeAgo(new Date(d.createdAt), now, locale);
  const isNew = !d.isWinner && now.getTime() - Date.parse(d.createdAt) < STUDIO_NEW_MS;
  const labels = { winner: t("studio.winner"), new: t("studio.newBadge") };
  const label = (k: number) => d.files[k]?.label ?? null;

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const enter = (e: React.PointerEvent) => {
    if (mode !== "hover" || e.pointerType !== "mouse") return;
    setHot(true);
    setArmed(true); // the hovered card's files start loading now, not before
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const r = tile.current?.getBoundingClientRect();
      if (!r) return;
      const width = window.innerWidth <= 1180 ? 440 : 520;
      setSide(previewSide(r, { width: window.innerWidth, height: window.innerHeight }, { width, height: width + 190 }));
    }, reduced() ? 0 : 200);
  };
  const move = (e: React.PointerEvent) => {
    if (mode !== "hover" || n < 2) return;
    const r = e.currentTarget.getBoundingClientRect();
    const k = stripIndex(e.clientX - r.left, r.width, n);
    setIdx((cur) => (cur === k ? cur : k));
  };
  const leave = () => {
    window.clearTimeout(timer.current);
    setHot(false);
    setSide(null);
    setIdx(0);
  };
  const onSwipe = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const k = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
    setIdx((cur) => (cur === k ? cur : Math.min(n - 1, Math.max(0, k))));
  };
  const open = () => onOpen(d, mode === "ssr" ? 0 : idx);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen(d, 0);
    }
  };

  const cover = d.files[0];
  const tileLabel = t("studio.open", { brand: d.brandName, who, n: formatNumber(Math.max(1, n), locale) });
  const badges = (
    <>
      <StudioBadge winner={d.isWinner} isNew={isNew} labels={labels} />
      {n > 1 && (
        <span className="ds-fc" aria-hidden>
          <FilesIcon />
          {formatNumber(n, locale)}
        </span>
      )}
    </>
  );

  return (
    <li className="ds" data-card={d.id} data-win={d.isWinner ? "" : undefined} data-hot={hot ? "" : undefined} style={{ "--i": i % 24 } as React.CSSProperties} onPointerLeave={leave}>
      {mode === "touch" && n > 1 ? (
        <div className="ds-tile ds-swipe-wrap" role="button" tabIndex={0} aria-label={tileLabel} data-card-tile={d.id} onClick={open} onKeyDown={onKey}>
          <div className="ds-swipe h-full" onScroll={onSwipe}>
            {d.files.map((f, k) => (
              <img key={f.url} src={f.url} alt="" loading={k === 0 ? (i < 10 ? "eager" : "lazy") : "lazy"} decoding="async" />
            ))}
          </div>
          {badges}
          <Segments count={n} current={idx} />
        </div>
      ) : (
        <div
          ref={tile}
          className="ds-tile"
          role="button"
          tabIndex={0}
          aria-label={tileLabel}
          data-card-tile={d.id}
          onClick={open}
          onKeyDown={onKey}
          onPointerEnter={enter}
          onPointerMove={move}
        >
          {cover ? (
            <>
              <span className="ds-sf" data-on={idx === 0 ? "" : undefined}>
                <img src={cover.url} alt="" loading={i < 10 ? "eager" : "lazy"} decoding="async" />
              </span>
              {armed &&
                d.files.slice(1).map((f, k) => (
                  <span key={f.url} className="ds-sf" data-on={idx === k + 1 ? "" : undefined}>
                    <img src={f.url} alt="" decoding="async" />
                  </span>
                ))}
            </>
          ) : (
            <span className="ds-empty-file">#{formatNumber(d.number, locale)}</span>
          )}
          {badges}
          {mode === "hover" && <Segments count={n} current={idx} />}
        </div>
      )}

      {renderMeta ? (
        renderMeta(d)
      ) : (
        <div className="ds-meta">
          <StudioAvatar username={d.designer?.username ?? null} url={d.designer?.avatarUrl ?? null} />
          <div className="min-w-0">
            <strong>{d.brandName}</strong>
            <span className="ds-sub">
              {who} · {ago}
            </span>
          </div>
        </div>
      )}

      {mode === "hover" && side && (
        <div className="ds-pv" data-x={side.x} data-y={side.y} aria-hidden>
          <div className="ds-pvh">
            <div className="flex min-w-0 items-center gap-2.5">
              <StudioAvatar username={d.designer?.username ?? null} url={d.designer?.avatarUrl ?? null} />
              <div className="flex min-w-0 flex-col">
                <strong className="truncate text-base">{d.brandName}</strong>
                <span className="truncate text-[13px] text-[#5F626B]">{t("studio.viewer.by", { who, when: ago })}</span>
              </div>
            </div>
            <StudioBadge winner={d.isWinner} isNew={isNew} labels={labels} still />
          </div>
          <div className="ds-pvi">
            {d.files.map((f, k) => (
              <span key={f.url} className="ds-sf" data-on={idx === k ? "" : undefined}>
                <img src={f.url} alt="" decoding="async" />
              </span>
            ))}
            <Segments count={n} current={idx} big />
          </div>
          {n > 0 && (
            <div className="ds-pvf">
              <span className="text-[15px] font-bold">
                {t("studio.fileOf", { n: formatNumber(idx + 1, locale), total: formatNumber(n, locale) })}
                {label(idx) ? ` · ${label(idx)}` : ""}
              </span>
              {n > 1 && <span className="text-[13px] text-[#5F626B]">{t("studio.moveHint")}</span>}
            </div>
          )}
          {n > 1 && (
            <div className="ds-ths">
              {d.files.map((f, k) => (
                <span key={f.url} className="ds-th" data-on={idx === k ? "" : undefined}>
                  <img src={f.url} alt="" decoding="async" />
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </li>
  );
});

/**
 * Design Studio grid (owner, 2026-10-12; Design/design-studio): the cards, "Load more designs", and the full preview.
 * The open design lives in the URL (?design=ID&file=3): opening adds a history step so Back closes it, and a link
 * opens it directly. Previous/Next design move through the designs on the page (loading more at the end).
 */
export function StudioBoard({
  initial,
  total,
  nextOffset,
  query,
  linked,
  nowIso,
}: {
  initial: StudioDesign[];
  total: number;
  nextOffset: number | null;
  query: StudioQuery;
  linked: StudioDesign | null;
  nowIso: string;
}) {
  const { t, locale } = useI18n();
  const mode = useMode();
  const sp = useSearchParams();
  const [designs, setDesigns] = useState(initial);
  const [offset, setOffset] = useState(nextOffset);
  const [error, setError] = useState(false);
  const [busy, start] = useTransition();
  const [now] = useState(() => new Date(nowIso));
  const pushed = useRef(false);
  const lastCard = useRef<string | null>(null);

  const openId = sp.get("design");
  const fileNo = Math.max(1, Number(sp.get("file")) || 1) - 1;
  const opened = openId ? (designs.find((x) => x.id === openId) ?? (linked?.id === openId ? linked : null)) : null;

  const onOpen = useCallback((d: StudioDesign, file: number) => {
    lastCard.current = d.id;
    window.history.pushState(null, "", href(d.id, file));
    pushed.current = true;
  }, []);

  // Back (or a link) closed it: forget our history step, and give focus back to the card.
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
      const id = lastCard.current;
      if (id) document.querySelector<HTMLElement>(`[data-card-tile="${id}"]`)?.focus({ preventScroll: true });
    }
  }, [opened]);

  const close = () => {
    if (pushed.current) {
      pushed.current = false;
      window.history.back();
    } else window.history.replaceState(null, "", href(null, 0));
  };
  const setFile = (i: number) => opened && window.history.replaceState(null, "", href(opened.id, i));
  const queryRecord = () => ({ tab: query.tab, q: query.q, type: query.type ?? "", sort: query.sort });

  const loadMore = (then?: (list: StudioDesign[]) => void) =>
    start(async () => {
      if (offset === null) return;
      setError(false);
      const page = await loadMoreStudio(queryRecord(), offset);
      if (!page) return setError(true);
      const merged = [...designs, ...page.designs.filter((x) => !designs.some((y) => y.id === x.id))];
      setDesigns(merged);
      setOffset(page.nextOffset);
      then?.(merged);
    });

  const step = (dir: 1 | -1) => {
    if (!opened || designs.length === 0) return;
    const at = designs.findIndex((x) => x.id === opened.id);
    const go = (list: StudioDesign[], k: number) => {
      const next = list[(k + list.length) % list.length];
      lastCard.current = next.id;
      window.history.replaceState(null, "", href(next.id, 0));
    };
    if (dir === 1 && at === designs.length - 1 && offset !== null) loadMore((list) => go(list, at + 1));
    else go(designs, at === -1 ? 0 : at + dir);
  };

  if (designs.length === 0 && !opened)
    return (
      <p className="m-0 rounded-[22px] border border-dashed border-[#DCDEE3] bg-white px-4 py-14 text-center text-[#5F626B]">
        {query.tab === "all" && !query.q && !query.type ? t("studio.empty") : t("studio.emptyFiltered")}
      </p>
    );

  return (
    <>
      {/* data-no-fx: the site's mouse tilt and press effects stay off these cards; they have their own motion. */}
      <ul className="ds-grid" data-no-fx>
        {designs.map((d, i) => (
          <StudioCard key={d.id} d={d} i={i} mode={mode} now={now} t={t} locale={locale} onOpen={onOpen} />
        ))}
      </ul>

      <div className="flex flex-col items-center gap-2.5 pb-1.5 pt-[18px]">
        {error && <p className="m-0 text-sm font-semibold text-danger">{t("studio.error")}</p>}
        {offset !== null ? (
          <button type="button" className="ds-b1 min-h-14 px-9 text-[17px] shadow-[0_12px_24px_rgba(139,0,0,.22)]" onClick={() => loadMore()} disabled={busy} aria-busy={busy || undefined}>
            {busy ? t("studio.loading") : t("studio.loadMore")}
          </button>
        ) : (
          designs.length > 0 && <p className="m-0 text-sm text-[#5F626B]">{t("studio.end")}</p>
        )}
        {designs.length > 0 && (
          <span className="text-sm text-[#5F626B]">{t("studio.shown", { shown: formatNumber(designs.length, locale), total: formatNumber(Math.max(total, designs.length), locale) })}</span>
        )}
      </div>

      {/* After the page runs in the browser (it renders on <body>); a direct link opens it right away. */}
      {opened && mode !== "ssr" && (
        <StudioViewer
          key={opened.id}
          design={opened}
          file={Math.min(fileNo, Math.max(0, opened.files.length - 1))}
          now={now}
          canStep={designs.length > 1 || (designs.length === 1 && designs[0].id !== opened.id)}
          onFile={setFile}
          onPrev={() => step(-1)}
          onNext={() => step(1)}
          onClose={close}
        />
      )}
    </>
  );
}
