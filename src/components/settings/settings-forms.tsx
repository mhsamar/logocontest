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
  updateProfile,
  type SettingsState,
} from "@/lib/profile/actions";
import { createBrowserSupabase } from "@/lib/supabase/browser";

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

export function PhotoSection({ name, avatarUrl, maxMb }: { name: string; avatarUrl: string | null; maxMb: number }) {
  const { t } = useI18n();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const shown = preview ?? avatarUrl;

  const upload = (file: File) =>
    start(async () => {
      const prepared = await prepareAvatarUpload({ type: file.type, size: file.size });
      if (!prepared.ok) return toast(t(prepared.error.key, prepared.error.params), "danger");
      setPreview(URL.createObjectURL(file));
      const { error } = await createBrowserSupabase().storage.from("avatars").uploadToSignedUrl(prepared.path, prepared.token, file, { contentType: file.type });
      if (error || !(await saveAvatar(prepared.path))) {
        setPreview(null);
        return toast(t("auth.errors.generic"), "danger");
      }
      toast(t("settings.photo.saved"));
    });

  return (
    <div className="flex items-center gap-5">
      <Avatar name={name} url={shown} tone="cream" className="size-20 text-2xl ring-1 ring-line sm:size-24" />
      <div>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) upload(file);
          }}
        />
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" loading={busy} onClick={() => input.current?.click()}>
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
        <p className="mt-2 text-xs text-muted">{t("settings.photo.hint", { mb: maxMb })}</p>
      </div>
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
