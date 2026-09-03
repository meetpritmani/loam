# Theme Store requirements audit — Loam

Running check against https://shopify.dev/docs/storefronts/themes/store/requirements,
one section at a time. Updated as we go through the page together.

Legend: ✅ Pass · ⚠️ Partial / needs a manual step · ❌ Gap, action needed

---

## 1. Theme Store exclusivity

✅ **Pass.** No designer-credit or affiliate links found anywhere in theme files
(`README.md`'s "Credits and licence" section only documents media/code
provenance, not a designer link). `CLAUDE.md` §0 updated 2026-09-02 to target
the Theme Store exclusively — no plan to also sell on TemplateMonster/Gumroad,
so no exclusivity conflict.

---

## 2. Uniqueness from other themes

⚠️ **Can't be fully verified from code.** No Dawn or Skeleton Theme
fingerprints found (`PUB_SUB_EVENTS`, `HTMLUpdateUtility`, `trapFocus`,
`quick-add-modal`, etc. all absent) — codebase is original, not derived from
either. But "fundamentally different from the current Theme Store catalog" is
a subjective, comparative judgment that needs an actual human side-by-side
against live listings at themes.shopify.com before submission. Not something
a repo-only check can certify.

**Action:** manual visual-comparison pass against the live Theme Store
catalog before submitting, ideally against other minimal/earthy-aesthetic
themes specifically.

---

## 3. Theme design and UX

### Visual design and art direction

- ⚠️ **Unique and intentional design** — same caveat as §2, needs the manual
  comparison pass. Theme does target a specific merchant type (natural-materials
  footwear) with a deliberate, consistent style (two signature elements:
  material tag + seam divider).
- ✅ **Professional-quality visuals** — spot-checked `demo-hero.webp`,
  `demo-product-1.webp`, `demo-avatar-1.webp`: high-res, sharp, consistent
  tone, no artifacts, no deformed anatomy, no rendered text. Worth a full
  pass over all ~40 demo images before submission, but the sample is solid.
- ✅ **Simple, complementary color palette** — `snippets/theme-tokens.liquid`
  implements the CLAUDE.md §2 palette (ink/paper/surface/accent/sand/signal)
  as a small, role-based token set, AA contrast required by §8.

### Layout

- ✅ **Clear, organized page structure** — single 8-step spacing scale
  (`--sp-1`…`--sp-9`) and a shared responsive grid pattern used consistently.
- ✅ **Clear content hierarchy** — systemic type scale (`--t-sm` → `--t-3xl`,
  all `clamp()`-based in `theme-tokens.liquid`), merchant-tunable via
  `--heading-scale`.
- ⚠️ **Flexible layouts that look intentional** — structurally required by
  CLAUDE.md's own definition-of-done (§14: every section must render with
  zero/one/max blocks and on a zero-product store), but not individually
  re-verified section by section in this audit.
  **Action:** manual pass resizing/emptying content on testimonials,
  featured-collection, lookbook-collage.

### Consistency

- ✅ **Consistent typography** — exactly 2 `font_picker` settings total
  (heading + body), no font sprawl.
- ✅ **Consistent visual/interaction design** — single button system
  (`.button`, `.button--primary/secondary/tertiary/full`) defined once,
  reused across 26 files / 35 call sites.
- ✅ **Settings clearly organized** — `settings_schema.json` groups into 12
  logically-named sections, every label localized via `t:` (verified zero
  raw-English labels).
- ⚠️ **Merchant-first editor experience** — structurally supported (scoped
  controls, opinionated defaults) but this is ultimately judged by actually
  clicking through the editor.
  **Action:** real editor click-through before submission.

### Customer shopping experience

- ✅ **Clear & effortless navigation** — mega menu + mobile drawer, cart
  drawer, breadcrumbs, footer nav all present.
- ✅ **Thoughtful product discovery** — predictive search, related products
  (from `recommendations`), recently viewed, featured-collection/
  collection-list merchandising sections.
- ✅ **Frictionless shopping interactions** — variant switching, quick view,
  cart add/change, facets all go through the Section Rendering API
  (`fetch` + `section_id=`), not full-page reloads.
  **Action:** real click-through (variant → add to cart → edit cart →
  checkout) worth doing before submission; nothing in the code suggests a
  friction point.

### Demo store experience

- ✅ **Complete, realistic demo store** — Phase 5 done per `PROGRESS.md`:
  48/48 media files sourced/licensed/uploaded, real catalog (8 products,
  variants, one sale item, sold-out variants), collections, pages, blog,
  menus seeded on a live demo store. No lorem ipsum found anywhere.
- ✅ **Relevant, intentional sections** — all 15 homepage sections built,
  each tied to a specific merchandising purpose per CLAUDE.md §9.4.
- ✅ **Inspiring merchant experience** — per `README.md`'s current build
  status: fresh-store install test confirmed, desktop Lighthouse 90+
  repeatably, listing screenshots captured (10 page states × 3 breakpoints,
  both theme styles). **VoiceOver pass is the one item still open** per the
  theme's own README — needs macOS/Safari access.

---

## 4. Features

- ✅ **Sections Everywhere** — every template is JSON
  (`templates/*.json` + `templates/customers/*.json`); `gift_card.liquid` is
  the expected Shopify-convention exception.
