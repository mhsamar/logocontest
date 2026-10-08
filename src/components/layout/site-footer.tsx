import Link from "next/link";
import { Wordmark } from "@/components/ui/logo";
import { setLocale } from "@/lib/i18n/actions";
import { getI18n } from "@/lib/i18n/server";
import { getSettings } from "@/lib/settings";
import { SUPPORT_PHONE, SUPPORT_PHONE_HREF } from "@/lib/site";
import { LEGAL_NAV } from "./nav-items";

const LINK = "inline-flex min-h-10 items-center text-sm text-muted transition-colors hover:text-primary";

// Social icons (owner, 2026-10-08). Links come from settings; an empty link hides its icon.
const SOCIAL = [
  {
    key: "social.facebook",
    name: "Facebook",
    icon: <path d="M14 8.6V11h3l-.5 3H14v8h-3.5v-8H8v-3h2.5V8.3C10.5 5.7 12 4 14.7 4c1 0 2 .1 2.3.2v2.7h-1.6c-1.1 0-1.4.6-1.4 1.7Z" fill="currentColor" />,
  },
  {
    key: "social.facebook_group",
    name: "Facebook group",
    icon: (
      <g fill="currentColor">
        <circle cx="12" cy="8" r="3.2" />
        <path d="M5.5 19.5c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6Z" />
        <circle cx="5.2" cy="9.6" r="2.2" opacity="0.7" />
        <circle cx="18.8" cy="9.6" r="2.2" opacity="0.7" />
        <path d="M1.5 18c0-2.5 1.6-4.2 3.9-4.4-.9 1.2-1.4 2.7-1.4 4.4ZM22.5 18c0-2.5-1.6-4.2-3.9-4.4.9 1.2 1.4 2.7 1.4 4.4Z" opacity="0.7" />
      </g>
    ),
  },
  {
    key: "social.instagram",
    name: "Instagram",
    icon: (
      <g fill="none" stroke="currentColor" strokeWidth="1.9">
        <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
        <circle cx="12" cy="12" r="3.9" />
        <circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" />
      </g>
    ),
  },
  {
    key: "social.youtube",
    name: "YouTube",
    icon: (
      <g>
        <rect x="2.5" y="5.5" width="19" height="13" rx="4" fill="currentColor" />
        <path d="M10 9.2v5.6l5-2.8Z" fill="var(--color-canvas)" />
      </g>
    ),
  },
  {
    key: "social.linkedin",
    name: "LinkedIn",
    icon: <path d="M6.9 8.8H3.6V20h3.3V8.8ZM5.2 3.5a1.9 1.9 0 1 0 0 3.8 1.9 1.9 0 0 0 0-3.8ZM20.4 13.6c0-3-1.6-4.9-4.3-4.9-1.4 0-2.4.8-2.8 1.5V8.8H10V20h3.3v-5.6c0-1.5.6-2.6 2-2.6 1.3 0 1.8 1 1.8 2.6V20h3.3v-6.4Z" fill="currentColor" />,
  },
] as const;

/** Footer on the page background, no separate colour (UI-JOURNEY §1.1, owner 2026-10-08). */
export async function SiteFooter() {
  const [{ t, locale }, links] = await Promise.all([getI18n(), getSettings(SOCIAL.map((x) => x.key))]);
  const year = new Date().getFullYear();
  const social = SOCIAL.filter((x) => links[x.key]);

  const columns: { title: string; links: { href: string; label: string }[] }[] = [
    {
      title: t("footer.clients"),
      links: [
        { href: "/start", label: t("footer.startContest") },
        { href: "/contests", label: t("nav.browse") },
        { href: "/how-it-works", label: t("nav.how") },
      ],
    },
    {
      title: t("footer.designers"),
      links: [
        { href: "/designers/signup", label: t("nav.becomeDesigner") },
        { href: "/how-it-works?for=designers", label: t("footer.howDesigners") },
        { href: "/login?as=designer", label: t("nav.login") },
      ],
    },
    { title: t("footer.legal"), links: LEGAL_NAV.map((item) => ({ href: item.href, label: t(item.label) })) },
  ];

  return (
    <footer className="mt-auto border-t border-line">
      <div className="reveal mx-auto grid max-w-page grid-cols-2 gap-x-6 gap-y-10 px-4 py-12 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="col-span-2 max-w-xs lg:col-span-1">
          <Wordmark />
          <p className="mt-3 text-sm leading-relaxed text-muted">{t("footer.blurb")}</p>
          <a
            href={SUPPORT_PHONE_HREF}
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-surface px-4 text-sm font-semibold text-ink shadow-card ring-1 ring-line transition-colors hover:ring-primary"
          >
            <svg viewBox="0 0 24 24" className="size-4 text-primary" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
            </svg>
            {SUPPORT_PHONE}
          </a>
        </div>
        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <p className="text-sm font-semibold text-ink">{col.title}</p>
            <ul className="mt-2">
              {col.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={LINK}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      {/* Bottom strip, as in the reference: © · language · made in */}
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-page flex-col gap-3 px-4 py-5 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-ink">{t("footer.rights", { year })}</span>
            <span className="text-line" aria-hidden>
              |
            </span>
            <form action={setLocale} className="flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="size-4 text-ink" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                <circle cx="12" cy="12" r="9" />
                <path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3Z" />
              </svg>
              <span className="sr-only">{t("footer.language")}:</span>
              {(["en", "bn"] as const).map((l) =>
                l === locale ? (
                  <span key={l} lang={l} className="font-semibold text-ink" aria-current="true">
                    {l === "en" ? "English" : "বাংলা"}
                  </span>
                ) : (
                  <button key={l} type="submit" name="locale" value={l} lang={l} className="min-h-10 hover:text-primary">
                    {l === "en" ? "English" : "বাংলা"}
                  </button>
                ),
              )}
            </form>
          </div>
          <div className="flex items-center gap-4">
            {social.length > 0 && (
              <ul className="flex items-center gap-1" aria-label={t("footer.social")}>
                {social.map((x) => (
                  <li key={x.key}>
                    <a
                      href={links[x.key]}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={x.name}
                      className="flex size-10 items-center justify-center rounded-full text-ink transition-colors hover:bg-surface hover:text-primary"
                    >
                      <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
                        {x.icon}
                      </svg>
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <span>{t("footer.madeIn")}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
