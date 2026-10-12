# logocontest.bd: admin "Users" list redesign — design handoff

Put this folder in the repo at `design/users/`. `admin-users.html` is a static design reference. It is not code to paste in.

## What changes

Today the Users page is a plain table. The new page adds counts, filters, a richer table row (activity, strikes, online and last active) and a **Quick view** panel on the right that shows the user under the mouse, with the main actions, so the admin rarely needs to leave the list.

## Rules

1. Copy the layout, spacing and colours from the design file. Reuse the existing admin layout, sidebar and shared components.
2. Keep the existing data, routes, user profile page and any existing suspend / ban logic. Only add what is marked **new** below.
3. Never copy names, numbers or amounts from the design file. They are samples. Everything in `[square brackets]` is a placeholder. Remove the "Sample data" pill.
4. Works at 390px wide: the table scrolls sideways inside its card, the Quick view panel moves below the table (or opens as a bottom sheet).

## Top of the page

- Title, one-line description, **Export CSV** button (exports the current filtered list; admins with Users · Manage only; log every export in the audit log).
- Four counts (real numbers):
  - All users (+ new this week)
  - Clients (+ how many ran at least one contest)
  - Designers (+ online now)
  - **Need a look** = suspended + banned + users with strikes or an agreement without an ID photo. Clicking it filters the list.

## Filters

- Role tabs with counts: All, Clients, Designers, Admins.
- Status chips: All, Active, Suspended, Banned.
- Show chips: Online now, Has strikes, New this week.
- Search by name, @username, email or mobile.
- Sort: Newest first, Last active, Most spent (clients), Most wins (designers).
- Keep all filters, search, sort and page number in the URL.
- 20 users per page with Previous / Next. Paging and filtering run on the server.

## Table row

| Column | Shows |
|---|---|
| User | Avatar or initial, green dot if online, name, @username, and one check line: email verified / not verified (clients) or agreement approved / no ID photo / needs review (designers) |
| Role & activity | Role badge. Client: contests run and total spent (৳). Designer: designs sent and wins. Admin: admin role name |
| Status & strikes | Active / Suspended / Banned badge and a 3-square strike meter (0/3 … 3/3) |
| Last active | "Online now", or relative time, plus join date |

**Mouse and click behaviour (owner's decision):**
- **Mouse over a row** (desktop): the Quick view panel on the right shows that user right away, and the row gets a light maroon background with a maroon left bar.
- **Click on a row** (not on the name): pins that user in Quick view, so moving the mouse to the panel's buttons keeps the same user. Moving over other rows previews them; leaving the table goes back to the pinned user. The first user in the list is pinned when the page opens.
- **Click on the name**: opens the full profile page (a normal link, so Ctrl/Cmd-click opens a new tab).
- **Phones and tablets** (no hover): tapping a row opens Quick view as a bottom sheet; tapping the name opens the full profile.
- There is no pop-up card on the name.

**"Online now"**: use the same rule the site already uses for live designers (last activity within a few minutes). If no activity time is stored yet, ask the owner before adding tracking.

## Quick view panel (new)

- Stays on the right of the table on desktop (sticky while scrolling). Small "Point at a row to preview" hint next to the title.
- Avatar, online dot, name, @username, role, online or last active, check line, role and status badges.
- Three stats: Client = Contests, Spent, Winners picked. Designer = Designs, Wins, Earned.
- Mobile, Email, Joined, Strikes (meter), Last login (time and device, **only if already recorded**).
- Buttons: **Send message**, **Give a strike**, and **Suspend** + **Ban** for active users, **Unsuspend** + **Ban** for suspended users, **Unban** for banned users. Admin accounts show no actions here (managed in Admins & roles).
- "Open full profile →" link.
- Load the panel data with the list (no extra request per hover). Show contact details only to admins with Users · Manage.

## Actions (new where missing)

- Give a strike, Suspend, Ban, Unsuspend, Unban: each opens a small dialog with a **required reason**. Ban also needs a confirm step.
- Suspend can have an end date (optional). Ask the owner what a suspended user can and cannot do before building blocking.
- 3 strikes: do **not** ban automatically; show "3 of 3 strikes, review" in Need a look. Ask the owner if he wants an automatic rule.
- The user gets an in-app notification (and email) with the reason.
- An admin can never suspend or ban themselves or a super admin.
- Every action and every CSV export goes to the audit log with the admin, time and reason.

## Privacy and security (must)

- Only admins with **Users · View** can open the page; actions and contact details need **Users · Manage**. Enforce on the server and in Row Level Security, not only in the UI.
- Do not show IP addresses, ID numbers or ID photos on this page.
- The CSV must not include passwords, tokens, ID numbers or IP addresses.

## Before going live

1. Test as an admin with Manage and one with only View.
2. Test each filter, search, sort and paging with real data.
3. Test strike, suspend (with and without end date), unsuspend, ban, unban, and check the notifications and audit log.
4. Check at 390px wide.
5. Deploy to production.

---

## Prompt for Claude Code (paste this as one message)

```
Read design/users/USERS-HANDOFF.md fully and open design/users/admin-users.html. Then look at how the current admin Users page and the user profile page are built: the users/profiles tables, roles, any existing suspend, ban or strike fields, last-active or online tracking, admin permissions, notifications, email and the audit log.

Before writing code, give me a short plan, the database changes needed, and your questions (including: is last activity and login device already recorded, what a suspended user can still do, and whether 3 strikes should do anything automatically). Then wait for my answers.

Build in this order. After each phase run build and lint, show me what changed, and wait for my OK:
Phase 1: the new layout: counts, role tabs, status and show chips, search, sort, server-side paging, all kept in the URL.
Phase 2: the new table row (check line, activity, status badge, strike meter, online and last active) and the Quick view panel: mouse over a row previews it, click on a row pins it, click on the name opens the full profile, bottom sheet on phones.
Phase 3: actions: Give a strike, Suspend (optional end date), Unsuspend, Ban (with confirm), Unban, each with a required reason, a notification and email to the user, and an audit log entry. Block actions on yourself and on super admins.
Phase 4: Export CSV of the filtered list (no passwords, tokens, ID numbers or IPs; logged), permission checks (View vs Manage) on the server and in Row Level Security, and checks at 390px wide.

Rules: keep existing data, routes and profile page; never copy sample data from the design file; do not collect new personal data or add new tracking without asking me; do not deploy to production. I will test on a preview first.
```