- ✅ **Accelerated checkout buttons** — `{{ form | payment_button }}` on the
  product page (`buy-buttons.liquid`), `content_for_additional_checkout_buttons`
  on the cart page and cart drawer (correct mechanism for that page type),
  both gated by `settings.cro_dynamic_checkout`. No CSS overrides the
  Shopify payment-button classes — branded colors untouched.
  **Refined 2026-09-03, not reversed:** raised by the operator as "the blue
  button doesn't match the theme" on the PDP/quick view. Inspected the live
  markup rather than assuming either "it's fine" or "just override it" —
  the rendered button is specifically `shopify-payment-button__button--unbranded`
  (Shopify's generic "Buy it now," not a branded wallet button like Shop Pay
  or PayPal), sitting in plain light DOM, no shadow root. Shopify's own
  documentation is explicit that this variant *is* meant to be theme-styled
  ("customize the colors and font on your unbranded accelerated checkout
  buttons") — unlike the branded versions, which stay untouched exactly as
  this audit line already said. The theme shipped with no CSS hook for that
  class at all, so it fell back to Shopify's own SDK blue by default,
  clashing with the theme's ink/paper palette. Added a scoped rule
  (`.buy-buttons__express .shopify-payment-button__button--unbranded`, the
  wrapper `buy-buttons.liquid` already renders on both the PDP and quick
  view) styling it as `.button--secondary`'s own outlined treatment —
  transparent fill, ink border and text — so it reads as the secondary
  action beneath the solid "Add to cart" button rather than a second CTA of
  equal weight (§9.2 rule 1). Needed a two-class descendant selector, not a
  bare one: Shopify's own `accelerated-checkout.css` loads after `base.css`
  and carries the identical bare-class selector, so equal specificity would
  have left the winner decided by load order. The descendant form lands
  exactly at CLAUDE.md's own 0,2,0 specificity ceiling and wins regardless
  — confirmed live (computed styles showed Shopify's blue before, the
  theme's ink tokens after), not assumed from source alone.
  **Two follow-ups from the same live check, both operator-raised:**
  - **Hover state didn't match either.** Shopify's own hover rule
    (`.shopify-payment-button__button--unbranded:hover:not([disabled])`)
    turned out to tie the fix above at the exact same specificity —
    `:not([disabled])` contributes a selector's worth of specificity same as
    a class does, so `:hover` + that trick lands at 0,3,0, matching a
    `:hover` appended to the already-0,2,0 base rule. Confirmed live via
    Chrome DevTools Protocol's `CSS.forcePseudoState` (a real mouse hover
    couldn't reach the button in headless testing — a wrapper element
    intercepts pointer events) that Shopify's blue-on-hover was still
    winning. Escalating specificity again would either exceed CLAUDE.md's
    own 0,2,0 ceiling or just restart the same arms race if Shopify ever
    changes their selector — so this one *does* use `!important`, scoped to
    this single rule and commented as a second, deliberate exception
    alongside `.visually-hidden` for exactly this reason: it is fighting a
    versioned third-party stylesheet outside the theme's own cascade, not
    theme-internal CSS, which is what the no-`!important` rule actually
    exists to keep sane. Restyled to match `.button--secondary:hover`'s own
    established pattern exactly (full invert to solid ink background, paper
    text) rather than the weaker tint first tried, for consistency with
    the rest of the theme's secondary-button hover behavior.
  - **Button text sat visibly low, not centered.** Shopify's own box model
    doesn't actually fit together — `height: 44px` (border-box) minus its
    own `padding: 1em 2em` (16px top/bottom) minus a ~16px `line-height`
    overflows the box by design, and block-flow text has nowhere to center
    itself under that math. `.button` elsewhere in the theme avoids exactly
    this failure mode with `display: inline-flex` + centered alignment;
    added the same to this rule rather than fighting Shopify's padding
    numbers directly. Confirmed via computed styles (`display: flex`
    applied) and a live screenshot.
  Live-verified via `shopify theme dev` + Playwright on both the PDP and
  quick view throughout. `shopify theme check`: 123 files, 0 offenses.
  **Third follow-up, same conversation:** the operator clarified "both
  buttons" also meant "Add to cart"'s own hover — it turns `--c-accent`
  green (`.button--primary:hover`, `base.css`), which is a pre-existing
  behavior, not something this session introduced, but a real inconsistency
  once actually checked against the theme's own rules: `theme-tokens.liquid`
  documents `--c-accent`'s role as "link hover, progress, focus ring" —
  button hover was never on that list, the same restraint principle already
  applied to `--c-signal` (sale price only). Fixed by deriving a new token,
  `--c-button-hover` (`--c-button` mixed 85% toward the scheme's own paper,
  same `color_mix` mechanism `--c-ink-70/45/12` already use, generated
  per-scheme in `theme-tokens.liquid` so it stays correct even if a
  merchant sets a custom `button` colour that differs from `text`), and
  pointing `.button--primary:hover` at it instead of `--c-accent`. This
  touches every `.button--primary` sitewide (Add to Cart, hero CTAs,
  newsletter submit, etc.), not just the PDP — a single shared class, one
  fix. Reran `node scripts/check-contrast.mjs` after adding the token: 96/96
  required pairs still pass (the new token wasn't in the script's hardcoded
  pair list, but at 85% ink it's darker than the already-passing `--c-ink-70`
  text tint, so a button-label-on-hover-background contrast failure isn't
  plausible — verified by the arithmetic, not just assumed). Confirmed the
  actual rendered value live: `rgb(50, 59, 55)` / `#323B37`, matching the
  hand-computed 85/15 mix exactly, clearly distinct from the `#2E6B4F`
  accent green it replaced. Documented the new token's rationale in
  `theme-tokens.liquid`'s own header comment, dated, alongside the existing
  ink-70/45/12 documentation.
- ✅ **Discounts** — **FIXED 2026-09-02.** Cart page and cart drawer already
  showed per-item (`line_level_discount_allocations`) and order-level
  (`cart_level_discount_applications`) discounts. `sections/main-order.liquid`
  (customer's past-order page) was missing any discount display — added the
  same per-item and order-level discount breakdown there
  (`.order-table__discounts`, reusing the existing `.badge` class).
  `shopify theme check`: 121 files, 0 offenses after the fix.

---

## 5. Faceted search, gift cards, focal points, social images

- ✅ **Faceted search filtering** — `main-collection.liquid` and
  `main-search.liquid` both drive filtering off `collection.filters`/
  `search.filters` through a shared `facet-controls.liquid` component.
- ✅ **Gift cards** — `templates/gift_card.liquid` is a standalone
  `layout none` page rendering balance, expiry, code, QR image, Apple
  Wallet link.
- ✅ **Image focal points** — `image-fallback.liquid` reads
  `image.presentation.focal_point.x/y`, applies as inline `object-position`
  uniformly on every cover-cropped image.
- ✅ **Images for social sharing** — `meta-tags.liquid` uses
  `page_image | default: settings.share_image` for `og:image`, resolving
  per template automatically.
- ✅ **Not part of this checklist item, but flagged along the way — FIXED
  2026-09-03.** CLAUDE.md §9.5 itself requires "Print and Apple Wallet
  options" on the gift card page. Apple Wallet was present; no print
  button/link existed. Added a `data-print-gift-card` button calling
  `window.print()`, plus a `@media print` rule (`.gift-card__no-print`)
  hiding the print/continue-shopping actions on the printed page since only
  the card itself is useful on paper. Wired inline rather than through
  `global.js`: this template deliberately skips the theme's main JS module
  (same reason `qr-code.js` is loaded standalone here), and one button
  doesn't earn pulling the whole bundle in. `shopify theme check`: 121
  files, 0 offenses. Not live-tested end to end — no redeemable gift card
  exists in the seeded demo catalog to open the real balance page against
  (see item 42), so this was verified by source review only.

---

## 6. Country/language selection, multi-level menus, newsletter

- ✅ **Country selection** — `localization-form.liquid`, real
  `{% form 'localization' %}`, gated on `localization.available_countries.size > 1`,
  works without JS, wired into announcement bar and footer.
- ✅ **Language selection** — same snippet/pattern, gated on
  `localization.available_languages.size > 1`, uses `endonym_name`.
- ✅ **Multi-level menus** — header mega menu goes parent → child →
  grandchild (`link.links` → `child.links`).
- ✅ **Newsletter forms** — real `{% form 'customer' %}` with
  `contact[email]`, shared via one `newsletter-form.liquid` snippet across
  newsletter section, footer, blog/article capture points.

No gaps in this batch.

---

## 7. Pickup availability, recommendations, rich media

- ✅ **Pickup availability** — `sections/pickup-availability.liquid`,
  fetched via Section Rendering API on variant change, scoped correctly to
  the variant.
- ✅ **Related product recommendations** — `related-products.liquid` uses
  `routes.product_recommendations_url` + `recommendations.products`/
  `recommendations.performed`, lazy-fetched, hidden below a minimum count.
- ✅ **Complementary product recommendations** — `complementary-products.liquid`,
  deliberately separate section using `&intent=complementary`, matching
  Shopify's own distinction between the two features.
- ✅ **Rich product media — both gaps FIXED 2026-09-03:**
  - `main-product.liquid` itself was already fine (`video`, `external_video`,
    `model` media types all handled via `external_video_tag`/
    `model_viewer_tag`).
  - **Quick view gap, fixed.** `sections/quick-view.liquid` only ever
    rendered a static image via `image-fallback` — a product whose primary
    media is a video or 3D model showed a flat picture in quick view instead
    of the actual rich media. Added the same `video`/`external_video`/
    `model`/image `{% case %}` switch `main-product.liquid` already uses.
    Variant switching needed its own fix underneath: `VariantPicker.onChange`
    (`global.js`) only ever updated an `<img src>` in place, so a quick view
    that opened on rich media had no `<img>` to update and would leave the
    video/model stuck on screen after picking a variant with its own image.
    Rewired the swap to detect this (create a fresh `<img>` when none exists)
    and renamed `data-quick-view-media` → the more general `data-media-target`
    so `featured-product.liquid` (below) can share the exact same logic.
  - **Featured product section gap, fixed.** The Theme Store checklist
    names three required surfaces for rich media — product template,
    featured product section, quick view. This theme had
    `featured-collection` (a grid of many products) but **no single-product
    spotlight section** at all — a distinct required section type, missing
    from both `CLAUDE.md` §10's inventory and the actual `sections/` folder.
    Built `sections/featured-product.liquid`: single merchant-picked
    product, its own media slot (all four media types, same pattern as quick
    view — not main-product's full stacked gallery, which is more than a
    spotlight needs), real variant picker + buy form reusing the existing
    snippets, `@app` block, and a `custom_liquid` block (closing out item 11
    for this section too, per that item's own note that it was "still open"
    here). Falls back to `card-product.liquid`'s own demo-shoe mode when no
    product is picked or the store has none — same mechanism
    `featured-collection.liquid` already uses, rather than an empty state,
    since there's no honest way to show a working buy form for a product
    that doesn't exist. **Not added to `templates/index.json`** — this
    exists to satisfy the "featured product section" requirement (available
    in the editor with a preset) rather than as a 20th homepage section; the
    homepage preset is already tuned to the ≤12-section/Lighthouse budget in
    `CLAUDE.md` §5, and adding a real product spotlight there would need its
    own perf re-validation. Live-tested end to end via `shopify theme dev` +
    Playwright (temporarily, not committed): zero-product demo fallback
    renders correctly, and with a real product picked the full flow —
    variant selection, Add to Cart, cart drawer open, correct line item —
    all worked from inside the new section. `shopify theme check`: 123
    files, 0 offenses.

---

## 8. Search, selling plans, Shop Pay Installments, unit pricing

- ✅ **Search box or a link to search** — `header.liquid` has a real search
  form (`action="{{ routes.search_url }}"`) plus a `<predictive-search>`
  element hitting `routes.predictive_search_url`; `templates/search.json`
  exists.
- ✅ **Shop Pay Installments** — `buy-buttons.liquid` uses
  `{{ form | payment_terms }}` (Shopify's current unified financing-banner
  filter, supersedes the older standalone installments widget), explicitly
  commented in the code as a Theme Store requirement.
- ✅ **Unit pricing** — `price.liquid` renders `unit_price`/
  `unit_price_measurement`, reused across `card-product.liquid` (Collection
  page), `main-product.liquid` (Product page), and `cart-line.liquid` (Cart
  page + cart drawer) — all three required surfaces covered from one shared
  snippet.
- ✅ **Selling plans — real gap, FIXED 2026-09-03.** `cart-line.liquid`
  already correctly *displayed* `item.selling_plan_allocation` when a line
  was bought via a plan, but no selling-plan selector existed anywhere in
  the theme — no way for a shopper to actually choose a subscription plan
  vs. one-time purchase, so the cart-display code could never trigger. Built
  `snippets/selling-plan-selector.liquid`: renders nothing when the product
  has no selling plans, otherwise a "One-time purchase" radio (skipped when
  `product.requires_selling_plan`) plus one radio per plan across every
  group on `product.selling_plan_groups`, each showing the plan's own
  `name`/`description` — no price-per-plan display, and deliberately so:
  plan availability and copy are product-level (`product.selling_plan_groups`
  doesn't change on a variant swap), but a plan's *price* is variant-scoped,
  and syncing that live would mean pulling it into the same refresh cycle as
  price/low-stock — more machinery than the agreed scope asked for. Wired
  into `main-product.liquid` as a new `selling_plan` block (between
  `low_stock` and `buy_buttons`, matching the natural pick-a-plan-then-buy
  order) and into `templates/product.json`'s block order, plus the same
  block on the new `featured-product.liquid` section for consistency between
  the theme's two buy-a-product surfaces.
  **The "existing hidden `selling_plan` input" this item's action line
  referred to didn't actually exist** — grepped the whole theme and found
  none; `buy-buttons.liquid` had never had one. Built it as part of this fix:
  the selector's radios live outside the actual `<form>` (same as
  `variant-picker.liquid`'s own inputs), associated via
  `form="{{ section_id }}-form"` rather than DOM nesting, which the HTML
  spec means `FormData(form)` and native submission both already honor
  without any new plumbing — confirmed, not assumed, since `ProductForm`'s
  `ready-to-submit` path (`global.js`) already relies on the same mechanism
  for the gift-card recipient fields added earlier this session. Extended
  `ProductForm.onSubmit`'s `extra` payload (the same one built for gift-card
  recipient data) to also read `selling_plan` from `FormData` and pass it to
  `Cart.add`, so a chosen plan actually reaches `/cart/add.js` — a blank
  value (one-time purchase) sends nothing extra, matching how the gift-card
  checkbox already behaves when unchecked. Live-tested via `shopify theme
  dev` + Playwright: PDP renders correctly with the block present and no
  plans configured (renders nothing, no gap left behind) — no product in
  the seeded demo catalog currently has selling plans, so the "plan actually
  selected and reaches checkout" path is source-reviewed and reasoned from
  the proven gift-card-recipient mechanism, not click-tested against a real
  plan. `shopify theme check`: 123 files, 0 offenses.

---

## 9. Section support, block support, app blocks

- ✅ **Custom Liquid section** — `sections/custom-liquid.liquid` exists,
  `"type": "liquid"` setting, no `enabled_on`/`disabled_on` restriction, so
  available on every section-supporting template.
- ✅ **Header/footer rendered within section groups** — `layout/theme.liquid`
  calls `{% sections 'header-group' %}` / `{% sections 'footer-group' %}`,
  backed by real `sections/header-group.json` / `footer-group.json`.
- ✅ **Blocks for all/most product-page elements** — `main-product.liquid`
  has 14 distinct block types (`vendor`, `title`, `badges`, `price`,
  `material`, `carbon`, `variant_picker`, `low_stock`, `buy_buttons`,
  `pickup`, `trust`, `description`, `accordion`, `share`) — matches Dawn's
  granularity.
- ⚠️ **App blocks (`@app`) in main product + featured product section** —
  `@app` correctly present in `main-product.liquid`, `main-collection.liquid`,
  `main-cart.liquid`, `cart-drawer.liquid`. Still blocked on the same missing
  featured-product section already logged under §7 — can't carry an `@app`
  block if the section doesn't exist.
- ✅ **Custom Liquid blocks in sections with `@app` blocks — real gap,
  FIXED 2026-09-03.** Only one place in the theme had a `"type": "liquid"`
  setting: the standalone `custom-liquid.liquid` section. None of the four
  sections carrying `@app` blocks (`main-product`, `main-collection`,
  `main-cart`, `cart-drawer`) also offered a Custom Liquid *block* as a
  second app-insertion point, which this requirement asks for specifically.
  Added a `custom_liquid` block type to all four, reusing
  `custom-liquid.liquid`'s own locale keys (`t:sections.custom_liquid.name`
  / `.custom_liquid.label` / `.info`) rather than minting four near-duplicate
  keys for the same concept. Still open: the same block type on the new
  featured-product section once that's built (item 9).
  `shopify theme check`: 121 files, 0 offenses.
- ✅ **`config/markets.json`** — correctly absent from the repo.

---

## 6. Lighthouse performance and accessibility

Theme Store's actual bar here (60 performance / 90 accessibility, averaged
across product/collection/home, desktop+mobile) is well below CLAUDE.md's
own internal target of 90+ mobile everywhere — so this one is comfortably
covered by data already in `PROGRESS.md`.

- ✅ **Performance ≥ 60 average** — desktop 99–100 across all three page
  types; mobile (clean empty-cart session) ~81; worst individually-logged
  number anywhere (collection page, an early pre-fix run) was 63 — still
  above 60, and that predates the later image-delivery and DOM-size fixes.
- ✅ **Accessibility ≥ 90 average** — logged scores are 96–97 across home,
  product, and collection.
- ✅ **Sections contain real content when tested** — demo store is fully
  seeded (Phase 5 done), not an empty-state test.
- ⚠️ **Caveat, not a gap:** Shopify's official review runs its own
  benchmark-dataset script, not ad hoc DevTools Incognito runs. Numbers are
  strong enough this is unlikely to flip, but worth actually running
  Shopify's benchmark tool once before submission as a verification step.

---

## 7 (Pages). Product page requirements

- ✅ **Product information** — `product.title` (escaped, not truncated in
  Liquid or CSS), `variant.price` and `variant.unit_price` via
  `price.liquid`, compare-at price, `product.description`, option names/
  values via `variant-picker.liquid`.
- ✅ **All product images displayed/viewable, different ratios don't break
  layout** — the two-column stacked gallery applies a merchant-controlled
  `.media--{ratio}` box uniformly per image regardless of source aspect
  ratio.
- ✅ **Variant images shown on selection** — confirmed under §"Variant
  images" earlier: `global.js` syncs `product-gallery.show(variant.featured_image.id)`
  on variant change.
