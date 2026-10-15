/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { pictureUrl } from "@/lib/content/pictures";
import { formatDate } from "@/lib/dates";
import { guideText } from "@/lib/guides/rules";
import type { GuideCard as Card } from "@/lib/guides/queries";
import type { Translate } from "@/lib/i18n/translate";

/** One guide in a list: cover (or the brand colour with a book), group, title, summary and date. */
export function GuideCard({ g, locale, t }: { g: Card; locale: "en" | "bn"; t: Translate }) {
  const x = guideText(g, locale);
  const cover = pictureUrl(g.cover_path);
  return (
    <li className="lc-card lc-sh group flex flex-col overflow-hidden">
      <Link href={`/guides/${g.slug}`} className="flex h-full flex-col">
        <span className="relative block aspect-[16/9] overflow-hidden bg-tint">
          {cover ? (
            <img src={cover} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center bg-[image:var(--gradient-red-dark)]">
              <svg aria-hidden width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="text-white/85 transition-transform duration-500 group-hover:scale-110">
                <path d="M12 6.5C10.5 5 8 4.5 4 4.5v13c4 0 6.5.5 8 2 1.5-1.5 4-2 8-2v-13c-4 0-6.5.5-8 2zM12 6.5v13" />
              </svg>
            </span>
          )}
        </span>
        <span className="flex flex-1 flex-col gap-2 p-5">
          <span className="text-xs font-bold uppercase tracking-[0.12em] text-primary">{t(`guides.categories.${g.category}`)}</span>
          <span lang={x.title.lang} className="text-[19px] font-semibold leading-snug tracking-[-0.015em] text-ink group-hover:text-primary">
            {x.title.text}
          </span>
          <span lang={x.summary.lang} className="line-clamp-3 text-[15px] leading-relaxed text-muted">
            {x.summary.text}
          </span>
          <span className="mt-auto pt-2 text-[13px] text-muted">{formatDate(new Date(g.published_at), locale, "long")}</span>
        </span>
      </Link>
    </li>
  );
}
