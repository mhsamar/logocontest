/**
 * "Complete your profile" (owner, 2026-10-13): designer sign-up only asks four steps, so the photo, skills, tools,
 * experience, languages and the email check are still to do. Pure: shared by the dashboard, Profile settings and tests.
 */

export const PROFILE_STEPS = ["photo", "bio", "skills", "tools", "experience", "languages", "email"] as const;
export type ProfileStep = (typeof PROFILE_STEPS)[number];

export type ProfileFacts = {
  avatarUrl: string | null;
  bio: string | null;
  skills: string[];
  tools: string[];
  experienceYears: number | null;
  /** null when languages can't be saved yet (before migration 0042): then it isn't asked for. */
  languages: string[] | null;
  emailVerified: boolean;
};

/** Where each step is filled in on /dashboard/profile. */
export const STEP_ANCHOR: Record<ProfileStep, string> = {
  photo: "profile",
  bio: "profile",
  skills: "portfolio",
  tools: "portfolio",
  experience: "portfolio",
  languages: "portfolio",
  email: "email",
};

export function profileSteps(f: ProfileFacts): { key: ProfileStep; done: boolean }[] {
  const done: Record<ProfileStep, boolean> = {
    photo: Boolean(f.avatarUrl),
    bio: (f.bio ?? "").trim().length > 0,
    skills: f.skills.length > 0,
    tools: f.tools.length > 0,
    experience: f.experienceYears !== null && f.experienceYears >= 0,
    languages: (f.languages ?? []).length > 0,
    email: f.emailVerified,
  };
  return PROFILE_STEPS.filter((k) => k !== "languages" || f.languages !== null).map((key) => ({ key, done: done[key] }));
}

/** 0–100, rounded. */
export function profilePercent(steps: { done: boolean }[]): number {
  return steps.length ? Math.round((steps.filter((s) => s.done).length / steps.length) * 100) : 100;
}
