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
- ❌ **Not part of this checklist item, but flagged along the way:**
  CLAUDE.md §9.5 itself requires "Print and Apple Wallet options" on the
  gift card page. Apple Wallet is present; no print button/link found.
  **Action:** add a print trigger to `templates/gift_card.liquid`.

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
- ❌ **Rich product media — two real gaps:**
  - `main-product.liquid` itself is fine (`video`, `external_video`, `model`
    media types all handled via `external_video_tag`/`model_viewer_tag`).
  - **Quick view gap:** `sections/quick-view.liquid` only ever renders a
    static image via `image-fallback` — a product whose primary media is a
    video or 3D model shows a flat picture in quick view instead of the
    actual rich media.
  - **Featured product section gap:** the Theme Store checklist explicitly
    names three required surfaces for rich media — product template,
    featured product section, quick view. This theme has
    `featured-collection` (a grid of many products) but **no single-product
    spotlight section** at all. That's a distinct required section type,
    entirely missing from both `CLAUDE.md` §10's inventory and the actual
    `sections/` folder.
  **Action:** build a `featured-product.liquid` section (single product,
  its own gallery + buy form, handling all three media types), and add
  rich-media handling (video/model, not just static image) to
  `quick-view.liquid`.

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
- ❌ **Selling plans — real gap.** `cart-line.liquid` correctly *displays*
  `item.selling_plan_allocation` when a line was bought via a plan, but
  **no selling-plan selector exists anywhere in the theme** — no snippet, no
  UI on `main-product.liquid` for a shopper to actually choose a
  subscription plan vs. one-time purchase. A merchant who creates selling
  plans (via a subscriptions app — the theme never creates or manages plans
  itself) has no way for customers to select one, so the cart-display code
  can never actually trigger.
  **Scope, per operator 2026-09-02:** the theme only needs to *render*
  whatever plans already exist on `product.selling_plan_groups` and feed the
  chosen plan into the existing hidden `selling_plan` input in
  `buy-buttons.liquid` — no subscription creation/management logic belongs
  in the theme; that stays app territory.
  **Action:** build a selling-plan selector (radio group or dropdown driven
  by `product.selling_plan_groups`) in the product buy form.

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
- ❌ **Custom Liquid blocks in sections with `@app` blocks — real gap.** Only
  one place in the theme has a `"type": "liquid"` setting: the standalone
  `custom-liquid.liquid` section. None of the four sections carrying `@app`
  blocks (`main-product`, `main-collection`, `main-cart`, `cart-drawer`) also
  offer a Custom Liquid *block* as a second app-insertion point, which this
  requirement asks for specifically.
  **Action:** add a `custom_liquid` block type (with a `"type": "liquid"`
  setting) to `main-product.liquid`, `main-collection.liquid`,
  `main-cart.liquid`, and `cart-drawer.liquid` — and to the new
  featured-product section once built.
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
- ❌ **Gift card recipient — real gap.** Grepped the whole theme for
  `recipient`, `form.email`/`form.name`/`form.message`, and `send_on` — zero
  matches anywhere. The gift-card product's buy form has no way for a
  shopper to send the card to someone else's email with a message and a
  scheduled send date — it can currently only be bought for the purchaser.
  **Action:** add a recipient form (email/name/message/send_on fields) to
  the buy form when `product.gift_card?` is true, using the `form` object's
  `email`/`name`/`message` attributes and `gift_card.send_on`.
- ❌ **Swatches — real gap, on the PDP specifically.** `card-product.liquid`
  and `facet-controls.liquid` both correctly use `value.swatch.color`. But
  **`variant-picker.liquid` — the actual product-page option selector —
  renders every value as a plain text label, no swatch at all**, which is
  the most important surface for this feature. Separately, `swatch.image`
  is used **nowhere** in the theme — only `swatch.color` is ever read.
  **Action:** add swatch rendering (both `swatch.color` and `swatch.image`)
  to `variant-picker.liquid`'s value labels, and add `swatch.image` support
  alongside the existing `swatch.color` handling in `card-product.liquid`
  and `facet-controls.liquid`.

---

## 7 (Pages, cont'd). Collection List page requirements

- ✅ **`collection.title` (not truncated)** — `card-collection.liquid` uses
  it directly, no `truncate` filter, no CSS ellipsis/line-clamp.
- ✅ **`collection.featured_image`** — same snippet, correctly relies on
  Shopify's own built-in fallback to the first product's image when a
  collection has no image of its own.
- ❌ **Pagination or lazy loading — real gap, missing entirely.**
  `sections/main-list-collections.liquid` renders every non-empty collection
  in one unbroken loop — no `{% paginate %}` around `collections`, no
  lazy-loading component. The collection *page* correctly paginates its
  products (§ above), but the collection *list* page doesn't paginate the
  collections themselves. A store with many collections would render them
  all in a single unpaginated page load.
  **Action:** wrap `collections` in `{% paginate collections by N %}` (or
  add lazy-loading) in `main-list-collections.liquid`, matching the pattern
  already used in `main-collection.liquid`.

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

## Open action items (running list)

| # | Item | Status |
|---|---|---|
| 1 | Manual visual-comparison pass vs. live Theme Store catalog (§2, §3) | Not started |
| 2 | Section-by-section flexible-layout spot-check (testimonials, featured-collection, lookbook-collage) | Not started |
| 3 | Real editor click-through pass | Not started |
| 4 | Real shopping-flow click-through (variant → cart → checkout) | Not started |
| 5 | VoiceOver pass | Not started (needs macOS/Safari) |
| 6 | Discount display on order template | **Done 2026-09-02** |
| 7 | Print option on gift card page | Not started |
| 8 | Rich media (video/3D model) in quick view | Not started |
| 9 | New `featured-product.liquid` section, incl. rich media, `@app` block, and `custom_liquid` block | Not started |
| 10 | Selling-plan selector on product page (render existing `selling_plan_groups` only — no subscription logic in-theme) | Not started |
| 11 | Add `custom_liquid` block type to `main-product`, `main-collection`, `main-cart`, `cart-drawer` | Not started |
| 12 | Run Shopify's official Lighthouse benchmark-dataset script once before submission | Not started |
| 13 | `cart.taxes_included` note on product page | **Done 2026-09-02** |
| 14 | Gift card recipient form (email/name/message/send_on) | Not started |
| 15 | Swatches (`swatch.color` + `swatch.image`) on `variant-picker.liquid`; add `swatch.image` to `card-product.liquid`/`facet-controls.liquid` | Not started |
| 16 | Pagination or lazy loading on `main-list-collections.liquid` | Not started |
| 17 | `cart.taxes_included` note on cart page + cart drawer | **Done 2026-09-02** |
| 18 | `item.options_with_values` on cart line (was `variant.title`) | **Done 2026-09-02** |
| 19 | `article.excerpt_or_content` word-safe fallback on blank excerpt | **Done 2026-09-02** |
| 20 | Pagination on `article.comments` | **Done 2026-09-02** |
| 21 | Comment form: loop all `form.errors` fields (was email-only) | **Done 2026-09-02** |

---

## Still to check

Everything on the requirements page after "Search, selling plans, Shop Pay
Installments, unit pricing" — continuing section by section as the checklist
screenshots come in.
