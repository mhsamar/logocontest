"use client";

/* eslint-disable @next/next/no-img-element */
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { CardShare } from "@/components/rewards/win-card-share";
import { cx } from "@/lib/cx";
import { useI18n } from "@/lib/i18n/client";
import { claimReward, type ClaimResult } from "@/lib/rewards/claim-actions";

type Step1 = {
  rewardId: string;
  kind: "smartphone" | "gift_box";
  images: { square: string; story: string };
  cardAlt: string;
  title: string;
  title2: string;
  lead: string;
  stats: { label: string; value: string }[];
  claimLabel: string;
  formTitle: string;
  deadline: string | null;
  closed: boolean;
  share: { pageUrl: string; fileName: string; shareText: string };
};

const card = "flex flex-col gap-3.5 rounded-[24px] border border-[#E9EAEE] bg-white p-[18px] sm:p-[22px]";
const input = "min-h-[50px] w-full rounded-xl border border-[#DCDEE3] bg-white px-3.5 py-3 text-[16px] font-medium text-[#111216] focus:outline-2 focus:outline-offset-1 focus:outline-[#8B0000]";
const label = "flex flex-col gap-1.5 text-[15px] font-bold";
const b1 = "inline-flex min-h-[54px] w-full items-center justify-center rounded-full bg-[linear-gradient(180deg,#B3201B,#8B0000)] px-[22px] text-[17px] font-bold text-white disabled:opacity-60";

/** A step label as in the design: a black number dot and its name. */
export function StepLabel({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-[14px] font-bold text-[#5F626B]">
      <b className="flex size-[26px] items-center justify-center rounded-full bg-[#111216] text-[13.5px] text-white">{n}</b>
      {children}
    </span>
  );
}

/**
 * Steps 1 and 2 of a monthly prize claim (owner, 2026-10-11; Design/rewards/client-smartphone-claim.html and
 * designer-gift-box-claim.html): the congratulation card with "Claim my …", then the form. Step 3 is drawn by the
 * page once the claim is saved.
 */
export function RewardClaim(p: Step1) {
  const { t } = useI18n();
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [values, setValues] = useState({ name: "", mobile: "", address: "", confirm: false });
  const [error, setError] = useState<Extract<ClaimResult, { ok: false }> | null>(null);
  const [busy, start] = useTransition();
  const top = useRef<HTMLDivElement>(null);
  const toTop = () => top.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  const moved = useRef(false);
  // A new step starts at its top (the page may be scrolled down to the button).
  useEffect(() => {
    if (moved.current) toTop();
    moved.current = true;
  }, [step]);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      setError(null);
      const res = await claimReward(p.rewardId, values);
      if (!res.ok) return setError(res);
      toTop();
      router.refresh();
    });
  };
  const bad = (f: string) => error?.field === f;

  if (step === 1)
    return (
      <div ref={top} className="scroll-mt-24">
        <section className={card}>
          <StepLabel n={1}>{t("monthlyReward.page.step1")}</StepLabel>
          <img src={p.images.square} alt={p.cardAlt} width={1080} height={1080} className={cx("aspect-square w-full rounded-[20px] object-cover", p.kind === "smartphone" ? "bg-[#8B0000]" : "bg-[#FFDF9C]")} />
          <h1 className="m-0 text-[26px] font-semibold leading-[1.1] tracking-[-0.035em]">
            {p.title}
            <br />
            {p.title2}
          </h1>
          <p className="m-0 text-[16px] text-[#5F626B]">{p.lead}</p>
          <dl className="m-0 flex flex-wrap gap-2">
            {p.stats.map((s) => (
              <div key={s.label} className="flex flex-[1_1_130px] flex-col-reverse gap-0.5 rounded-[14px] bg-[#F4F5F7] px-3.5 py-3">
                <dt className="text-[13.5px] font-bold text-[#5F626B]">{s.label}</dt>
                <dd className="lc-d m-0 text-[21px] font-semibold tracking-[-0.02em]">{s.value}</dd>
              </div>
            ))}
          </dl>
          {p.closed ? (
            <p className="m-0 rounded-xl bg-[#FBECEB] px-3.5 py-3 text-[15px] font-semibold text-[#8B0000]">{t("monthlyReward.errors.late")}</p>
          ) : (
            <button type="button" className={b1} onClick={() => setStep(2)}>
              {p.claimLabel}
            </button>
          )}
          <CardShare compact images={p.images} pageUrl={p.share.pageUrl} fileName={p.share.fileName} shareText={p.share.shareText} />
        </section>
      </div>
    );

  return (
    <div ref={top} className="scroll-mt-24">
      <form className={card} onSubmit={send} noValidate>
        <StepLabel n={2}>{t("monthlyReward.page.step2")}</StepLabel>
        <h1 className="m-0 text-[26px] font-semibold leading-[1.1] tracking-[-0.035em]">{p.formTitle}</h1>
        <p className="m-0 text-[16px] text-[#5F626B]">{t("monthlyReward.form.lead")}</p>
        <label className={label}>
          {t("monthlyReward.form.name")}
          <input
            className={cx(input, bad("name") && "border-[#B3261E]")}
            type="text"
            autoComplete="name"
            maxLength={80}
            placeholder={t("monthlyReward.form.namePlaceholder")}
            value={values.name}
            onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
            aria-invalid={bad("name") || undefined}
          />
        </label>
        <label className={label}>
          {t("monthlyReward.form.mobile")}
          <input
            className={cx(input, bad("mobile") && "border-[#B3261E]")}
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            maxLength={14}
            placeholder="01XXXXXXXXX"
            value={values.mobile}
            onChange={(e) => setValues((v) => ({ ...v, mobile: e.target.value }))}
            aria-invalid={bad("mobile") || undefined}
          />
          <span className="text-[13.5px] font-medium text-[#5F626B]">{t("monthlyReward.form.mobileHint")}</span>
        </label>
        <label className={label}>
          {t("monthlyReward.form.address")}
          <textarea
            className={cx(input, "resize-y leading-[1.45]", bad("address") && "border-[#B3261E]")}
            rows={4}
            autoComplete="street-address"
            maxLength={400}
            placeholder={t("monthlyReward.form.addressPlaceholder")}
            value={values.address}
            onChange={(e) => setValues((v) => ({ ...v, address: e.target.value }))}
            aria-invalid={bad("address") || undefined}
          />
        </label>
        <label className="flex items-start gap-2.5 text-[15px] font-semibold">
          <input
            type="checkbox"
            className="mt-px size-[22px] flex-none accent-[#8B0000]"
            checked={values.confirm}
            onChange={(e) => setValues((v) => ({ ...v, confirm: e.target.checked }))}
            aria-invalid={bad("confirm") || undefined}
          />
          {t("monthlyReward.form.confirm")}
        </label>
        {error && (
          <p role="alert" className="m-0 rounded-xl bg-[#FBECEB] px-3.5 py-3 text-[15px] font-semibold text-[#8B0000]">
            {t(error.error)}
          </p>
        )}
        <button type="submit" className={b1} disabled={busy}>
          {busy ? t("monthlyReward.form.sending") : t("monthlyReward.form.send")}
        </button>
        <button type="button" className="inline-flex min-h-[50px] w-full items-center justify-center rounded-full bg-[#F4F5F7] px-5 text-[16px] font-bold" onClick={() => (setError(null), setStep(1))}>
          {t("monthlyReward.form.back")}
        </button>
        {p.deadline && <p className="m-0 text-[14px] text-[#5F626B]">{t("monthlyReward.form.deadline", { date: p.deadline })}</p>}
      </form>
    </div>
  );
}
