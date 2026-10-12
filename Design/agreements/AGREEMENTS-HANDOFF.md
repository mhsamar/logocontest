# logocontest.bd: admin "Designer agreements" redesign — design handoff

Put this folder in the repo at `design/agreements/`. `admin-agreements.html` is a static design reference. It is not code to paste in.

## What changes

Today each agreement is one row: masked ID number, "Show full number", and two links to the ID photos. The new page shows **everything on one card per designer, with the ID photos visible directly**, and adds a simple review step.

## Rules

1. Copy the layout, spacing and colours from the design file. Reuse the existing admin layout, sidebar and shared components.
2. Keep the existing data, routes, masking, "Show full number" and audit logging. Only add what is marked **new** below.
3. Never copy names or numbers from the design file. The ID cards in it are drawn samples marked "SAMPLE", not real documents. Everything in `[square brackets]` is a placeholder.
4. Works at 390px wide: the three parts of each card stack on phones.

## The card (one per signed agreement)

**Left: the designer**
- Avatar or initial, name, @username, number of designs, join date.
- Mobile, email, address (from the profile or the agreement form, whichever the site uses today).
- "Open profile" link to the admin user page.

**Middle: the ID**
- ID type (NID, Passport, Birth certificate) and the masked number (last 4), with the existing "Show full number" button.
- **New:** front and back photos shown as images right on the card, side by side, about 1.6 : 1, with a "Front" / "Back" label and a zoom icon. Clicking a photo opens it full size in a viewer on the same page (close with Esc or the X; arrow keys switch front and back). Keep a "Open in new tab" link inside the viewer.
- Under the photos: the upload date.
- No photo: a dashed box "No ID photo · Signed before photos were asked for" and an "Ask for an ID photo" button (see Review below).

**Right: the agreement**
- Status badge: Needs review, Approved, No ID photo, Rejected.
- "Read signed agreement" opens the exact version the designer signed.
- Grey box: Signed date and time, agreement version, IP address, and Device (browser and device type). **Show Device only if it is already recorded; do not start collecting new data for it without asking the owner.**
- Action buttons and the admin note (see Review).

## Review (new)

- New fields on the agreement: `review_status` (`needs_review`, `approved`, `rejected`, `no_photo`), `reviewed_by`, `reviewed_at`, `admin_note`, `photo_requested_at`.
- New agreements with photos start as **Needs review**. Old agreements without photos start as **No ID photo**.
- **Approve**: sets Approved, saves who and when, shows the green "Approved by ... on ..." line. "Undo approval" puts it back to Needs review.
- **Ask for new photo / Ask for an ID photo**: sends the designer an in-app notification and email asking them to upload a clear photo, sets `photo_requested_at`, and shows "Photo asked for on [date]" on the card. The designer uploads from their account page using the existing upload flow.
- **Reject**: asks for a short reason (required), sets Rejected, and tells the designer. Ask the owner what a rejected designer can still do on the site before building any blocking.
- **Approve without photo**: only for the No ID photo case, with a confirm step.
- The admin note saves on blur.
- Every action, every photo open and every "Show full number" is written to the audit log with the admin and the time.

## Top of the page

- Four counts: Agreements signed, Needs review, Approved, No ID photo (real numbers).
- Tabs: All, Needs review, Approved, No ID photo, Rejected, with counts. Default sort: Needs review first, then newest.
- Search by name, @username or mobile.
- Keep tab and search in the URL.

## Privacy and security (must)

- ID photos stay in a **private** storage bucket. The page shows them with short-lived signed links (a few minutes), created on the server. Never make the bucket public and never put permanent photo URLs in the HTML.
- Only admins with **Agreements · Manage** see the photos, the "Show full number" button and the actions. Admins with only View see the page with the photos and numbers hidden (a grey box saying "You need Agreements · Manage to see ID photos").
- Enforce this on the server and in Row Level Security, not only in the UI.
- Do not load the photo images until the card is near the screen.
- Never show a designer's ID photo or number anywhere outside this admin page.

## Before going live

1. Test as an admin with Manage and as one with only View.
2. Test an agreement with photos, one without, approve, undo, reject, ask for photo.
3. Check the audit log has every view and action.
4. Check at 390px wide.
5. Deploy to production.

---

## Prompt for Claude Code (paste this as one message)

```
Read design/agreements/AGREEMENTS-HANDOFF.md fully and open design/agreements/admin-agreements.html. Then look at how the current admin Agreements page is built: the agreement table, where ID photos are stored, how "Show full number" and its audit log work, the admin permissions, notifications and email.

Before writing code, give me a short plan, the database changes for the review step, and your questions (including: is device or browser already recorded at signing, and what a rejected designer can still do). Then wait for my answers.

Build in this order. After each phase run build and lint, show me what changed, and wait for my OK:
Phase 1: the new card layout with the designer details, ID number and the front and back photos shown directly through short-lived signed links, plus the full-size photo viewer.
Phase 2: counts, tabs, search, sort with Needs review first.
Phase 3: the review step: statuses, Approve, Undo, Reject with reason, Ask for a photo (notification and email), Approve without photo, admin note, all written to the audit log.
Phase 4: permission checks (Manage sees photos, numbers and actions; View does not) enforced on the server and in Row Level Security, lazy loading of photos, and checks at 390px wide.

Rules: keep the existing masking, "Show full number" and audit logging; keep ID photos in the private bucket with short-lived links only; never copy sample data or the drawn sample ID cards from the design file; do not collect new personal data without asking me; do not deploy to production. I will test on a preview first.
```
