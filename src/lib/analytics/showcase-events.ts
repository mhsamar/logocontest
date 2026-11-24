/**
 * Home showcase clicks (owner, 2026-11-20): custom events for Meta Pixel and the data layer (Google Analytics later).
 * Sent on every click, as these count interest, not conversions. Never throws, and nothing personal is sent.
 */
export type ShowcaseEvent = "showcase_logo_click" | "showcase_contest_click" | "showcase_tab_switch" | "showcase_cta_start_contest";

type FbqCustom = (cmd: "trackCustom", event: string, params?: Record<string, string>) => void;

export function trackShowcase(event: ShowcaseEvent, params?: Record<string, string>): void {
  if (typeof window === "undefined") return;
  try {
    (window.dataLayer ??= []).push({ event, ...params });
    const fbq = window.fbq as unknown as FbqCustom | undefined;
    if (typeof fbq === "function") fbq("trackCustom", event, params);
  } catch {
    // Analytics never breaks a click.
  }
}
