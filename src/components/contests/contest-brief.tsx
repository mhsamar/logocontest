import { StyleExamples } from "@/components/wizard/style-art";
import type { ContestDetail } from "@/lib/contests/browse";
import { STYLE_SLIDERS } from "@/lib/contests/brief";
import { cx } from "@/lib/cx";
import { getI18n } from "@/lib/i18n/server";

function Block({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cx("rounded-lg bg-surface p-5 ring-1 ring-line", className)}>
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">{title}</h3>
      <div className="mt-3 text-ink">{children}</div>
    </section>
  );
}

/** P-03 Brief tab. Only rendered for viewers allowed to read the brief. */
export async function ContestBrief({ brief }: { brief: NonNullable<ContestDetail["brief"]> }) {
  const { t } = await getI18n();
  const facts = [
    brief.logoText && { label: t("contest.brief.logoText"), value: brief.logoText },
    brief.slogan && { label: t("contest.brief.slogan"), value: brief.slogan },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* The description itself is in the page header. */}
      {(facts.length > 0 || brief.websiteUrl) && (
        <Block title={t("contest.brief.about")} className="lg:col-span-2">
          <dl className="grid gap-3 sm:grid-cols-3">
            {facts.map((f) => (
              <div key={f.label}>
                <dt className="text-xs text-muted">{f.label}</dt>
                <dd className="mt-0.5 font-medium">{f.value}</dd>
              </div>
            ))}
            {brief.websiteUrl && (
              <div className="min-w-0">
                <dt className="text-xs text-muted">{t("contest.brief.website")}</dt>
                <dd className="mt-0.5 truncate font-medium">
                  <a href={brief.websiteUrl} target="_blank" rel="nofollow noopener noreferrer" className="text-primary underline">
                    {brief.websiteUrl.replace(/^https?:\/\//, "")}
                  </a>
                </dd>
              </div>
            )}
          </dl>
        </Block>
      )}

      {brief.styles.length > 0 && (
        <Block title={t("contest.brief.styles")}>
          <ul className="grid grid-cols-2 gap-3">
            {brief.styles.map((s) => (
              <li key={s} className="rounded-md bg-canvas p-3 text-center">
                <StyleExamples style={s} />
                <p className="mt-2 text-sm font-medium">{t(`wizard.styles.${s}`)}</p>
              </li>
            ))}
          </ul>
        </Block>
      )}

      <Block title={t("contest.brief.feel")}>
        <ul className="space-y-4">
          {STYLE_SLIDERS.map((key) => {
            const value = brief.sliders[key] ?? 3;
            return (
              <li key={key}>
                <div className="flex justify-between text-sm">
                  <span className={value <= 2 ? "font-semibold" : "text-muted"}>{t(`wizard.sliders.${key}.left`)}</span>
                  <span className={value >= 4 ? "font-semibold" : "text-muted"}>{t(`wizard.sliders.${key}.right`)}</span>
                </div>
                <div className="mt-2 flex gap-1.5" aria-hidden>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span key={n} className={cx("h-2 flex-1 rounded-full", n === value ? "bg-primary" : "bg-line")} />
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      </Block>

      <Block title={t("contest.brief.colors")}>
        {brief.colors.length > 0 && (
          <ul className="flex flex-wrap gap-3">
            {brief.colors.map((hex) => (
              <li key={hex} className="flex items-center gap-2">
                <span className="size-9 rounded-md ring-1 ring-inset ring-black/10" style={{ background: hex }} aria-hidden />
                <span className="font-mono text-sm uppercase">{hex}</span>
              </li>
            ))}
          </ul>
        )}
        {(brief.letDesignersChoose || brief.colors.length === 0) && (
          <p className={cx("text-sm text-muted", brief.colors.length > 0 && "mt-3")}>{t("contest.brief.designersChoose")}</p>
        )}
      </Block>

      {brief.usedOn.length > 0 && (
        <Block title={t("contest.brief.usedOn")}>
          <ul className="flex flex-wrap gap-2">
            {brief.usedOn.map((u) => (
              <li key={u} className="rounded-full bg-cream/60 px-3 py-1 text-sm font-medium text-primary-dark">
                {t(`wizard.usedOn.${u}`)}
              </li>
            ))}
          </ul>
        </Block>
      )}

      <Block title={t("contest.brief.likes")}>
        <p className="whitespace-pre-line leading-relaxed">{brief.likes}</p>
      </Block>

      {brief.dislikes && (
        <Block title={t("contest.brief.dislikes")}>
          <p className="whitespace-pre-line leading-relaxed">{brief.dislikes}</p>
        </Block>
      )}

      {brief.files.length > 0 && (
        <Block title={t("contest.brief.files")} className="lg:col-span-2">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {brief.files.map((f) => (
              <li key={f.name}>
                <a
                  href={f.url ?? undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t("contest.brief.openFile", { name: f.name })}
                  className="block overflow-hidden rounded-md bg-canvas ring-1 ring-line hover:ring-primary"
                >
                  {f.isImage && f.url ? (
                    // Signed, short-lived storage URL, so next/image's optimiser can't cache it.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.url} alt="" className="aspect-square w-full object-contain p-2" loading="lazy" />
                  ) : (
                    <span className="flex aspect-square items-center justify-center text-sm font-semibold text-muted">PDF</span>
                  )}
                  <span className="block truncate border-t border-line bg-surface px-2 py-1.5 text-xs text-muted">{f.name}</span>
                </a>
              </li>
            ))}
          </ul>
        </Block>
      )}
    </div>
  );
}
