import { getI18n } from "@/lib/i18n/server";
import { sizeText, type Answers, type Lang, type ServiceDef } from "@/lib/services/types";
import { answerText } from "./service-answer";

/**
 * A non-logo contest's brief (owner, 2026-10-13): the client's answers to the service's questions, then what the
 * designers must send: the service's instruction, size, image types and final files.
 */
export async function ServiceBrief({ service, answers, full = false }: { service: ServiceDef; answers: Answers; full?: boolean }) {
  const { t, locale } = await getI18n();
  const l = (x: Lang) => (locale === "bn" ? x.bn || x.en : x.en);
  const answered = service.fields.filter((f) => answers[f.key] !== undefined && String(answers[f.key]).length > 0);
  const label = "m-0 text-[13px] font-bold uppercase tracking-[0.05em] text-muted";
  return (
    <div className="lc-card !rounded-[24px] p-5">
      <span className="inline-flex rounded-full bg-tint px-3 py-1 text-[13px] font-bold text-primary">{l(service.name)}</span>
      {answered.length > 0 && (
        <dl className="m-0 mt-4 grid gap-4 sm:grid-cols-2">
          {answered.map((f) => (
            <div key={f.key} className={f.type === "long_text" ? "min-w-0 sm:col-span-2" : "min-w-0"}>
              <dt className={label}>{l(f.label)}</dt>
              <dd className="m-0 mt-1.5 whitespace-pre-line break-words text-[15.5px] leading-relaxed text-ink">
                {f.type === "colours" ? (
                  <span className="flex flex-wrap gap-2">
                    {(answers[f.key] as string[]).map((c) => (
                      <span key={c} className="flex flex-col items-center gap-1">
                        <span className="size-9 rounded-xl shadow-card ring-1 ring-black/10" style={{ background: c }} />
                        <span className="font-mono text-[0.625rem] uppercase text-muted">{c.replace("#", "")}</span>
                      </span>
                    ))}
                  </span>
                ) : f.type === "link" ? (
                  <a href={String(answers[f.key])} target="_blank" rel="noopener noreferrer nofollow" className="break-all font-semibold text-primary underline">
                    {String(answers[f.key])}
                  </a>
                ) : (
                  answerText(f, answers[f.key], l)
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <div className="mt-5 border-t border-line pt-5">
        <p className={label}>{t("services.brief.forDesigners")}</p>
        {l(service.designerInstruction) && <p className="m-0 mt-1.5 whitespace-pre-line text-[15.5px] leading-relaxed text-ink">{l(service.designerInstruction)}</p>}
        <ul className="m-0 mt-3 flex list-none flex-wrap gap-2 p-0 text-[13.5px] font-semibold">
          {sizeText(service) && <li className="rounded-full bg-frame px-3 py-1">{t("services.brief.size", { size: sizeText(service) })}</li>}
          <li className="rounded-full bg-frame px-3 py-1">{t("services.brief.upload", { types: service.entryTypes.join(", ").toUpperCase(), n: service.maxImages, mb: service.maxMb })}</li>
          {full && <li className="rounded-full bg-frame px-3 py-1">{t("services.brief.final", { types: service.finalTypes.join(", ").toUpperCase() })}</li>}
        </ul>
      </div>
    </div>
  );
}
