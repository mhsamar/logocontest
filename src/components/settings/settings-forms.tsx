"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PasswordField, PhoneField, TextAreaField, TextField } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/client";
import { formatBdMobile } from "@/lib/phone";
import {
  changeEmail,
  changeMobile,
  changePassword,
  prepareAvatarUpload,
  removeAvatar,
  saveAvatar,
  updatePayout,
  updateProfile,
  type SettingsState,
} from "@/lib/profile/actions";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import type { Area } from "react-easy-crop";
import { cropToBlob, PhotoCropper } from "./photo-cropper";

const IDLE: SettingsState = { status: "idle" };

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-surface p-5 shadow-card ring-1 ring-line sm:p-6">
      <h2 className="text-lg font-bold text-ink">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

/** Shows a toast once the action says "ok". */
function useSavedToast(state: SettingsState, message: string) {
  const toast = useToast();
  useEffect(() => {
    if (state.status === "ok") toast(message);
  }, [state, toast, message]);
}

function useFieldError(state: SettingsState) {
  const { t } = useI18n();
  return (field: string) => (state.status === "error" && state.field === field && state.error ? t(state.error.key, state.error.params) : undefined);
}

export function PhotoSection({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const { t } = useI18n();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const shown = preview ?? avatarUrl;

  const closeCropper = () => {
    if (source) URL.revokeObjectURL(source);
    setSource(null);
  };

  // Any image the browser can open is accepted; it's cropped and shrunk before upload.
  const pick = (file: File) => {
    const url = URL.createObjectURL(file);
    const probe = new Image();
    probe.onload = () => setSource(url);
    probe.onerror = () => {
      URL.revokeObjectURL(url);
      toast(t("settings.photo.cantOpen"), "danger");
    };
    probe.src = url;
  };

  const save = (area: Area) =>
    start(async () => {
      let blob: Blob;
      try {
        blob = await cropToBlob(source!, area);
      } catch {
        return toast(t("settings.photo.cantOpen"), "danger");
      }
      const prepared = await prepareAvatarUpload({ type: blob.type, size: blob.size });
      if (!prepared.ok) return toast(t(prepared.error.key, prepared.error.params), "danger");
      const { error } = await createBrowserSupabase().storage.from("avatars").uploadToSignedUrl(prepared.path, prepared.token, blob, { contentType: blob.type });
      if (error) return toast(t("auth.errors.generic"), "danger");
      const saved = await saveAvatar(prepared.path);
      if (!saved.ok) return toast(t(saved.error.key), "danger");
      setPreview(URL.createObjectURL(blob));
      closeCropper();
      toast(t("settings.photo.saved"));
    });

  return (
    <div className="flex items-center gap-5">
      <Avatar name={name} url={shown} tone="cream" className="size-20 text-2xl ring-1 ring-line sm:size-24" />
      <div>
        <input
          ref={input}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) pick(file);
          }}
        />
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={busy} onClick={() => input.current?.click()}>
            {shown ? t("settings.photo.change") : t("settings.photo.upload")}
          </Button>
          {shown && (
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() =>
                start(async () => {
                  setPreview(null);
                  if (await removeAvatar()) toast(t("settings.photo.removed"));
                })
              }
            >
              {t("settings.photo.remove")}
            </Button>
          )}
        </div>
        <p className="mt-2 text-xs text-muted">{t("settings.photo.hint")}</p>
        <p className="mt-1 text-xs text-muted">{t("settings.photo.rule")}</p>
      </div>
      <PhotoCropper src={source} onCancel={closeCropper} onSave={save} saving={busy} />
    </div>
  );
}

export function ProfileForm({
  role,
  name,
  bio,
  businessName,
  username,
  profileUrl,
  bioMax,
}: {
  role: "client" | "designer";
  name: string;
  bio: string;
  businessName: string;
  username: string | null;
  profileUrl: string | null;
  bioMax: number;
}) {
  const { t, locale } = useI18n();
  const [state, action, pending] = useActionState(updateProfile, IDLE);
  const [bioText, setBioText] = useState(bio);
  useSavedToast(state, t("settings.saved"));
  const err = useFieldError(state);
  const count = new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US");
  return (
    <form action={action} className="space-y-4">
      <TextField name="name" label={t("designerSignup.name.label")} defaultValue={name} maxLength={60} autoComplete="name" error={err("name")} />
      {role === "client" && (
        <TextField name="businessName" label={t("settings.businessName")} optionalLabel={t("common.optional")} defaultValue={businessName} maxLength={80} />
      )}
      {role === "designer" && (
        <TextAreaField
          name="bio"
          label={t("designerSignup.bio.label")}
          hint={t("designerSignup.bio.hint")}
          value={bioText}
          onChange={(e) => setBioText(e.target.value)}
          maxLength={bioMax}
          counterLabel={`${count.format(bioText.length)} / ${count.format(bioMax)}`}
          error={err("bio")}
        />
      )}
      {username && (
        <div>
          <p className="text-sm font-medium text-ink">{t("designerSignup.username.label")}</p>
          <p className="mt-1.5 flex min-h-12 items-center justify-between gap-3 rounded-md bg-canvas px-3.5 ring-1 ring-inset ring-line">
            <span className="truncate font-mono text-sm text-ink">@{username}</span>
            {profileUrl && (
              <a href={profileUrl} className="shrink-0 text-sm font-semibold text-primary hover:underline">
                {t("designerDash.viewProfile")}
              </a>
            )}
          </p>
        </div>
      )}
      <div className="flex justify-end">
        <Button type="submit" loading={pending}>
          {t("settings.save")}
        </Button>
      </div>
    </form>
  );
}

