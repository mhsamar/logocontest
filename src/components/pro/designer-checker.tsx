"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/client";
import type { DesignerCheck } from "@/lib/pro/logo-checks";
import { Icon } from "./parts";

const ERRORS: Record<string, string> = { limit: "pro.checker.limit", not_set_up: "pro.checker.notReady", bad_file: "pro.checker.badFile", too_big: "pro.checker.tooBig" };

/** Upload a logo and follow the check (every 2 seconds) until the result is in. */
export function DesignerChecker({ left, basicNote }: { left: number; basicNote: string | null }) {
  const { t } = useI18n();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [running, setRunning] = useState<{ id: string; step: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(async () => {
      const res = await fetch(`/api/logo-checks/${running.id}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null);
      const check = res?.check as DesignerCheck | undefined;
      if (!check) return;
      if (check.status === "done" || check.status === "failed") {
        setRunning(null);
        router.refresh();
      } else setRunning({ id: running.id, step: check.step });
    }, 2000);
    return () => window.clearInterval(id);
  }, [running, router]);

  const start = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.set("requestKey", crypto.randomUUID());
    form.set("file", file);
    const res = await fetch("/api/logo-checks", { method: "POST", body: form }).then((r) => r.json()).catch(() => ({ ok: false, error: "invalid" }));
    setBusy(false);
    if (!res.ok) return setError(t((ERRORS[res.error as string] ?? "pro.errors.generic") as never));
    setFile(null);
    setRunning({ id: res.id as string, step: 0 });
  };

  if (running)
    return (
      <div className="pr-empty" aria-live="polite">
        <div className="ck-spin" style={{ margin: "0 auto 10px", width: 70, height: 70 }}>
          <span />
          <Icon name="shield" size={24} />
        </div>
        {t("pro.checker.checking", { n: Math.max(1, running.step) })}
      </div>
    );

  if (left <= 0)
    return (
      <div className="pr-empty">
        {t("pro.checker.limit")} {basicNote}{" "}
        {basicNote && (
          <Link href="/pro" className="pr-link">
            {t("pro.checker.goPro")}
          </Link>
        )}
      </div>
    );

  return (
    <div className="pr-picks">
      <div className="up">
        <label className="pr-out sm" style={{ cursor: "pointer" }}>
          <input type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <Icon name="upload" size={16} />
          {file ? file.name : t("pro.checker.upload")}
        </label>
        <button type="button" className="pr-btn sm" onClick={() => void start()} disabled={!file || busy}>
          <Icon name="shield" size={16} />
          {t("pro.checker.start")}
        </button>
      </div>
      <p className="pr-mut">{t("pro.checker.uploadHint")}</p>
      {error && (
        <p className="ck-err" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
