import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge, Chip } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { OtpField, PasswordField, PhoneField, TextField } from "@/components/ui/field";
import { StatusChip, type ChipStatus } from "@/components/ui/status-chip";
import { Card, Panel } from "@/components/ui/panel";
import { Arrow, IconBadge, PageTitle, Pill, SectionHead } from "@/components/ui/section-heading";
import { Stepper } from "@/components/ui/stepper";
import { Svg } from "@/components/ui/svg";
import { getI18n } from "@/lib/i18n/server";
import { ModalDemo, ToastDemo } from "./demo";

export const metadata: Metadata = { robots: { index: false } };

const STATUSES: ChipStatus[] = ["draft", "pending_payment", "open", "judging", "winner_selected", "handover", "completed", "no_result", "cancelled", "rejected"];
const SWATCHES = ["primary", "primary-hi", "primary-deep", "tint", "gold", "ink", "muted", "line", "line-soft", "surface", "canvas", "frame", "chip", "success", "danger", "warning", "info"];

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
          <Button variant="outline">{t("styleguide.outline")}</Button>
          <Button variant="dark">{t("styleguide.dark")}</Button>
          <Button variant="ghost">{t("styleguide.ghost")}</Button>
          <Button variant="danger">{t("styleguide.danger")}</Button>
          <Button disabled>{t("styleguide.disabled")}</Button>
          <Button loading>{t("common.loading")}</Button>
        </div>
        <div className="mt-3">
          <ButtonLink href="/start" size="lg" block>
            {t("home.cta")}
            <Arrow />
          </ButtonLink>
        </div>
      </Section>

      <Section title={t("styleguide.headings")}>
        <div className="space-y-8">
          <SectionHead icon={<Svg d="M13 3L5 13.5h6L10 21l9-11h-6z" size={24} stroke="#FFFFFF" width={2.2} />} lead={t("home.how.titleLead")} accent={t("home.how.titleAccent")} sub={t("home.showcase.subtitle")} />
          <PageTitle pill={t("home.why.eyebrow")} lead={t("home.why.titleLead")} accent={t("home.why.titleAccent")} sub={t("home.subtitle")} />
        </div>
      </Section>

      <Section title={t("styleguide.surfaces")}>
        <div className="space-y-3 rounded-[32px] bg-canvas p-3">
          <Panel className="!py-8">
            <p className="m-0 text-muted">{t("styleguide.panel")}</p>
          </Panel>
          <Card lift className="p-6">
            <p className="m-0 text-muted">{t("styleguide.card")}</p>
          </Card>
        </div>
      </Section>

      <Section title={t("styleguide.badges")}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{t("contest.featured")}</Badge>
          <Badge tone="red">{t("home.card.urgent")}</Badge>
          <Badge tone="gold">{t("home.card.highlighted")}</Badge>
          <Badge tone="orange">{t("home.card.daysLeft", { days: 12 })}</Badge>
          <Badge tone="soonRed">{t("home.card.daysLeft", { days: 3 })}</Badge>
          <Chip tone="tint">{t("wizard.packages.elite.name")}</Chip>
          <Chip tone="ink">{t("wizard.packages.standard.name")}</Chip>
          <Pill>{t("home.faq.eyebrow")}</Pill>
          <IconBadge>
            <Svg d="M5 12.5l4.5 4.5L19 7.5" size={22} stroke="#FFFFFF" />
          </IconBadge>
          <IconBadge dark>
            <Svg d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19zM14 7l3 3" size={22} stroke="#FFFFFF" />
          </IconBadge>
        </div>
      </Section>

      <Section title={t("styleguide.reveal")}>
        <p className="mb-3 text-muted">{t("styleguide.revealBody")}</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <Card key={n} className="lc-rv p-6">
              <p className="m-0 font-semibold">{t("home.landing.step", { n })}</p>
            </Card>
          ))}
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
