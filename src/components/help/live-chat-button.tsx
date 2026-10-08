"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type TawkApi = { onLoad?: () => void; maximize?: () => void; showWidget?: () => void; hideWidget?: () => void };

declare global {
  interface Window {
    Tawk_API?: TawkApi;
    Tawk_LoadStart?: Date;
  }
}

/**
 * Loads the Tawk.to chat only when the visitor taps the button, then opens it (BLUEPRINT live chat).
 * The chat bubble is hidden again when the visitor leaves the Help page.
 */
export function LiveChatButton({ src, label, loadingLabel }: { src: string; label: string; loadingLabel: string }) {
  const [state, setState] = useState<"idle" | "loading" | "ready">(() => (typeof window !== "undefined" && window.Tawk_API?.maximize ? "ready" : "idle"));

  useEffect(() => {
    window.Tawk_API?.showWidget?.();
    return () => window.Tawk_API?.hideWidget?.();
  }, []);

  const open = () => {
    if (window.Tawk_API?.maximize) {
      window.Tawk_API.showWidget?.();
      window.Tawk_API.maximize();
      return;
    }
    if (state === "loading") return;
    setState("loading");
    window.Tawk_API = window.Tawk_API ?? {};
    window.Tawk_API.onLoad = () => {
      setState("ready");
      window.Tawk_API?.maximize?.();
    };
    window.Tawk_LoadStart = new Date();
    const script = document.createElement("script");
    script.async = true;
    script.src = src;
    script.charset = "UTF-8";
    script.setAttribute("crossorigin", "*");
    script.onerror = () => setState("idle");
    document.body.appendChild(script);
  };

  return (
    <Button size="lg" block onClick={open} loading={state === "loading"}>
      {state === "loading" ? loadingLabel : label}
    </Button>
  );
}
