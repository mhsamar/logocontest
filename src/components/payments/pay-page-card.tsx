"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { SITE_BUCKET } from "@/lib/content/pictures";
import { cx } from "@/lib/cx";
import type { HowVideo } from "@/lib/home/how-video";
import { useI18n } from "@/lib/i18n/client";
import { preparePayVoice, removePayVoice, savePayCues, savePayPage, savePayVoice, setPayVoiceOn } from "@/lib/payments/pay-page-actions";
import type { VoiceCue } from "@/lib/payments/pay-v3";
import { createBrowserSupabase } from "@/lib/supabase/browser";

const INPUT = "h-11 w-full rounded-[10px] border border-[#DCDEE3] bg-white px-3 text-[15px] font-medium text-ink focus:outline-2 focus:outline-offset-1 focus:outline-primary disabled:bg-canvas";
const BOXES: VoiceCue["box"][] = ["none", "bkash-number", "amount", "reference", "trxid-step", "money-held", "whatsapp"];

type Row = VoiceCue & { key: number };
let nextKey = 0;

/**
 * Admin › Payments › Methods, "Contest payment screen" (owner, 2026-11-06): how many clients reached it, chose "pay
 * later" and sent proof; the voice guide (upload, listen, replace, delete, on/off, timing table); the support hours
 * and the "how to Send Money" video; and a button to see the screen in preview mode.
 */
