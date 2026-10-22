import { PROFILE_STEPS, STEP_ANCHOR, profilePercent, profileSteps, type ProfileStep } from "@/lib/profile/completeness";

/**
 * Admin › Users: profile state and reminders (owner, 2026-10-22). The team sees whether a designer or client has
 * confirmed their email, added a photo and (designers) completed their profile, and can remind them: in the app, on
 * their phone and by email, at most once a day per kind. Pure: shared by the list, the person page, the action and
 * the tests.
 */

export const REMINDER_KINDS = ["verify_email", "photo", "profile"] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number];

/** One reminder of a kind per person per day. */
export const REMIND_GAP_MS = 24 * 60 * 60_000;

/** The notification type of each reminder (Admin › Notifications row profile_reminders). */
export const REMINDER_TYPE = { verify_email: "remind_verify_email", photo: "remind_photo", profile: "remind_profile" } as const satisfies Record<ReminderKind, string>;

export type ProfileFields = {
  role: "client" | "designer" | "admin";
  email: string | null;
  email_verified_at: string | null;
  avatar_path: string | null;
  bio?: string | null;
  skills?: string[] | null;
  tools?: string[] | null;
  experience_years?: number | null;
  languages?: string[] | null;
};

export type ProfileStatus = {
  /** null: no real email to confirm (none, or an old phone-only address). */
  emailOk: boolean | null;
  hasPhoto: boolean;
  /** Designers: how complete the profile is, and what is still missing (photo and email have their own lines). */
  percent: number | null;
  missing: ProfileStep[];
  /** Every step still open, photo and email included: what the percent counts (for the person's own email). */
  open: ProfileStep[];
};

/** Old phone-only accounts have an internal address that can't receive email. */
export const isRealEmail = (email: string | null | undefined): email is string => Boolean(email && email.includes("@") && !email.endsWith("@phone.logocontest.bd"));

export function profileStatus(u: ProfileFields): ProfileStatus | null {
  if (u.role === "admin") return null;
  const emailOk = isRealEmail(u.email) ? Boolean(u.email_verified_at) : null;
  const hasPhoto = Boolean(u.avatar_path);
  if (u.role !== "designer") return { emailOk, hasPhoto, percent: null, missing: [], open: [] };
  const steps = profileSteps({
    avatarUrl: u.avatar_path ?? null,
    bio: u.bio ?? null,
    skills: u.skills ?? [],
    tools: u.tools ?? [],
    experienceYears: u.experience_years ?? null,
    languages: u.languages ?? [],
    emailVerified: emailOk !== false,
  });
  const open = steps.filter((s) => !s.done).map((s) => s.key);
  return { emailOk, hasPhoto, percent: profilePercent(steps), missing: open.filter((k) => k !== "photo" && k !== "email"), open };
}

/** The reminders that make sense for this person now. */
export function remindersFor(s: ProfileStatus | null): ReminderKind[] {
  if (!s) return [];
  return REMINDER_KINDS.filter((k) => (k === "verify_email" ? s.emailOk === false : k === "photo" ? !s.hasPhoto : s.missing.length > 0));
}

/** True while the last reminder of this kind is less than a day old. */
export const remindedRecently = (last: string | Date | null | undefined, now: Date): boolean => Boolean(last && now.getTime() - new Date(last).getTime() < REMIND_GAP_MS);

/** Where the reminder takes the person: the right section of their own settings. */
export function reminderPath(kind: ReminderKind, role: "client" | "designer", missing: ProfileStep[] = []): string {
  if (kind === "verify_email") return "/verify-email";
  const settings = role === "client" ? "/client/settings" : "/dashboard/profile";
  if (kind === "photo") return `${settings}#profile`;
  const first = PROFILE_STEPS.find((s) => missing.includes(s));
  return `${settings}#${first ? STEP_ANCHOR[first] : "profile"}`;
}
