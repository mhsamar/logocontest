import { ButtonLink } from "@/components/ui/button";
import { getI18n } from "@/lib/i18n/server";

// Placeholder home page using the P-01 hero copy. The full P-01 (seven sections) is Milestone 3.
export default async function HomePage() {
  const { t } = await getI18n();
  return (
    <section className="mx-auto w-full max-w-page px-4 pb-16 pt-12 sm:pt-20">
      <h1 className="max-w-2xl text-h1 font-bold leading-tight tracking-tight text-ink lg:text-h1-lg lg:leading-[1.1]">
        {t("home.title")}
      </h1>
      <p className="mt-4 max-w-xl text-base text-muted sm:text-lg">{t("home.subtitle")}</p>
      <ButtonLink href="/start" size="lg" className="mt-8 w-full sm:w-auto">
        {t("home.cta")}
      </ButtonLink>
      <p className="mt-12 rounded-md border border-dashed border-line bg-surface px-4 py-3 text-sm text-muted">
        {t("home.placeholder")}
      </p>
    </section>
  );
}
