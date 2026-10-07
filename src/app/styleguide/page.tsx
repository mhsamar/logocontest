import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { OtpField, PasswordField, PhoneField, TextField } from "@/components/ui/field";
import { StatusChip, type ChipStatus } from "@/components/ui/status-chip";
import { Stepper } from "@/components/ui/stepper";
import { getI18n } from "@/lib/i18n/server";
import { ModalDemo, ToastDemo } from "./demo";

export const metadata: Metadata = { robots: { index: false } };

const STATUSES: ChipStatus[] = ["draft", "pending_payment", "open", "judging", "winner_selected", "handover", "completed", "no_result", "cancelled", "rejected"];
const SWATCHES = ["primary", "primary-dark", "cream", "accent", "ink", "muted", "line", "surface", "canvas", "success", "danger", "warning", "info"];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line py-8">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
      {children}
    </section>
  );
}

/** Development-only showcase of the shared tokens and components. */
export default async function StyleguidePage() {
  if (process.env.NODE_ENV === "production") notFound();
  const { t } = await getI18n();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="text-h1 font-bold text-ink">{t("styleguide.title")}</h1>
      <p className="mt-1 text-muted">{t("styleguide.intro")}</p>

      <Section title={t("styleguide.colors")}>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {SWATCHES.map((name) => (
            <div key={name} className="text-xs text-muted">
              <div className="h-12 rounded-md ring-1 ring-inset ring-black/5" style={{ background: `var(--color-${name})` }} />
              <div className="mt-1 font-mono">{name}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title={t("styleguide.buttons")}>
        <div className="flex flex-wrap gap-2">
          <Button>{t("styleguide.primary")}</Button>
          <Button variant="secondary">{t("styleguide.secondary")}</Button>
          <Button variant="ghost">{t("styleguide.ghost")}</Button>
          <Button variant="danger">{t("styleguide.danger")}</Button>
          <Button disabled>{t("styleguide.disabled")}</Button>
          <Button loading>{t("common.loading")}</Button>
        </div>
        <div className="mt-3">
          <ButtonLink href="/start" size="lg" block>
            {t("home.cta")}
          </ButtonLink>
        </div>
      </Section>

      <Section title={t("styleguide.inputs")}>
        <div className="grid gap-5">
          <TextField label={t("auth.name.label")} placeholder={t("auth.name.placeholder")} optionalLabel={t("common.optional")} />
          <PhoneField label={t("auth.phone.label")} hint={t("auth.phone.hint")} placeholder={t("auth.phone.placeholder")} />
          <PasswordField label={t("auth.password.label")} showLabel={t("auth.password.show")} hideLabel={t("auth.password.hide")} error={t("styleguide.exampleError")} />
          <OtpField label={t("auth.otp.label")} length={6} />
        </div>
      </Section>

      <Section title={t("styleguide.stepper")}>
        <div className="space-y-6">
          {[1, 3, 8, 11].map((i) => (
            <Stepper key={i} current={i} total={11} label={t("common.stepOf", { current: i, total: 11 })} />
          ))}
        </div>
      </Section>

      <Section title={t("styleguide.chips")}>
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <StatusChip key={s} status={s} label={t(`status.${s}`)} />
          ))}
        </div>
      </Section>

      <Section title={t("styleguide.toast")}>
        <ToastDemo />
      </Section>

      <Section title={t("styleguide.modal")}>
        <ModalDemo />
      </Section>

      <Section title={t("styleguide.emptyState")}>
        <EmptyState
          title={t("styleguide.emptyTitle")}
          body={t("styleguide.emptyBody")}
          action={<ButtonLink href="/start">{t("home.cta")}</ButtonLink>}
        />
      </Section>
    </div>
  );
}
