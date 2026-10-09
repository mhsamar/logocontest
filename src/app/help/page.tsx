import type { Metadata } from "next";
import Link from "next/link";
import { LiveChatButton } from "@/components/help/live-chat-button";
import { cx } from "@/lib/cx";
import { getI18n } from "@/lib/i18n/server";
import { getSettings } from "@/lib/settings";
import { getContact } from "@/lib/content/contact";
import { liveChatConfig, messengerLink, whatsappLink } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("help.metaTitle"), description: t("help.metaDescription") };
}

const ICONS = {
  chat: (
    <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12ZM8.5 12h.01M12 12h.01M15.5 12h.01" strokeLinecap="round" strokeLinejoin="round" />
  ),
  whatsapp: (
    <>
      <path d="M3.5 20.5l1.3-4.6A8.5 8.5 0 1 1 8 19.3Z" strokeLinejoin="round" />
      <path d="M9 8.5c0 3.6 2.9 6.5 6.5 6.5l1-1.6-2-1-1 1a4.5 4.5 0 0 1-2.4-2.4l1-1-1-2Z" strokeLinejoin="round" />
    </>
  ),
  messenger: (
    <>
      <path d="M12 3C7 3 3 6.7 3 11.3c0 2.6 1.3 4.9 3.3 6.4V21l3-1.7c.9.3 1.8.4 2.7.4 5 0 9-3.7 9-8.4S17 3 12 3Z" strokeLinejoin="round" />
      <path d="M7.5 13.5 10.5 10l2 2 3.5-2.5-3 3.5-2-2Z" strokeLinejoin="round" />
    </>
  ),
  call: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" strokeLinejoin="round" />,
} as const;

const TINT = {
  chat: "from-[#fff0f3] to-[#ffdce4] text-primary",
  whatsapp: "from-[#e7f8f0] to-[#c9efdc] text-[#0f6b45]",
  messenger: "from-[#e8f1ff] to-[#d4e4ff] text-[#1d4ed8]",
  call: "from-[#fff7e0] to-[#ffe6a8] text-[#8a5105]",
} as const;

const CTA = "btn-sheen relative inline-flex min-h-12 w-full items-center justify-center gap-2 overflow-clip rounded-full px-6 font-semibold transition-[background-color,box-shadow,scale] duration-200 active:scale-[0.97]";

