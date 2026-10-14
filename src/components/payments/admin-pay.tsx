"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AdminAction } from "@/components/admin/admin-action";
import { useReadOnly } from "@/components/admin/read-only";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/translate";
import { approvePayment, createPromoCodes, makeQaCodes, rejectPayment, saveMethod, setMethodEnabled, setPromoActive } from "@/lib/payments/admin-actions";
import { CLIENT_FEE_CHOICES, DESIGNER_FEE_CHOICES, showMobile } from "@/lib/payments/manual-rules";

/** Admin › Payments (owner, 2026-10-14): approve or reject, method switches, QA IDs and promo codes. */

export function ProofActions({ id, amount, txn }: { id: string; amount: string; txn: string }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap gap-2">
      <AdminAction
        label={t("pay.admin.approvals.approve")}
        title={t("pay.admin.approvals.approveTitle")}
        body={t("pay.admin.approvals.approveBody", { amount, txn })}
        confirm={t("pay.admin.approvals.approveConfirm")}
        done={t("pay.admin.approvals.approved")}
        tone="primary"
        fields={[]}
        run={() => approvePayment(id)}
      />
      <AdminAction
        label={t("pay.admin.approvals.reject")}
        title={t("pay.admin.approvals.rejectTitle")}
        body={t("pay.admin.approvals.rejectBody")}
        done={t("pay.admin.approvals.rejected")}
        tone="danger"
        // Five ready-made reasons (owner, 2026-10-14); the payer sees the text, which can still be changed.
        fields={[
          {
            name: "reason",
            kind: "reason",
            hint: t("pay.admin.approvals.reasonHint"),
            suggestions: (["notFound", "amount", "wrongNumber", "used", "test"] as const).map((k) => ({ label: t(`pay.admin.approvals.reasons.${k}.label`), text: t(`pay.admin.approvals.reasons.${k}.text`) })),
          },
        ]}
        run={(f) => rejectPayment(id, f)}
      />
    </div>
  );
}

export function CopyChip({ value, className }: { value: string; className?: string }) {
  const { t } = useI18n();
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() =>
        navigator.clipboard?.writeText(value).then(
          () => (setDone(true), setTimeout(() => setDone(false), 1400)),
          () => undefined,
        )
      }
      className={cx("inline-flex min-h-9 items-center rounded-[10px] border border-adm-line px-2.5 text-[13px] font-bold text-primary hover:border-primary", className)}
    >
      {done ? t("pay.page.copied") : t("pay.admin.qa.copy")}
    </button>
  );
}

