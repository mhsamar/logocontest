import { getI18n } from "@/lib/i18n/server";
import { invitesOpenForClients } from "@/lib/pro/invites-open";
import "./wall.css";

function Check() {
  return (
    <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFE27A" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5l4.2 4.2L19 7" />
    </svg>
  );
}

/**
 * "What if I don't like any of the designs?" (owner, 2026-10-29; Design/logocontest-site/index.html, CLIENT
 * QUESTION): a maroon band with the answer in one line, three ticks and a link down to the Q&A (#faq on the same
 * page). The "Invite Pro designers" tick shows only while clients can really invite them.
 */
export async function AskBand() {
  const [{ t }, invites] = await Promise.all([getI18n(), invitesOpenForClients().catch(() => false)]);
  const ticks = [t("home2.wall.ask.rate"), t("home2.wall.ask.changes"), ...(invites ? [t("home2.wall.ask.invite")] : [])];
  return (
    <section id="dont-like" className="lc-ab" aria-labelledby="lc-ab-title">
      <span className="lc-ab-glow" aria-hidden />
      <div className="lc-ab-row">
        <span className="lc-ab-icon" aria-hidden>
          <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-4-1L3 21l1.9-4.6A8.4 8.4 0 1 1 21 11.5z" />
            <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.5" />
            <path d="M12 16.2h.01" />
          </svg>
        </span>
        <div className="lc-ab-txt">
          <h2 id="lc-ab-title" className="lc-ab-q">
            {t("home2.wall.ask.title")} <span className="lc-ab-tag">{t("home2.wall.ask.tag")}</span>
          </h2>
          <p className="lc-ab-body">{t("home2.wall.ask.body")}</p>
          <ul className="lc-ab-ticks">
            {ticks.map((x) => (
              <li key={x} className="lc-ab-tick">
                <Check />
                {x}
              </li>
            ))}
          </ul>
        </div>
        <a href="#faq" className="lc-ab-cta">
          {t("home2.wall.ask.cta")}
          <span className="lc-ab-go">
            <svg aria-hidden width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </span>
        </a>
      </div>
    </section>
  );
}