export function PayPageCard(props: { canManage: boolean; voice: { url: string | null; name: string; on: boolean; cues: VoiceCue[] }; hours: string; video: HowVideo; stats: { opened: number; later: number; sent: number } }) {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const file = useRef<HTMLInputElement>(null);
  const [busy, run] = useTransition();
  const [on, setOn] = useState(props.voice.on);
  const [rows, setRows] = useState<Row[]>(() => props.voice.cues.map((c) => ({ ...c, key: nextKey++ })));
  const [hours, setHours] = useState(props.hours);
  const [video, setVideo] = useState(props.video.url);
  const ro = !props.canManage;
  const badRows = rows.some((r) => !(r.to > r.from) || r.text.trim().length > 80);

  const upload = (f: File) =>
    run(async () => {
      const prepared = await preparePayVoice({ type: f.type || (f.name.toLowerCase().endsWith(".m4a") ? "audio/mp4" : "audio/mpeg"), size: f.size });
      if (!prepared.ok) return toast(t(prepared.error), "danger");
      const { error } = await createBrowserSupabase().storage.from(SITE_BUCKET).uploadToSignedUrl(prepared.path, prepared.token, f, { contentType: f.type || "audio/mpeg" });
      if (error) return toast(t("pay.admin.screen.voiceFailed"), "danger");
      const saved = await savePayVoice(prepared.path, f.name);
      if (!saved.ok) return toast(t(saved.error), "danger");
      toast(t("admin.saved"));
      router.refresh();
    });
  const act = (fn: () => Promise<{ ok: boolean; error?: Parameters<typeof t>[0] }>) =>
    run(async () => {
      const res = await fn();
      if (!res.ok) return toast(t(res.error ?? "admin.errors.generic"), "danger");
      toast(t("admin.saved"));
      router.refresh();
    });
  const set = (i: number, patch: Partial<Row>) => setRows((list) => list.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <section className="rounded-2xl bg-surface p-5 shadow-card ring-1 ring-line" id="pay-screen">
      <h2 className="font-semibold text-ink">{t("pay.admin.screen.title")}</h2>
      <p className="mt-1 text-sm text-muted">{t("pay.admin.screen.lead")}</p>

      <dl className="mt-4 grid grid-cols-3 gap-2">
        {(["opened", "later", "sent"] as const).map((k) => (
          <div key={k} className="rounded-xl bg-canvas px-3 py-2.5">
            <dt className="text-xs font-semibold text-muted">{t(`pay.admin.screen.stats.${k}`)}</dt>
            <dd className="m-0 text-[22px] font-semibold tabular-nums text-ink">{props.stats[k]}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-1 text-xs text-muted">{t("pay.admin.screen.statsHint")}</p>

      <div className="mt-5 border-t border-line pt-4">
        <h3 className="text-[15.5px] font-bold text-ink">{t("pay.admin.screen.voice")}</h3>
        <p className="mt-1 text-sm text-muted">{t("pay.admin.screen.voiceHint")}</p>
        <input ref={file} type="file" accept="audio/mpeg,audio/mp4,audio/x-m4a,.mp3,.m4a" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        {props.voice.url ? (
          <div className="mt-3 flex flex-col gap-2">
            <p className="m-0 text-sm font-semibold text-ink">{props.voice.name || t("pay.admin.screen.voiceFile")}</p>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption -- the owner's own voice recording, checked here by ear */}
            <audio controls preload="metadata" src={props.voice.url} className="w-full max-w-md" />
            {!ro && (
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => file.current?.click()} loading={busy}>
                  {t("pay.admin.screen.replace")}
                </Button>
                <Button variant="ghost" onClick={() => act(removePayVoice)} disabled={busy}>
                  {t("pay.admin.screen.delete")}
                </Button>
              </div>
            )}
          </div>
        ) : (
          !ro && (
            <Button className="mt-3" onClick={() => file.current?.click()} loading={busy}>
              {t("pay.admin.screen.upload")}
            </Button>
          )
        )}

        <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-xl bg-[#F4F5F7] px-4 py-3.5">
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <strong className="text-[15.5px] text-ink">{t("pay.admin.screen.voiceOn")}</strong>
            <span className="text-sm text-muted">{t("pay.admin.screen.voiceOnHint")}</span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label={t("pay.admin.screen.voiceOn")}
            disabled={ro || busy}
            onClick={() => {
              const next = !on;
              setOn(next);
              act(() => setPayVoiceOn(next));
            }}
            className={cx("relative block h-7 w-[46px] flex-none rounded-full transition-colors disabled:cursor-not-allowed", on ? "bg-[#14633C]" : "bg-[#B9BCC4]")}
          >
            <span className={cx("absolute top-[3px] size-[22px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.25)] transition-[left]", on ? "left-[21px]" : "left-[3px]")} />
          </button>
        </label>

        <h4 className="mt-4 text-sm font-bold text-ink">{t("pay.admin.screen.cues")}</h4>
        <p className="mt-1 text-xs text-muted">{t("pay.admin.screen.cuesHint")}</p>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="py-1.5 pr-2 font-semibold">{t("pay.admin.screen.from")}</th>
                <th className="py-1.5 pr-2 font-semibold">{t("pay.admin.screen.to")}</th>
                <th className="py-1.5 pr-2 font-semibold">{t("pay.admin.screen.box")}</th>
                <th className="py-1.5 pr-2 font-semibold">{t("pay.admin.screen.line")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.key}>
                  <td className="py-1 pr-2">
                    <input type="number" min={0} max={600} value={r.from} onChange={(e) => set(i, { from: Number(e.target.value) })} disabled={ro} className={cx(INPUT, "w-20")} aria-label={t("pay.admin.screen.from")} />
                  </td>
                  <td className="py-1 pr-2">
                    <input type="number" min={0} max={600} value={r.to} onChange={(e) => set(i, { to: Number(e.target.value) })} disabled={ro} className={cx(INPUT, "w-20", !(r.to > r.from) && "border-danger")} aria-label={t("pay.admin.screen.to")} />
                  </td>
                  <td className="py-1 pr-2">
                    <select value={r.box} onChange={(e) => set(i, { box: e.target.value as VoiceCue["box"] })} disabled={ro} className={cx(INPUT, "w-40")} aria-label={t("pay.admin.screen.box")}>
                      {BOXES.map((b) => (
                        <option key={b} value={b}>
                          {t(`pay.admin.screen.boxes.${b}`)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-1 pr-2">
                    <input value={r.text} onChange={(e) => set(i, { text: e.target.value })} maxLength={80} lang="bn" disabled={ro} className={INPUT} aria-label={t("pay.admin.screen.line")} />
                  </td>
                  <td className="py-1">
                    {!ro && (
                      <Button variant="ghost" onClick={() => setRows((list) => list.filter((_, j) => j !== i))} aria-label={t("admin.homepage.remove")}>
                        ×
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!ro && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" disabled={rows.length >= 20} onClick={() => setRows((list) => [...list, { from: list.at(-1)?.to ?? 0, to: (list.at(-1)?.to ?? 0) + 5, box: "none", text: "", key: nextKey++ }])}>
              {t("pay.admin.screen.addRow")}
            </Button>
            <Button disabled={badRows || busy} onClick={() => act(() => savePayCues(rows.map(({ from, to, box, text }) => ({ from, to, box, text }))))}>
              {t("pay.admin.screen.saveCues")}
            </Button>
          </div>
        )}
      </div>

      <div className="mt-5 grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-bold text-ink">
          {t("pay.admin.screen.hours")}
          <input value={hours} onChange={(e) => setHours(e.target.value)} maxLength={60} lang="bn" disabled={ro} className={INPUT} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-bold text-ink">
          {t("pay.admin.screen.video")}
          <input value={video} onChange={(e) => setVideo(e.target.value)} inputMode="url" placeholder="https://youtu.be/…" disabled={ro} className={INPUT} />
        </label>
      </div>
      <p className="mt-1 text-xs text-muted">{t("pay.admin.screen.whatsappHint")}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {!ro && (
          <Button variant="secondary" disabled={busy} onClick={() => act(() => savePayPage({ hours, video }))}>
            {t("pay.admin.screen.savePage")}
          </Button>
        )}
        <ButtonLink href="/admin/payments/pay-preview" variant="ghost">
          {t("pay.admin.screen.test")}
        </ButtonLink>
      </div>
    </section>
  );
}
