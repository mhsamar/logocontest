"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/client";
import { saveContestInvites } from "@/lib/pro/invite-actions";
import type { InviteCandidate } from "@/lib/pro/invites";
import { Icon, ProAvatar, ProBadge } from "./parts";

type Sort = "match" | "rating" | "winRate" | "wins";
const RATINGS = [0, 4, 4.5] as const;
const PAGE = 12;

/**
 * Contest creation, "Invite Pro designers" (owner, 2026-10-13; Design/pro/client-invite-pro-designers.html): ranked
 * Pro designers with filters, Invite / Invited, the counter, and Send invites & continue (or Skip). Optional.
 */
export function InvitePicker({
  contestId,
  list,
  sent,
  max,
  skills,
  types,
  next,
}: {
  contestId: string;
  list: InviteCandidate[];
  sent: string[];
  max: number;
  skills: { key: string; label: string }[];
  types: { key: string; label: string }[];
  next: string;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>(list.filter((d) => d.invited).map((d) => d.id));
  const [sort, setSort] = useState<Sort>("match");
  const [skill, setSkill] = useState<string[]>([]);
  const [type, setType] = useState<string[]>([]);
  const [minRating, setMinRating] = useState<number>(0);
  const [active, setActive] = useState(false);
  const [q, setQ] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const n = (v: number) => new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US", { maximumFractionDigits: 1 }).format(v);
  const date = (iso: string) => new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { month: "short", year: "numeric" }).format(new Date(iso));

  const filtered = useMemo(() => {
    const words = q.trim().toLowerCase();
    const label = new Map(skills.map((s) => [s.key, s.label.toLowerCase()]));
    const out = list.filter(
      (d) =>
        (!words || d.name.toLowerCase().includes(words) || (d.username ?? "").includes(words) || d.skills.some((s) => (label.get(s) ?? s).includes(words))) &&
        skill.every((s) => d.skills.includes(s)) &&
        (type.length === 0 || type.some((x) => d.types.includes(x))) &&
        (minRating === 0 || (d.rating ?? 0) >= minRating) &&
        (!active || d.activeThisWeek),
    );
    const by: Record<Sort, (a: InviteCandidate, b: InviteCandidate) => number> = {
      match: (a, b) => b.score - a.score,
      rating: (a, b) => (b.rating ?? 0) - (a.rating ?? 0),
      winRate: (a, b) => b.winRate - a.winRate,
      wins: (a, b) => b.wins - a.wins,
    };
    return out.sort(by[sort]);
  }, [list, q, skill, type, minRating, active, sort, skills]);

  const room = max - picked.length;
  const flip = (id: string) => setPicked((p) => (p.includes(id) ? (sent.includes(id) ? p : p.filter((x) => x !== id)) : p.length >= max ? p : [...p, id]));
  const send = () =>
    start(async () => {
      setError(null);
      const res = await saveContestInvites(contestId, picked);
      if (!res.ok) return setError(t(res.error, res.params));
      router.push(next);
    });
  const reset = () => {
    setSort("match");
    setSkill([]);
    setType([]);
    setMinRating(0);
    setActive(false);
    setQ("");
  };
  const toggle = (arr: string[], set: (v: string[]) => void, v: string) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const label = new Map(skills.map((s) => [s.key, s.label]));

  return (
    <>
      <div className="iv-w">
        <aside className="pr-card iv-f">
          <div className="pr-ch" style={{ marginBottom: 0 }}>
            <h2>{t("pro.invite.filters")}</h2>
            <button type="button" className="pr-link" style={{ border: 0, background: "none", cursor: "pointer" }} onClick={reset}>
              {t("pro.invite.reset")}
            </button>
          </div>
          <span className="lbl">{t("pro.invite.sortBy")}</span>
          <div className="iv-radios" role="radiogroup" aria-label={t("pro.invite.sortBy")}>
            {(["match", "rating", "winRate", "wins"] as const).map((s) => (
              <label key={s}>
                <input type="radio" name="iv-sort" checked={sort === s} onChange={() => setSort(s)} />
                {t(`pro.invite.sort.${s}`)}
              </label>
            ))}
          </div>
          {skills.length > 0 && (
            <>
              <span className="lbl">{t("pro.invite.skills")}</span>
              <div className="iv-chips">
                {skills.map((s) => (
                  <button key={s.key} type="button" aria-pressed={skill.includes(s.key)} onClick={() => toggle(skill, setSkill, s.key)}>
                    {s.label}
                  </button>
                ))}
              </div>
            </>
          )}
          {types.length > 0 && (
            <>
              <span className="lbl">{t("pro.invite.industries")}</span>
              <div className="iv-chips">
                {types.map((s) => (
                  <button key={s.key} type="button" aria-pressed={type.includes(s.key)} onClick={() => toggle(type, setType, s.key)}>
                    {s.label}
                  </button>
                ))}
              </div>
            </>
          )}
          <span className="lbl">{t("pro.invite.minRating")}</span>
          <div className="iv-chips">
            {RATINGS.map((r) => (
              <button key={r} type="button" aria-pressed={minRating === r} onClick={() => setMinRating(r)}>
                {r === 0 ? t("pro.invite.anyRating") : t("pro.invite.andUp", { n: n(r) })}
              </button>
            ))}
          </div>
          <div className="pr-row-tg">
            <span>{t("pro.invite.activeWeek")}</span>
            <button type="button" role="switch" aria-checked={active} aria-label={t("pro.invite.activeWeek")} className="pr-toggle" onClick={() => setActive((v) => !v)} />
          </div>
          <div className="iv-how">
            <b>{t("pro.invite.how")}</b>
            <ul>
              <li>{t("pro.invite.h1")}</li>
              <li>{t("pro.invite.h2")}</li>
              <li>{t("pro.invite.h3")}</li>
              <li>{t("pro.invite.h4")}</li>
              <li>{t("pro.invite.h5")}</li>
            </ul>
            <em>{t("pro.invite.onlyPro")}</em>
          </div>
        </aside>
        <div>
          <div className="iv-top">
            <label className="pr-search">
              <Icon name="search" />
              <input value={q} onChange={(e) => setQ(e.target.value.slice(0, 40))} placeholder={t("pro.invite.search")} aria-label={t("pro.invite.search")} />
            </label>
            <span className="pr-mut">{filtered.length === 1 ? t("pro.invite.matchOne") : t("pro.invite.match", { n: n(filtered.length) })}</span>
          </div>
          {filtered.length === 0 ? (
            <p className="pr-empty">{t("pro.invite.noneMatch")}</p>
          ) : (
            <div className="iv-g">
              {filtered.slice(0, shown).map((d, i) => {
                const on = picked.includes(d.id);
                const locked = sent.includes(d.id);
                return (
                  <article key={d.id} className={`iv-d${on ? " on" : ""}`}>
                    <div className="iv-h">
                      <ProAvatar name={d.name} url={d.avatarUrl} />
                      <div className="iv-n">
                        <div>
                          <b>{d.name}</b>
                          <ProBadge size="sm" />
                          {sort === "match" && i === 0 && <span className="iv-tag">{t("pro.invite.topMatch")}</span>}
                          {d.replyMinutes !== null && d.replyMinutes <= 60 && <span className="iv-tag">{t("pro.invite.fastReply")}</span>}
                        </div>
                        <em>{d.username ? t("pro.invite.since", { username: d.username, date: date(d.proSince) }) : t("pro.invite.sinceNoUser", { date: date(d.proSince) })}</em>
                      </div>
                      <span className="iv-m">
                        <b>{t("pro.invite.matchPct", { n: n(d.score) })}</b>
                        <em>{t("pro.invite.matchWord")}</em>
                      </span>
                    </div>
                    <div className="iv-st">
                      <span>{d.rating === null ? t("pro.invite.noRating") : <b>{t("pro.invite.rating", { n: n(d.rating) })}</b>}</span>
                      <span>
                        <b>{t("pro.invite.winRate", { n: n(d.winRate) })}</b>
                      </span>
                      <span>
                        <b>{t("pro.invite.wins", { n: n(d.wins) })}</b>
                      </span>
                    </div>
                    {d.skills.length > 0 && (
                      <div className="iv-sk">
                        {d.skills.slice(0, 4).map((s) => (
                          <em key={s}>{label.get(s) ?? s}</em>
                        ))}
                      </div>
                    )}
                    <div className="iv-a">
                      {d.username ? (
                        <Link href={`/designer/${d.username}`} target="_blank" className="pr-out sm">
                          {t("pro.invite.viewProfile")}
                        </Link>
                      ) : (
                        <span />
                      )}
                      <button type="button" className="iv-btn" aria-pressed={on} disabled={locked || (!on && room <= 0)} onClick={() => flip(d.id)}>
                        {on ? `✓ ${t("pro.invite.invited")}` : t("pro.invite.invite")}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          {filtered.length > shown && (
            <button type="button" className="pr-out" style={{ marginTop: 14 }} onClick={() => setShown((s) => s + PAGE)}>
              {t("pro.invite.more")}
            </button>
          )}
        </div>
      </div>
      <div className="iv-bar">
        <div>
          <b>{t("pro.invite.picked", { n: n(picked.length), max: n(max) })}</b>
          <em>{t("pro.invite.pickedLead")}</em>
        </div>
        {error && (
          <p className="ck-err" role="alert">
            {error}
          </p>
        )}
        <Link href={next} className="pr-out">
          {t("pro.invite.skip")}
        </Link>
        <button type="button" className="pr-btn" onClick={send} disabled={busy || picked.length === 0}>
          {busy ? t("pro.invite.sending") : t("pro.invite.send")}
        </button>
      </div>
    </>
  );
}
