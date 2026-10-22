"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/translate";
import { adminCancelTrial, adminExtendTrial, adminRemoveInvite, adminStartTrial, grantProByUsername, manageProMember, remindProClicker, saveProSettings, searchProDesigners, setProAutoRemind, setProForSale, type ProSettingsInput } from "@/lib/pro/admin-actions";
import type { ProFeature } from "@/lib/pro/rules";

/** "Pro plan for sale" — the master switch, saved at once. */
export function MasterSwitch({ on: initial, canManage }: { on: boolean; canManage: boolean }) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [busy, start] = useTransition();
  return (
    <div className={`ap-master${on ? " on" : ""}`}>
      <div>
        <b>{t("pro.admin.master")}</b>
        <em>{t("pro.admin.masterLead")}</em>
      </div>
      <b style={{ color: on ? "#14633C" : "#6A6D76" }}>{on ? t("pro.admin.on") : t("pro.admin.off")}</b>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={t("pro.admin.master")}
        className="ap-sw"
        disabled={!canManage || busy}
        onClick={() =>
          start(async () => {
            const next = !on;
            setOn(next);
            const res = await setProForSale(next);
            if (!res.ok) {
              setOn(!next);
              return toast(t(res.error, res.params), "danger");
            }
            toast(t("pro.admin.saved"));
            router.refresh();
          })
        }
      />
    </div>
  );
}

type Form = Omit<ProSettingsInput, "offerStartsAt" | "offerEndsAt"> & { offerStartsAt: string; offerEndsAt: string };

const FEATURE_ROWS: { f: ProFeature; title: string; sub: string; value?: "early" | "invites" }[] = [
  { f: "early_access", title: "pro.admin.fEarly", sub: "pro.admin.fEarlySub", value: "early" },
  { f: "highlighted_entries", title: "pro.admin.fHighlight", sub: "pro.admin.fHighlightSub" },
  { f: "client_chat", title: "pro.admin.fChat", sub: "pro.admin.fChatSub" },
  { f: "invitations", title: "pro.admin.fInvites", sub: "pro.admin.fInvitesSub", value: "invites" },
  { f: "insights", title: "pro.admin.fInsights", sub: "pro.admin.fInsightsSub" },
  { f: "priority_support", title: "pro.admin.fSupport", sub: "pro.admin.fSupportSub" },
  { f: "floating_card", title: "pro.admin.fCard", sub: "pro.admin.fCardSub" },
  { f: "show_contact_on_profile", title: "pro.admin.fContact", sub: "pro.admin.fContactSub" },
  { f: "hidden_entries", title: "pro.admin.fHidden", sub: "pro.admin.fHiddenSub" },
];

const QUICK = [300, 400, 500, 600];

