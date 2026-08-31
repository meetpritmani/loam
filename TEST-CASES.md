# Loam — manual test cases

No browser-automation tool is available in this working environment, so
these are run by hand. Two automated checks exist and should run before any
manual pass: `node scripts/check-locales.mjs` (translation completeness) and
`shopify theme check` (schema/Liquid correctness) — neither can catch a
layout or click-target bug, which is what every case below is for.

Re-run this file after any change to `assets/global.js`, `assets/base.css`,
`card-product.liquid`, or any drawer. Record the date and result in
`PROGRESS.md`, not here — this file is the checklist, not the log.

## Viewport matrix

Run every case in this file at each of these, unless the case says
otherwise:

| Label | Width | Why this one |
|---|---|---|
| Mobile | 375px | The smallest supported width (§1) |
| Mobile landscape / small tablet | 750px | First CSS breakpoint |
| Tablet | 990px | Second breakpoint, nav switches to desktop mode |
| Desktop | 1440px | Default page width |
| Wide | 1920px | Content should cap at `--page-width`, not stretch |

Test on a real touch device or Chrome DevTools device mode for anything
marked **touch**, and with a mouse for anything marked **hover** — the two
do not always fail the same way.

---

## 1 — Material tag (plain and interactive)

| # | Case | Expected |
|---|---|---|
| 1.1 | Product with `custom.material` set, no composition/story | Plain `<p class="material-tag">`, not clickable, no caret |
| 1.2 | Product with `custom.material_composition` set | Tag becomes `<details>`; clicking (or Enter/Space on keyboard focus) opens a segmented bar + percentage list |
| 1.3 | Product with `custom.material_story` set, no composition | Tag opens to show only the story text, no bar |
| 1.4 | Product with neither material sub-field | No tag renders at all — not an empty wrapper |
| 1.5 | Same product's tag on card, cart line, and PDP | All three open/close independently; opening one does not affect another elsewhere on the page |
| 1.6 | Keyboard only | Tab reaches the tag, Enter/Space toggles it, focus ring visible |
| 1.7 | Screen reader | `<summary>` announces as a button with expanded/collapsed state |

## 2 — Footprint counter (cart)

| # | Case | Expected |
|---|---|---|
| 2.1 | Cart with zero items carrying `custom.carbon_footprint` | Counter does not render — no empty wrapper, no "0 kg" |
| 2.2 | Cart with one tracked item, qty 1 | Shows that product's exact footprint value |
| 2.3 | Same item, qty 3 | Shows `footprint × 3`, not `(footprint + something) × 3` — this exact class of bug shipped once already |
| 2.4 | Cart with a mix of tracked and untracked items | Sums only the tracked lines silently — no error, no "partial" disclaimer needed beyond the label itself |
| 2.5 | `cart_show_footprint` off | Never renders, regardless of cart contents |
| 2.6 | Add a second tracked item while drawer is open | Total updates and re-animates (count-up) without a page reload |
| 2.7 | Cart page vs. cart drawer | Both show the identical total for the identical cart |

## 3 — Compare tray and drawer

