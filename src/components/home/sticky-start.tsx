"use client";

import { useEffect, useState } from "react";
import { ButtonLink } from "@/components/ui/button";

/** Phone-only "Start a Contest" bar that appears once the hero has scrolled away (UI-JOURNEY P-01). */
export function StickyStart({ label, watchId }: { label: string; watchId: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const el = document.getElementById(watchId);
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setShow(!entry.isIntersecting && entry.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, [watchId]);

  return (
    <div
      inert={!show}
      className={`fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur transition-transform duration-200 sm:hidden ${
        show ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <ButtonLink href="/start" size="lg" block>
        {label}
      </ButtonLink>
    </div>
  );
}