/** Plan settings: price (+ quick buttons), offer, trial, promo code, limits, feature switches. Save / Undo. */
export function PlanSettings({ initial, canManage }: { initial: Form; canManage: boolean }) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [f, setF] = useState<Form>(initial);
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const dirty = JSON.stringify(f) !== JSON.stringify(initial);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  const num = (v: string) => (v === "" ? 0 : Math.round(Number(v)));
  const field = (k: keyof Form, label: string, unit?: string, opts?: { nullable?: boolean; placeholder?: string }) => (
    <label className="ap-f">
      <span>{label}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input
          type="number"
          inputMode="numeric"
          value={f[k] === null ? "" : String(f[k])}
          placeholder={opts?.placeholder}
          disabled={!canManage}
          onChange={(e) => set(k, (opts?.nullable && e.target.value === "" ? null : num(e.target.value)) as never)}
        />
        {unit && <em style={{ fontStyle: "normal", fontSize: 12.5, whiteSpace: "nowrap" }}>{unit}</em>}
      </span>
    </label>
  );
  const save = () =>
    start(async () => {
      setError(null);
      const res = await saveProSettings({
        ...f,
        offerStartsAt: f.offerStartsAt ? new Date(f.offerStartsAt).toISOString() : null,
        offerEndsAt: f.offerEndsAt ? new Date(f.offerEndsAt).toISOString() : null,
        promoCode: f.promoCode?.trim() || null,
      });
      if (!res.ok) return setError(t(res.error, res.params));
      toast(t("pro.admin.saved"));
      router.refresh();
    });

  return (
    <section className="ap-c" aria-labelledby="ap-settings">
      <div className="ap-h">
        <div>
          <h2 id="ap-settings">{t("pro.admin.settings")}</h2>
          <p>{t("pro.admin.settingsLead")}</p>
        </div>
        {canManage && (
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="ap-btn ghost" disabled={!dirty || busy} onClick={() => setF(initial)}>
              {t("pro.admin.undo")}
            </button>
            <button type="button" className="ap-btn" disabled={!dirty || busy} onClick={save}>
              {t("pro.admin.save")}
            </button>
          </div>
        )}
      </div>
      {error && (
        <p className="ap-err" role="alert">
          {error}
        </p>
      )}
      <div className="ap-g2">
        <div className="ap-col">
          <div className="ap-price">
            <span className="ap-l">{t("pro.admin.price")}</span>
            <div className="ap-pi">
              <span>৳</span>
              <input type="number" inputMode="numeric" value={f.priceBdt} disabled={!canManage} onChange={(e) => set("priceBdt", num(e.target.value))} aria-label={t("pro.admin.price")} />
              <span>{t("pro.admin.perMonth")}</span>
            </div>
            <div className="ap-q">
              {QUICK.map((p) => (
                <button key={p} type="button" className={f.priceBdt === p ? "on" : undefined} disabled={!canManage} onClick={() => set("priceBdt", p)}>
                  ৳{p}
                </button>
              ))}
            </div>
            <small>{t("pro.admin.priceNote")}</small>
          </div>
          <div className="ap-box">
            <div className="ap-boxh">
              <b>{t("pro.admin.offer")}</b>
              <button type="button" role="switch" aria-checked={f.offerEnabled} aria-label={t("pro.admin.offer")} className="ap-sw" disabled={!canManage} onClick={() => set("offerEnabled", !f.offerEnabled)} />
            </div>
            <div className="ap-f2">
              {field("offerPriceBdt", t("pro.admin.offerPrice"), t("pro.admin.firstMonth"), { nullable: true })}
              <label className="ap-f">
                <span>{t("pro.admin.audience")}</span>
                <select value={f.offerAudience} disabled={!canManage} onChange={(e) => set("offerAudience", e.target.value === "all" ? "all" : "new")}>
                  <option value="new">{t("pro.admin.audienceNew")}</option>
                  <option value="all">{t("pro.admin.audienceAll")}</option>
                </select>
              </label>
            </div>
            <div className="ap-f2">
              <label className="ap-f">
                <span>{t("pro.admin.starts")}</span>
                <input type="datetime-local" value={f.offerStartsAt} disabled={!canManage} onChange={(e) => set("offerStartsAt", e.target.value)} />
              </label>
              <label className="ap-f">
                <span>{t("pro.admin.ends")}</span>
                <input type="datetime-local" value={f.offerEndsAt} disabled={!canManage} onChange={(e) => set("offerEndsAt", e.target.value)} />
              </label>
            </div>
            <div className="ap-f2">
              <label className="ap-f">
                <span>{t("pro.admin.promo")}</span>
                <input value={f.promoCode ?? ""} disabled={!canManage} placeholder="EID26" onChange={(e) => set("promoCode", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20))} />
              </label>
            </div>
            {f.promoCode ? <div className="ap-f2">{field("promoPriceBdt", t("pro.admin.promoPrice"), "৳", { nullable: true })}</div> : null}
          </div>
          {/* 3-day free Pro Trial (owner, 2026-10-14): replaces the old checkout trial days. */}
          <div className="ap-box">
            <div className="ap-boxh">
              <div>
                <b>{t("pro.trial.admin.switchTitle")}</b>
                <em style={{ display: "block", fontStyle: "normal", fontSize: 12.5 }}>{t("pro.trial.admin.switchSub")}</em>
              </div>
              <button type="button" role="switch" aria-checked={f.freeTrialEnabled} aria-label={t("pro.trial.admin.switchTitle")} className="ap-sw" disabled={!canManage} onClick={() => set("freeTrialEnabled", !f.freeTrialEnabled)} />
            </div>
            <div className="ap-f3">
              {field("freeTrialDays", t("pro.trial.admin.days"), t("pro.admin.days"))}
              {field("trialLogoChecks", t("pro.trial.admin.checks"), t("pro.trial.admin.perTrial"))}
              {field("trialPortfolioLimit", t("pro.trial.admin.slots"), t("pro.trial.admin.perTrial"))}
            </div>
          </div>
          <div className="ap-box">
            <span className="ap-l">{t("pro.admin.limits")}</span>
            <div className="ap-f3">
              {field("proLogoChecks", t("pro.admin.proChecks"), t("pro.admin.perMonth"))}
              {field("basicLogoChecks", t("pro.admin.basicChecks"), t("pro.admin.perMonth"))}
              {field("checkLowMax", t("pro.admin.lowMax"), "%")}
              {field("checkMediumMax", t("pro.admin.mediumMax"), "%")}
              {field("proPortfolioLimit", t("pro.admin.proSlots"), t("pro.admin.designs"))}
              {field("proEntriesPerContest", t("pro.admin.proEntries"), undefined, { nullable: true, placeholder: t("pro.admin.unlimited") })}
              {field("basicEntriesPerContest", t("pro.admin.basicEntries"))}
              {field("invitesPerContest", t("pro.admin.invites"), t("pro.admin.designers"))}
            </div>
            <p className="ap-hint" style={{ margin: "10px 0 0" }}>
              {t("pro.admin.levelsNote", { low: f.checkLowMax, mid1: f.checkLowMax + 1, mid: f.checkMediumMax, high: f.checkMediumMax + 1 })}
            </p>
          </div>
        </div>
        <div className="ap-col">
          <span className="ap-l">{t("pro.admin.features")}</span>
          <div>
            {FEATURE_ROWS.map((r) => (
              <div key={r.f} className="ap-ft">
                <div>
                  <b>{t(r.title as never)}</b>
                  <em>{t(r.sub as never)}</em>
                </div>
                {r.value === "early" && (
                  <span className="v">
                    <input type="number" inputMode="numeric" value={f.earlyAccessMinutes} disabled={!canManage} onChange={(e) => set("earlyAccessMinutes", num(e.target.value))} aria-label={t("pro.admin.headStart")} />
                    {t("pro.admin.headStart")}
                  </span>
                )}
                {r.value === "invites" && (
                  <span className="v">
                    {f.invitesPerContest} {t("pro.admin.designers")}
                  </span>
                )}
                <button
                  type="button"
                  role="switch"
                  aria-checked={f.features[r.f]}
                  aria-label={t(r.title as never)}
                  className="ap-sw"
                  disabled={!canManage}
                  onClick={() => set("features", { ...f.features, [r.f]: !f.features[r.f] } as Record<ProFeature, boolean>)}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/** "Remind" in Clicked but did not buy. */
export function RemindButton({ designerId, canManage }: { designerId: string; canManage: boolean }) {
  const { t } = useI18n();
  const toast = useToast();
  const [done, setDone] = useState(false);
  const [busy, start] = useTransition();
  return (
    <button
      type="button"
      className="ap-btn ghost sm"
      disabled={!canManage || busy || done}
      onClick={() =>
        start(async () => {
          const res = await remindProClicker(designerId);
          if (!res.ok) return toast(t(res.error, res.params), "danger");
          setDone(true);
          toast(t("pro.admin.reminded"));
        })
      }
    >
      {done ? t("pro.admin.reminded") : t("pro.admin.remind")}
    </button>
  );
}

export function AutoRemindToggle({ on: initial, canManage }: { on: boolean; canManage: boolean }) {
  const { t } = useI18n();
  const toast = useToast();
  const [on, setOn] = useState(initial);
  const [busy, start] = useTransition();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={t("pro.admin.autoRemind")}
      className="ap-sw"
      disabled={!canManage || busy}
      onClick={() =>
        start(async () => {
          const next = !on;
          setOn(next);
          const res = await setProAutoRemind(next);
          if (!res.ok) {
            setOn(!next);
            toast(t(res.error, res.params), "danger");
          }
        })
      }
    />
  );
}

/** Manage one member: extend 7 days, a free month, a new end date, or cancel. */
export function ManageMember({ designerId, name, status, canManage }: { designerId: string; name: string; status: string; canManage: boolean }) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [end, setEnd] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const run = (action: "extend" | "free_month" | "set_end" | "cancel") =>
    start(async () => {
      setError(null);
      const res = await manageProMember(designerId, action, action === "set_end" ? new Date(`${end}T23:59:00+06:00`).toISOString() : undefined);
      if (!res.ok) return setError(t(res.error, res.params));
      toast(t("pro.admin.saved"));
      setOpen(false);
      router.refresh();
    });
  if (!canManage) return null;
  return (
    <>
      <button type="button" className="ap-btn ghost sm" onClick={() => setOpen(true)}>
        {t("pro.admin.manage")}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={t("pro.admin.mTitle", { name })} closeLabel={t("common.close")}>
        <div className="ap-modal">
          {error && <p className="ap-err">{error}</p>}
          <div className="row">
            <button type="button" className="ap-btn ghost" disabled={busy} onClick={() => run("extend")}>
              {t("pro.admin.mExtend")}
            </button>
            <button type="button" className="ap-btn ghost" disabled={busy} onClick={() => run("free_month")}>
              {t("pro.admin.mFree")}
            </button>
          </div>
          <label className="ap-f">
            <span>{t("pro.admin.mEnd")}</span>
            <span className="row">
              <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
              <button type="button" className="ap-btn sm" disabled={busy || !end} onClick={() => run("set_end")}>
                {t("pro.admin.mEndSave")}
              </button>
            </span>
          </label>
          {status !== "cancelled" && status !== "expired" && (
            <button type="button" className="ap-btn ghost" style={{ color: "#A3121B" }} disabled={busy} onClick={() => run("cancel")}>
              {t("pro.admin.mCancel")}
            </button>
          )}
          <p className="ap-hint">{t("pro.admin.manageHint")}</p>
        </div>
      </Modal>
    </>
  );
}

type Suggestion = { id: string; name: string; username: string | null; avatar: string | null; test?: boolean; trial?: boolean };

/**
 * A designer box with suggestions (owner, 2026-10-22): tapping it lists designers, typing narrows the list, picking
 * one fills the box. `items` filters a list the page already has; `load` asks the server (pass a stable function).
 * Enter picks only a row chosen with the arrow keys; otherwise it submits what was typed.
 */
function DesignerSuggest({ name, value, onChange, onPick, items, load, empty, placeholder }: { name?: string; value: string; onChange: (v: string) => void; onPick: (s: Suggestion) => void; items?: Suggestion[]; load?: (q: string) => Promise<Suggestion[]>; empty: string; placeholder: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  // Each server answer remembers the text it was for, so an older answer is never shown or picked.
  const [found, setFound] = useState<{ q: string; rows: Suggestion[] } | null>(null);
  const [active, setActive] = useState(-1);
  const box = useRef<HTMLSpanElement>(null);
  const listId = useId();
  const q = value.trim().replace(/^@/, "").toLowerCase();

  useEffect(() => {
    if (!open || !load) return;
    let live = true;
    const timer = window.setTimeout(() => {
      load(q)
        .then((rows) => live && setFound({ q, rows }))
        .catch(() => live && setFound({ q, rows: [] }));
    }, 220);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [open, q, load]);
  const loading = Boolean(load) && found?.q !== q;
  const shown = items ? items.filter((s) => !q || s.name.toLowerCase().includes(q) || (s.username ?? "").toLowerCase().includes(q)).slice(0, 30) : found?.q === q ? found.rows : [];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const pick = (s: Suggestion) => {
    onChange(s.username ?? s.name);
    setOpen(false);
    setActive(-1);
    onPick(s);
  };

  return (
    <span
      ref={box}
      className="ap-sug"
      onBlur={(e) => {
        if (!box.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <input
        name={name}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
          else if (e.key === "ArrowDown") {
            e.preventDefault();
            if (!open) {
              setOpen(true);
              setActive(0);
            } else setActive((i) => Math.min(i + 1, shown.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, -1));
          } else if (e.key === "Enter" && open && active >= 0 && shown[active]) {
            e.preventDefault();
            pick(shown[active]);
          }
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && active >= 0 && shown[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
      />
      {open && (
        <ul id={listId} role="listbox">
          {!q && <li className="ap-sug-head" aria-hidden>{empty}</li>}
          {loading && !shown.length && <li className="ap-sug-head" aria-hidden>{t("admin.messages.picker.loading")}</li>}
          {!loading && !shown.length && <li className="ap-sug-head" aria-hidden>{t("pro.admin.sugNone")}</li>}
          {shown.map((s, i) => (
            <li
              key={s.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => pick(s)}
              onMouseEnter={() => setActive(i)}
            >
              <span className="ap-av">{s.avatar ? <img src={s.avatar} alt="" /> : (s.name || s.username || "?").charAt(0).toUpperCase()}</span>
              <span className="ap-nm">
                <b>{s.name || `@${s.username}`}</b>
                {s.username && <em>@{s.username}</em>}
              </span>
              {s.trial && <i className="ap-st">{t("pro.admin.sugTrial")}</i>}
              {s.test && <i className="ap-st off">{t("admin.users.testAccount")}</i>}
            </li>
          ))}
        </ul>
      )}
    </span>
  );
}

/** "Search designer" over the Pro members, with suggestions from the members on the page (owner, 2026-10-22). */
export function MemberSearch({ q, range, chip, items }: { q: string; range: number; chip: string; items: Suggestion[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const [value, setValue] = useState(q);
  return (
    <form action="/admin/pro" className="ap-search">
      <input type="hidden" name="range" value={range} />
      <input type="hidden" name="members" value={chip} />
      <DesignerSuggest
        name="q"
        value={value}
        onChange={setValue}
        items={items}
        empty={t("pro.admin.sugMembers")}
        placeholder={t("pro.admin.searchMember")}
        onPick={(s) => router.push(`/admin/pro?${new URLSearchParams({ range: String(range), members: chip, q: s.username ?? s.name })}`, { scroll: false })}
      />
    </form>
  );
}

/**
 * Give Pro (a free month) to any designer: tap the box for suggestions, or type a name or username. A designer picked
 * from the list gets it by their id, so Pro always goes to exactly the person shown; typed text must be a username.
 */
export function GrantPro({ canManage }: { canManage: boolean }) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<Suggestion | null>(null);
  const [busy, start] = useTransition();
  if (!canManage) return null;
  const chosen = picked && (picked.username ?? picked.name) === name ? picked : null;
  return (
    <form
      className="ap-search"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = chosen ? await manageProMember(chosen.id, "free_month") : await grantProByUsername(name);
          if (!res.ok) return toast(t(res.error, res.params), "danger");
          toast(t("pro.admin.saved"));
          setName("");
          setPicked(null);
          router.refresh();
        });
      }}
    >
      <span className="ap-hint">{t("pro.admin.mGrantLead")}</span>
      <DesignerSuggest value={name} onChange={setName} load={searchProDesigners} onPick={setPicked} empty={t("pro.admin.sugNewest")} placeholder={t("pro.admin.mUsername")} />
      <button type="submit" className="ap-btn sm" disabled={busy || name.trim().length < 3}>
        {t("pro.admin.mGrant")}
      </button>
    </form>
  );
}

/** Pro Trials (owner, 2026-10-14): add days or end a trial. */
export function TrialActions({ designerId, status, canManage }: { designerId: string; status: string; canManage: boolean }) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [busy, start] = useTransition();
  if (!canManage || status === "upgraded") return null;
  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: MessageKey }>) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return toast(t(res.error), "danger");
      toast(t("pro.admin.saved"));
      router.refresh();
    });
  return (
    <span style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "flex-end" }}>
      <button type="button" className="ap-btn sm ghost" disabled={busy} onClick={() => run(() => adminExtendTrial(designerId, 1))}>
        {t("pro.trial.admin.extend1")}
      </button>
      <button type="button" className="ap-btn sm ghost" disabled={busy} onClick={() => run(() => adminExtendTrial(designerId, 3))}>
        {t("pro.trial.admin.extend3")}
      </button>
      {status === "active" && (
        <button type="button" className="ap-btn sm ghost" style={{ color: "#A3121B" }} disabled={busy} onClick={() => run(() => adminCancelTrial(designerId))}>
          {t("pro.trial.admin.cancel")}
        </button>
      )}
    </span>
  );
}