| # | Case | Expected |
|---|---|---|
| 3.1 | Fresh browser, never used compare | Tray is not visible anywhere, on any page |
| 3.2 | Click compare on one product card | Tray appears at the bottom, shows 1 chip, "Compare" button still disabled (or enabled — confirm intended threshold) |
| 3.3 | Add a 2nd and 3rd product from **different pages** (e.g. one from homepage, one from a collection) | Tray persists across navigation, shows all 3 |
| 3.4 | Try to add a 4th | 4th is refused, an announcement fires ("up to 3"), tray still shows exactly 3 |
| 3.5 | Remove a chip directly from the tray (×) | Tray updates immediately; that product's own card, if visible, shows its toggle button un-pressed |
| 3.6 | Toggle the same product's compare button in two places at once (e.g. its card on a collection grid, and again via quick view) | Both reflect the same pressed state at all times |
| 3.7 | Click "Compare" to open the drawer | **Dialog is opaque and fully readable** — page content must not show through. This is the exact bug already found once; re-check specifically at every viewport width |
| 3.8 | Compare drawer open at 375px | Table scrolls horizontally inside its own container; the page body itself never scrolls sideways |
| 3.9 | Compare drawer open at 1440px+ | Dialog is centred, capped at `900px`, not full width |
| 3.10 | Close via Escape, via the × button, and via clicking the scrim | All three close it; focus returns to whatever opened it |
| 3.11 | Clear all | Tray disappears, localStorage entry empties, re-opening a previously-compared product's card shows it un-pressed |
| 3.12 | Close the browser tab, reopen the site | Compare selection persists (localStorage), unless in a private/incognito window, where it may not — that is expected, not a bug |
| 3.13 | Compare drawer with 1 sold-out and 2 in-stock products | Availability column correctly distinguishes each |
| 3.14 | **Regression**: quick view still opens correctly on every card that also has a compare button | This pairing is what an earlier draft broke once already — check on the narrowest card layout in the theme (a PDP's related-products/complementary-products row, not just the main collection grid) |

## 4 — Back-in-stock

| # | Case | Expected |
|---|---|---|
| 4.1 | PDP, in-stock variant selected | No back-in-stock form anywhere |
| 4.2 | PDP, genuinely sold-out variant selected (verify via the variant picker's own `[data-variant-data]`, not a guess — see the note below) | Collapsed "Email me when this is back" row appears under Add to Cart |
| 4.3 | PDP, a variant *combination* that does not exist (e.g. a colour/size pairing never created) | No back-in-stock form — this is "Unavailable", not "Sold out", and there is nothing to be notified about |
| 4.4 | Submit the form with a valid email | Success message renders inline, no page navigation, no page-clearing |
| 4.5 | Submit with an invalid email | Inline error, field marked `aria-invalid` |
| 4.6 | Switch the variant picker away from the sold-out variant while the form is open | Form should disappear along with the rest of the sold-out state |
| 4.7 | Same check inside quick view (not just the full PDP) | Form appears/behaves identically there |
| 4.8 | `cro_back_in_stock` off | Never renders, even for a genuinely sold-out variant |

**Finding a real sold-out variant:** don't trust a `.json` endpoint's
per-variant `available` field for this — it returned `undefined` for every
variant during this session's own testing, which silently breaks a filter
like `.find(v => !v.available)`. Read `[data-variant-data]` from the
product page's own rendered HTML instead (the same JSON `VariantPicker`
itself uses) and confirm `"available": false` on the one you pick.

## 5 — Cross-feature regression (run after touching any card-product change)

Card-product now carries up to four interactive controls: quick view,
compare, quick add, and swatches. Any layout change to one is a layout
change to all four's shared space.

| # | Case | Expected |
|---|---|---|
| 5.1 | Narrowest card the theme ships (check the PDP's related-products/complementary-products row, and a 4-up mobile collection grid) | Quick view and compare are both independently clickable — hit-test each with a mouse click precisely on its icon, not just "somewhere near it" |
| 5.2 | Same narrow card, touch device | Both controls have a real tap target, not just a small icon glyph |
| 5.3 | Card with quick add AND compare both visible | Neither control's click accidentally triggers the other, and neither triggers the card's own stretched title link |
| 5.4 | Sold-out product card | Quick add shows disabled "Sold out"; compare and quick view still work normally (compare should still be able to compare a sold-out product) |

---

## Recording a result

When a case fails, write it up in `PROGRESS.md` the way every other bug in
this project has been recorded: what broke, the actual root cause (not just
the symptom), the fix, and how it was re-verified — not just "fixed" with no
evidence. When a case passes, it does not need its own log entry; a
regression sweep passing cleanly is only worth a line in the next relevant
entry, if that.
