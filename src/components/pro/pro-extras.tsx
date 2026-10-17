"use client";

/* eslint-disable @next/next/no-img-element */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/client";
import { addPortfolioItem, cancelMyPro, preparePortfolioUpload, removePortfolioItem, setProPicks } from "@/lib/pro/actions";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { COMPRESS, compressImage } from "@/lib/images/compress";
import { Icon } from "./parts";

type Design = { id: string; thumb: string | null; brand: string };

/** Pick designs for the profile cover (up to 12) or featured work (up to 6). Saved with one button. */
export function PicksGrid({ kind, designs, picked: initial, max }: { kind: "cover" | "featured"; designs: Design[]; picked: string[]; max: number }) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [picked, setPicked] = useState(initial.filter((id) => designs.some((d) => d.id === id)));
  const [busy, start] = useTransition();
  const dirty = picked.join() !== initial.join();
  const flip = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= max ? p : [...p, id]));
  const save = () =>
    start(async () => {
      const res = await setProPicks(kind === "cover" ? { cover: picked } : { featured: picked });
      if (!res.ok) return toast(t(res.error), "danger");
      toast(t("pro.settings.saved"));
      router.refresh();
    });
  if (!designs.length) return <p className="pr-empty">{t("pro.settings.noDesigns")}</p>;
  return (
    <div className="pr-picks">
      <div className="grid">
        {designs.map((d) => {
          const on = picked.includes(d.id);
          return (
            <button key={d.id} type="button" className={`pick${on ? " on" : ""}`} onClick={() => flip(d.id)} aria-pressed={on} aria-label={`${d.brand} · ${on ? t("pro.settings.picked") : t("pro.settings.pick")}`}>
              {d.thumb ? <img src={d.thumb} alt="" loading="lazy" /> : <Icon name="image" />}
              {on && (
                <i>
                  <Icon name="check" size={14} strokeWidth={3} />
                </i>
              )}
            </button>
          );
        })}
      </div>
      <div className="foot">
        <span className="pr-mut">
          {picked.length} / {max}
        </span>
        <button type="button" className="pr-btn sm" onClick={save} disabled={busy || !dirty}>
          {t("pro.settings.save")}
        </button>
      </div>
    </div>
  );
}

/** The Pro title shown on the profile. */
export function TitleForm({ initial }: { initial: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const [title, setTitle] = useState(initial);
  const [busy, start] = useTransition();
  return (
    <form
      className="pr-title"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await setProPicks({ title });
          toast(res.ok ? t("pro.settings.saved") : t(res.error), res.ok ? undefined : "danger");
        });
      }}
    >
      <label>
        <span>{t("pro.settings.title2")}</span>
        <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 60))} placeholder={t("pro.settings.titleHint")} />
      </label>
      <button type="submit" className="pr-out pr-save sm" disabled={busy || title === initial}>
        {t("pro.settings.saveTitle")}
      </button>
    </form>
  );
}

/**
 * Portfolio uploads (own designs only), within the Pro slots. Owner, 2026-10-16: choose a picture, see it, give it a
 * name, then Save (before, the name box had no Save button and the picture went up the moment it was chosen).
 */