/** "Make 5 QA IDs": test transaction IDs for trying manual bKash without money. */
export function QaMaker() {
  const { t } = useI18n();
  const readOnly = useReadOnly();
  const router = useRouter();
  const toast = useToast();
  const [busy, start] = useTransition();
  if (readOnly) return null;
  return (
    <Button
      variant="secondary"
      loading={busy}
      onClick={() =>
        start(async () => {
          const res = await makeQaCodes(5);
          if (!res.ok) return toast(t(res.error), "danger");
          toast(t("pay.admin.qa.made"));
          router.refresh();
        })
      }
    >
      {t("pay.admin.qa.make", { n: 5 })}
    </Button>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Methods
// ---------------------------------------------------------------------------------------------------------

export type MethodCardData = { key: string; enabled: boolean; manual: boolean; ready: boolean; number: string | null; name: string | null; noteEn: string | null; noteBn: string | null; updated: string | null };

/** One payment method: its switch, and for manual bKash the number people send money to. */
export function MethodCard({ m, canManage }: { m: MethodCardData; canManage: boolean }) {
  const { t } = useI18n();
  const readOnly = useReadOnly() || !canManage;
  const router = useRouter();
  const toast = useToast();
  const [on, setOn] = useState(m.enabled);
  const [number, setNumber] = useState(m.number ? showMobile(m.number).replace("-", "") : "");
  const [name, setName] = useState(m.name ?? "");
  const [noteEn, setNoteEn] = useState(m.noteEn ?? "");
  const [noteBn, setNoteBn] = useState(m.noteBn ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const [saving, save] = useTransition();
  const canTurnOn = m.manual ? Boolean(m.number) : m.ready;

  const flip = () =>
    start(async () => {
      const next = !on;
      setError(null);
      setOn(next);
      const res = await setMethodEnabled(m.key, next);
      if (!res.ok) {
        setOn(!next);
        return setError(t(res.error));
      }
      toast(t("pay.admin.methods.saved"));
      router.refresh();
    });

  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-[20px] border border-adm-line bg-surface p-5" data-method-card={m.key}>
      <div className="flex items-start gap-3">
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <strong className={cx("text-[18px]", m.key.startsWith("bkash") ? "text-[#e2136e]" : "text-ink")}>{t(`pay.admin.methods.names.${m.key}` as MessageKey)}</strong>
            <span className={cx("rounded-full px-2 py-0.5 text-[12.5px] font-bold", m.manual ? "bg-[#fff4dc] text-[#9a6200]" : "bg-[#e8f1ff] text-[#1d4ed8]")}>{m.manual ? t("pay.admin.methods.manual") : t("pay.admin.methods.automatic")}</span>
            <span className={cx("rounded-full px-2 py-0.5 text-[12.5px] font-bold", on ? "bg-[#e7f8f0] text-[#0f6b45]" : "bg-[#eef0f3] text-[#5f626b]")}>{on ? t("pay.admin.methods.on") : t("pay.admin.methods.off")}</span>
          </span>
          <span className="text-[14.5px] text-muted">{t(`pay.admin.methods.descs.${m.key}` as MessageKey)}</span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={on ? t("pay.admin.methods.turnOff") : t("pay.admin.methods.turnOn")}
          disabled={readOnly || busy || (!on && !canTurnOn)}
          onClick={flip}
          className={cx("relative mt-1 block h-[30px] w-[52px] flex-none rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60", on ? "bg-[linear-gradient(180deg,#2BB673,#1F7A4D)]" : "bg-[#D5D7DD]")}
        >
          <span className={cx("absolute left-[3px] top-[3px] size-6 rounded-full bg-white shadow-[0_2px_6px_rgba(17,18,22,.25)] transition-transform duration-300", on && "translate-x-[22px]")} />
        </button>
      </div>

      {!m.manual && <p className={cx("m-0 rounded-[12px] px-3.5 py-2.5 text-[14px]", m.ready ? "bg-[#e7f8f0] text-[#0f6b45]" : "bg-[#f4f5f7] text-[#3a3c45]")}>{m.ready ? t("pay.admin.methods.ready") : t("pay.admin.methods.notReady")}</p>}
      {m.key === "stripe" && <p className="m-0 text-sm text-muted">{t("pay.admin.methods.usdOnly")}</p>}

      {m.manual && (
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            save(async () => {
              setError(null);
              const res = await saveMethod(m.key, { number, name, noteEn, noteBn });
              if (!res.ok) return setError(t(res.error));
              toast(t("pay.admin.methods.saved"));
              router.refresh();
            });
          }}
        >
          <TextField label={t("pay.admin.methods.number")} hint={t("pay.admin.methods.numberHint")} value={number} onChange={(e) => setNumber(e.target.value)} type="tel" inputMode="tel" maxLength={16} disabled={readOnly} />
          <TextField label={t("pay.admin.methods.name")} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} disabled={readOnly} />
          <TextField label={t("pay.admin.methods.noteEn")} value={noteEn} onChange={(e) => setNoteEn(e.target.value)} maxLength={300} disabled={readOnly} />
          <TextField label={t("pay.admin.methods.noteBn")} value={noteBn} onChange={(e) => setNoteBn(e.target.value)} maxLength={300} disabled={readOnly} />
          {!readOnly && (
            <div className="flex items-center gap-3 sm:col-span-2">
              <Button type="submit" loading={saving}>
                {t("pay.admin.methods.save")}
              </Button>
              {m.updated && <span className="text-sm text-muted">{t("pay.admin.methods.updated", { date: m.updated })}</span>}
            </div>
          )}
        </form>
      )}
      {!on && m.manual && !m.number && <p className="m-0 text-sm text-muted">{t("pay.admin.methods.needsNumber")}</p>}
      {error && <Alert tone="danger">{error}</Alert>}
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Promo codes
// ---------------------------------------------------------------------------------------------------------

const PRO_DISCOUNTS = [10, 20, 25, 30, 40, 50, 75, 100];

/** Make promo codes: who for, what it does, the value, one-time batch or one shared code, and dates. */
export function PromoCreator() {
  const { t } = useI18n();
  const readOnly = useReadOnly();
  const router = useRouter();
  const toast = useToast();
  const [audience, setAudience] = useState<"client" | "designer">("client");
  const [kind, setKind] = useState<"client_fee" | "designer_fee" | "pro_discount">("client_fee");
  const [value, setValue] = useState("20");
  const [mode, setMode] = useState<"single" | "shared">("single");
  const [count, setCount] = useState("10");
  const [prefix, setPrefix] = useState("");
  const [code, setCode] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [label, setLabel] = useState("");
  const [made, setMade] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  if (readOnly) return null;

  const values = kind === "client_fee" ? CLIENT_FEE_CHOICES : kind === "designer_fee" ? DESIGNER_FEE_CHOICES : PRO_DISCOUNTS;
  const pickAudience = (a: "client" | "designer") => {
    setAudience(a);
    const k = a === "client" ? "client_fee" : "designer_fee";
    setKind(k);
    setValue(String((k === "client_fee" ? CLIENT_FEE_CHOICES : DESIGNER_FEE_CHOICES)[0]));
  };
  const pickKind = (k: typeof kind) => {
    setKind(k);
    setValue(String((k === "client_fee" ? CLIENT_FEE_CHOICES : k === "designer_fee" ? DESIGNER_FEE_CHOICES : PRO_DISCOUNTS)[0]));
  };
  const local = (v: string) => (v ? new Date(v).toISOString() : null);

  const submit = () =>
    start(async () => {
      setError(null);
      setMade(null);
      const res = await createPromoCodes({ audience, kind, value: Number(value), mode, count: Number(count), prefix, code, maxUses: maxUses ? Number(maxUses) : null, startsAt: local(startsAt), endsAt: local(endsAt), label });
      if (!res.ok) return setError(t(res.error));
      toast(t("pay.admin.promos.created", { n: res.codes.length }));
      setMade(res.codes);
      setCode("");
      router.refresh();
    });

  const seg = (on: boolean) => cx("min-h-11 flex-1 rounded-[10px] px-3 text-[14.5px] font-bold transition-colors", on ? "bg-primary text-white" : "text-adm-strong hover:bg-adm-bg");

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-ink">{t("pay.admin.promos.audience")}</span>
        <div className="flex gap-1 rounded-[14px] border border-adm-line bg-surface p-1">
          {(["client", "designer"] as const).map((a) => (
            <button key={a} type="button" className={seg(audience === a)} aria-pressed={audience === a} onClick={() => pickAudience(a)}>
              {t(`pay.admin.promos.audiences.${a}`)}
            </button>
          ))}
        </div>
      </div>
      {audience === "designer" && (
        <SelectField
          label={t("pay.admin.promos.kind")}
          placeholder={t("pay.admin.promos.kind")}
          value={kind}
          onChange={(e) => pickKind(e.target.value as typeof kind)}
          options={(["designer_fee", "pro_discount"] as const).map((k) => ({ value: k, label: t(`pay.admin.promos.kinds.${k}`) }))}
        />
      )}
      {audience === "client" && <p className="m-0 text-[14.5px] text-muted">{t("pay.admin.promos.kinds.client_fee")}</p>}
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-ink">{kind === "pro_discount" ? t("pay.admin.promos.discount") : t("pay.admin.promos.value")}</span>
        <div className="flex flex-wrap gap-1.5">
          {values.map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={value === String(v)}
              onClick={() => setValue(String(v))}
              className={cx("min-h-11 min-w-14 rounded-[12px] px-3 text-[15px] font-bold ring-1 transition-colors", value === String(v) ? "bg-primary text-white ring-primary" : "bg-surface text-ink ring-adm-line hover:ring-primary")}
            >
              {t("pay.admin.promos.valuePct", { n: v })}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-ink">{t("pay.admin.promos.mode")}</span>
        <div className="flex gap-1 rounded-[14px] border border-adm-line bg-surface p-1">
          {(["single", "shared"] as const).map((m) => (
            <button key={m} type="button" className={seg(mode === m)} aria-pressed={mode === m} onClick={() => setMode(m)}>
              {t(`pay.admin.promos.modes.${m}`)}
            </button>
          ))}
        </div>
        <span className="text-sm text-muted">{t(`pay.admin.promos.modeHints.${mode}`)}</span>
      </div>
      {mode === "single" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label={t("pay.admin.promos.count")} type="number" inputMode="numeric" min={1} max={500} value={count} onChange={(e) => setCount(e.target.value)} />
          <TextField label={t("pay.admin.promos.prefix")} hint={t("pay.admin.promos.prefixHint")} value={prefix} onChange={(e) => setPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))} />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label={t("pay.admin.promos.code")} hint={t("pay.admin.promos.codeHint")} value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 24))} />
          <TextField label={t("pay.admin.promos.maxUses")} type="number" inputMode="numeric" min={1} value={maxUses} onChange={(e) => setMaxUses(e.target.value)} />
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label={t("pay.admin.promos.startsAt")} type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
        <TextField label={t("pay.admin.promos.endsAt")} type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
      </div>
      <TextField label={t("pay.admin.promos.label")} value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} />
      {error && <Alert tone="danger">{error}</Alert>}
      <Button type="submit" size="lg" loading={busy} block>
        {t("pay.admin.promos.create")}
      </Button>
      {made && made.length > 0 && (
        <div className="flex flex-col gap-2 rounded-[14px] bg-[#e7f8f0] p-3.5" data-promo-made>
          <strong className="text-[15px] text-[#0f6b45]">{t("pay.admin.promos.created", { n: made.length })}</strong>
          <ul className="m-0 flex max-h-56 list-none flex-wrap gap-1.5 overflow-auto p-0">
            {made.map((c) => (
              <li key={c} className="rounded-[8px] bg-white px-2 py-1 font-mono text-[13.5px] font-semibold text-ink">
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}

export function PromoToggle({ id, batchId, active }: { id?: string; batchId?: string | null; active: boolean }) {
  const { t } = useI18n();
  const readOnly = useReadOnly();
  const router = useRouter();
  const toast = useToast();
  const [busy, start] = useTransition();
  if (readOnly) return null;
  return (
    <Button
      variant="secondary"
      size="md"
      loading={busy}
      onClick={() =>
        start(async () => {
          const res = await setPromoActive(batchId ? { batchId } : { id }, !active);
          if (!res.ok) return toast(t(res.error), "danger");
          toast(t("admin.saved"));
          router.refresh();
        })
      }
    >
      {active ? t("pay.admin.promos.pause") : t("pay.admin.promos.resume")}
    </Button>
  );
}
