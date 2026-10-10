# AI copyright checker: handoff

Put this folder in the repo at `design/copyright-checker/`. The `.html` files are static design references, not code to paste in. This file replaces section D of `design/admin/ADMIN-HANDOFF.md`.

Everything in the design files is sample data: the logos, the similar-logo images (AXION, NOXO and so on), scores, percentages, dates. Anything in `[square brackets]` is a placeholder. Never copy these into the product.

## Files

| File | What it is |
|---|---|
| `client-judging-page.html` | Where the feature sits on the client's contest page, plus the three other states of the side box |
| `client-check-popup.html` | The pop-up, all four steps shown one under another |
| `certificate.html` | The certificate (PDF and image) |
| `client-my-logo-checks.html` | Client dashboard page listing every check |
| `admin-copyright-checker.html` | Admin page listing every check by every client |

## Rules decided by the owner

1. Only the **client** (contest owner) can use it. Designers and visitors never see it.
2. **3 checks per contest.** One check = one logo image. Enforce on the server.
3. **Free** when the contest prize is **৳8,000 or more**.
4. Below ৳8,000 it is a **paid add-on: ৳500 for the 3 checks**. Use the existing add-on purchase flow. Keep the price and the ৳8,000 limit in Settings, not hard-coded.
5. It is available while the client is judging, before a winner is picked.
6. The client can check a design from the contest or upload their own image.
7. Every check ends with a **certificate as PDF and as an image**.
8. Every check and its details are kept in the client's dashboard ("My logo checks") and in the admin page.
9. A check that fails for a technical reason does **not** use up one of the 3.

## Where it appears (client)

Match `client-judging-page.html`. The real judging page already exists: keep its layout and add two things.

- A **"Check with AI"** button on every design card, next to the pick-winner action. A design that was already checked shows a result badge and a "Certificate" button instead.
- An **"AI copyright checker" box** beside the designs. It has four states:
  - **Active**: "1 of 3 checks used", the checked logos with their result, "Check a logo" button.
  - **Free, unused**: prize ৳8,000 or more, 0 of 3 used.
  - **Locked add-on**: prize under ৳8,000 and add-on not bought. Shows "3 logo checks · ৳500" and "Add to this contest".
  - **All used**: 3 of 3, link to My logo checks.

## The pop-up (client)

Match `client-check-popup.html`. One modal, four steps, with the step indicator at the top. On phones it is full screen.

**Step 1, Choose.** The design the client clicked is already selected. They can pick another design from the contest (already-checked ones are disabled) or upload PNG, JPG or SVG. Footer says how many checks this will leave. Button: Start check.

**Step 2, Check.** Shows the logo, a progress bar, the tags the AI found (shape, text, colours) and a list of steps, each one Done / Searching / Waiting:
1. Reading your logo
2. Google Lens image search
3. Logos on logocontest.bd
4. Shape match by AI
5. Font check

The client can close the window. The check keeps running and the result appears in My logo checks.

**Step 3, Result.** In this order:
1. Verdict banner. Three possible verdicts: **No close match** (green), **Similar logos found** (orange), **High risk** (red, a very close or identical logo exists).
2. **What the AI sees in your logo**: large logo image, then shape, type of logo, letters it reads, colours.
3. **Logos with a similar shape**: dark panel, the client's logo large on the left, a grid of the found images on the right, each with its similarity percent. Close ones get a highlighted border. Show at most 8.
4. **Closest match, side by side**: both images, the source link, and a short list of what is the same and what is different.
5. **Font check**: what the letters look like, and a reminder to ask the designer for the font name and licence. Always say "looks like", never state the font as a fact.
6. **Four scores**, each 0 to 100 with one sentence: Uniqueness, Legibility, Colour & contrast, Overall.
7. **How we checked**: the four sources with what each one found.
8. **What this means for you**: two or three plain sentences of advice.
9. Buttons: Ask designer for changes (opens the message to that designer), Check another logo (shows checks left), Get certificate.