/** Start a trial for a designer by username (even while trials are off). */
export function GiveTrial({ canManage }: { canManage: boolean }) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, start] = useTransition();
  if (!canManage) return null;
  return (
    <form
      className="ap-search"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await adminStartTrial(name);
          if (!res.ok) return toast(t(res.error), "danger");
          toast(t("pro.admin.saved"));
          setName("");
          router.refresh();
        });
      }}
    >
      <span className="ap-hint">{t("pro.trial.admin.giveLead")}</span>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("pro.admin.mUsername")} aria-label={t("pro.admin.mUsername")} />
      <button type="submit" className="ap-btn sm" disabled={busy || name.trim().length < 3}>
        {t("pro.trial.admin.give")}
      </button>
    </form>
  );
}

/** Admin › Pro plan › Invitations (owner, 2026-10-14): take one invitation back. */
export function RemoveInvite({ contestId, designerId, canManage }: { contestId: string; designerId: string; canManage: boolean }) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [busy, start] = useTransition();
  if (!canManage) return null;
  return (
    <button
      type="button"
      className="ap-btn sm ghost"
      style={{ color: "#A3121B" }}
      disabled={busy}
      onClick={() =>
        start(async () => {
          const res = await adminRemoveInvite(contestId, designerId);
          if (!res.ok) return toast(t(res.error), "danger");
          toast(t("pro.invitesAdmin.removedToast"));
          router.refresh();
        })
      }
    >
      {t("pro.invitesAdmin.remove")}
    </button>
  );
}