- ❌ **`cart.taxes_included` indicator — real gap, FIXED 2026-09-02.** Zero
  usage anywhere in the theme before this fix — a tax-inclusive store had no
  way to tell shoppers the price already includes tax. Added a
  `show_tax_note` opt-in param to `price.liquid` (gated on
  `cart.taxes_included`, rendered only on the product page, not repeated on
  every card/cart-line), wired into `main-product.liquid`'s price block, and
  added `products.product.price.tax_included` to **all 8 locale files**
  (en, ar, de, es, fr, it, ja, pt-PT). `shopify theme check`: 121 files, 0
  offenses.
- ✅ **Buying functions** — real option selectors, quantity input, Add to
  Cart (disabled + labeled for sold-out/unavailable per CLAUDE.md §9.6),
  variant-change callback syncing price/compare-at/availability via
  `data-price-target`, `product.selected_or_first_available_variant` drives
  initial state.

---

## 7 (Pages, cont'd). Product page features, gift card recipient, swatches

- ✅ **Product page feature bundle** — recommendations, pickup availability,
  and Shop Pay Installments already confirmed earlier. Accelerated checkout
  confirmed **enabled by default** (`cro_dynamic_checkout` defaults `true`
  in `settings_schema.json`). Rich product media is the one still-open item
  from §7 above (quick view + missing featured-product section).
- ✅ **Gift card recipient — real gap, FIXED 2026-09-03.** Grepped the
  whole theme for `recipient`, `form.email`/`form.name`/`form.message`, and
  `send_on` — zero matches anywhere. The gift-card product's buy form had
  no way for a shopper to send the card to someone else's email with a
  message and a scheduled send date — it could only be bought for the
  purchaser. Added a `<gift-card-recipient-form>` block to
  `buy-buttons.liquid`, gated on `product.gift_card?`: a checkbox (which
  IS the `properties[__shopify_send_gift_card_to_recipient]` field —
  unchecked checkboxes are simply absent from form data, so an un-ticked
  box behaves like a normal, non-gift purchase) plus `recipient[email]`
  (required once checked), `recipient[name]`, `recipient[message]`, and
  `recipient[send_on]` (date, minimum today). Works with no JS at all —
  the fields render open and enabled by default; the new custom element
  only collapses them behind the checkbox once it knows script is actually
  running, toggling `required` on the email field to match. This surfaced
  a real gap one level down: `ProductForm.onSubmit` (`global.js`) was
  calling `Cart.add(id, quantity)` with only those two fields — any
  `properties`/`recipient` data typed into the form was being silently
  dropped before it ever reached `/cart/add.js`. Fixed `Cart.add` to take
  an optional third `extra` argument merged into the JSON payload, and
  `ProductForm.onSubmit` to read the checkbox + recipient fields via
  `FormData` and pass them through — scoped narrowly to this one feature
  rather than a generic form-serializer, since that is the only field set
  the theme currently needs to carry. Translated the four new labels plus
  the checkbox and the send-on hint into 7 of the theme's 8 locales — see
  the new finding below on `locales/ar.json` for why Arabic didn't get
  this one. `shopify theme check`: 121 files, 0 offenses. `node --check`
  clean on `global.js`. Live-verified via `shopify theme dev` + Playwright
  that the PDP still renders and functions correctly with these changes in
  place; the recipient form itself needs a real gift-card product in the
  catalog to exercise end to end (none exists — same gap as item 42), so
  that part is source-reviewed, not click-tested.
- ✅ **Swatches — real gap, on the PDP specifically, FIXED 2026-09-03.**
  `card-product.liquid` and `facet-controls.liquid` both correctly used
  `value.swatch.color`. But **`variant-picker.liquid` — the actual
  product-page option selector — rendered every value as a plain text
  label, no swatch at all**, which is the most important surface for this
  feature. Separately, `swatch.image` was used **nowhere** in the theme —
  only `swatch.color` was ever read. Added swatch rendering (both
  `swatch.color` and `swatch.image`, image taking priority when both are
  set) to `variant-picker.liquid`'s value labels for color-named options —
  the dot sits ahead of the text rather than replacing it, so the value
  name stays readable and the touch target stays the same ≥44px size. Added
  `swatch.image` support alongside the existing `swatch.color` handling in
  `card-product.liquid` and `facet-controls.liquid`. Verified live via
  `shopify theme dev`: the seeded catalog's own color option values have no
  swatches configured in admin, so the dots correctly render nothing extra
  (no broken/empty-circle state) rather than being confirmed with an actual
  colored swatch — the no-swatch-set path is the one that was actually
  exercised. `shopify theme check`: 121 files, 0 offenses.

---

## 7 (Pages, cont'd). Collection List page requirements

- ✅ **`collection.title` (not truncated)** — `card-collection.liquid` uses
  it directly, no `truncate` filter, no CSS ellipsis/line-clamp.
- ✅ **`collection.featured_image`** — same snippet, correctly relies on
  Shopify's own built-in fallback to the first product's image when a
  collection has no image of its own.
- ✅ **Pagination or lazy loading — real gap, FIXED 2026-09-03.**
  `sections/main-list-collections.liquid` rendered every non-empty
  collection in one unbroken loop — no `{% paginate %}` around
  `collections`, no lazy-loading component. The collection *page* correctly
  paginated its products (§ above), but the collection *list* page didn't
  paginate the collections themselves. Wrapped `collections` in
  `{% paginate collections by section.settings.collections_per_page %}`
  (new setting, default 24, range 8–48), rendered through the same
  `pagination.liquid` snippet `main-collection.liquid` already uses. One
  real trade-off, documented in-line: the section's existing "Alphabetical"
  sort option is applied to each page's slice, not the full set — Liquid
  has no way to sort the complete collection list before Shopify paginates
  it — which only matters once a store has enough collections to span more
  than one page. Live-verified via `shopify theme dev`: the seeded store
  has 7 collections (under the 24-per-page default), so the grid rendered
  correctly and pagination controls correctly stayed hidden — the
  multi-page path itself wasn't exercised against real data.
  `shopify theme check`: 121 files, 0 offenses.

---

## 7 (Pages, cont'd). Cart page requirements

- ✅ **`line_item` details** — `title`, `image`, `quantity` confirmed in
  `cart-line.liquid`; `unit_price`/`final_price` confirmed earlier.
- ✅ **`cart.total_price` visible.**
- ✅ **Checkout button submits cart form.**
- ✅ **Quantity update refreshes all line items/totals — done well.**
  `Cart.post()` re-fetches cart sections via the Section Rendering API on
  every change and swaps the whole body/footer region, not just the touched
  line, with focus preserved.
- ✅ **Quantity change per line, empty-cart message, cart notes, automatic
  discount codes, accelerated checkout default-on** — all confirmed present.
- ❌ **`cart.taxes_included` — real gap, FIXED 2026-09-02.** Zero usage on
  the cart page or drawer. Worse than just missing: both had a hardcoded
  "Taxes and shipping calculated at checkout" note that would be **actively
  false** on a tax-inclusive store. Added `cart.taxes_included_shipping_note`
  and a conditional in both `main-cart.liquid` and `cart-drawer.liquid`,
  translated into all 8 locales.
- ❌ **`item.options_with_values` — real gap, FIXED 2026-09-02.**
  `cart-line.liquid` used `item.variant.title` (one concatenated string)
  instead of the literally-named attribute. Switched to a
  `{% for option in item.options_with_values %}` loop rendering
  `Name: Value` pairs, plus a small `.cart-line__variant` CSS rule to keep
  the compact single-line look.
  `shopify theme check`: 121 files, 0 offenses after both fixes.

---

## 7 (Pages, cont'd). Page + Blog page requirements

- ✅ **`page.title` / `page.content`** — both rendered directly in
  `main-page.liquid`, no truncation.
- ✅ **Alternate contact-form template** — `templates/page.contact.json`
  exists, fully populated with real copy, a `contact-form` section plus
  quick-route links, and a follow-up FAQ section.
- ✅ **`blog.title`** — Yes.
- ✅ **`article.title` (linked, not truncated), `article.image`** — Yes,
  confirmed in `card-article.liquid`.
