# logocontest.bd: Designer profile page redesign — design handoff

Put this folder in the repo at `design/designer-profile/`. `designer-profile.html` is a static design reference, not code to paste in. Open it in a browser and point at things: most of the motion is on hover.

## Rules

1. Copy the layout, spacing, colours and motion from the design file. Reuse the site's existing header, footer, fonts and components.
2. Keep the existing profile data, routes, email confirmation flow, share and PDF features. Only add or change what is described below.
3. **No money anywhere on this page.** Remove the "Earned ৳" stat. Do not show prices, prizes or payouts.
4. Never copy the sample name "Tasnim Rahman", the bio, numbers, skills, tools or the drawn sample logos. Use the real designer's data. Everything in `[square brackets]` is a placeholder.
5. Works at 390px wide. Respect `prefers-reduced-motion` (turn off every looping animation).

## 1. Email confirmation bar (only for the logged-in owner whose email is not confirmed)

- One slim bar: mail icon, "Confirm your email. Enter the 6-digit code we sent to [your email].", six separate digit boxes, Confirm button, Resend code link.
- Digit boxes: typing a digit moves to the next box, Backspace moves back, pasting a 6-digit code fills all boxes. Keep the existing verification logic.

## 2. Profile header

- **Cover** (130px high, 110px on phones): maroon gradient, a big faint **"logocontest.bd"** wordmark centred in the middle with a gold ✦ on each side, a slow gold shine moving across the wordmark, and a small tag on the right: lc logo + "Designer on logocontest.bd".
- **Avatar**: large round photo (or initial if no photo) overlapping the cover, with a slowly rotating gold-maroon ring.
- **Name** + blue verified tick (show only if the designer's agreement is approved; tooltip "Verified designer"). Under it: @username · Member since [month year] · "Active today" with a pulsing green dot (only if active in the last 24 hours; hide otherwise).
- **Bio** from the profile.
- **Buttons** (owner only): Edit profile. **Share profile** (everyone): on hover/click opens a menu:
  - **View public profile** (owner only, highlighted): opens the profile exactly as clients see it (no Edit button, no email bar).
  - Copy link (shows a small "Copied" tick), Facebook, WhatsApp, Portfolio PDF (the existing PDF download).
- **Three highlight cards** under the buttons:
  - Latest win: small thumbnail of the latest winning logo, contest name, "#1 of [entries] · [time ago]". Click opens that design. Hide if no wins.
  - Best at: the designer's top skill (from Skills).
  - Speaks: languages set by the designer. Hide if empty.

## 3. Five colourful stat cards (no money)

Wins (gold), Designs sent (blue), Contests joined (green-teal), Win rate (maroon, with a ring = wins ÷ contests joined), Client rating (purple, average of client star ratings; show "–" if none). On hover: lift, slight tilt, and a light shine.

## 4. Portfolio

- Tabs: Winning logos, All designs (default), Top rated (designs with a client rating), with counts. Switching tabs filters instantly.
- Hint: "Point at a design and move left and right to see every file. Click to open it big."
- Cards: same as the new Design Studio cards: Winner/New badge, file count, and under the card the contest name, position or status (#1 of 14, Shortlisted, Contest open, Contest ended), time ago, and the client's star rating (or "Not rated").
- **Hover preview** and **full preview on click** work exactly like Design Studio (move the mouse across a card to flip through up to 8 files; click opens the full preview with arrows, all files, Previous/Next design and ✕). Reuse the same components. No designer profile links inside the preview.
- Footer: "Showing the latest [n] designs." and a **See more designs** button (loads more).
- Private / NDA contest designs must stay hidden from the public, exactly as today.

## 5. Right column

- **Skills** (set by the designer): 3–5 logo skills with a level (Learning, Good, Strong, Expert) shown as a bar; extra skill tags (chips). Hover: bar glows, chips turn maroon.
- **Tools** (set by the designer): tool name + years used. Show a coloured 2-letter tile (Ai, Ps, Fg…) and the tool name as **text only**. Do not use any tool's official logo. Hover shows "X years".
- **Works most with**: business types of the contests the designer joined, with counts and coloured bars. Calculated from existing contest data. Show the top 4.

If the site does not store skills, tools or languages yet: add them to the designer's Edit profile page (optional fields). Hide each box when it is empty.

## 6. Recent activity (full width, bottom)

The last 4 events from real data: sent a design, won a contest, got a rating, shortlisted. Each with time ago. Hide if empty.

## Before going live

1. Check a designer with no wins, no ratings, no skills (boxes hide cleanly).
2. Check owner view vs public view ("View public profile").
3. Check the share menu, PDF, hover preview, click preview and tabs.
4. Check at 390px wide and with reduce motion turned on.
5. Check that no money and no private/NDA designs appear.

---

## Prompt for Claude Code (paste this as one message)

```
Read design/designer-profile/DESIGNER-PROFILE-HANDOFF.md fully and open design/designer-profile/designer-profile.html. Then look at how the current designer profile page is built: profile data, wins, designs, ratings, contest business types, the email confirmation banner, Share profile and Download PDF, and the new Design Studio card, hover preview and full preview components.

Do not stop to ask me questions and do not wait for my OK between steps. Make sensible choices yourself and list them at the end. If skills, tools or languages are not stored yet, add them as optional fields on the designer's Edit profile page and hide each box when empty.

Before changing anything, make a git commit (or tag) of the current state named "before-designer-profile-redesign" so we can roll back.

Then build everything in the handoff:
1. Email confirmation bar with 6 digit boxes (auto-advance, backspace, paste).
2. Header: cover with the centred logocontest.bd wordmark and shine, rotating avatar ring, verified tick (only if agreement approved), active dot (only if active in the last 24 hours), bio, Edit profile (owner only), Share profile menu with View public profile (owner only), Copy link, Facebook, WhatsApp, Portfolio PDF, and the three highlight cards (Latest win, Best at, Speaks).
3. Five colourful stat cards: Wins, Designs sent, Contests joined, Win rate, Client rating. Remove the Earned stat. No money anywhere on the page.
4. Portfolio with tabs (Winning logos, All designs default, Top rated), the Design Studio cards with rating and status, hover preview, full preview on click, and See more designs. Keep private/NDA designs hidden as today.
5. Right column: Skills, Tools (text names only, no tool logos), Works most with (from contest business types).
6. Recent activity row from real events.
7. prefers-reduced-motion, layout at 390px wide.

Rules: use only real data; never copy the sample name, bio, numbers or logos from the design file; no money anywhere on this page; no designer profile links inside the design preview.

When done, run build, lint and any tests. Fix every error. If everything passes, deploy to production. If build or tests fail and you cannot fix them, do not deploy; tell me what failed.

After deploying, give me: the live URL of one designer profile, a short list of what changed, the choices you made, and the exact command to roll back to "before-designer-profile-redesign".
```
