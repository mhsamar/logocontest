"use client";

import { useId, useState, type MouseEvent, type ReactNode } from "react";
import { trackShowcase, type ShowcaseEvent } from "@/lib/analytics/showcase-events";
import { cx } from "@/lib/cx";

/*
 * Home showcase, the only parts that run in the browser (owner, 2026-11-20; Design/logocontest-home-showcase): the
 * clicks it counts and the two tabs. The server draws every card; a link says what it counts with data-lcs-ev
 * (and data-lcs-place), so one listener on the section is enough.
 */

/** The section itself: counts every marked link clicked inside it. */
export function ShowcaseClicks({ id, labelledBy, className, children }: { id?: string; labelledBy?: string; className?: string; children: ReactNode }) {
  const onClick = (e: MouseEvent<HTMLElement>) => {
    const a = (e.target as Element).closest<HTMLElement>("[data-lcs-ev]");
    if (!a) return;
    const params: Record<string, string> = {};
    if (a.dataset.lcsPlace) params.place = a.dataset.lcsPlace;
    const href = a.getAttribute("href");
    if (href) params.href = href;
    trackShowcase(a.dataset.lcsEv as ShowcaseEvent, params);
  };
  return (
    <section id={id} aria-labelledby={labelledBy} className={className} onClick={onClick}>
      {children}
    </section>
  );
}

/**
 * "Live contests · n" and "Finished contests · n": they switch the cards below without a reload. Live first; with no
 * live card the live tab is not shown and the finished one opens. Both panels are in the server HTML; the hidden one's
 * pictures wait (they load lazily) until it opens.
 */
export function ShowcaseTabs({ liveLabel, finishedLabel, label, live, finished }: { liveLabel: string; finishedLabel: string; label: string; live: ReactNode | null; finished: ReactNode | null }) {
  const [tab, setTab] = useState<"live" | "finished">(live ? "live" : "finished");
  const base = useId();
  const tabs = [
    { key: "live" as const, text: liveLabel, panel: live },
    { key: "finished" as const, text: finishedLabel, panel: finished },
  ].filter((x) => x.panel);
  if (!tabs.length) return null;
  const pick = (key: "live" | "finished") => {
    if (key === tab) return;
    setTab(key);
    trackShowcase("showcase_tab_switch", { tab: key });
  };
  return (
    <>
      <div className="lcs-tabs" role="tablist" aria-label={label}>
        {tabs.map((x) => (
          <button
            key={x.key}
            type="button"
            role="tab"
            id={`${base}-t-${x.key}`}
            aria-controls={`${base}-p-${x.key}`}
            aria-selected={tab === x.key}
            tabIndex={tab === x.key ? 0 : -1}
            className={cx("lcs-tab", tab === x.key && "lcs-on")}
            onClick={() => pick(x.key)}
            onKeyDown={(e) => {
              if (tabs.length < 2 || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
              const other = tabs.find((y) => y.key !== x.key)!;
              pick(other.key);
              document.getElementById(`${base}-t-${other.key}`)?.focus();
            }}
          >
            {x.text}
          </button>
        ))}
      </div>
      {tabs.map((x) => (
        <div key={x.key} role="tabpanel" id={`${base}-p-${x.key}`} aria-labelledby={`${base}-t-${x.key}`} hidden={tab !== x.key}>
          {x.panel}
        </div>
      ))}
    </>
  );
}