// P-14 Help & contact (owner, 2026-10-08): live chat, WhatsApp, Messenger and phone.
export default async function HelpPage() {
  const [{ t, locale }, s] = await Promise.all([getI18n(), getSettings(["contact.whatsapp", "social.facebook", "chat.driver", "chat.tawk_property_id", "chat.tawk_widget_id"])]);
  const contact = await getContact(locale);
  const chat = liveChatConfig({ driver: s["chat.driver"], tawkPropertyId: s["chat.tawk_property_id"], tawkWidgetId: s["chat.tawk_widget_id"] });
  const whatsapp = whatsappLink(s["contact.whatsapp"], t("help.whatsapp.greeting"));
  const messenger = messengerLink(s["social.facebook"]);

  const cards: { key: keyof typeof ICONS; title: string; body: string; action: React.ReactNode }[] = [
    {
      key: "chat",
      title: t("help.chat.title"),
      body: chat.driver === "tawk" ? t("help.chat.body") : t("help.chat.soon"),
      action:
        chat.driver === "tawk" ? (
          <LiveChatButton src={chat.src} label={t("help.chat.start")} loadingLabel={t("help.chat.loading")} />
        ) : (
          <span className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-canvas px-6 font-semibold text-muted ring-1 ring-inset ring-line">
            <span className="size-2 animate-pulse rounded-full bg-primary/60" aria-hidden />
            {t("help.chat.comingSoon")}
          </span>
        ),
    },
    {
      key: "whatsapp",
      title: t("help.whatsapp.title"),
      body: t("help.whatsapp.body", { number: s["contact.whatsapp"] }),
      action: (
        <a href={whatsapp} target="_blank" rel="noopener" className={cx(CTA, "bg-[#128c4b] text-white hover:bg-[#0f6b45] hover:shadow-[0_10px_24px_-10px_rgb(18_140_75/0.7)]")}>
          {t("help.whatsapp.cta")}
        </a>
      ),
    },
    ...(messenger
      ? [
          {
            key: "messenger" as const,
            title: t("help.messenger.title"),
            body: t("help.messenger.body"),
            action: (
              <a href={messenger} target="_blank" rel="noopener" className={cx(CTA, "bg-[#1d4ed8] text-white hover:bg-[#1e40af] hover:shadow-[0_10px_24px_-10px_rgb(29_78_216/0.7)]")}>
                {t("help.messenger.cta")}
              </a>
            ),
          },
        ]
      : []),
    {
      key: "call",
      title: t("help.call.title"),
      body: t("help.call.body"),
      action: (
        <a href={contact.phoneHref} className={cx(CTA, "bg-surface text-ink ring-1 ring-inset ring-line hover:bg-canvas")}>
          {t("help.call.cta", { number: contact.phone })}
        </a>
      ),
    },
  ];

  const quick = [
    { href: "/how-it-works", title: t("help.quick.how"), line: t("help.quick.howLine") },
    { href: "/legal/payment-refund", title: t("help.quick.refund"), line: t("help.quick.refundLine") },
    { href: "/legal/designer-rules", title: t("help.quick.rules"), line: t("help.quick.rulesLine") },
    { href: "/legal/terms", title: t("help.quick.terms"), line: t("help.quick.termsLine") },
  ];

  return (
    <div className="mx-auto w-full max-w-page px-4 pb-16 pt-4">
      <section className="relative animate-rise overflow-clip rounded-[2rem] bg-aurora px-5 py-10 text-center shadow-frame ring-1 ring-white sm:px-8 sm:py-14">
        <span className="pointer-events-none absolute -left-10 -top-12 size-48 animate-float-soft rounded-full bg-[#c9efdc]/60 blur-2xl" aria-hidden />
        <span className="pointer-events-none absolute -bottom-16 right-1/4 size-56 animate-float rounded-full bg-[#ffdce4]/60 blur-3xl" aria-hidden />
        <div className="relative mx-auto max-w-xl">
          <span className="mx-auto flex size-14 animate-float-soft items-center justify-center rounded-2xl bg-gradient-to-br from-ink to-primary-dark text-white shadow-raised">
            <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden>
              {ICONS.chat}
            </svg>
          </span>
          <h1 className="mt-5 text-h1 font-bold tracking-tight text-ink lg:text-4xl">{t("help.title")}</h1>
          <p className="mt-3 text-muted">{t("help.lead")}</p>
        </div>
      </section>

      <ul className={cx("mt-8 grid gap-4 sm:grid-cols-2", cards.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
        {cards.map((c, i) => (
          <li
            key={c.key}
            className="group flex animate-rise flex-col rounded-3xl bg-surface p-5 shadow-card ring-1 ring-line transition-[box-shadow,translate] duration-300 hover:-translate-y-1 hover:shadow-raised"
            style={{ animationDelay: `${120 + i * 80}ms` }}
          >
            <span className={cx("flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br transition-[rotate,scale] duration-300 group-hover:-rotate-6 group-hover:scale-110", TINT[c.key])}>
              <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden>
                {ICONS[c.key]}
              </svg>
            </span>
            <h2 className="mt-4 text-lg font-bold text-ink">{c.title}</h2>
            <p className="mt-1 flex-1 text-sm leading-relaxed text-muted">{c.body}</p>
            <div className="mt-5">{c.action}</div>
          </li>
        ))}
      </ul>

      <section className="mt-12">
        <h2 className="text-h3 font-bold text-ink lg:text-h3-lg">{t("help.quick.title")}</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {quick.map((q) => (
            <li key={q.href} className="reveal">
              <Link href={q.href} className="group flex items-center justify-between gap-4 rounded-2xl bg-surface p-4 shadow-card ring-1 ring-line transition-[box-shadow] duration-300 hover:shadow-raised">
                <span className="min-w-0">
                  <span className="block font-semibold text-ink">{q.title}</span>
                  <span className="block text-sm text-muted">{q.line}</span>
                </span>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-canvas text-primary transition-transform duration-300 group-hover:translate-x-1">
                  <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
