/* eslint-disable @next/next/no-img-element -- the screenshot preview is a local file the payer picked */
"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "@/components/ui/link";
import { useI18n } from "@/lib/i18n/client";
import { COMPRESS, compressImage, isCompressible } from "@/lib/images/compress";
import { formatNumber, formatTaka } from "@/lib/money";
import { preparePaymentProof, submitPaymentProof } from "@/lib/payments/manual-actions";
import { BANKS, isBankRef, isTxnId, normalizeBankRef, normalizeMobile, showMobile, type ProofMethod } from "@/lib/payments/manual-rules";
import type { PayV3, VoiceCue } from "@/lib/payments/pay-v3";
import { payV3Later, payV3Opened, payV3State } from "@/lib/payments/pay-v3-actions";
import { whatsappLink } from "@/lib/site";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { cleanTrx, helpMessage } from "./rules";
import { VoicePlayer } from "./voice";
import "./pay-v3.css";

const SHOT_TYPES = ["image/png", "image/jpeg", "image/webp"];
const SHOT_MAX = 5 * 1024 * 1024;

type Screen = "how" | "proof" | "wait";

const Svg = ({ d, size = 18, stroke = 2.2 }: { d: string; size?: number; stroke?: number }) => (
  <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const WA = "M3 21l1.6-4.7A8.5 8.5 0 1 1 8 19.7L3 21zM8.5 9.5c.5 2 2 3.5 4 4.3l1.3-1.1 2 .8-.4 1.8c-3.4-.1-6.5-3.2-6.6-6.6l1.8-.4.8 2-1 1.2";

/** "Copy": the value to the clipboard, "Copied ✓" for 2 seconds. */
function Copy({ value, pink }: { value: string; pink?: boolean }) {
  const { t } = useI18n();
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={pink ? "pv-copy-pink" : "pv-copy"}
      onClick={() =>
        navigator.clipboard?.writeText(value).then(
          () => {
            setDone(true);
            window.setTimeout(() => setDone(false), 2000);
          },
          () => {},
        )
      }
    >
      {done ? t("payV3.bk.copied") : t("payV3.bk.copy")}
    </button>
  );
}

/**
 * The contest payment flow (owner, 2026-11-06; Design/logocontest-update): how to send the money by bKash with the
 * voice guide, then how it was sent (the bKash app's TrxID, a bank app's receipt, or another way), then the check
 * until the contest is live. In the wizard's last step and on /pay/contest/<id>; a 480px column on wide screens.
 */
