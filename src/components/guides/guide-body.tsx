/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { guideImageOk, parseBody, type Inline } from "@/lib/guides/rules";

/**
 * A guide's text on the page (owner, 2026-10-15). Used by the guide page and the editor's preview, so it has no
 * server-only parts. Only the simple marks in lib/guides/rules.ts are shown; anything else stays plain text.
 */

function Parts({ parts }: { parts: Inline[] }) {
  return (
    <>
      {parts.map((p, i) =>
        p.kind === "bold" ? (
          <strong key={i} className="font-semibold text-ink">
            {p.text}
          </strong>
        ) : p.kind === "link" ? (
          p.href.startsWith("/") ? (
            <Link key={i} href={p.href} className="font-semibold text-primary underline-offset-2 hover:underline">
              {p.text}
            </Link>
          ) : (
            // Links to other sites: no ranking passed on (Google's guidance for links an owner doesn't vouch for).
            <a key={i} href={p.href} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold text-primary underline-offset-2 hover:underline">
              {p.text}
            </a>
          )
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

export function GuideBody({ body, lang }: { body: string; lang?: "en" | "bn" }) {
  const blocks = parseBody(body, guideImageOk(process.env.NEXT_PUBLIC_SUPABASE_URL));
  return (
    <div lang={lang} className="space-y-4 text-[17px] leading-[1.75] text-ink/90">
      {blocks.map((b, i) =>
        b.kind === "h2" ? (
          <h2 key={i} id={b.id} className="m-0 scroll-mt-32 pt-4 text-[24px] font-semibold leading-tight tracking-[-0.02em] text-ink">
            {b.text}
          </h2>
        ) : b.kind === "h3" ? (
          <h3 key={i} id={b.id} className="m-0 scroll-mt-32 pt-2 text-[19px] font-semibold leading-snug text-ink">
            {b.text}
          </h3>
        ) : b.kind === "p" ? (
          <p key={i} className="m-0">
            <Parts parts={b.parts} />
          </p>
        ) : b.kind === "img" ? (
          <figure key={i} className="m-0 py-2">
            <img src={b.src} alt={b.alt} loading="lazy" className="w-full rounded-[20px] border border-line bg-chip" />
            {b.alt && <figcaption className="mt-2 text-center text-sm text-muted">{b.alt}</figcaption>}
          </figure>
        ) : b.kind === "ul" ? (
          <ul key={i} className="m-0 list-none space-y-2 p-0">
            {b.items.map((item, j) => (
              <li key={j} className="flex gap-3">
                <span className="mt-[0.7em] size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                <span>
                  <Parts parts={item} />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <ol key={i} className="m-0 list-none space-y-2.5 p-0">
            {b.items.map((item, j) => (
              <li key={j} className="flex gap-3">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-tint text-sm font-bold text-primary tabular-nums">{j + 1}</span>
                <span>
                  <Parts parts={item} />
                </span>
              </li>
            ))}
          </ol>
        ),
      )}
    </div>
  );
}