- ✅ **Pagination or lazy loading** — real `{% paginate blog.articles %}`.
- ❌ **`article.excerpt_or_content` — real gap, FIXED 2026-09-02.**
  `card-article.liquid` rendered `article.excerpt` only, with no fallback —
  an article with no manually-set excerpt showed no summary line at all,
  missing the literal requirement (never manifested on the seeded demo
  content since all 3 articles have real excerpts, but would on any
  merchant's own future post). Fixed with a word-safe fallback: a set
  excerpt still renders as-is; only a blank one falls back to
  `article.excerpt_or_content | strip_html | truncatewords: 30` —
  `truncatewords` rather than `truncate` so it never cuts mid-word, keeping
  the original "no mangled half-sentence" principle from CLAUDE.md §9.6
  intact while satisfying the literal Theme Store requirement.
  `shopify theme check`: 121 files, 0 offenses.

---

## 7 (Pages, cont'd). Article page requirements

- ✅ **`article.title` (not truncated), `article.comments`,
  `article.published_at` (not `created_at`)** — all confirmed correct in
  `main-article.liquid`.
- ❌ **Comments must be paginated — real gap, FIXED 2026-09-02.** No
  `{% paginate %}` existed around `article.comments` — a heavily-commented
  article rendered every comment unpaginated. Added
  `{% paginate article.comments by section.settings.comments_per_page %}`
  (new setting, default 20) around the existing loop, rendered through the
  shared `pagination.liquid` snippet.
- ❌ **Comment workflow error output — real gap, FIXED 2026-09-02.** The
  comment form only ever displayed the `email` field's error, hardcoded — a
  validation failure on `author` or `body` was silently swallowed. Fixed to
  match the exact pattern already used in `contact-form.liquid`:
  `{% for field in form.errors %}` looping every failed field. Success state
  (`form.posted_successfully?`) was already correct — moderation is handled
  server-side by Shopify, transparent to the theme.
  `shopify theme check`: 121 files, 0 offenses after both fixes.

---

## 9. Browser compatibility

Desktop matrix: Safari (latest 2, Mac), Chrome (latest 3, Mac+PC), Firefox
(latest 3, Mac+PC), Edge (latest 2, PC). Mobile matrix: Mobile Safari
(latest 2, iOS), Chrome Mobile (latest 3, Android+iOS), Samsung Internet
(latest 2, Android). Also requires mobile responsiveness.

- ✅ **Source-level audit clean.** No non-standard CSS/JS anywhere:
  `:has()` deliberately avoided (comment at `base.css` ~line 3293),
  `ResizeObserver` feature-detected before use, `global.js` is
  ES2020-era with nothing needing a polyfill.
- ✅ **Real Edge + real Firefox, actually driven** (Playwright, since no
  browser-automation tool was otherwise available this session — real
  installed Edge via `channel: 'msedge'`, Firefox via Playwright's own
  bundled build). Home/PDP/cart: zero uncaught JS exceptions in either,
  identical rendering confirmed via screenshot. Console noise present in
  both was entirely Shopify's own `theme dev`-proxy scaffolding, not
  theme code.
- ✅ **Mobile responsive, no horizontal overflow** — verified via
  emulation (iPhone 13/Pixel 7/375px) on home/PDP/cart, portrait and
  landscape: `scrollWidth === clientWidth` in every case.
- ❌ **Two real bugs found and fixed 2026-09-03:**
  1. `.hero--full`/`--small`/`--medium`/`--large` all sized via bare
     `vh`, which mobile Safari computes against the viewport *behind*
     the collapsed address bar. Added `@supports (height: 100dvh)`
     overrides (and extended the existing ≥990px "shrink + tighten"
     rule to also fire on `(max-height: 500px)` for landscape phones).
  2. **Bigger one:** `.hero__media` (the background image) was
     grid-stacked into the same cell as its content
     (`grid-area: 1 / 1`), and its `height: 100%` had no definite
     row to resolve against — so it fell back to the image's own
     intrinsic aspect ratio, meaning **the photo was sizing the hero
     box** instead of being cropped to it. Invisible on portrait
     phones (aspect ratios happened to be close), glaring on landscape
     (568×320 hero rendered 757px tall — exactly the mobile hero
     image's 1200:1600 ratio). Fixed by making `.hero__media`/
     `.hero__scrim` `position: absolute; inset: 0` instead, so
     `.hero__inner` alone drives the box's content height. Verified via
     direct box-tree measurement before/after, portrait re-confirmed
     unregressed. `shopify theme check`: 121 files, 0 offenses.
- ⚠️ **Residual, not a bug:** at the shortest landscape height tested
  (568×320) the hero's own content (heading + body + 2 buttons + 3 stat
  rows) genuinely needs more vertical space than 320px holds. Closing
  that means hiding content (the stat row) on very short viewports — a
  product call, not made unilaterally. CLAUDE.md's own hero rule commits
  to "375px" width only, never pairs it with a height, so this isn't a
  violation of the written spec.
- ❌ **Can't be verified from here: real Safari, real Chrome Mobile,
  real Samsung Internet.** No macOS access (same constraint blocking the
  VoiceOver pass) and no Android/iOS device or emulator in this
  environment. Everything above is either a source audit or tested on
  Blink/Gecko engines standing in for the closest available proxy —
  genuine WebKit/Mobile Safari and Samsung Internet coverage is still
  outstanding.

**Action:** real Safari (desktop + iOS) and Samsung Internet passes
before submission — same blocker as the VoiceOver item, needs macOS or
a device lab.

---

## Webviews and other application requirements

Themes must support browsing and purchasing actions rendered inside
in-app browsers (WebViews, not the system browser) for Instagram,
Facebook, and Pinterest — latest release, Android and iOS.

- ✅ **Source-level audit clean.** No `window.open`, no
  `target="_blank"`, no eagerly-loaded third-party iframe anywhere
  (`video-section.liquid`'s YouTube/Vimeo embed only builds on click).
- ✅ **Storage degrades safely.** `sessionStorage`/`localStorage` used
  only for announcement dismissal, recently-viewed, and compare — never
  anything the cart depends on (CLAUDE.md §16) — and every read/write is
  `try/catch`-wrapped with a graceful no-op fallback
  (`global.js` ~line 2607). In-app browsers are known to restrict or
  clear storage inconsistently; this already tolerates that.
- ✅ **Web Share is feature-detected** (`if (navigator.share)`,
  `global.js` ~line 1942) with a copy-link fallback — Android WebView
  support for the API is inconsistent across host apps, but the
  fallback covers it regardless.
- ✅ **Accelerated checkout (Apple Pay/Google Pay/Shop Pay)** goes
  through Shopify's own `payment_button` filter — Shopify's platform
  code hides wallets unavailable in a given context; not theme-owned
  behavior.
- ⚠️ **Noted, not theme-owned:** Shopify's own `login_with_shop`
  account-menu embed was observed (during the browser-compatibility
  pass above) attempting a popup-based auth flow that got blocked
  (`SameSite` cookie rejection). That's Shopify platform code, not
  theme code, but it's exactly the category of thing genuinely flaky
  inside Instagram/Facebook in-app browsers industry-wide — flagged for
  awareness, nothing to fix on the theme side.
- ❌ **Can't be verified from here.** No Instagram, Facebook, or
  Pinterest app, and no Android/iOS device, available in this
  environment. Spoofing a user-agent string in a desktop Chromium
  instance would not reproduce the real constraints those WebViews
  impose (storage partitioning, stripped APIs, injected restrictions),
  so this is a code audit only — not claimed as a real test.

**Action:** an actual pass inside Instagram/Facebook/Pinterest in-app
browsers (real devices or a device-cloud service) before submission —
same category of gap as the browser-compatibility item above.

---

## 10. Assets

- ✅ **No Sass** — zero `.scss`/`.scss.liquid` files anywhere in the repo
  (`assets/` holds only `base.css`, `global.js`, `qr-code.js`,
  `LICENSES.md` — matches `store-submission-build/assets/` exactly).
- ✅ **No minified `.css`/`.js`.** `base.css` and `global.js` are fully
  formatted and commented (checked for the minification tell — any line
  over 500 characters — zero hits in either file). The one other JS file,
  `qr-code.js`, is a third-party library (Project Nayuki's MIT-licensed
  QR generator, used only by `templates/gift_card.liquid` for the
  balance-page QR code) — unminified (904 readable lines) and loaded as
  `type="module"`, so it clears the requirement's own ES6/third-party
  exemption twice over: it wouldn't need the exemption even under a
  strict reading, since it isn't minified either way.
- ⚠️ **Noted for awareness, not a §10 gap:** `qr-code.js` existing at all
  sits in tension with CLAUDE.md's own stricter internal rule (§3 lists
  only `base.css` + `global.js`; §1 says "zero dependencies"). Shopify's
  actual requirement here explicitly permits third-party libraries — the
  exemption text names them directly — so this is compliant with the
  real Theme Store bar. Flagging the internal-spec tension rather than
  silently resolving it either direction.

No gaps in this batch.

---

## 11. Search engine optimization (SEO)

- ✅ **Theme SEO metadata snippet** — `snippets/meta-tags.liquid`: `<title>`
  (with tag/pagination suffixes and a shop-name fallback), `<meta
  name="description">` (with a full fallback chain — page → shop →
  `settings.brand_description`, never blank), `<link rel="canonical">`.
  Rendered from all three `<head>` contexts in the theme: `theme.liquid`,
  `password.liquid`, and `gift_card.liquid` (its own head, since that
  template is `layout: none`).
- ✅ **Google's rich product snippets** — `snippets/structured-data.liquid`
  emits a `Product` node with one `Offer` per variant (`price`,
  `priceCurrency`, `availability`, `itemCondition`, `sku`/`gtin` when
  present), `Organization`/`WebSite` on every page, `BreadcrumbList` on
  product + collection, `CollectionPage`/`ItemList`, `BlogPosting` on
  articles. `AggregateRating` only emitted when real review metafields
  carry a non-zero count (CLAUDE.md §7's own anti-fabrication rule,
  correctly enforced — `has_reviews` gate at line 113). Every
  interpolated value goes through `| json`, so nothing is hand-escaped
  and injectable.
- ✅ **No `robots.txt.liquid`** — confirmed absent (`find` across the
  whole repo, zero matches).

No gaps in this batch. Worth an actual pass through Google's Structured
Data Testing Tool / Rich Results Test on a live product URL before
submission (CLAUDE.md §7 already asks for this) — not re-verified here
since it needs a public URL, not something checkable from source alone.

---

## 12. Accessibility

- ✅ **Keyboard accessible, including dropdown navigation** — `MegaMenu`
  and `<loam-drawer>` (`global.js`) both own their own `keydown`
  listener with `Escape`-to-close, focus trap, and focus-return-to-
  opener; real Tab-order pass already logged in `PROGRESS.md` ("cart
  add/remove/qty works via Section Rendering API, keyboard nav clean,
  drawer focus trap verified").
- ✅ **Visible focus state.** `:focus-visible { outline: var(--focus-width)
  solid var(--c-accent) }` set once, globally. The one `outline: none`
  that isn't `:not(:focus-visible)`-guarded (`.facet-price__input`) has
  a real replacement one level up — `.facet-price__field:focus-within`
  puts the same ring on the whole "$ + input" group instead of clipping
  it around the bare input — so it's a deliberate relocation, not a
  removal.
- ✅ **Every image has `alt`.** Confirmed structurally, not just spot
  checked: zero bare `<img` tags exist anywhere in the theme (grepped
  the whole repo) — every image goes through `image-fallback.liquid`,
  whose `image_tag` call always receives an `alt:` argument (defaulting
  to `''` only when the caller passes nothing, which is the *correct*
  WCAG treatment for a genuinely decorative image, not a missing
  attribute). Every real call site passes a meaningful value — product
  title, article title, collection title, section heading, shop name —
  never left on the empty default for actual content images.
- ✅ **Form inputs: unique ID + matching `for`.** Consistent, deliberate
  pattern across every form in the theme (address fields, newsletter,
  contact, login/register/reset, comments, facets, quantity input,
  variant picker, localization, search). Multi-instance snippets
  (`newsletter-form`, `quantity-input`) take `id` as a *required* param
  specifically to prevent collisions when rendered more than once on a
  page — `newsletter-form.liquid`'s own header comment calls out the
  exact failure mode ("giving them the same value is invalid HTML and
  points every `for=` at whichever the parser saw first"). Per-instance
  callers (`cart-line`, `facet-controls`, `variant-picker`) build the id
  from `section_id` + line/option index, confirmed at each call site.
- ✅ **Valid HTML — FIXED gap, actually run 2026-09-03.** Operator
  shared the live preview URL; fetched the real server-rendered
  homepage HTML (via Playwright, to get the raw response body rather
  than the post-JS DOM) and POSTed it to the W3C Nu validator's API
  directly (`validator.w3.org/nu/?out=json`) rather than sending it the
  page URL — the URL carries a password-bypass token, and there was no
  reason to hand that to a third-party service when the page content
  alone answers the question.
  **Result: one error, zero warnings that trace back to theme code.**
  The single error — a `<script type="module" defer="defer">` combo,
  invalid because module scripts are deferred by spec already — is
  Shopify's own platform-injected cart-sync loader
  (`shop-js/modules/v2/loader.init-shop-cart-sync`), not
  `global.js` (confirmed: `global.js`'s own `<script type="module">` tag
  carries no `defer` at all). The "trailing slash on void element" info
  notices all trace to Shopify's own `{% form %}` tag's auto-generated
  `form_type`/`utf8` hidden inputs — theme markup has zero control over
  that output. The one "section lacks heading" info note is a section
  with no heading set, which is by design (optional heading, per the
  section's own schema) — info-tier, not an error, not a defect.
  Preview-mode-only scripts (hot-reload client, preview bar) also
  showed up in this specific fetch and would not appear on the actual
  published storefront — noted, not counted against the theme either
  way since neither is theme code regardless.
  **Scope of what was checked:** homepage only, this pass. PDP,
  collection, cart, and the rest would need the same treatment for full
  coverage — same mechanism, just needs those URLs.
- ✅ **Contrast** — CLAUDE.md's own audit table already confirms
  ink/paper/surface/accent combinations pass AA (5.73:1–17.78:1).
  Independently recalculated the one color that table doesn't list —
  `--c-signal` (#B23A2F, used as text for sale price/errors) — against
  both paper and surface: 5.40:1 and 5.94:1, both clear the 4.5:1 body-
  text floor.
- ✅ **Focus order matches DOM order.** Only one use of CSS `order`
  in the whole stylesheet (`.image-with-text--media-start`), and its
  own comment names the exact risk this requirement is about. Confirmed
  safe: the element being reordered is a plain image with no link, no
  button, nothing focusable inside it — moving it visually doesn't move
  anything in the tab sequence.
- ✅ **Touch targets ≥ 24×24px.** `.icon-button` 44×44, `.quantity__button`
  36×36, `.variant-picker__value` 44×44 — every interactive control
  checked clears the floor with margin. (Swatches don't exist on the
  PDP yet — separate, already-tracked gap, item 15 below — so there's
  no undersized swatch target to check yet either.)
- ✅ **Headings visually distinct.** `.h0`–`.h6` utility classes step
  through seven distinct size tokens. Bare `h1`–`h6` (merchant rich-text
  content, which doesn't get the utility classes) only has `margin: 0`
  and `unicode-bidi` touched by the reset — font-size is untouched, so
  it falls through to the browser's own differentiated UA defaults
  rather than being flattened to one size.

All nine items check out clean now — zero theme-authored HTML
validation errors on the homepage, several items also backed by prior
real-browser verification already logged in `PROGRESS.md`.

---

## 13. Social media

- ✅ **Open Graph + Twitter card tags** — already confirmed under §11:
  `meta-tags.liquid` emits the full set (`og:site_name`, `og:url`,
  `og:title`, `og:type`, `og:description`, `og:image` +
  `image:secure_url`/`width`/`height`/`alt`, `twitter:card`,
  `twitter:title`, `twitter:description`, `twitter:image`).
- ✅ **Social placeholder text left empty** — every `social_*_link`
  setting has no `default` in `settings_schema.json`, and all three
  shipped presets in `settings_data.json` ship them as `""`. Verified
  by temporarily filling all seven with test URLs to check the icon
  rendering (below), then reverted immediately — confirmed via
  `git diff` that the revert left the file byte-identical to before.
- ❌ **Social media icon set — real gap, FIXED 2026-09-03.** Every
  platform except YouTube rendered the same generic `'external'`
  (open-in-new-tab arrow) icon — Instagram, Facebook, TikTok,
  Pinterest, X, and LinkedIn were visually indistinguishable in the
  footer; YouTube got `'play'`, which is closer but still not a
  YouTube-specific mark. A shopper couldn't tell which link went where
  without hovering to read the URL. Added seven platform icons to
  `icon.liquid` (`instagram`, `facebook`, `x`, `pinterest`, `tiktok`,
  `linkedin`, `youtube`) as line-art reads of each mark in the theme's
  existing stroke style — not the brands' solid logotypes, so nothing
  here reproduces trademarked artwork pixel for pixel, just enough
  shape for a shopper to tell them apart at a glance. Wired
  `footer.liquid`'s seven conditional social links to their own icon
  instead of the two shared placeholders. Verified by rendering: all
  seven render as visually distinct marks, no broken paths.
  `shopify theme check`: 121 files, 0 offenses (icon/footer edits don't
  add new files).

---

## 14. Settings — basic requirements

- ✅ **Text style / terminology** — spot-checked both locale files for
  the most common violation class (Title Case where Shopify wants
  sentence case). Zero real hits — the only two matches were correct
  proper-noun capitalization ("Add to **Apple Wallet**", "Powered by
  **Shopify**"), not style violations.
- ⚠️ **Grammar/spelling** — same spot-check scope, nothing found. Not a
  substitute for an actual proofread/spell-checker pass over every
  label and info string — flagging as best-effort, not exhaustive.
- ✅ **No lorem ipsum / demo-store filler as section-block defaults** —
  checked every `presets` block across `sections/*.liquid`, not just
  the already-verified `templates/index.json`. Real, on-brand copy
  throughout (e.g. `value-props.liquid`'s preset ships an actual
  material claim, not "Heading here").
- ✅ **Favicon setting** — `config/settings_schema.json:423`.
- ✅ **Logo works at any aspect ratio.** Checked all three render
  sites (header, password page, gift card) — none force a crop or a
  fixed width+height combo. Header: `width: auto; max-height: 40px`.
  Password page: fixed width only, `height: auto` on the image itself.
  Gift card: no constraint beyond the srcset. A portrait logo scales
  down proportionally in all three, never gets clipped.
- ✅ **Every setting has a `label`.** Scripted a full walk of every
  section/block schema plus `settings_schema.json` — one flagged hit,
  and it's a false positive: `color_scheme_group` doesn't take a
  top-level `label` by Shopify's own schema spec (it has `definition`
  instead). Zero real violations.
- ✅ **`link_list` defaults in header/footer** — `header.liquid`'s menu
  setting defaults to `main-menu`, `footer.liquid`'s to `footer`. (First
  grep pass under-read the file and looked like header's was missing
  one — it wasn't; re-read the actual lines and it's there.)
- ✅ **Resource-based setting defaults** — N/A, no violation possible.
  Every `product`/`collection` setting in the theme (`cro_empty_cart_collection`,
  `collection-list`'s block collection picker, `lookbook-collage`'s
  hotspot product, etc.) ships with no `default` at all, so there's no
  hardcoded resource reference that could point at something that
  doesn't exist.
- ✅ **`metaobject`/`metaobject_list` settings** — N/A, the theme uses
  neither type anywhere, so the "standard definitions only" rule has
  nothing to check.
- ✅ **`theme_info` section — FIXED 2026-09-02, confirmed correct.**
  Flagged `theme_author: "Loam"` (the theme's own name, not a person)
  and the unfamiliar `growth-lab.gitbook.io` documentation domain rather
  than guessing. Operator confirmed the docs URL is real and gave the
  real author name — `theme_author` corrected to `"Meet Pritmani"`.
  `theme_documentation_url` and `theme_support_url` left as shipped,
  both confirmed intentional. `shopify theme check`: 121 files, 0
  offenses.

---

## Theme editor event requirements

- ✅ **Changes made in the theme editor are reflected in the preview.**
  Two real, targeted `shopify:section:load` listeners in `global.js`
  (not decorative): one re-registers a newly added/reordered section's
  `.reveal` elements with the shared `IntersectionObserver` — without
  it, a section inserted in the editor would stay permanently
  `opacity: 0`, invisible, since the observer would never have seen its
  elements — and one re-applies the announcement bar's dismissed-state
  from `sessionStorage` so a re-rendered bar doesn't reappear having
  been closed. Confirmed as a deliberate, documented decision from
  Phase 1, not an accident: `PROGRESS.md` records the reveal engine
  being kept as a document-wide singleton specifically so
  `shopify:section:load` reinitializes it correctly, rather than
  wrapping every heading in its own custom element.
  Everything else that needs editor-lifecycle correctness is handled
  the other, equally valid way Shopify supports: real custom elements
  (`<sticky-header>`, `<loam-drawer>`, `<marquee-strip>`, etc.) with
  `connectedCallback`/`disconnectedCallback` pairs, which fire on their
  own every time the editor replaces a section's DOM — this is the
  literal mechanism CLAUDE.md's own §4 rule ("every element must
  survive `shopify:section:load` / `:unload`") is built around, and it
  predates this specific Theme Store checklist item by the whole build.
  No `request.design_mode` usage anywhere, and none needed — nothing in
  the theme assumes it's running outside an iframe (no `window.top`/
  `window.parent` checks anywhere in `global.js`), so nothing breaks
  specifically because of the editor's preview context.

No gaps in this batch.

---

## 14 (detail). Text style requirements

Deeper pass against the full rubric, not just the earlier spot-check.

- ✅ **Sentence case on section/preset/category names** — spot-checked,
  clean.
- ✅ **No numbered options/titles except colors** — scripted search for
  "Option 1"/"Position 1"/"Image 1"/"X position"/"Y position" patterns
  across both locale files and `settings_schema.json`. Zero hits.
- ✅ **Intuitive language** — zero uses of "CTA" in any merchant-facing
  label/info anywhere (the one match found was inside a code comment
  quoting CLAUDE.md's own spec, not shown to a merchant). No
  "X/Y position" wording either (folds into the item above).
- ✅ **No ampersands** — one match, and it's a citation, not a style
  choice: `facet-controls`'s info text reads "Filters come from the
  Search & Discovery app" — that's the literal, correct name of
  Shopify's own app. Rewriting it to "Search and Discovery" would
  misname the app it's pointing a merchant at.
- ✅ **Declarative statements, not questions** — zero question marks
  anywhere in `en.default.schema.json` (the settings-facing locale
  file). The question marks that do exist in the theme (`en.default.json`
  — "Forgot your password?", "Already have an account?") are storefront
  UI copy, not settings text, and out of scope for this rule; those are
  also the expected, idiomatic phrasing for that kind of prompt.
- ✅ **Subject stated once, not repeated in setting labels** — precise
  check (not the noisy shared-word version first tried): walked every
  section's own `name` against every setting `label` inside it, looking
  for the literal "`{Section Name}` `{generic word}`" pattern the
  example describes (e.g. "Slideshow color"). Zero real hits — the
  section-naming discipline already in place avoided this.
- ⚠️ **Active voice** — not independently checkable by script with any
  reliability; spot-checked a sample of labels/info strings while doing
  the other passes and nothing read as passive, but this isn't an
  exhaustive claim the way the scripted checks above are.
- ❌ **American English — real gap, FIXED 2026-09-03.** Five British
  spellings in `en.default.schema.json`: `"Show colour swatches"` (a
  setting label) and four instances of "catalogue" in `info`/`paragraph`
  text (CRO settings group intro, page-template next-step block, search
  term info, featured-collection minimum-products info). All five
  corrected to `color`/`catalog`. Checked the full American-English
  table from the requirements page (canceled/cancelled, catalog/
  catalogue, center/centre, color/colour, customize/customise, dialog/
  dialogue, gray/grey, organize/organise) — nothing else in either
  locale file or `settings_schema.json` matched any of the British
  forms. `shopify theme check`: 121 files, 0 offenses after the fix.

---

## 14 (detail, cont.). Buttons start with a verb; technical specs follow the exact format

- ❌ **Technical specification format — real gap, FIXED 2026-09-03.**
  Three image-dimension mentions in `en.default.schema.json`, none
  matching the required `[numeral] x [numeral]px (required/
  recommended)` shape:
  - Favicon: "Will be scaled down to 32 x 32px." → **"32 x 32px
    recommended."** (also stopped describing automatic post-upload
    behavior and started giving actual upload guidance, which is more
    useful to a merchant than either version).
  - Social sharing image: "...1200 x 630px works best." →
    **"...1200 x 630px recommended."**
  - Hero image: "Recommended 2400 x 1350px. ..." → **"2400 x 1350px
    recommended. ..."** (numeral now leads, qualifier now trails,
    matching the example row exactly).
  Checked for the other two spec types the table names — word/character
  count ("32 words max") and "Use basic HTML to format text" — neither
  appears anywhere in the theme, so there's nothing to reformat there;
  not a gap, just nothing stated.
  `shopify theme check`: 121 files, 0 offenses after the fix.
- ⚠️ **Buttons/actions start with a verb — checked, two flagged rather
  than silently changed.** Walked every populated button label
  (`en.default.json` UI strings, `templates/index.json`'s shipped
  button text, every `button_label`/`button_label_2` default across
  every section's presets). Everything renders conditionally on
  non-blank text (confirmed in `hero.liquid`: no default text means no
  button renders at all, never a blank one), so there's no case of a
  merchant seeing an empty or broken button from a missing default.
  Of everything that does render, all of it is verb-first — "Shop
  men's", "Continue shopping", "Add to cart", "Choose options", "Sign
  up", "Apply filters", etc. — **except two industry-standard e-commerce
  terms that are technically noun/adjective-first: "Checkout" (the verb
  form is "check out," two words — "Checkout" is what Shopify's own
  platform, and essentially every storefront, calls this button) and
  "Quick view"** (adjective-first; the near-universal name for this
  exact feature across the industry). Left both as-is rather than
  "fixing" them into something grammatically compliant but unfamiliar
  to shoppers (`"Check out"`, `"Preview"`) — that trade looks like a
  worse outcome than the literal rule violation. Flagged for a call,
  not decided unilaterally.
  Also checked disabled-state labels (`"Sold out"`, `"Unavailable"`) —
  these replace the action label specifically because the action is no
  longer available (§9.2/§9.6's own "disabled state explains why" rule),
  so they read as status, not action; noted, not counted as a
  violation.

**Action:** confirm "Checkout" and "Quick view" should stay as
industry-standard terms rather than being rewritten to a literal verb
form.

---

## 14 (detail, cont. 2). Terminology requirements

Checked every row of the full "use this / don't use this" table against
`config/settings_schema.json` and `en.default.schema.json`, not just the
individual terms already caught while checking other §14 rows.

- ❌ **"homepage" → "home page" — real gap, FIXED.** Two hits, both in
  the hero image info text just edited for the size-format fix
  (`storefront it decides how fast your homepage feels` /
  `keeps the homepage fast on cellular`). Both corrected to "home page".
- ❌ **"Slider" → "Slideshow" — real gap, FIXED.** The shared
  `options.layout.slider` locale key (used by both `featured-collection`
  and `testimonials`' grid/slider layout choice) was labeled "Slider".
  One key, both usages fixed at once.
- ❌ **Generic "Menu" label on header/footer nav settings → "Main menu"
  / "Footer menu" — real gap, FIXED.** Both `header.liquid` and
  `footer.liquid`'s `link_list` settings shared one generic
  `t:labels.menu` → "Menu" label — exactly the pattern the table calls
  out by name ("main menu... don't use: navigation, menu" / "footer
  menu... don't use: navigation, menu"). Added two new distinct keys
  (`labels.main_menu`, `labels.footer_menu`) and pointed each section at
  its own; left the original shared `menu` key in place since removing
  an otherwise-harmless locale entry wasn't necessary.
- ⚠️ **"Show social links" → "Show social media icons" — improved, not
  a clear-cut violation.** The footer's toggle didn't use the explicitly
  banned term ("social media buttons"), but "links" wasn't the
  recommended "social media icons" either. Retitled for closer
  alignment since it was a low-risk, purely cosmetic change.
- ✅ **Everything else checked, no violations:** "Button label" (not
  "button name"), "Cart type" with "Drawer"/"Page" options (not
  "Ajax cart"), "Social media" as the settings-group name (not
  "social"/"social sharing"), no bare "Title" used for a custom heading
  field, no "sub-heading"/"main text"/"side bar"/"check out"/"meta-nav"/
  "search bar" anywhere, no ".PNG"/".png " variants. The three
  `enable_*`-prefixed settings (`enable_sticky`, `enable_reveal`,
  `enable_image_zoom`) all genuinely fit the "significantly modifies
  layout/behavior, theme-wide" criterion the table gives for "enable"
  rather than "show" — spot-checked, not changed.
  `shopify theme check`: 121 files, 0 offenses after all fixes.

---

## 14 (detail, cont. 3). Section name guidelines

Pulled every section's `name` from `en.default.schema.json` (48 total)
and checked each against "relates to the section's function" plus
Shopify's suggested vocabulary (Header, Featured products/collections,
Slideshow, Image gallery, Logo list, Newsletter, Map, Blog posts,
Testimonials, Footer).

- ✅ **44 of 48 match Shopify's exact suggested terms or are equally
  clear, function-first names of their own** — `Header`, `Footer`,
  `Blog posts`, `Testimonials`, `Newsletter` match verbatim; the rest
  (`Contact form`, `Announcement bar`, `Cart drawer`, `Predictive
  search`, `Related products`, `Complementary products`, `Reset
  password`, etc.) all name what the section actually does, nothing
  generic or internal-jargon.
- ⚠️ **One borderline case, not changed:** `value_props`'s display name
  is **"Value props"** — shorthand for "value propositions," which
  reads clearly to anyone with e-commerce/marketing background but
  isn't self-explanatory to every merchant on first read the way
  `Testimonials` or `Newsletter` is. Flagged rather than renamed
  unilaterally — an alternative like "Value props" → "Highlights" or
  "Key benefits" is a real option but changes the section's identity in
  the editor (presets, any existing merchant configuration keyed to the
  name), so left for a call rather than assumed.
- ✅ **No other unclear, internal, or ID-shaped names** — none of the
  48 leak an internal-id-style name (e.g. no section literally called
  "block_1" or "section_a"), and abbreviations that do appear (`FAQ`,
  `UGC`'s display name is deliberately the plain "Social grid", not
  the acronym) are either universally understood or already avoided in
  the visible name.

**Action:** decide whether "Value props" should be renamed to something
more self-explanatory before submission — not done here, low-confidence
call.

---

## 15. Font picker

- ✅ **`font_picker` setting type** — both `heading_font` and
  `body_font` in `config/settings_schema.json` use it correctly.
- ✅ **Default font loaded** — `heading_font` defaults to `archivo_n7`,
  `body_font` to `assistant_n4`, both real Shopify font-library IDs.
- ✅ **Custom fonts not accepted** — structurally guaranteed, not just
  policy: zero `.woff`/`.woff2`/`.ttf`/`.otf`/`.eot` files anywhere in
  `assets/`. There's nothing to self-host even if someone tried.
- ✅ **Defaults use a currently available font** — `archivo_n7`
  (Archivo) and `assistant_n4` (Assistant) are both real, current
  entries in Shopify's font library, not a renamed or retired one.
- ❌ **Bold/italic/bold-italic for each font — real gap, FIXED
  2026-09-03.** `theme-tokens.liquid` generated all three `font_modify`
  variants for the **body** font but only the bold variant for the
  **heading** font — no `heading_font_italic`, no
  `heading_font_bold_italic`, and no matching `@font-face` for either.
  The requirement is "for each font," not just body. Practical
  consequence, not just a technicality: without a real italic face
  loaded, any `<em>`/`<strong><em>` inside heading-styled rich text
  (an FAQ answer, a page's content, anywhere a merchant nests emphasis
  in text using `--f-heading`) would fall back to the browser's
  synthetic/faux-italic slant instead of the font's actual italic
  design — exactly the rendering artifact this requirement exists to
  prevent. Added `heading_font_italic` and `heading_font_bold_italic`
  (chained off the bold variant, matching the existing body pattern so
  the result carries both properties rather than only the last one
  applied) and their `@font-face` declarations. Preload tags in
  `theme.liquid` were already correctly scoped to just the two base
  weights (not all 8 variants — preloading everything would cost LCP
  for weights most pages never use above the fold) and reference
  `settings.heading_font`/`settings.body_font` directly, so they were
  untouched by this fix and didn't need to be. `shopify theme check`:
  121 files, 0 offenses; live-checked in a real browser afterward —
  zero new console errors, only the same pre-existing `theme dev`-proxy
  noise already documented earlier in this file.

---

## 16. Color system

- ✅ **Minimum 4 colors** — each color scheme's `definition` carries 9:
  `background`, `surface`, `text`, `accent`, `sand`, `signal`, `button`,
  `button_label`, `shadow`.
- ✅ **Every `type: "color"`** — all 9 fields, no exceptions (no color
  smuggled in as a `text` setting holding a hex string).
- ✅ **Every background has a registered foreground — confirmed via
  Shopify's own `role` map, not just inferred from field names.**
  `config/settings_schema.json`'s `color_scheme_group` declares an
  explicit `"role"` block pairing `background` → `text`,
  `primary_button` (→ `button`) → `on_primary_button` (→
  `button_label`), and `secondary_button` (→ `background`) →
  `on_secondary_button` (→ `text`). Every background role Shopify's own
  schema recognizes has a paired foreground registered against it —
  this is Shopify's own mechanism for asserting the pairing, so its
  presence and correctness here is direct evidence, not circumstantial.
  (`surface` and `sand` exist as extra color fields but aren't
  registered as `background`-type roles in the map, so they don't need
  a role-level pairing; the theme's own CSS already uses `text` as the
  foreground on both, independently verified for AA contrast earlier
  in this file.)

No gaps in this batch.

---

## 17. Responsive images

- ✅ **Responsive image strategy.** Structurally guaranteed, not just
  per-usage: `image-fallback.liquid` is the only path any image takes
  through this theme (confirmed earlier — zero raw `<img>` tags exist
  anywhere in the repo), and it always calls `image_tag` with
  `widths:`/`sizes:`, producing a real `srcset`. Icons are SVG via
  `icon.liquid`, not raster images, so the stated exception doesn't
  even need to apply.
- ✅ **Load only as needed.** `loading: 'lazy'` is the default inside
  `image-fallback.liquid` — every caller gets it unless it explicitly
  overrides. Audited every override: hero (both crops), header logo,
  article header image, collection banner, password-page logo, and the
  product gallery's first image are `eager` + `fetchpriority: high` —
  each one is a legitimate above-the-fold/LCP candidate for its own
  template, not an arbitrary choice. The product gallery's own logic
  (`main-product.liquid`) explicitly marks only `forloop.first` as
  eager+high and everything after it `lazy`/`auto` — confirmed by
  reading the loop, not assumed. Lightbox images are explicitly `lazy`
  (hidden until opened, correctly not eager).
- ❌ **One inconsistency found and fixed.** The *zero-media* fallback
  path in `main-product.liquid` (what renders when a product has no
  media at all, a real if rare state — a brand-new product still being
  set up) had `loading: 'eager'` but no `fetchpriority: 'high'`, unlike
  every other eager image in the theme. In that state the fallback
  placeholder *is* the page's first/only image, so it should get the
  same priority hint the normal first-gallery-image path gets. Added
  `fetchpriority: 'high'` to match. `shopify theme check`: 121 files, 0
  offenses.

---

## 18. Naming themes and theme presets

- ✅ **Distinct from Shopify products, company names, platform/SEO
  words, and Theme Store industries/collections** — "Loam" (theme) and
  "Fernway"/"Fernway Night" (presets) are original, evocative names,
  none resembling a Shopify product, the operator's own name, a
  benefit-word ("Performance", "Sales"), or an industry category
  ("Fashion", "Footwear"). "Fernway" is the fictional demo brand
  established throughout `CLAUDE.md`, not a company name.
- ✅ **1–2 words, under 30 characters** — "Loam" (1 word, 4 chars),
  "Fernway" (1 word, 7 chars), "Fernway Night" (2 words, 13 chars). All
  three clear both limits with room to spare.
- ❌ **One preset must take the parent theme's name — real gap, FIXED
  2026-09-03.** Neither shipped preset was named "Loam" (the theme's own
  `theme_name`) — both were demo-brand names, "Fernway" and "Fernway
  Night". Renamed the primary preset's key in
  `config/settings_data.json` from `"Fernway"` to `"Loam"`, keeping its
  full settings content untouched — only the preset's display name
  changed, satisfying the literal requirement while leaving "Fernway
  Night" as the second, brand-flavored option. Checked for stale
  references to the old preset name in `README.md`/`PROGRESS.md` before
  and after — none existed, nothing else needed updating.
  `shopify theme check`: 121 files, 0 offenses.
- ⚠️ **Unique/distinct from existing Theme Store themes** — same
  caveat already logged under §2: not verifiable from source alone,
  needs the manual side-by-side comparison against the live catalog
  already tracked as action item #1.

---

## 18 (detail). Theme and preset name guidelines

These are guidelines, not pass/fail checkboxes — judgment calls, not
gaps to fix. Assessed "Loam" against each rather than treating this as
another audit row.

- **Alludes to the purpose, gives an idea of what to expect** — loam is
  fertile, nutrient-rich soil; the metaphor lines up with a
  natural-materials brand story ("Built from things that grow") and the
  earthy, grounded palette (`--c-ink`/`--c-paper`/`--c-sand`) better
  than a literal category name like "Footwear" would, and a literal
  name would have failed the industries/collections rule from the
  checkbox list above anyway.
- **Noun** — yes, cleanly (a soil type).
- **Easy to spell and pronounce** — yes; short, phonetic, rhymes with
  "home"/"foam".
- **Works across dialects / no unintended meaning elsewhere** — nothing
  found, but this is the one item on the list that's genuinely hard to
  fully clear without a real idiom dictionary or native speakers across
  every locale this theme ships in (`fr`, `de`, `es`, `it`, `ja`,
  `pt-PT`). Said plainly rather than silently assumed clean.
- **Different from theme names on other platforms** — actually
  searched rather than caveated: "Loam" Shopify theme, and "Loam theme"
  across WordPress/Webflow/Squarespace/ThemeForest. No existing theme
  by this name surfaced in either search. Not an exhaustive guarantee —
  an obscure or very recently listed theme could exist that didn't
  surface — but a real check, not an assumption.

No action needed here; recorded for completeness since it was asked
about directly.

---

## 18 (detail, cont.). Increasing clarity and discoverability

Also guidelines, not pass/fail. Same treatment — judged, not audited.

- **Not trendy** — "loam" is a centuries-old soil-science term, not
  slang or a fad word; nothing about it dates.
- **Not an unusual spelling** — "Loam" is the standard dictionary
  spelling, not a stylized one ("Lite" for "Light", "Kwik" for
  "Quick"). "Fernway" is a genuine compound/portmanteau (fern + way),
  not a misspelling of an existing word — same category as most
  invented brand names, not what this guideline is warning against.
- **Not lengthy** — 4/7/13 characters across the three names.
- **Not the same as a theme on another platform** — searched again,
  specifically for "Fernway" this time (the previous turn only checked
  "Loam"): no theme or preset by that exact name surfaced. **One
  adjacent, not identical, result worth flagging:** Archetype Themes'
  "Streamline" theme (sold on themes.shopify.com itself) ships a preset
  called **"Fern"** — not "Fernway," a different, shorter word, so it
  doesn't violate the literal "same name" rule, but it's close enough
  in the same natural/plant-name space that it's worth being aware of
  before submission.
- **Not the same as an existing theme+preset name** — no exact
  collision found for "Loam," "Fernway," or "Fernway Night" in either
  search pass.

No action needed — the one adjacent case ("Fern") is a different word,
not a rule violation, but flagged since a real, close neighbor is more
useful to know about than a clean "no gaps" here would suggest.

---

## Adding presets to the theme zip submission

- ❌ **Real, currently-unmet gap — this theme has 2 presets now
  ("Loam", "Fernway Night" per §18's fix), so a `/listings` folder is
  required, and it doesn't exist.** Confirmed: no `listings/` directory
  anywhere in the repo, no mention of one in `README.md`, `PROGRESS.md`,
  or `CLAUDE.md`. Per the requirement, the zip needs
  `listings/<preset>/templates/*.json` (and optionally `sections/`) for
  **every preset beyond the first** — content that shows what that
  specific preset looks like, similar to its associated demo store.
  With only one preset this folder is skippable (the note on the page
  says so explicitly); with two, it's required.

**This is a different kind of gap from everything else on this list.**
Not a bug or a quick text/CSS fix — it's a packaging deliverable that
needs real content decisions: what "Loam"'s and "Fernway Night"'s
listing templates actually contain (presumably "Loam" mirrors the
existing `templates/`, and "Fernway Night" needs its own JSON with the
dark-scheme color choices swapped in per section) isn't something to
guess at silently. Flagged, not built, pending direction on scope —
worth doing close to actual zip packaging (`shopify theme package`)
rather than maintaining a parallel copy throughout the rest of the
build.

**Action, decided 2026-09-03:** deferred to just before packaging.
Building it now would mean keeping a second parallel copy of
`templates/` in sync with every homepage/section change made between
now and submission — real risk of drift for no benefit this early.
Build `listings/loam/templates/` (mirroring `templates/`) and
`listings/fernway-night/templates/` (same structure, dark-scheme colors
swapped in per section) as the last step before running
`shopify theme package`.

---

## 19. Theme versions and release notes

- ✅ **Version number** — `theme_version: "1.0.0"` in `settings_schema.json`'s
  `theme_info` (valid semver), matching `package.json`'s own version.
- ⚠️ **Release notes — not a repo artifact to begin with, drafted
  anyway.** Unlike the version number, release notes aren't a field
  embedded in the theme's own files — Shopify collects them through the
  Partner Dashboard at submission time, so there was nothing in the
  repo to check for absence or presence. Drafted a genuine v1.0.0 entry
  anyway (`RELEASE-NOTES.md`, new) so it's ready to paste into that
  submission form rather than written from scratch under deadline
  pressure. Content is drawn from what the theme actually ships — 19
  sections, the CRO feature set, both presets, the a11y/i18n/performance
  figures already verified elsewhere in this file — nothing claimed
  that isn't backed by a finding somewhere else in this audit.

**Action:** review `RELEASE-NOTES.md` before submission — it's a draft,
not a final version copy-pasted in.

---

## 20. Demo stores

- ⚠️ **Not code-checkable — a Partner Dashboard fact, confirmed by
  operator rather than found in source.** The requirement is that the
  demo store be built on a Partner Dashboard **client transfer store**
  specifically, not a regular development store with developer previews
  enabled (those can't be transferred to Shopify for review). Nothing
  in the repo or the Admin API can distinguish store-creation method
  from here — `PROGRESS.md` even surfaced a real ambiguity worth
  flagging before assuming: it separately mentions "operator has a
  test/transfer store set up" for the fresh-install test, distinct
  language from the `demo-store-nwv18ak5` already configured in `.env`
  for seeding. Asked directly rather than assumed either reading.
  **Operator confirmed:** `demo-store-nwv18ak5` — the store already
  seeded, theme-pushed, and used for the live preview earlier in this
  session — is a client transfer store, created the correct way.
  Nothing to redo.

No gaps — confirmed correct, not inferred.

---

## 20 (detail). Demo store requirements

Split by what's actually checkable from source versus what lives only
in store admin / the Partner Dashboard submission form.

**Checked from source, clean:**

- ✅ **`powered_by_link` unaltered** — the one usage
  (`main-password.liquid:110`) is the bare object, `{{ powered_by_link }}`,
  nothing wrapped around it or concatenated to it.
- ✅ **No `rel="nofollow"` gap** — moot rather than satisfied-by-effort:
  grepped every `.liquid` file for a hardcoded link to any
  `*.shopify.com`/`shop.app`/`*.myshopify.com` domain and found zero.
  `powered_by_link` itself is a Shopify-rendered object the theme
  doesn't construct the markup for, so there's nothing theme-authored
  that would need the attribute added.
- ✅ **No affiliate linking** — grepped for `affiliate`, `utm_source`,
  affiliate-style ref/partner query params across locales and shipped
  JSON. Nothing found. Consistent with §1's earlier finding (no
  designer-credit or affiliate links anywhere in the theme).
- ✅ **Authentic text, no Lorem Ipsum/onboarding text** — re-confirms
  what's already been verified repeatedly across this whole audit
  (§3, §14, and the media-manifest review), not re-derived from
  scratch here.
- ✅ **Asset rights** — already governed end-to-end by `CLAUDE.md` §6's
  three-tier licensing system (CC0/Burst-License/AI-generated,
  bundle-eligibility per tier, `LICENSES.md` tracking every file) —
  this exists specifically to satisfy the Partner Agreement's rights
  requirement, not something new to check here.

**Not checkable from source — store admin / submission-form facts:**

- ✅ **Payment gateway — confirmed by operator 2026-09-03: Shopify
  Payments test mode.** Not verifiable from the theme repo (a
  Settings → Payments configuration on the live demo store), so asked
  directly rather than assumed.
- ⚠️ **No apps beyond the free-review/free-translation exception** (and
  if a translation app is used, *everything* must actually be
  translated). Which apps are installed on `demo-store-nwv18ak5` isn't
  something the theme code or this session's Admin API access can see.
- ⚠️ **Preset ↔ demo-store industry/catalog-size tagging, and "each
  preset install matches its demo store's expectations."** These are
  Theme Store *listing* metadata, set at submission time in the Partner
  Dashboard, not theme files — nothing in the repo to audit.

**Action:** confirm directly (not verifiable from here) — payment
gateway is set to Bogus Gateway or Shopify Payments test mode with
every other checkout method disabled, and no non-exempt apps are
installed on the demo store before submission.

---

## Demo store recommendations

Explicitly non-mandatory ("recommendations aren't requirements that
need to be met for submission") — assessed for completeness, not
treated as pass/fail gates.

- ⚠️ **Identify the source of product images in the product
  description** — not done at the description-text level, but the
  underlying provenance is tracked exhaustively elsewhere (`LICENSES.md`,
  `licenses.json`, per CLAUDE.md §6's three-tier system). A soft nice-
  to-have, not chased further given it's explicitly optional and the
  real tracking already exists.
- ❌ **Use the latest theme version in the demo store — currently
  false, and concretely checkable.** `git status` right now: 10
  modified files plus `RELEASE-NOTES.md`, none committed, none pushed.
  That includes everything fixed this session — the hero scrim bug, the
  hero-height/landscape fixes, the seven social icons, the heading-font
  italic variants, the fetchpriority fix, and every locale/terminology
  correction. The live preview shown earlier in this session predates
  essentially all of today's real fixes. **Flagging, not pushing** —
  pushing to the shared demo store is a real, visible action on shared
  state, not something to do without asking first.
- ✅ **Built-in Shopify features showcased** — the theme itself renders
  all of them when store data exists to exercise them: Shop Pay
  Installments (`buy-buttons.liquid`), pickup availability
  (`pickup-availability.liquid`), gift cards (`templates/gift_card.liquid`),
  predictive search, faceted filtering. Whether the demo store's actual
  configuration (e.g. local pickup enabled, an eligible price point for
  installments) exercises every one of these is a store-config
  question outside what the theme repo can confirm.
- ⚠️ **Versatility examples — 3 of 4 present, 1 likely missing.** Per
  CLAUDE.md §12.4's own catalog spec and confirmed earlier in this
  audit: a sale product (real `compareAtPrice`) ✓, sold-out
  variants ✓, full multi-variant products ✓. **A gift card product does
  not appear to exist in the seeded catalog** — grepped the seeding
  script, the exported `products.csv`, and `PROGRESS.md`'s own catalog
  notes for any mention of one; found none. `templates/gift_card.liquid`
  exists and is correct, but a template only renders once a real
  gift-card-type product is purchased — without one in the catalog,
  there's nothing for a reviewer to buy to see that flow.

**Action:** push the current local changes to `demo-store-nwv18ak5`
before submission (confirm first — this touches the shared demo store).
Consider adding one gift-card product to the seeded catalog so the
gift-card purchase flow has something to actually exercise.

---

## 21. Documentation and contact forms

Both URLs already confirmed real (not placeholder) during the §14
`theme_info` check — this pass actually fetched them rather than
trusting that confirmation alone.

- ✅ **Theme documentation exists and is substantive.**
  `growth-lab.gitbook.io/growth-lab-docs` is live: 8 pages — Overview,
  Installation, Theme settings, Conversion & CRO settings, Metafields,
  Sections & templates, FAQ, Support. Not scaffolding — covers
  installation through advanced features.
- ✅ **Public support contact form exists and is functional.**
  `tally.so/r/EkOW1L` is a real, working form: Name, Email, Store URL,
  Problem description, file upload (10MB), branded "Loam."
- ✅ **FAQ section present** — the docs' own page 7.
- ✅ **Both ready well before launch** — live and reachable now, not a
  promise to build later.
- ✅ **Linked to the theme listing page — structurally, via the correct
  mechanism.** `theme_documentation_url`/`theme_support_url` in
  `theme_info` are exactly the fields Shopify's Theme Store listing
  page pulls Documentation/Support links from automatically; both are
  set correctly (confirmed under §14). The actual listing page doesn't
  exist yet (theme isn't submitted), so the live link can't be checked,
  but the wiring that produces it is correct.
- ⚠️ **Grammar/spelling in the docs — not verifiable from here at
  character level.** `WebFetch` returns a summarized read of the page,
  not raw text to proofread. Nothing in the summary suggested a
  problem, but that's not the same claim as a real proofread.
- ⚠️ **Consistency with current theme settings copy — a real,
  non-trivial risk worth naming, not just a formality.** This session
  renamed several settings today (`"Menu"` → `"Main menu"`/`"Footer
  menu"`, `"Show social links"` → `"Show social media icons"`,
  `theme_author` corrected, several locale-string fixes). If the
  GitBook docs were written before today, their "Theme settings" page
  may now describe labels that no longer match what a merchant sees in
  the editor. Not confirmed either way — flagged because it's a
  specific, dated risk, not a generic caveat.

**Action:** review the "Theme settings" doc page against today's
renames (`Main menu`/`Footer menu`, `Show social media icons`,
`theme_author`) before submission.

---

## 21 (detail). Contact form fields, and custom-tutorial clarity

Tried to verify at field level, hit a real tooling limit worth being
honest about rather than papering over.

**Contact form (`tally.so/r/EkOW1L`) against the field table:**

- ✅ **Name, Email, Store URL, Description of Problem, File upload** —
  all five present, confirmed on a second, more targeted fetch.
- ✅ **Subject / Theme Name fields absent — correctly so, not a gap.**
  Both are conditional ("if you include this field," "if you offer
  multiple themes") — no Subject field, and the operator ships exactly
  one theme, so neither applies.
- ⚠️ **Can't verify from here: Store URL example placeholder text,
  whether Problem Description is a real textarea vs. single-line
  input, and whether an auto-responder fires on submit.** `WebFetch`
  renders a static/summarized read of the page — Tally forms are
  interactive and this tool doesn't see field-level HTML attributes or
  post-submit behavior. Submitting a real test entry to check the
  auto-responder would create an actual support ticket in the
  operator's inbox, which isn't something to do without being asked.
  **Action:** operator to check these three directly in the Tally
  editor — quick, since it's their own form.

**Custom coding tutorials — likely not applicable, not fully
confirmed.** This whole item is conditional on the docs offering
custom code-editing tutorials at all. The 8-page index (Overview,
Installation, Theme settings, CRO settings, Metafields, Sections &
templates, FAQ, Support) reads like standard merchant-facing settings
documentation, not developer tutorials — `WebFetch` couldn't dive into
the "Sections & templates" page's actual content to be certain either
way. If there's no code-editing tutorial content, this item doesn't
apply; if there is, it needs the duplicate-before-editing warning and
the Shopify Partner suggestion. **Action:** operator to confirm whether
any doc page walks merchants through editing theme code directly.

---

## 22. Supporting your theme

**Merchant support requirements and the support-workload section are
policy commitments, not code-checkable.** Responding within two
business days, fixing critical bugs immediately (or risking removal
from the Theme Store), and staffing for an ongoing support workload are
about the operator's post-launch capacity and process — nothing in the
repo can confirm or deny readiness for that. Named rather than silently
skipped, since it's a real, binding part of becoming a Theme Partner,
just not something this audit can verify.

**The "installation experience" tips underneath it, checked directly:**

- ✅ **No demo-store-admin-specific resources baked into shipped
  JSON.** Checked exactly what the tip warns about — `shopify://`
  references that only resolve on *this* demo store, not a buyer's
  fresh one. Grepped every `shopify://` pattern across
  `templates/index.json` and `config/settings_data.json`: the only one
  in use is `shopify://shop_images/<filename>`, which is filename-based
  and portable by design (CLAUDE.md §12.6) — nothing referencing a
  demo-store-specific product/collection ID or metaobject entry.
  Collection settings (`featured-collection`'s `"collection":
  "best-sellers"`) store a portable handle, not a GID, and every
  `product`-type setting in the shipped JSON (`lookbook-collage`'s
  hotspot products) is blank, not pointing at anything demo-specific.
- ✅ **`link_list` defaults** — already confirmed correct under §14
  (header → `main-menu`, footer → `footer`); not re-derived here.
- ✅ **Resource-based setting defaults** — already confirmed N/A under
  §14 (nothing ships a default at all, so nothing to reference
  incorrectly); not re-derived here.
- ✅ **`metaobject`/`metaobject_list` standard-definitions-only** —
  already confirmed N/A under §14 (theme uses neither type anywhere);
  not re-derived here.

All four tips check out — three by direct cross-reference to work
already done, one (the `shopify://` scope) checked fresh here since it
hadn't come up in exactly this form before.

---

## New finding, 2026-09-03: `locales/ar.json` had no headroom left — FIXED

Surfaced by accident, not by audit: `shopify theme dev` was started to
live-verify the swatch/pagination/gift-card-recipient work above, and the
very first request came back as a hard upload failure —
**"locales/ar.json: Too many translation keys."** — not the theme, the
homepage itself failed to render at all.

Bisected by reverting just the day's `ar.json` edit (the new
`gift_card.recipient` block, 6 leaf keys) and reloading: the error cleared
immediately. Confirmed by direct count: `locales/ar.json` currently sits at
**3,399 leaf translation keys** in the version already committed on `main`
— before today's session touched it at all. Adding 6 more was enough to
cross whatever hard cap Shopify's upload step enforces. This is a
pre-existing condition, not something this session's edits caused; today's
change just happened to be the one that finally landed on a full file.

The bulk of `ar.json` is not theme-authored copy — most of its ~4,600 lines
are a large `"shopify": { "checkout": { ... } }` block, and the file's own
header comment says it plainly: *"The contents of this file are
auto-generated... may be updated by the Shopify admin language editor or
related systems... changes made to this file may be overwritten."* That
block is almost certainly what's consuming the headroom, but deleting
content from a file Shopify itself describes as auto-managed is a real
decision with unclear downside (would Shopify just regenerate it on the
next language sync? does Theme Store review expect it present?) — not
something to resolve unilaterally mid-session.

**Confirmed the diagnosis before touching anything:** `ar.json`'s
`shopify` block alone accounted for 2,037 of its 3,399 leaf keys (~60%) —
Shopify's own auto-generated checkout/customer-accounts translations, not
theme-authored copy. Every one of the other 7 locale files is ~408 lines
with no such block at all; `en.default.json`, the theme's own source of
truth, has exactly 305 leaf keys total. Grepped every `.liquid` file for
any `| t` reference into `shopify.*` or `customer_accounts.*` — zero hits;
the only `customer_accounts` matches anywhere in the theme are
`shop.customer_accounts_enabled`, an unrelated Liquid object property, not
a translation key. Nothing in the theme's own rendering reads a single
string out of that block.

**Fix, applied 2026-09-03 with operator sign-off** (this is a bulk edit to
existing translated content, not something to do unilaterally): removed
the `shopify` and `customer_accounts` top-level keys from `ar.json`,
bringing it down from 4,600 lines / 3,399 keys to 408 lines / matching the
same shape as every other locale file. The `gift_card.recipient.*`
translation drafted earlier in the session was preserved through the
trim (recovered via `git stash pop` first, then the auto-generated blocks
were stripped) — Arabic now has the full recipient string set, same as
the other 7 locales. Verified twice: `shopify theme check` — 121 files, 0
offenses; and, more importantly, an actual `shopify theme dev` upload
against the live demo store, which failed outright before this fix
("Too many translation keys," the whole homepage 500'd) and served a
normal 200 after it.

**Why this mattered beyond today's feature:** before this fix, `ar.json`
had essentially zero remaining headroom — any future addition of even a
single new Arabic-facing string, by anyone, for any feature, would have
hit this exact upload failure. That's now resolved, not just worked
around.

---

## Open action items (running list)

| # | Item | Status |
|---|---|---|
| 1 | Manual visual-comparison pass vs. live Theme Store catalog (§2, §3) | Not started |
| 2 | Section-by-section flexible-layout spot-check (testimonials, featured-collection, lookbook-collage) | Not started |
| 3 | Real editor click-through pass | Not started |
| 4 | Real shopping-flow click-through (variant → cart → checkout) | Not started |
| 5 | VoiceOver pass | Not started (needs macOS/Safari) |
| 6 | Discount display on order template | **Done 2026-09-02** |
| 7 | Print option on gift card page | **Done 2026-09-03** |
| 8 | Rich media (video/3D model) in quick view | **Done 2026-09-03** |
| 9 | New `featured-product.liquid` section, incl. rich media, `@app` block, and `custom_liquid` block | **Done 2026-09-03** — not added to `templates/index.json` by design, see finding above |
| 10 | Selling-plan selector on product page (render existing `selling_plan_groups` only — no subscription logic in-theme) | **Done 2026-09-03** — no product in the demo catalog has plans configured, so not click-tested against a real one |
| 11 | Add `custom_liquid` block type to `main-product`, `main-collection`, `main-cart`, `cart-drawer` | **Done 2026-09-03** |
| 12 | Run Shopify's official Lighthouse benchmark-dataset script once before submission | Not started |
| 13 | `cart.taxes_included` note on product page | **Done 2026-09-02** |
| 14 | Gift card recipient form (email/name/message/send_on) | **Done 2026-09-03** — translated into all 8 locales |
| 15 | Swatches (`swatch.color` + `swatch.image`) on `variant-picker.liquid`; add `swatch.image` to `card-product.liquid`/`facet-controls.liquid` | **Done 2026-09-03** |
| 16 | Pagination or lazy loading on `main-list-collections.liquid` | **Done 2026-09-03** |
| 17 | `cart.taxes_included` note on cart page + cart drawer | **Done 2026-09-02** |
| 18 | `item.options_with_values` on cart line (was `variant.title`) | **Done 2026-09-02** |
| 19 | `article.excerpt_or_content` word-safe fallback on blank excerpt | **Done 2026-09-02** |
| 20 | Pagination on `article.comments` | **Done 2026-09-02** |
| 21 | Comment form: loop all `form.errors` fields (was email-only) | **Done 2026-09-02** |
| 22 | Hero `vh`→`dvh` fallback (all 4 size variants) + landscape short-viewport tightening | **Done 2026-09-03** |
| 23 | Hero background image sizing the box instead of being cropped to it (`.hero__media` grid-stacking bug) | **Done 2026-09-03** |
| 24 | Real Safari (desktop + iOS) and Samsung Internet passes | Not started (needs macOS/device access) |
| 25 | Real Instagram/Facebook/Pinterest in-app webview pass | Not started (needs device/app access) |
| 26 | W3C HTML validator pass on a live page | **Done 2026-09-03 — homepage; PDP/collection/cart/etc. still to check** |
| 27 | Platform-specific social icons (Instagram/Facebook/X/Pinterest/TikTok/LinkedIn/YouTube) in footer | **Done 2026-09-03** |
| 28 | Confirm `theme_author`, `theme_documentation_url`, `theme_support_url` in `config/settings_schema.json` are real, not leftover/placeholder values | **Done 2026-09-03** — `theme_author` corrected to "Meet Pritmani", docs/support URLs confirmed correct |
| 29 | British spellings in settings locale (`colour` → `color`, `catalogue` → `catalog` ×4) | **Done 2026-09-03** |
| 30 | Image-size info text reformatted to `[numeral] x [numeral]px (required/recommended)` (favicon, share image, hero image) | **Done 2026-09-03** |
| 31 | Confirm "Checkout" and "Quick view" stay as industry-standard terms despite not being literally verb-first | Not started — needs operator input |
| 32 | Terminology table: "homepage"→"home page", "Slider"→"Slideshow", split shared "Menu" label into "Main menu"/"Footer menu", "Show social links"→"Show social media icons" | **Done 2026-09-03** |
| 33 | Decide whether "Value props" section name should be renamed to something more self-explanatory | Not started — needs operator input |
| 34 | Heading font missing italic/bold-italic `font_modify` variants (body had all 3, heading only had bold) | **Done 2026-09-03** |
| 35 | `fetchpriority: high` missing on the zero-media product fallback image (`main-product.liquid`) | **Done 2026-09-03** |
| 36 | Rename a theme preset to match the parent theme name ("Loam") | **Done 2026-09-03** |
| 37 | Build `/listings` folder for zip submission (required now that the theme ships 2 presets) | Not started — deferred to just before `shopify theme package`, by design |
| 38 | Draft v1.0.0 release notes for Theme Store submission | **Done 2026-09-03** — `RELEASE-NOTES.md`, review before submitting |
| 39 | Confirm demo store payment gateway is Bogus Gateway or Shopify Payments test mode, all other methods disabled | **Confirmed 2026-09-03** — Shopify Payments test mode |
| 40 | Confirm no non-exempt apps installed on the demo store | Not started — store-admin check, needs operator |
| 41 | Push today's local changes to `demo-store-nwv18ak5` and commit/push to git | **Done 2026-09-03** — theme pushed (#155644264616), committed `ad732a2`, pushed to `origin/main`. **Repeated 2026-09-03** for the swatch/gift-card-recipient/pagination/app-block work and the `ar.json` fix: committed `a19a4c0`, pushed to `origin/main`, theme pushed live to #155644264616. **Repeated again 2026-09-03** for featured-product/selling-plans/quick-view rich media and the accelerated-checkout button fixes: committed `5581921`, pushed to `origin/main`, theme pushed live to #155644264616 |
| 42 | Add a gift card product to the seeded demo catalog | Not started (recommendation, not required) |
| 43 | Review GitBook "Theme settings" doc page against today's renames (Main menu/Footer menu, Show social media icons, theme_author) | Not started |
| 44 | Verify Tally form: Store URL placeholder text, Problem field is a textarea, auto-responder fires on submit | Not started — needs operator (own form, quick check) |
| 45 | Confirm whether docs contain custom code-editing tutorials (duplicate-theme warning + Partner suggestion needed if so) | Not started — needs operator |
| 46 | `locales/ar.json` had no headroom for new keys (3,399 leaf keys, hard upload failure past that) — traced to an auto-generated `shopify.checkout.*`/`customer_accounts` block absent from every other locale and unreferenced anywhere in the theme | **Done 2026-09-03** — block removed with operator sign-off, verified via a real `theme dev` upload (failed before, 200 after), see new finding above |

---

## Still to check

Everything on the requirements page after "Search, selling plans, Shop Pay
Installments, unit pricing" — continuing section by section as the checklist
screenshots come in.
