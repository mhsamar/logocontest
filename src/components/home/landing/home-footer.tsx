import Link from "next/link";
import { getContact } from "@/lib/content/contact";
import { visibleList } from "@/lib/content/lists";
import { setLocale } from "@/lib/i18n/actions";
import { getI18n } from "@/lib/i18n/server";
import { getSettings } from "@/lib/settings";
import { Svg } from "./hero";

const SOCIAL = [
  { key: "social.facebook", name: "Facebook page", icon: <path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.6-1.5h1.5V4.4c-.7-.1-1.5-.2-2.3-.2-2.3 0-3.8 1.4-3.8 3.9v2.4H8v3h2.5V21z" fill="currentColor" /> },
  {
    key: "social.facebook_group",
    name: "Facebook group",
    icon: (
      <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="8" r="3.2" />
        <path d="M3 19a6 6 0 0 1 12 0" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M16.5 14.2A5 5 0 0 1 21 19" />
      </g>
    ),
  },
  {
    key: "social.instagram",
    name: "Instagram",
    icon: (
      <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="4" width="16" height="16" rx="4.5" />
        <circle cx="12" cy="12" r="3.6" />
        <circle cx="16.7" cy="7.3" r=".6" fill="currentColor" />
      </g>
    ),
  },
  {
    key: "social.youtube",
    name: "YouTube",
    icon: (
      <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
        <rect x="3" y="6" width="18" height="12" rx="3.5" />
        <path d="M10.5 9.5l4 2.5-4 2.5z" fill="currentColor" />
      </g>
    ),
  },
  {
    key: "social.linkedin",
    name: "LinkedIn",
    icon: (
      <g fill="currentColor">
        <rect x="4" y="9" width="3.4" height="11" rx=".6" />
        <circle cx="5.7" cy="5.6" r="2" />
        <path d="M10 9h3.2v1.6c.6-1 1.8-1.9 3.6-1.9 3 0 3.6 2 3.6 4.5V20H17v-5.9c0-1.3-.2-2.6-1.8-2.6s-1.9 1.2-1.9 2.5v6H10Z" />
      </g>
    ),
  },
] as const;

/** Home page footer (design file): links from Lists → Footer links, social links and phone from Settings. */
export async function HomeFooter() {
  const { t, locale } = await getI18n();
  const [links, contact, footerLinks] = await Promise.all([getSettings(SOCIAL.map((x) => x.key)), getContact(locale), visibleList("footer_links", locale)]);
  const social = SOCIAL.filter((x) => links[x.key]);
  const year = Number(new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "Asia/Dhaka" }).format(new Date()));
  const columns = (["clients", "designers", "legal"] as const)
    .map((column) => ({ title: t(column === "legal" ? "footer.legal" : `footer.${column}`), links: footerLinks.filter((l) => l.column === column) }))
    .filter((c) => c.links.length > 0);
  const languageButton = (l: "en" | "bn") => (
    <button type="submit" name="locale" value={l} lang={l} aria-current={locale === l ? "true" : undefined} className={locale === l ? "font-semibold text-[var(--lc-ink)]" : "hover:opacity-70"}>
      {t(l === "en" ? "home.landing.english" : "home.landing.bangla")}
    </button>
  );

  return (
    <footer className="overflow-hidden rounded-[32px] bg-white px-10 pt-16">
      <div className="lc-fg mx-auto grid max-w-[1160px] grid-cols-[repeat(auto-fit,minmax(min(100%,170px),1fr))] gap-9 text-base">
        <div className="flex flex-col items-start gap-3.5">
          <p className="lc-d m-0 max-w-[260px] text-xl font-semibold leading-tight tracking-[-0.03em]">{t("footer.blurb")}</p>
          <a href={contact.phoneHref} className="inline-flex min-h-11 items-center gap-2 rounded-[14px] bg-[var(--lc-chip)] px-4 font-bold">
            <Svg d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2C10.3 21 3 13.7 3 6a2 2 0 0 1 2-2z" size={16} stroke="var(--lc-red)" width={2.2} />
            {contact.phone}
          </a>
          {contact.email && (
            <a href={`mailto:${contact.email}`} className="break-all text-[var(--lc-muted)]">
              {contact.email}
            </a>
          )}
          {social.length > 0 && (
            <div className="flex flex-col gap-2.5 pt-2.5">
              <span className="text-[15px] font-bold">{t("footer.social")}</span>
              <div className="flex gap-2">
                {social.map((s) => (
                  <a key={s.key} href={links[s.key]} target="_blank" rel="noopener noreferrer" aria-label={s.name} className="flex h-[46px] w-[46px] items-center justify-center rounded-[14px] bg-[var(--lc-red)] text-white">
                    <svg aria-hidden width="20" height="20" viewBox="0 0 24 24">
                      {s.icon}
                    </svg>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title} className="flex flex-col gap-0.5 text-[var(--lc-muted)]">
            <span className="pb-2 font-bold text-[var(--lc-ink)]">{col.title}</span>
            {col.links.map((l) => (
              <Link key={l.id} href={l.href ?? "/"} className="py-1.5">
                {l.text.label}
              </Link>
            ))}
          </nav>
        ))}
      </div>
      <div className="mx-auto mt-12 flex max-w-[1160px] flex-wrap justify-between gap-x-6 gap-y-2 border-t border-[var(--lc-line-soft)] pt-5 text-[15px] text-[var(--lc-muted)]">
        <span>{t("footer.rights", { year })}</span>
        <form action={setLocale} aria-label={t("home.landing.languages")} className="flex items-center gap-1.5">
          {languageButton("en")}
          <span aria-hidden>·</span>
          {languageButton("bn")}
        </form>
        <span>{t("footer.madeIn")}</span>
      </div>
      <div aria-hidden className="lc-d lc-rv lc-big mb-[-0.16em] mt-7 whitespace-nowrap text-center text-[clamp(54px,14.5vw,212px)] font-semibold leading-[0.82] tracking-[-0.06em] text-[var(--lc-red)]">
        {t("brand.name")}
      </div>
    </footer>
  );
}
