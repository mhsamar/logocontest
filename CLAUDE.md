@AGENTS.md

# logocontest.bd

Bangladesh-only, logo-only design contest platform. Currency is BDT, stored as whole-taka integers.

## Source of truth
- BLUEPRINT.md: business rules, data model, lifecycle, milestones.
- UI-JOURNEY.md: every screen and its ID.
If code and these files disagree, the files win. If the two files disagree, ask me.

> Stack note: BLUEPRINT.md §4 says Laravel/MySQL/Blade/Livewire. The owner chose Next.js + Supabase
> instead (2026-10-07). Read every Laravel term in the two files as its equivalent here:
> controllers → server actions, policies → `src/lib/auth/policies.ts`, localization files →
> `src/lib/i18n/messages`, scheduler → a scheduled job (decided in Milestone 6), "users" table →
> `auth.users` (password) + `public.profiles` (everything else).

## Stack
Next.js (App Router, TypeScript), Supabase (Postgres + Auth), Tailwind CSS v4, Vitest.
(The original prompt pack said Laravel; the owner chose Next.js + Supabase instead.)

## Rules for working in this repo
- Build only the milestone I ask for. Do not start the next one.
- Do not add features, pages or packages that are not in the two files. Ask first.
- Every admin-changeable number (fees, tiers, prices, timers, limits) is read from the `settings` table via `getSetting()` (`src/lib/settings`), never hard-coded. New keys go in `src/lib/settings/registry.ts`.
- All user-facing text goes through `src/lib/i18n/messages/{en,bn}.ts`. No hard-coded strings in components. `bn` must have every `en` key (a test enforces this).
- Money and contest state changes live in service classes under `src/lib/`, run inside a single Postgres function (transaction) when they touch more than one row, and have tests.
- Every authorization check goes through `src/lib/auth/policies.ts` (`can()` / `authorize()`). RLS is the second line of defence, not the only one.
- Mobile-first: build and check each screen at 360px width before wider sizes.
- External services (payment, SMS, storage) sit behind interfaces with fake/log drivers for local development (see `src/lib/sms`).
- Database changes are new files in `supabase/migrations/` (numbered, re-runnable). Never edit an applied migration.
- After each milestone: run the tests, fix failures, then give me a short summary of what was built, how to try it by hand, and anything you were unsure about.
- If something in the files is ambiguous, stop and ask me instead of guessing.

## Commands
- Install: `npm install`
- Configure: copy `.env.example` to `.env.local` and fill in Supabase keys, `OTP_SECRET`, `ADMIN_PHONE`, `ADMIN_PASSWORD`
- Migrate: paste each file in `supabase/migrations/` (in order) into Supabase → SQL Editor and run it
- Seed (settings defaults + first admin): `npm run seed`
- Run: `npm run dev` → http://localhost:3000 (component showcase at `/styleguide`, dev only)
- Test: `npm test` · Types: `npm run typecheck` · Lint: `npm run lint`
- Build check while the dev server runs: `NEXT_DIST_DIR=.next-check npx next build` (a plain build overwrites `.next` and makes the dev server serve stale CSS)
- SMS codes in development are printed in the `npm run dev` terminal (`[sms:log]` lines).
