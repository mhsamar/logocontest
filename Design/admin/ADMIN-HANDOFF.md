# logocontest.bd admin: design handoff

Put this whole folder in the repo at `design/admin/`. The `.html` files are static design references. They are not code to paste in.

## Rules for every step

1. Open the matching `.html` file and copy its layout, spacing, colours and wording.
2. Keep all existing data fetching, server actions, permissions and routes. Only the presentation changes, unless a section below says "new feature".
3. Never copy numbers, names or rows from the design files. Everything marked "Sample data", "sample", "example" or written in `[square brackets]` is a placeholder. Show real data from the database, and a proper empty state when there is none.
4. Every page must work at 390px wide (phone) with no sideways page scroll. Wide tables scroll inside their own card.
5. Reuse one shared admin layout and shared components (card, pill, KPI tile, tabs, contest ID chip, checkbox). Do not restyle each page separately.
6. After each step: run the build and lint, open the page, and tell me what you changed and anything you could not match.

## Design tokens

| Token | Value |
|---|---|
| Brand | `#8B0000` (deep `#5C0A0C`, tint `#FBECEB`, row tint `#FDF6F5`) |
| Page background | `#F4F5F7` |
| Card | white, 1px `#E9EAEE` border, 16px radius |
| Text | `#111216` main, `#3A3C45` strong grey, `#5F626B` muted |
| Good | `#14633C` on `#E3F3EA` |
| Warning | `#9A3412` on `#FFEDD5` |
| Bad | `#A3121B` on `#FDE3E1` |
| Sample label | `#6B4E00` on `#FFF4D1` |
| Chart colours | prizes `#2F6DB5`, service fees `#B3261E`, add-ons `#D08A1E` |
| Fonts | Instrument Sans (headings, numbers), Urbanist (body), Hind Siliguri (Bangla) |
| Controls | 44 to 48px tall, 12px radius |

Contest IDs are shown as `LC-0005` (zero padded to 4 digits) in a small monospace chip. Use the same style for `TK-0001` (tickets) and `CC-0001` (copyright checks).

## File map

| Design file | Admin page | Type |
|---|---|---|
| `dashboard.html` | Dashboard | Redesign |
| `shell-account-menu-open.html` | Account menu (avatar, top right) | Redesign |
| `shell-activity-drawer-open.html` | Recent activity drawer (bell icon) | Redesign |
| `live-now.html` | Live now | Redesign |
| `analytics.html` | Analytics | Redesign |
| `activity.html` | Activity | Redesign |
| `contests.html` | Contests | Redesign |
| `designs.html` | Designs | Redesign |
| `unpaid-contests.html` | Unpaid contests | Redesign |
| `user-profile.html` | User profile | Redesign |
| `agreements.html` | Agreements | Redesign, plus ID photo upload |
| `payments.html` | Payments | Redesign |
| `admins-roles.html` | Admins & roles | Redesign |
| `support-inbox.html` | Support inbox | Redesign, plus assign and notes |
| `tickets.html` | Tickets | **New feature** |
| `copyright-checker.html` | Copyright checker | **New feature** |
| `auto-share.html` | Auto share | **New feature** |

The sidebar has three new items: **Tickets** (first item under Work), **Copyright checker** (under Copy claims) and **Auto share** (under Send message).

---

## A. Redesign of existing pages

Design only. Notes on things that are easy to miss:

- **Dashboard**: period switcher is Today / 3 days / 7 days / 30 days / All time / Custom.
- **Contests**: live, featured and old contests are separated by tabs/filters; each row shows time left and the stage the contest is in.
- **Unpaid contests**: show the exact wizard step where the client stopped and the amount they would have paid.
- **Payments**: KPIs, paid-per-day chart, "where the money goes" split, table, and a details panel for the selected payment. The "Check with gateway" button stays disabled until the SSLCommerz milestone.
- **Agreements**: the designer uploads a photo of an ID card, passport or birth certificate. Store the image in a private bucket. Show the ID number masked (last 4 digits) unless the admin has Agreements → Manage.
- **Admins & roles**: keep the existing permission keys and the existing Manager / Support / Moderator presets. The preset contents in the design file are only a guess. Rows grouped under Overview, Work, People, Money, Messages, Site & system. Show the live count "Can view X of 17 areas · can manage Y".

---

## B. Tickets (new feature)

A ticket is one job with one owner.

**Fields**: id (shown as `TK-0001`), title, details, status (`todo`, `in_progress`, `done`), priority (`low`, `normal`, `urgent`), due date, assigned admin (nullable), created by, linked item type (`contest`, `user`, `payment`, `conversation`, `agreement`, `copyright_check`, or none) and linked item id, created/updated/completed timestamps.

