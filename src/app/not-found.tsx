import { ButtonLink } from "@/components/ui/button";
import { PageShell, Panel } from "@/components/ui/panel";
import { Arrow } from "@/components/ui/section-heading";
import { getI18n } from "@/lib/i18n/server";

export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <PageShell>
      <Panel className="flex flex-1 flex-col items-center justify-center py-20 text-center">
        <p className="lc-d m-0 bg-[image:var(--gradient-red)] bg-clip-text text-[clamp(96px,16vw,180px)] font-semibold leading-none tracking-[-0.06em] text-transparent">404</p>
        <h1 className="m-0 mt-4 text-[clamp(26px,3vw,36px)] font-semibold tracking-[-0.03em] text-ink">{t("notFound.title")}</h1>
        <p className="m-0 mt-2 max-w-md text-lg text-muted">{t("notFound.body")}</p>
        <ButtonLink href="/" size="lg" className="mt-8">
          {t("notFound.home")} <Arrow />
        </ButtonLink>
      </Panel>
    </PageShell>
  );
}
