# Future enhancements — not in CLAUDE.md, logged for later phases

Features worth building that are outside the current build spec (`CLAUDE.md`).
Nothing here is scheduled into §12's phases yet — each entry needs a
deliberate decision to pull in, at which point it should be added to
`CLAUDE.md` proper (§9.6 / §10) rather than left floating here.

---

## Quick view

**Requested:** 2026-08-27, referencing themes.shopify.com/themes/dynamic/presets/rich
as a CRO-strong reference implementation.

**What it is:** a modal opened from a product card — `featured-collection`,
`main-collection`, `main-search` — showing gallery, price, variant picker and
Add to Cart without leaving the grid. Distinct from quick add (already built,
§9.2 rule 6): quick add is zero-navigation for the common case (single
variant, no decision needed); quick view is for the case that *does* need a
decision (multiple variants, wants a second photo) without paying for a full
page load.

### Why not now

1. **Sequencing, not scope.** Phase 4 is actively building the PDP's
   sub-components — `variant-picker`, `buy-buttons`, `sticky-atc`,
   `size-guide` (all in `snippets/`, per the 2026-08-21 PROGRESS entry). Quick
   view is a compact embed of exactly that surface. Built now, it duplicates
   that logic. Built after, it fetches a lean product fragment through the
   Section Rendering API and reuses the same snippets the PDP already calls —
   the same pattern the cart drawer proves out for `cart-line.liquid`.
2. **Not in the spec.** Quick add is in §9.2/§9.4/§9.6. Quick view is not
   mentioned anywhere in `CLAUDE.md`. Building undocumented surface mid-build
   risks drifting from "the spec wins" and needs a conscious decision to
   amend §9.6 and §10 before it's built, not after.
3. **A real accessibility question needs answering first, not mid-build.**
   `card-product.liquid` already has two tab stops per card by design (title
   link with stretched `::after`, plus the quick-add button as a "genuinely
   new action" per §8's one-tab-stop rule). A quick-view trigger is a
   candidate third stop. Options: fold it into the same hover/focus-revealed
   affordance quick-add uses rather than adding a fourth control; or make it
   icon-only and visually paired with quick-add so the two read as one
   action cluster. This needs a decision, not a default.

### When picked up

After `main-product.liquid` and its snippets are complete and stable
(post-Phase-4), before Phase 7 hardening starts fresh Lighthouse/a11y passes.

### Draft requirements, for whoever builds it

- Trigger: icon button on `card-product.liquid`, visible without hover on
  touch (§9.4 featured-collection row: "quick add visible without hover on
  touch" — quick view should match, not regress to hover-only on mobile).
- Modal: `role="dialog"`, `aria-modal="true"`, focus trapped, `Escape`
  closes, focus returns to the trigger — same contract already proven by
  `<loam-drawer>` (cart, menu, search). Reuse that component rather than
  building a second modal primitive.
- Content: fetched via the Section Rendering API against the product's own
  URL (`?section_id=...`), not duplicated Liquid — mirrors how the cart
  drawer and variant picker already avoid rebuilding markup in JS (§4: "Never
  rebuild cart HTML in JS").
- Variant switching inside the modal updates price/media/availability the
  same way the PDP's `<variant-picker>` does — actually *reuse*
  `<variant-picker>`, don't reimplement it.
- Add to Cart from the modal must go through the existing `Cart.add()` path
  (`global.js`) so Section Rendering API refresh, `cart:updated`, and the
  `add_to_cart` dataLayer event (§9.8) all come for free — no second
  add-to-cart implementation.
- Unavailable variant combinations shown and marked, never hidden (§9.7,
  consistent with the full PDP).
- No layout shift on open/close; respects `prefers-reduced-motion`.
- Budget check before merging: current JS is 14.5KB/40KB, CSS 14KB/60KB —
  headroom exists, but re-measure after, same as every other phase.

### CRO rationale (for whoever writes the settings copy)

Fewer clicks to a purchase decision without leaving the browse context —
strengthens §9.2 rule 6 and the featured-collection / main-collection rows in
§9.4. Framed the same way §9.10's `CRO-CHECKLIST.md` frames everything else:
surface the merchant can use to reduce friction, not a promised lift.
