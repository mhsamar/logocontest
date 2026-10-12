"use client";

import { useEffect, useState } from "react";
import { StudioAvatar } from "./studio-bits";

type TickerEvent = { key: string; username: string | null; avatarUrl: string | null; text: string };

/** The floating card over the hero columns: the last real events, one every 3 seconds (still for reduced motion). */
export function StudioTicker({ events }: { events: TickerEvent[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (events.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setI((x) => (x + 1) % events.length), 3000);
    return () => window.clearInterval(id);
  }, [events.length]);
  const now = events[i] ?? events[0];
  const prev = events.length > 1 ? (i - 1 + events.length) % events.length : -1;
  return (
    <div className="ds-toast">
      <StudioAvatar username={now.username} url={now.avatarUrl} size={34} />
      <div className="ds-tm">
        {events.map((e, j) => (
          <span key={e.key} data-on={j === i ? "" : undefined} data-was={j === prev ? "" : undefined}>
            {e.text}
          </span>
        ))}
      </div>
    </div>
  );
}