export function PortfolioManager({ items, max }: { items: { id: string; url: string | null; title: string }[]; max: number }) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [chosen, setChosen] = useState<{ file: File; url: string } | null>(null);
  const full = items.length >= max;
  const choose = (f: File) => {
    if (chosen) URL.revokeObjectURL(chosen.url);
    setChosen({ file: f, url: URL.createObjectURL(f) });
  };
  const clear = () => {
    if (chosen) URL.revokeObjectURL(chosen.url);
    setChosen(null);
    setTitle("");
  };
  const upload = async (picked: File) => {
    setBusy(true);
    try {
      // Any size goes in; it is made light first (owner, 2026-10-14).
      const f = await compressImage(picked, COMPRESS.picture);
      const prep = await preparePortfolioUpload({ type: f.type, size: f.size });
      if (!prep.ok) return toast(t(prep.error), "danger");
      const { error } = await createBrowserSupabase().storage.from("pro-files").uploadToSignedUrl(prep.path, prep.token, f, { contentType: f.type });
      if (error) return toast(t("pro.errors.generic"), "danger");
      const res = await addPortfolioItem({ path: prep.path, title: title.trim() });
      if (!res.ok) return toast(t(res.error), "danger");
      clear();
      toast(t("pro.settings.itemSaved"));
      router.refresh();
    } finally {
      setBusy(false);
    }
  };
  const remove = async (id: string) => {
    setBusy(true);
    await removePortfolioItem(id);
    setBusy(false);
    router.refresh();
  };
  return (
    <div className="pr-picks">
      {items.length > 0 && (
        <div className="grid">
          {items.map((it) => (
            <div key={it.id} className="pick own">
              {it.url ? <img src={it.url} alt={it.title} loading="lazy" /> : <Icon name="image" />}
              <button type="button" className="rm" onClick={() => void remove(it.id)} disabled={busy} aria-label={`${t("pro.settings.removeItem")} ${it.title}`}>
                <Icon name="x" size={14} strokeWidth={3} />
              </button>
            </div>
          ))}
        </div>
      )}
      {!full && !chosen && (
        <div className="up">
          <label className={`pr-btn sm${busy ? " busy" : ""}`}>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) choose(f);
              }}
            />
            <Icon name="upload" size={16} />
            {t("pro.settings.upload")}
          </label>
        </div>
      )}
      {!full && chosen && (
        <div className="up chosen" data-portfolio-chosen>
          <img src={chosen.url} alt="" className="prev" />
          <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 80))} placeholder={t("pro.settings.itemNameHint")} aria-label={t("pro.settings.itemName")} autoFocus />
          <button type="button" className="pr-btn sm" onClick={() => void upload(chosen.file)} disabled={busy}>
            <Icon name="check" size={16} strokeWidth={3} />
            {busy ? t("pro.settings.saving") : t("pro.settings.save")}
          </button>
          <button type="button" className="pr-out sm" onClick={clear} disabled={busy}>
            {t("pro.settings.cancelPick")}
          </button>
        </div>
      )}
      <p className="pr-mut">{t("pro.settings.uploadHint")}</p>
    </div>
  );
}

const REASONS = ["too_expensive", "not_enough_wins", "one_contest", "payment_problem", "other"] as const;

/** Cancel Pro: one short question; Pro stays until the end date. */
export function CancelPlan({ until }: { until: string }) {
  const { t } = useI18n();
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>("");
  const [note, setNote] = useState("");
  const [busy, start] = useTransition();
  if (!open)
    return (
      <button type="button" className="pr-link" style={{ border: 0, background: "none", cursor: "pointer", color: "#A3121B" }} onClick={() => setOpen(true)}>
        {t("pro.settings.cancel")}
      </button>
    );
  return (
    <div className="pr-cancel" role="dialog" aria-label={t("pro.settings.cancelTitle")}>
      <b>{t("pro.settings.cancelTitle")}</b>
      <p className="pr-mut">{t("pro.settings.cancelLead", { date: until })}</p>
      <div className="opts">
        {REASONS.map((r) => (
          <label key={r}>
            <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} />
            {t(`pro.settings.reasons.${r}`)}
          </label>
        ))}
      </div>
      <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 300))} placeholder={t("pro.settings.cancelNote")} aria-label={t("pro.settings.cancelNote")} />
      <div className="row">
        <button type="button" className="pr-out sm" onClick={() => setOpen(false)}>
          {t("pro.settings.keep")}
        </button>
        <button
          type="button"
          className="pr-btn sm"
          disabled={!reason || busy}
          onClick={() =>
            start(async () => {
              const res = await cancelMyPro({ reason, note });
              if (!res.ok) return toast(t(res.error), "danger");
              toast(t("pro.settings.cancelled", { date: until }));
              setOpen(false);
              router.refresh();
            })
          }
        >
          {t("pro.settings.cancelConfirm")}
        </button>
      </div>
    </div>
  );
}