**Page**:
- KPIs: open, nobody assigned, due today, done.
- Tabs: All, Mine, Nobody assigned. Search by title or ID.
- Board with three columns. Move a ticket by drag and drop, and also by a status menu on the card (needed for phone and keyboard).
- "New ticket" form: title, details, about (pick the linked item), give it to (any admin or staff member, or nobody), priority, due date.
- "Who has what": open and done count per admin.

**Rules**:
- Add a new permission area "Tickets" (View / Manage) to Admins & roles. Staff with View see only tickets assigned to them. Manage can see all, create, assign and close.
- The assigned person gets an in-app notification when a ticket is given to them.
- Write create / assign / status change to the audit log.
- "Make a ticket" buttons elsewhere (Support inbox, Copyright checker) open the new-ticket form with the linked item already filled in.

---

## C. Support inbox: assign and notes

Add to the existing conversations:
- `assigned_admin_id` (nullable) and `priority` on each conversation.
- Internal notes: messages marked as admin-only. They must never be returned to the user side. Enforce this in Row Level Security, not only in the UI.
- List filters: All, Mine, Not assigned, on top of the existing Open / Closed tabs.
- Right panel: conversation facts (status, assigned to, priority, started, message count), the user's account facts with links to their profile and agreement, and the notes box.
- Composer: Reply / Note for admins only switch, file attach, "Close after sending".
- Keep the existing polling ("new messages appear every few seconds").

---

## D. Copyright checker (new feature)

Clients check a logo with AI before they pick a winner and get a research certificate.

**Rules decided by the owner**:
- At most **3 logo checks per contest**. Enforce on the server.
- **Free** when the contest prize is **৳8,000 or more**.
- Below ৳8,000 it is a **paid add-on**. The price is **not decided yet**: read it from Settings, and keep the feature off for those contests while the price is empty.
- The client can run a check on a submitted design any time before picking the winner.
- The result comes with a **certificate as PDF and as an image**.

**Client side** (not designed yet, build a simple version in the same style): on the contest page, a "Check this logo" action on a design, a counter "2 of 3 checks used", the result, and download buttons for the certificate.

**Admin page** (`copyright-checker.html`): KPIs, the rules strip, table of every check (logo, check ID, when, contest, design, who checked, free or paid, result, check number), checks left per contest, and a details panel with the matches and the certificate.

**Data**: check id (shown as `CC-0001`), contest, design, requested by, logo image path, status (`running`, `done`, `failed`), result (`no_match`, `similar`, `high_risk`), closest match percent, matches (source link, image, similarity), certificate PDF path, certificate image path, fee charged, timestamps.

**Open technical decision, ask the owner before building**: an AI model on its own cannot search the internet for look-alike logos. This needs a reverse image search or trademark search service plus the AI to judge the results. Propose two or three options with their cost per check, then wait for a choice. Keep the provider and its key in server-side env variables.

**Wording**: call it "Logo research certificate". Every certificate and result screen carries the line "This is an AI research report. It is not a legal guarantee." Do not use the words "copyright free" or "guaranteed".

A failed check must not use up one of the 3 checks.

---

## E. Auto share (new feature)

Share to the owner's Facebook page and Pinterest automatically.

**Default rules** (each one is a checkbox the owner can change):

| When | Facebook page | Pinterest |
|---|---|---|
| A contest is created (paid and live) | Yes | No |
| A designer submits a logo | Yes | Yes |
| A winner is picked | Yes | No |

**Admin page** (`auto-share.html`):
- Connection cards: Facebook (Page ID, Page access token) and Pinterest (Board, Access token), with Save and "Send a test post". Show a real status: Not connected / Connected / Token expired.
- Rules table with the six checkboxes.
- Safety options: pause all sharing; hold design posts until the admin approves; maximum design posts per day.
- Share history: when, what was shared, contest, Facebook status, Pinterest status. Filters: All, Contests, Designs, Winners, Failed.
- Post details: preview of image and caption, links to the live post and pin, "Send again" for failed ones.

**How it must work**:
- Tokens are secrets. Store them encrypted on the server, never send them back to the browser (show only the last 4 characters), and never log them.
- Posting runs in the background (queue or job table), never inside the user's request. Retry failed posts a few times with a growing delay, then mark as Failed with the error message.
- One row per event and channel in a `share_posts` table: event type, contest, design, channel, status, external post id and link, error, attempts, timestamps.
- Never post the same event to the same channel twice.
- "Contest created" means the contest is paid and live, not a draft.
- Do not share designs from contests that are private or hidden, and do not share removed or reported designs.
- Check the current Meta Graph API and Pinterest API documentation for the exact endpoints, permissions and app review steps before writing the integration, and tell the owner what he must set up in the Meta and Pinterest developer consoles.
- Add a line to the contest rules / terms saying that contests and submitted designs may be shared on the site's social pages.

---

## Suggested order

1. Shared admin layout and components, then Dashboard.
2. The other redesigned pages.
3. Tickets.
4. Support inbox assign and notes.
5. Copyright checker.
6. Auto share.
