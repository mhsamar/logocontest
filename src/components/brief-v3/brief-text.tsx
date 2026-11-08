import { briefLines, linkParts } from "@/lib/brief-v3/rules";
import { cx } from "@/lib/cx";

/**
 * A brief as plain text (owner, 2026-11-08): line breaks kept, a line that starts with one of the 9 headings shows it
 * in bold red, and web addresses are links. Never HTML: the text is shown as text, so nothing in it can run.
 */
export function BriefText({ text, small, links = true }: { text: string; small?: boolean; links?: boolean }) {
  return (
    <div className={cx("b3-txt", small && "sm")} lang="bn">
      {briefLines(text).map((line, i) => (
        <p key={i}>
          {line.heading && <span className="b3-h">{line.heading}:</span>}
          {line.heading && " "}
          {links
            ? linkParts(line.text).map((part, j) =>
                part.href ? (
                  <a key={j} href={part.href} target="_blank" rel="nofollow ugc noopener noreferrer">
                    {part.text}
                  </a>
                ) : (
                  <span key={j}>{part.text}</span>
                ),
              )
            : line.text}
        </p>
      ))}
    </div>
  );
}
