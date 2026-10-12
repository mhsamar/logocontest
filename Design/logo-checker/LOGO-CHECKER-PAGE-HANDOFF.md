# logocontest.bd: public "Logo Checker" page — design handoff

Put this folder in the repo at `design/logo-checker/`. `logo-checker.html` is a static design reference (open it in a browser, click the samples, steps and tabs). It is not code to paste in.

## Important: example logos
The LC logos inside the design file are **third-party stock images**, used only to show the idea. **Do not copy them into the site.** Use example images the owner provides (or simple neutral placeholder logos made for logocontest.bd) from `public/logo-checker/`. Keep the footnote: "Example logos are used only to show how the checker works. Scores and percentages are samples."

## Menu
- Add **Logo Checker** to the main menu after Design Studio, with a small gold **NEW** pill (remove the pill after about 30 days; keep that as a setting or a simple date check).
- Add it to the footer "For clients" links.
- Route: `/logo-checker`. Page is public (no login needed).

## New pricing rules (owner's decision, replaces the old 3 checks / ৳8,000 / ৳500)
- Contest prize **৳5,000 or more**: **free, 20 logo checks** per contest.
- Prize **under ৳5,000**: **৳250 for 10 logo checks** (paid add-on, existing add-on purchase flow).
- Only the contest owner (client) can run a check, while judging. One check = one logo. A failed check does not count.
- Keep the limit (5,000), the counts (20 / 10) and the price (250) in **Settings**, not hard-coded. Update the existing checker logic, the judging-page checker box, My logo checks and the admin Copyright checker page to use these settings.

## Page sections (top to bottom)
1. **Hero**: "AI logo checker" pill, title "Is your new logo **really original?**" (animated maroon-gold gradient on the last words), one paragraph, buttons **Start a contest** and **See a sample report** (scrolls to the sample), three ticks (Free with a ৳5,000+ prize · Up to 20 checks per contest · PDF certificate). Right side: **live demo**: "Try a sample" chips (3 example logos). Choosing a chip swaps a scan card (grid, moving red scan line, dashed boxes that mark the parts the AI reads, tags for Shape / Reads / Colours) and a result card (coloured verdict, 5 check steps lighting up, 3 look-alikes with % bars coloured green → orange → red, overall score ring). This demo is **static example data**, not a real check.
2. **How it works**: 4 clickable steps (Choose the logo · AI checks it · See the result · Get a certificate). The selected step is highlighted with a progress line; the right panel shows a preview for that step on a colourful dotted background with a few floating example logos.
3. **Five checks in one click**: 5 colourful cards (Reads your logo, Google Lens image search, Logos on logocontest.bd, Shape match by AI, Font check), each with its own colour, numbered, lifting and tilting on hover.
4. **Sample report**: 3 verdict tabs (No close match · Similar logos found · High risk, default High risk) with a matching banner; then three panels:
   - Your logo + what the AI reads (shape, type, letters, colours).
   - **Similarity map**: a dark radar. The checked logo sits in the centre; found logos orbit slowly, closer to the centre = more similar; rings at 75/50/25%, a red "Close zone 40%+", a rotating gold sweep; hover pauses the motion and shows a tooltip (name, %, source). A list on the right with % bars; close ones outlined in gold.
   - **Scores**: a gauge for the overall score, three coloured bars (Uniqueness, Legibility, Colour) and a dark "What to do" tip.
5. **Price and rules**: two highlighted cards (green **Free** with "Best value" ribbon, gold **৳250**), big faded numbers 20 / 10, and the rules list. Next to it: **What it can and can't do** and the disclaimer: "The certificate is an AI research report made on the date shown. It is not a legal guarantee and not a trademark registration."
6. **FAQ** (accordion, first one open).
7. **Maroon CTA**: "Pick your winner with confidence." Start a contest · How it works.

## Rules
- Match layout, colours and motion. Reuse the site header, footer, fonts and components.
- All motion off with `prefers-reduced-motion`.
- Works at 390px wide (the demo, steps and report stack; the floating logos hide on phones).
- Do not show any real client's logo or check result on this public page.
- Page title and meta description for SEO: "AI Logo Checker – check if your logo is original | logocontest.bd".

## Before going live
Check the menu link, the demo chips, the 4 steps, the verdict tabs, the radar hover, FAQ, phone layout, reduce-motion, and that pricing shows ৳5,000 / 20 free and ৳250 / 10 everywhere (this page, judging page box, admin, Settings).

---

## Prompt for Claude Code (paste this as one message)

```
Read design/logo-checker/LOGO-CHECKER-PAGE-HANDOFF.md fully and open design/logo-checker/logo-checker.html. Then look at the site's header menu, footer, the existing AI logo/copyright checker (judging page box, check limits, add-on purchase, My logo checks, admin Copyright checker page) and Settings.

Do not stop to ask me questions and do not wait for my OK between steps. Make sensible choices yourself and list them at the end.

Before changing anything, make a git commit (or tag) of the current state named "before-logo-checker-page" so we can roll back.

Then:
1. Create the public page /logo-checker exactly as in the handoff: hero with the "Try a sample" live demo (static example data), 4 clickable steps, five colourful check cards, the sample report with verdict tabs, similarity radar and scores panel, price and rules, can/can't, FAQ accordion and the maroon CTA. Add SEO title and meta description.
2. Add "Logo Checker" with a NEW pill to the main menu after Design Studio, and to the footer "For clients" links.
3. Change the checker pricing everywhere to: prize ৳5,000 or more = free with 20 checks per contest; under ৳5,000 = ৳250 add-on for 10 checks. Store 5000, 20, 10 and 250 in Settings, and update the checker limit logic, the judging-page box, My logo checks and the admin Copyright checker page to read them.
4. prefers-reduced-motion and layout at 390px wide.

Rules: never copy the LC logo images from the design file (they are third-party stock). Use images from public/logo-checker/ if they exist; if not, use simple neutral placeholder logos and tell me which files to add. Never show a real client's logo or result on this page. Keep the disclaimer text.

When done, run build, lint and any tests. Fix every error. If everything passes, deploy to production. If build or tests fail and you cannot fix them, do not deploy; tell me what failed.

After deploying, give me: the live URL, a short list of what changed, the choices you made, which example image files I should add, and the exact command to roll back to "before-logo-checker-page".
```