export function MobileForm({ mobile }: { mobile: string }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(changeMobile, IDLE);
  // Controlled, so a rejected number stays in the box (forms reset after an action).
  const [value, setValue] = useState(mobile ? formatBdMobile(mobile) : "");
  useSavedToast(state, t("settings.mobile.saved"));
  const err = useFieldError(state);
  return (
    <form action={action} className="space-y-4">
      <PhoneField name="mobile" label={t("designerSignup.mobile")} value={value} onChange={(e) => setValue(e.target.value)} error={err("mobile")} />
      <div className="flex justify-end">
        <Button type="submit" variant="secondary" loading={pending}>
          {t("settings.mobile.save")}
        </Button>
      </div>
    </form>
  );
}

export function EmailForm({ email, verified }: { email: string; verified: boolean }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(changeEmail, IDLE);
  const [value, setValue] = useState(email);
  useSavedToast(state, t("settings.email.saved"));
  const err = useFieldError(state);
  return (
    <form action={action} className="space-y-4">
      <TextField
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        label={t("designerSignup.email")}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        error={err("email")}
        hint={verified ? `✓ ${t("settings.email.verified")}` : t("settings.email.unverified")}
      />
      <div className="flex justify-end">
        <Button type="submit" variant="secondary" loading={pending}>
          {t("settings.email.save")}
        </Button>
      </div>
    </form>
  );
}

export function PasswordForm({ min }: { min: number }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(changePassword, IDLE);
  const formRef = useRef<HTMLFormElement>(null);
  useSavedToast(state, t("settings.password.saved"));
  useEffect(() => {
    if (state.status === "ok") formRef.current?.reset();
  }, [state]);
  const err = useFieldError(state);
  return (
    <form ref={formRef} action={action} className="space-y-4">
      <PasswordField
        name="current"
        label={t("settings.password.current")}
        showLabel={t("auth.password.show")}
        hideLabel={t("auth.password.hide")}
        autoComplete="current-password"
        error={err("current")}
      />
      <PasswordField
        name="password"
        label={t("settings.password.new")}
        hint={t("auth.password.hint", { min })}
        showLabel={t("auth.password.show")}
        hideLabel={t("auth.password.hide")}
        autoComplete="new-password"
        error={err("password")}
      />
      <div className="flex justify-end">
        <Button type="submit" variant="secondary" loading={pending}>
          {t("settings.password.save")}
        </Button>
      </div>
    </form>
  );
}

export { Section };

export type PayoutValues = {
  type: "bkash" | "bank";
  bkashNumber: string;
  bankName: string;
  branch: string;
  accountName: string;
  accountNumber: string;
  routingNumber: string;
};

/** Designers: bKash or bank details for winnings (D-12). */
export function PayoutForm({ initial }: { initial: PayoutValues }) {
  const { t } = useI18n();
  const toast = useToast();
  const [v, setV] = useState<PayoutValues>(initial);
  const [state, setState] = useState<SettingsState>(IDLE);
  const [pending, start] = useTransition();
  const err = useFieldError(state);
  const set = <K extends keyof PayoutValues>(k: K, value: PayoutValues[K]) => {
    setV((x) => ({ ...x, [k]: value }));
    setState(IDLE);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await updatePayout(
            v.type === "bkash"
              ? { type: "bkash", bkashNumber: v.bkashNumber }
              : { type: "bank", bankName: v.bankName, branch: v.branch, accountName: v.accountName, accountNumber: v.accountNumber, routingNumber: v.routingNumber },
          );
          setState(r);
          if (r.status === "ok") toast(t("settings.payout.saved"));
        });
      }}
      className="space-y-4"
      noValidate
    >
      <div className="grid grid-cols-2 gap-1 rounded-full bg-canvas p-1 ring-1 ring-line" role="tablist">
        {(["bkash", "bank"] as const).map((type) => (
          <button
            key={type}
            type="button"
            role="tab"
            aria-selected={v.type === type}
            onClick={() => set("type", type)}
            className={`min-h-10 rounded-full text-sm font-semibold transition-colors ${v.type === type ? "bg-ink text-white" : "text-muted hover:text-ink"}`}
          >
            {t(`designerSignup.payout.${type}`)}
          </button>
        ))}
      </div>
      {v.type === "bkash" ? (
        <PhoneField label={t("designerSignup.payout.bkashNumber")} value={v.bkashNumber} onChange={(e) => set("bkashNumber", e.target.value)} error={err("bkashNumber")} />
      ) : (
        <div className="space-y-4">
          <TextField label={t("designerSignup.payout.bankName")} value={v.bankName} onChange={(e) => set("bankName", e.target.value)} error={err("bankName")} />
          <TextField label={t("designerSignup.payout.branch")} optionalLabel={t("common.optional")} value={v.branch} onChange={(e) => set("branch", e.target.value)} />
          <TextField label={t("designerSignup.payout.accountName")} value={v.accountName} onChange={(e) => set("accountName", e.target.value)} error={err("accountName")} />
          <TextField
            label={t("designerSignup.payout.accountNumber")}
            inputMode="numeric"
            value={v.accountNumber}
            onChange={(e) => set("accountNumber", e.target.value)}
            error={err("accountNumber")}
          />
          <TextField
            label={t("designerSignup.payout.routingNumber")}
            optionalLabel={t("common.optional")}
            inputMode="numeric"
            value={v.routingNumber}
            onChange={(e) => set("routingNumber", e.target.value)}
            error={err("routingNumber")}
          />
        </div>
      )}
      {state.status === "error" && !state.field && state.error && <p className="text-sm text-danger">{t(state.error.key, state.error.params)}</p>}
      <div className="flex justify-end">
        <Button type="submit" variant="secondary" loading={pending}>
          {t("settings.payout.save")}
        </Button>
      </div>
    </form>
  );
}