export function PayFlow({ data, briefHref, onSent, extra, preview }: { data: PayV3; briefHref: string; onSent?: () => void; /** Under the payment details on the first screen (the wizard's promo code). */ extra?: React.ReactNode; /** Admin's "Test on page": nothing is sent, saved or counted. */ preview?: boolean }) {
  const [screen, setScreen] = useState<Screen>(data.state === "pending" ? "wait" : "how");
  const [sent, setSent] = useState<{ txn: string; method: ProofMethod } | null>(data.pending);
  const [rejected, setRejected] = useState<string | null>(data.rejected);
  const top = useRef<HTMLDivElement>(null);
  const go = (s: Screen) => {
    setScreen(s);
    top.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  // Counted once per contest: a client who reached the payment screen (Admin › Payments).
  useEffect(() => {
    if (!preview) void payV3Opened(data.paymentId);
  }, [data.paymentId, preview]);

  return (
    <div ref={top} className="pv" data-pay-screen={screen}>
      {screen === "how" && <How data={data} rejected={rejected} extra={extra} preview={preview} onNext={() => go("proof")} />}
      {screen === "proof" && (
        <Proof
          data={data}
          preview={preview}
          onBack={() => go("how")}
          onSent={(s) => {
            setSent(s);
            setRejected(null);
            onSent?.();
            go("wait");
          }}
        />
      )}
      {screen === "wait" && (
        <Wait
          data={data}
          preview={preview}
          sent={sent}
          briefHref={briefHref}
          onRejected={(why) => {
            setRejected(why);
            go("how");
          }}
        />
      )}
    </div>
  );
}

function Help({ data, label, lit }: { data: PayV3; label: string; lit?: boolean }) {
  const { t } = useI18n();
  if (!data.whatsapp) return null;
  return (
    <a href={whatsappLink(data.whatsapp, helpMessage(t("payV3.help.greeting"), data.reference))} target="_blank" rel="noopener noreferrer" className={lit ? "pv-wa pv-on" : "pv-wa"}>
      <span>
        <Svg d={WA} />
      </span>
      <span>
        <strong>{label}</strong>
        <small>
          {data.hours} · {data.whatsapp}
        </small>
      </span>
    </a>
  );
}

/** Screen 1: the order, how to send it, and the voice guide lighting up each box. */
function How({ data, rejected, extra, preview, onNext }: { data: PayV3; rejected: string | null; extra?: React.ReactNode; preview?: boolean; onNext: () => void }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [box, setBox] = useState<VoiceCue["box"] | null>(null);
  const [video, setVideo] = useState(false);
  const [later, startLater] = useTransition();
  const taka = (n: number) => formatTaka(n, locale);
  const n = (v: number) => formatNumber(v, locale);
  const lit = (b: VoiceCue["box"]) => (box === b ? " pv-on" : "");
  const merchant = data.method === "bkash_merchant";
  const action = merchant ? "Payment" : "Send Money";
  const onBox = useCallback((b: VoiceCue["box"] | null) => setBox(b), []);

  return (
    <>
      <div>
        <h1>{t("payV3.title")}</h1>
        <p className="pv-lead">{t("payV3.lead")}</p>
      </div>
      {data.voice && <VoicePlayer url={data.voice.url} cues={data.voice.cues} contestId={data.contestId} onBox={onBox} />}
      {rejected !== null && (
        <div role="alert" className="pv-alert">
          <strong>{t("payV3.wait.rejected")}</strong>
          {rejected && <div>{t("payV3.wait.rejectedLead", { reason: rejected })}</div>}
        </div>
      )}

      <div className="pv-card">
        <div className="pv-row pv-row-head">
          <span>{t("payV3.sum.title", { brand: data.brand, package: t(`wizard.packages.${data.packageKey}.name` as never) })}</span>
          <span>{t("payV3.sum.days", { n: n(data.days) })}</span>
        </div>
        <div className="pv-row">
          <span>{t("payV3.sum.prize")}</span>
          <span className="pv-num">{taka(data.prize)}</span>
        </div>
        {data.addons > 0 && (
          <div className="pv-row">
            <span>{t("payV3.sum.addons")}</span>
            <span className="pv-num">{taka(data.addons)}</span>
          </div>
        )}
        <div className="pv-row">
          <span>{t("payV3.sum.fee", { p: n(data.feePercent) })}</span>
          <span className="pv-num">{taka(data.fee)}</span>
        </div>
        <div className="pv-row pv-total">
          <span>{t("payV3.sum.total")}</span>
          <strong className="pv-num">{taka(data.amount)}</strong>
        </div>
      </div>

      <div className="pv-trust">
        <div className={lit("money-held").trim()}>
          <Svg d="M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z" />
          {t("payV3.trust.held")}
        </div>
        <div>
          <Svg d="M14 3H6v18h12V7zM14 3v4h4M9 14l2 2 4-4" />
          {t("payV3.trust.files")}
        </div>
        <div>
          <Svg d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5" />
          {t("payV3.trust.fast", { n: n(data.approvalMinutes) })}
        </div>
      </div>

      <div className="pv-bk">
        <div className="pv-bk-head">
          <span className="pv-bk-badge">{t("payV3.bk.badge")}</span>
          <div>
            <strong>{t(merchant ? "payV3.bk.pay" : "payV3.bk.send")}</strong>
            <span>{t(merchant ? "payV3.bk.paySub" : "payV3.bk.sendSub")}</span>
          </div>
        </div>
        <div className="pv-field">
          <span className="pv-label">{t("payV3.bk.to")}</span>
          <div className={`pv-numbox${lit("bkash-number")}`}>
            <div>
              <strong>{showMobile(data.number)}</strong>
              {data.accountName && <small>{t("payV3.bk.name", { name: data.accountName, kind: t(merchant ? "payV3.bk.merchant" : "payV3.bk.personal") })}</small>}
            </div>
            <Copy value={showMobile(data.number).replace(/-/g, "")} pink />
          </div>
        </div>
        <div className="pv-pair">
          <div className="pv-field">
            <span className="pv-label">{t("payV3.bk.amount")}</span>
            <div className={`pv-smallbox${lit("amount")}`}>
              <strong>{taka(data.amount)}</strong>
              <Copy value={String(data.amount)} />
            </div>
          </div>
          {data.reference && (
            <div className="pv-field">
              <span className="pv-label">{t("payV3.bk.ref")}</span>
              <div className={`pv-smallbox${lit("reference")}`}>
                <strong>{data.reference}</strong>
                <Copy value={data.reference} />
              </div>
            </div>
          )}
        </div>
        {data.reference && <p className="pv-note">{t("payV3.bk.refNote")}</p>}
      </div>

      <div className="pv-card">
        <div className="pv-steps-head">
          <strong>{t("payV3.app.title")}</strong>
          {data.videoId && (
            <button type="button" className="pv-link" onClick={() => setVideo(true)}>
              <Svg d="M8 5v14l11-7z" size={14} />
              {t("payV3.app.video")}
            </button>
          )}
        </div>
        <ol className="pv-steps">
          <li>
            <b>{n(1)}</b>
            <span>
              {t("payV3.app.s1a")} <strong>{action}</strong> {t("payV3.app.s1c")}
            </span>
          </li>
          <li>
            <b>{n(2)}</b>
            <span>{t("payV3.app.s2")}</span>
          </li>
          <li>
            <b>{n(3)}</b>
            <span>
              {t("payV3.app.s3a")} <strong>{taka(data.amount)}</strong>
              {data.reference && (
                <>
                  {t("payV3.app.s3b")} <strong>{data.reference}</strong>
                </>
              )}
            </span>
          </li>
          <li className={lit("trxid-step").trim() || undefined}>
            <b>{n(4)}</b>
            <span>
              {t("payV3.app.s4a")} <strong>TrxID</strong> {t("payV3.app.s4b")}
            </span>
          </li>
        </ol>
      </div>

      <Help data={data} label={t("payV3.help.title")} lit={box === "whatsapp"} />
      {extra}

      <div className="flex flex-col gap-2">
        <button type="button" className="pv-go" onClick={onNext}>
          {t("payV3.go")}
        </button>
        <button
          type="button"
          className="pv-second"
          disabled={later}
          onClick={() =>
            startLater(async () => {
              if (preview) return;
              await payV3Later(data.paymentId);
              router.push("/client/contests");
            })
          }
        >
          {t("payV3.later")}
        </button>
        <p className="pv-foot">{t("payV3.laterNote")}</p>
      </div>

      {video && data.videoId && (
        <div className="pv-sheet" role="dialog" aria-modal="true" aria-label={t("payV3.app.video")} onClick={() => setVideo(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <iframe src={`https://www.youtube-nocookie.com/embed/${data.videoId}?autoplay=1&playsinline=1&rel=0`} title={t("payV3.app.video")} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
            <button type="button" className="pv-second mt-2.5" onClick={() => setVideo(false)}>
              {t("payV3.app.videoClose")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/** A picture: picked, made light, shown small; removed again with a tap. */
function Shot({ label, pick, need, file, onFile, error }: { label: string; pick: string; need: boolean; file: File | null; onFile: (f: File | null, error?: string) => void; error?: string }) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a picked file's preview address exists only in the browser
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const choose = async (f: File | undefined) => {
    if (!f) return;
    if (!SHOT_TYPES.includes(f.type) && !isCompressible(f)) return onFile(null, t("pay.page.errors.shotType"));
    const small = await compressImage(f, COMPRESS.screenshot);
    if (!SHOT_TYPES.includes(small.type)) return onFile(null, t("pay.page.errors.shotType"));
    if (small.size > SHOT_MAX) return onFile(null, t("pay.page.errors.shotSize"));
    onFile(small);
  };
  return (
    <div className="pv-field">
      <span className="pv-fieldlabel">
        {label} <em className={need ? "pv-need" : undefined}>{need ? t("payV3.proof.required") : t("payV3.proof.optional")}</em>
      </span>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => void choose(e.target.files?.[0])} />
      <button type="button" className={need && !file ? "pv-drop pv-need" : "pv-drop"} onClick={() => (file ? onFile(null) : input.current?.click())}>
        {preview ? (
          <>
            <img src={preview} alt="" />
            {t("payV3.proof.remove")}
          </>
        ) : (
          <>
            <Svg d="M12 16V4M7 9l5-5 5 5M4 20h16" />
            {pick}
          </>
        )}
      </button>
      {error && <span className="pv-err">{error}</span>}
    </div>
  );
}

/** Screen 2: how the money was sent, with what the team needs to find it. */
function Proof({ data, preview, onBack, onSent }: { data: PayV3; preview?: boolean; onBack: () => void; onSent: (s: { txn: string; method: ProofMethod }) => void }) {
  const { t, locale } = useI18n();
  const [how, setHow] = useState<ProofMethod>("bkash");
  const [txn, setTxn] = useState("");
  const [sender, setSender] = useState(data.mobile);
  const [bank, setBank] = useState("");
  const [ref, setRef] = useState("");
  const [amount, setAmount] = useState("");
  const [when, setWhen] = useState("");
  const [shot, setShot] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const taka = (n: number) => formatTaka(n, locale);
  const money = (n: number) => new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2 }).format(n);
  const stuck = how === "bkash" ? t("payV3.proof.bkash.stuck") : how === "bank" ? t("payV3.proof.bank.stuck") : t("payV3.proof.other.stuck");

  const paste = async () => {
    try {
      setTxn(cleanTrx(await navigator.clipboard.readText()));
    } catch {
      // No clipboard permission: they type it.
    }
  };

  const submit = () => {
    const next: Record<string, string> = {};
    const code = how === "bkash" ? cleanTrx(txn) : how === "bank" ? normalizeBankRef(ref) : "";
    if (how === "bkash" && !isTxnId(code)) next.txn = t("pay.page.errors.txn");
    if (how === "bank" && !isBankRef(code)) next.ref = t("pay.page.errors.bankRef");
    if (how === "bank" && !bank) next.bank = t("pay.page.errors.bank");
    if (sender.trim() && !normalizeMobile(sender)) next.sender = t("pay.page.errors.sender");
    if (how === "other" && !sender.trim()) next.sender = t("pay.page.errors.senderNeeded");
    if (how === "other" && !(Number(amount.replace(/[^\d.]/g, "")) > 0)) next.amount = t("pay.page.errors.amount");
    if (how !== "bkash" && !shot) next.shot = t("pay.page.errors.shotNeeded");
    setErrors(next);
    if (Object.keys(next).length) return;
    setError(null);
    if (preview) return onSent({ txn: code, method: how });
    start(async () => {
      let path: string | null = null;
      if (shot) {
        const prepared = await preparePaymentProof({ kind: "contest", paymentId: data.paymentId, type: shot.type, size: shot.size });
        if (!prepared.ok) return setError(t(prepared.error));
        const { error: up } = await createBrowserSupabase().storage.from("payment-proofs").uploadToSignedUrl(prepared.path, prepared.token, shot, { contentType: shot.type });
        if (up) return setError(t("pay.page.errors.shot"));
        path = prepared.path;
      }
      const res = await submitPaymentProof({
        kind: "contest",
        paymentId: data.paymentId,
        method: how,
        txnId: code,
        sender: sender.trim() || undefined,
        screenshotPath: path,
        bank: how === "bank" ? bank : null,
        amountSent: how === "other" ? Math.round(Number(amount.replace(/[^\d.]/g, ""))) : null,
        sentAround: how === "other" ? when : null,
      });
      if (!res.ok) return setError(t(res.error));
      onSent({ txn: code, method: how });
    });
  };

  const tab = (k: ProofMethod, title: string, sub: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={how === k}
      className="pv-tab"
      onClick={() => {
        setHow(k);
        setErrors({});
        setError(null);
      }}
    >
      <strong>{title}</strong>
      <span>{sub}</span>
    </button>
  );

  return (
    <>
      <div className="pv-top">
        <button type="button" className="pv-back" aria-label={t("payV3.proof.back")} onClick={onBack}>
          <Svg d="M15 18l-6-6 6-6" />
        </button>
        <span className="pv-kicker">{t("payV3.proof.kicker")}</span>
      </div>
      <div>
        <h1>{t(`payV3.proof.${how}.title`)}</h1>
        <p className="pv-lead">{t(`payV3.proof.${how}.lead`)}</p>
      </div>
      <div className="pv-field">
        <span className="pv-fieldlabel">{t("payV3.proof.how")}</span>
        <div className="pv-tabs" role="tablist">
          {tab("bkash", t("payV3.proof.tabs.bkash"), t("payV3.proof.tabs.bkashSub"))}
          {tab("bank", t("payV3.proof.tabs.bank"), t("payV3.proof.tabs.bankSub"))}
          {tab("other", t("payV3.proof.tabs.other"), t("payV3.proof.tabs.otherSub"))}
        </div>
      </div>

      {how === "bkash" && (
        <>
          <div className="pv-card">
            <div className="pv-sample-head">
              <strong>
                <span className="pv-logo-bk">{t("payV3.bk.badge").slice(0, 1)}</span>bKash
              </strong>
              <small>{t("payV3.proof.bkash.sample")}</small>
            </div>
            <div className="pv-sms">
              Send Money Tk {money(data.amount)} to 01XXXXXXXXX successful.{data.reference ? ` Ref ${data.reference}.` : ""} Fee Tk 0.00. Balance Tk 1,240.50. <mark>TrxID 9K7X2PQ1AB</mark> at 06/11/2026 10:24
            </div>
            <p className="pv-note">{t("payV3.proof.bkash.sampleNote")}</p>
          </div>
          <div className="pv-field">
            <span className="pv-fieldlabel">{t("payV3.proof.bkash.field")}</span>
            <div className="pv-input-row">
              <input className="pv-input" value={txn} onChange={(e) => setTxn(cleanTrx(e.target.value))} placeholder={t("payV3.proof.bkash.placeholder")} autoCapitalize="characters" autoComplete="off" spellCheck={false} aria-invalid={Boolean(errors.txn)} />
              <button type="button" className="pv-paste" onClick={() => void paste()}>
                {t("payV3.proof.bkash.paste")}
              </button>
            </div>
            <span className={errors.txn ? "pv-err" : "pv-hint"}>{errors.txn ?? t("payV3.proof.bkash.hint")}</span>
          </div>
          <div className="pv-field">
            <span className="pv-fieldlabel">{t("payV3.proof.bkash.sender")}</span>
            <input className="pv-input" value={sender} onChange={(e) => setSender(e.target.value)} inputMode="tel" placeholder="01XXXXXXXXX" aria-invalid={Boolean(errors.sender)} />
            <span className={errors.sender ? "pv-err" : "pv-hint"}>{errors.sender ?? t("payV3.proof.bkash.senderHint")}</span>
          </div>
          <Shot label={t("payV3.proof.bkash.shot")} pick={t("payV3.proof.bkash.shotHint")} need={false} file={shot} onFile={(f, e) => (setShot(f), setErrors((x) => ({ ...x, shot: e ?? "" })))} error={errors.shot || undefined} />
        </>
      )}

      {how === "bank" && (
        <>
          <div className="pv-card">
            <div className="pv-sample-head">
              <strong>
                <span className="pv-logo-bank">{t("payV3.proof.tabs.bank").slice(0, 3)}</span>
                {t("payV3.proof.bank.receipt")}
              </strong>
              <small>{t("payV3.proof.bank.example")}</small>
            </div>
            <div className="pv-receipt">
              <div>
                <span>Transfer to bKash</span>
                <span className="pv-ok">Successful</span>
              </div>
              <div>
                <span>Amount</span>
                <strong>Tk {money(data.amount)}</strong>
              </div>
              <div>
                <span>To wallet</span>
                <span>01XXXXXXXXX</span>
              </div>
              <div>
                <span>Reference No.</span>
                <mark>FT2611068842</mark>
              </div>
              <div>
                <span>Date</span>
                <span>06 Nov 2026, 10:24</span>
              </div>
            </div>
            <p className="pv-note">{t("payV3.proof.bank.note")}</p>
          </div>
          <div className="pv-field">
            <span className="pv-fieldlabel">{t("payV3.proof.bank.bank")}</span>
            <select className="pv-input pv-select" value={bank} onChange={(e) => setBank(e.target.value)} aria-invalid={Boolean(errors.bank)}>
              <option value="">{t("payV3.proof.bank.pick")}</option>
              {BANKS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
              <option value={t("payV3.proof.bank.other")}>{t("payV3.proof.bank.other")}</option>
            </select>
            {errors.bank && <span className="pv-err">{errors.bank}</span>}
          </div>
          <div className="pv-field">
            <span className="pv-fieldlabel">{t("payV3.proof.bank.ref")}</span>
            <input className="pv-input" value={ref} onChange={(e) => setRef(e.target.value.toUpperCase())} placeholder={t("payV3.proof.bank.refPh")} autoCapitalize="characters" autoComplete="off" spellCheck={false} aria-invalid={Boolean(errors.ref)} />
            {errors.ref && <span className="pv-err">{errors.ref}</span>}
          </div>
          <Shot label={t("payV3.proof.bank.shot")} pick={t("payV3.proof.bank.shotPick")} need file={shot} onFile={(f, e) => (setShot(f), setErrors((x) => ({ ...x, shot: e ?? "" })))} error={errors.shot || undefined} />
          <p className="pv-note">{t("payV3.proof.bank.shotWhy")}</p>
          {data.reference && (
            <div className="pv-tip">
              <strong>{t("payV3.proof.bank.tipLabel")}</strong> {t("payV3.proof.bank.tipA")} <strong>{data.reference}</strong> {t("payV3.proof.bank.tipB")}
            </div>
          )}
        </>
      )}

      {how === "other" && (
        <>
          <div className="pv-field">
            <span className="pv-fieldlabel">{t("payV3.proof.other.sender")}</span>
            <input className="pv-input" value={sender} onChange={(e) => setSender(e.target.value)} inputMode="tel" placeholder="01XXXXXXXXX" aria-invalid={Boolean(errors.sender)} />
            {errors.sender && <span className="pv-err">{errors.sender}</span>}
          </div>
          <div className="pv-pair">
            <div className="pv-field">
              <span className="pv-fieldlabel">{t("payV3.proof.other.amount")}</span>
              <input className="pv-input" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" placeholder={taka(data.amount)} aria-invalid={Boolean(errors.amount)} />
              {errors.amount && <span className="pv-err">{errors.amount}</span>}
            </div>
            <div className="pv-field">
              <span className="pv-fieldlabel">{t("payV3.proof.other.time")}</span>
              <input className="pv-input" value={when} onChange={(e) => setWhen(e.target.value)} maxLength={60} placeholder={t("payV3.proof.other.timePh")} />
            </div>
          </div>
          <Shot label={t("payV3.proof.other.shot")} pick={t("payV3.proof.other.shotPick")} need file={shot} onFile={(f, e) => (setShot(f), setErrors((x) => ({ ...x, shot: e ?? "" })))} error={errors.shot || undefined} />
        </>
      )}

      {error && (
        <div role="alert" className="pv-alert">
          {error}
        </div>
      )}
      <button type="button" className="pv-go" onClick={submit} disabled={busy}>
        {t("payV3.proof.submit")}
      </button>
      {data.whatsapp && (
        <a href={whatsappLink(data.whatsapp, helpMessage(t("payV3.help.greeting"), data.reference))} target="_blank" rel="noopener noreferrer" className="pv-late text-center">
          {stuck}
        </a>
      )}
    </>
  );
}

/** Screen 3: sent; checked by the team. Asks every 20 seconds and shows the contest live once it is approved. */
function Wait({ data, preview, sent, briefHref, onRejected }: { data: PayV3; preview?: boolean; sent: { txn: string; method: ProofMethod } | null; briefHref: string; onRejected: (why: string) => void }) {
  const { t, locale } = useI18n();
  const [live, setLive] = useState(data.state === "paid");
  const n = (v: number) => formatNumber(v, locale);
  const other = sent?.method === "other";

  useEffect(() => {
    if (live || preview) return;
    const tick = window.setInterval(async () => {
      const s = await payV3State(data.paymentId).catch(() => null);
      if (!s) return;
      if (s.state === "paid") setLive(true);
      else if (s.state === "open" && s.rejected !== null) onRejected(s.rejected);
    }, 20_000);
    return () => window.clearInterval(tick);
  }, [live, preview, data.paymentId, onRejected]);

  return (
    <div className="pv pv-wait">
      <span className="pv-tick" aria-hidden>
        <Svg d="M5 12.5l4.5 4.5L19 7.5" size={34} stroke={2.6} />
      </span>
      <div>
        <h1>{live ? t("payV3.wait.live") : t(other ? "payV3.wait.titleOther" : "payV3.wait.title")}</h1>
        <p className="pv-lead">{live ? t("payV3.wait.liveLead") : t("payV3.wait.lead", { n: n(data.approvalMinutes) })}</p>
      </div>
      <ol className="pv-line">
        <li className="pv-done">
          <span className="pv-dot">
            <Svg d="M5 12.5l4.5 4.5L19 7.5" size={14} stroke={3} />
          </span>
          <span>
            <strong>{t(other ? "payV3.wait.step1Other" : "payV3.wait.step1")}</strong>
            <small>{[sent?.txn, formatTaka(data.amount, locale)].filter(Boolean).join(" · ")}</small>
          </span>
        </li>
        <li className={live ? "pv-done" : "pv-now"}>
          <span className="pv-dot">{live && <Svg d="M5 12.5l4.5 4.5L19 7.5" size={14} stroke={3} />}</span>
          <span>
            <strong>{t("payV3.wait.step2")}</strong>
            <small>{t("payV3.wait.step2Line")}</small>
          </span>
        </li>
        <li className={live ? "pv-done" : undefined}>
          <span className="pv-dot">{live && <Svg d="M5 12.5l4.5 4.5L19 7.5" size={14} stroke={3} />}</span>
          <span>
            <strong>{t("payV3.wait.step3")}</strong>
          </span>
        </li>
      </ol>
      {live ? (
        <Link href={`/client/contests/${data.slug}`} className="pv-go">
          {t("payV3.wait.toContest")}
        </Link>
      ) : (
        <>
          <div className="pv-todo">
            <strong>{t("payV3.wait.meanwhile")}</strong>
            <p>{t("payV3.wait.meanwhileBody")}</p>
          </div>
          <Link href={briefHref} className="pv-go">
            {t("payV3.wait.brief")}
          </Link>
        </>
      )}
      <Link href="/client" className="pv-second">
        {t("payV3.wait.dashboard")}
      </Link>
      {!live && data.whatsapp && (
        <a href={whatsappLink(data.whatsapp, helpMessage(t("payV3.help.greeting"), data.reference))} target="_blank" rel="noopener noreferrer" className="pv-late">
          {t("payV3.wait.late", { phone: data.whatsapp })}
        </a>
      )}
    </div>
  );
}
