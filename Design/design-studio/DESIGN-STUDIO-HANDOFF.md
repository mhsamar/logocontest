# logocontest.bd: "Design Studio" page redesign — design handoff

Put this folder in the repo at `design/design-studio/`. The two HTML files are static design references, not code to paste in:
- `design-studio.html`: the page (hover a design to preview it, click it to open the full preview).
- `design-studio-full-preview.html`: the same page with the full preview already open.

## Rules

1. Copy the layout, spacing, colours and motion from the design files. Reuse the site's existing header, footer, fonts and components.
2. Keep the existing data, routes and Design Studio query. Only add what is described below.
3. Never copy the sample brands (Nodi Tea, Shapla Foods, …), logos, names, numbers or the "Sample designs" pill. They are drawn samples. Use the real designs from the database.
4. Works at 390px wide.
5. Respect `prefers-reduced-motion`: turn off every looping animation.

## 1. Hero (top)

- Left: "Live · designs coming in" pill with a pulsing red dot, the title "Design **Studio**" (Studio in maroon with a moving maroon-gold underline), one line of text, three stat boxes (Designs sent, New today, Winning designs: **real counts**), and the hint box "No click needed. Point at a design…".
- Right (desktop only, hidden under 1020px): three columns of recent design thumbnails that scroll slowly and forever (two up, one down), faded at top and bottom. They pause on hover and a hovered thumbnail grows slightly.
- A floating card over the columns cycles through the last 3 real events ("@user sent a design · Contest", "@user won · Contest"), changing every 3 seconds.
- Use the latest ~15 designs' first file as small thumbnails (lazy-loaded, small image size). Do not load full files here.

## 2. Filters

- Tabs: All designs, Winners, New today (with real counts). Search, business type, sort (Newest default).
- Keep tab, search, filter and sort in the URL.

## 3. Design cards (grid: 5 columns desktop, 4 under 1180px, 3 under 900px, 2 on phones)

- Square tile showing the design's first file, badges: **Winner** (gold, trophy) or **New** (maroon, sent in the last 24 hours), and the number of files (top right, only if more than 1).
- Under the tile: designer avatar, contest/brand name, @designer · time ago.
- Winner cards have a gold border.

## 4. Hover preview (desktop, no click)

A design can have **up to 8 files**.

- Mouse over a card: the card lifts slightly. After about 0.2 s a large preview card (about 520px) opens beside it: to the right for the left columns, to the left for the right columns, and upward for cards near the bottom of the screen (pick the side by measuring the space).
- Moving the mouse **left to right across the card** flips through the files: split the card into as many equal vertical strips as there are files; the strip under the mouse decides which file shows. The small card and the big preview change together.
- Shows a progress bar (one segment per file), "File 3 of 8 · [file label]", and a row of all file thumbnails with the current one outlined in maroon.
- Leaving the card closes the preview and resets to file 1.
- File labels: use the file's label if the site stores one; otherwise "File 1", "File 2", … (do not invent labels).
- Preload only the files of the hovered card, after the hover starts. Keep hover handling light (no re-render per pixel; update only when the strip changes).
- Touch screens: no hover preview. The tile becomes a swipe carousel of the files with the progress bar following the swipe.

## 5. Full preview (on click)

- Click (or Enter on keyboard) on a card opens a full-screen preview over a dark blurred background, with a small open animation.
- Top: designer avatar, contest/brand name, "by @designer · time ago", Winner/New badge, **Previous design** and **Next design** buttons (move through the designs in the current filtered list), and a black **✕** close button.
- Left: the current file large, on a light dotted background, with **‹ ›** arrows (wrap around from last to first).
- Right: "File 5 of 8 · [label]", **All files in this design** as clickable thumbnails (current one outlined), facts (Contest, Designer, Sent), and **View the contest** button.
- **Do not link to the designer's profile anywhere on this page** (owner's decision). The @name is plain text, not a link.
- Note under the button: "Files can be downloaded only by the contest owner after the contest ends." Confirm with the owner before going live that this matches the site's rule.
- Close with ✕, a click on the dark background, or **Esc**. Keyboard: **← →** change file, focus stays inside the preview while it is open and returns to the card when it closes.
- Put the open design in the URL (for example `?design=ID&file=3`) so the back button closes it and a link opens it directly.
- Phones: the preview fills the screen; file on top, thumbnails scroll sideways underneath.
- Load full-size images only in the full preview. Never show download buttons here.

## 6. Privacy and rules

- Show only designs the site already shows publicly today. Private / NDA contests must stay hidden exactly as they are now.
- Do not show the designer's real name, contact or profile link.
- The live stats and events must be real numbers. If there is no activity, hide the floating event card instead of faking one.

## Before going live

1. Test hover on a design with 1, 3 and 8 files, cards at the edges and the bottom row.
2. Test click, arrows, thumbnails, Previous/Next design, ✕, background click, Esc, back button, and a direct link.
3. Test on a phone at 390px (swipe and full preview).
4. Check private/NDA designs do not appear.
5. Turn on "reduce motion" in the OS and check the loops stop.
6. Deploy to production.

---

## Prompt for Claude Code (paste this as one message)

```
Read design/design-studio/DESIGN-STUDIO-HANDOFF.md fully and open design/design-studio/design-studio.html and design/design-studio/design-studio-full-preview.html. Then look at how the current Design Studio page is built: the query for designs, how files of a design are stored (how many, labels if any, image sizes), winners, private/NDA contest rules, and the shared header and footer.

Before writing code, give me a short plan and your questions (including: are file labels stored, are thumbnails/smaller image sizes available, and what is the download rule for files). Then wait for my answers.

Build in this order. After each phase run build and lint, show me what changed, and wait for my OK:
Phase 1: the hero (real stats, live pill, animated thumbnail columns, rotating event card from real data), the filters with URL state, and the new card grid with Winner/New badges and file count.
Phase 2: the hover preview: big preview beside the card on the side with more space, flipping through up to 8 files by moving the mouse across the card, progress bar, label and thumbnail row; swipe carousel on touch screens.
Phase 3: the full preview on click: large file, arrows, all-files thumbnails, Previous/Next design, close with the X, background click or Esc, keyboard arrows, focus trap, and the open design in the URL. No designer profile links anywhere.
Phase 4: performance (lazy loading, preload only the hovered card, small thumbnails), prefers-reduced-motion, and checks at 390px wide.

Rules: use only real data; never copy the sample brands, logos or numbers from the design files; keep private/NDA designs hidden as today; do not add download buttons; do not deploy to production. I will test on a preview first.
```