**Step 4, Certificate.** Preview thumbnail, Download PDF, Download image, a note that it is saved in My logo checks.

## How a check runs (server)

Run it as a background job. The browser polls for status. Never do this inside the request.

1. **Read the logo.** Send the image to Claude (vision). Ask for strict JSON: main shape, logo type, the text it reads, colours as hex, a font description and best-guess font name, and a one-line description.
2. **Search by image.** Use the image search service chosen in "Open decision" below. Keep the top results (image URL, page URL, title). Drop results that are the client's own site or logocontest.bd.
3. **Search our own designs.** Compare against designs submitted to other contests on logocontest.bd (not the same contest).
4. **Compare shapes.** For each candidate, send the client's logo and the candidate image together to Claude and ask for a similarity score 0 to 100 plus the "same" and "different" points. Keep the top 8. A candidate counts as "close" from a threshold kept in Settings (start at 45). 85 or more means High risk.
5. **Score the design.** Uniqueness comes from the closest similarity. Legibility and colour/contrast come from Claude looking at the logo. Overall is the summary.
6. **Save** everything, then **render the certificate**.

Save a copy of each similar-logo image in our own storage at check time. The source page can change or vanish later, and the certificate must stay the same.

If any step fails, mark the check as failed, show a clear message with "Try again", and do not count it.

## Open decision: the image search service

As far as we know, Google Lens has no official public API. Before building, research and show the owner 2 or 3 options with: what it searches, how good it is for logos, cost per check, and limits. Likely candidates to investigate: Google Cloud Vision "Web Detection" (official Google), and third-party services that return Google Lens results. Verify all of this against current documentation. Do not start the integration until the owner picks one.

Whatever is chosen, the "How we checked" list on the result and the certificate must name only what was really searched. If the service is not Google Lens, change that label.

## Certificate

Match `certificate.html`. A4 portrait. Build it from one HTML template and render it to both PDF and PNG on the server.

Contents: site logo, certificate number (`CC-0001` format), title "Logo Research Certificate", the checked logo, contest and ID, design, designer, who it was checked for, date and time, the result, images of the similar logos with percent and source, what is the same and different, the four scores, where we searched, the note, a verify link and a QR code that opens the same link.

Fixed wording, do not change:
- Title: **Logo Research Certificate**. Never "copyright certificate", "copyright free" or "guaranteed".
- Note: "This is an AI research report made on the date above. It is not a legal guarantee and not a trademark registration. New logos can appear after this date."

**Verify page**: a public page at `/verify/CC-0003` that shows whether that certificate number is real, the date, the checked logo and the result. Nothing else, no client contact details.

## Client dashboard: My logo checks

Match `client-my-logo-checks.html`. Totals, one row per check (logo, design, check ID, contest, date, free or add-on, result, overall score, See result, PDF), and "checks left" per contest. "See result" opens the pop-up on step 3 for that check.

## Admin page

Match `admin-copyright-checker.html`. Every check by every client: logo, check ID, when, contest, design, who checked, free or paid, result, check number. A details panel with the matches and the certificate. Checks left per contest. A "Make a ticket" button for a check that needs review. The rules strip reads its values from Settings.

Add "Copyright checker" as a permission area in Admins & roles (view only).

## Data to store per check

Check ID, contest, design (or uploaded image), requested by, status (`queued`, `running`, `done`, `failed`), current step, verdict (`no_match`, `similar`, `high_risk`), what the AI read (shape, type, text, colours, font guess), the candidates (stored image, source URL, similarity, same/different points, which source found it), the four scores with their sentences, the advice text, certificate PDF path, certificate image path, whether it was free or paid and the amount, error message if failed, timestamps.

## Security and cost

- All keys (Claude, image search) stay in server environment variables.
- Uploaded logos and stored images go in a private bucket. Only the contest's client and admins can read a check (Row Level Security).
- Check the limit and the payment on the server before starting a job, and make it safe against double clicks.
- Tell the owner the estimated cost of one full check (search + all Claude calls) so he can compare it with the ৳500 price and the free tier.
