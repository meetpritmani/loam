# PROGRESS

Tracks what's built, what's verified, and what's still open on the Replenish
theme. Workflow rules for this file are defined in
`shopify-theme-claude-code-prompts.md` — update this after every section.

Prefix: `rpl-`. Convention: BEM class names, JSON templates + sections
everywhere (including header/footer), no jQuery, native Shopify APIs
preferred over hand-rolled equivalents.

## Status summary

`shopify theme check` — **0 errors, 0 warnings** (68 files inspected, last run
2026-08-17). Mobile navigation, the AJAX cart drawer, product page JS,
collection filtering, a first pass of homepage sections, and a product
discovery batch are all done. Not yet fully Theme-Store-submittable end to
end (see Known gaps).

The repo is pushed to `github.com/meetpritmani/replenish` (`main`). A dev
store (`tes-store-7r6dce1z`) is connected via `shopify theme dev`, which means
**every change from this point on is verified two ways**: `shopify theme
check` locally, and the actual Shopify Liquid compiler on the live store (the
dev-server sync log). This matters — local theme-check has already missed
real compiler errors twice (a literal `{brace}` inside a `t:` filter argument,
and an invalid `role` key in `settings_schema.json`) that only surfaced on
the real store.

A second planning doc, `shopify-theme-sections-prompts.md`, was added with a
much larger section list (~20 sections across homepage, product discovery,
trust/conversion, content, cart, and footer/utility) plus a template-wiring
pass. This pass covers the homepage batch only — see Known gaps for the rest.

## Built and verified

| File | State | Tested against |
|---|---|---|
| `layout/theme.liquid`, `layout/password.liquid` | Complete | theme-check; deferred CSS/JS wiring, skip link, live regions |
| `sections/header.liquid` | Mobile nav done; mega menu/predictive search/sticky still open | theme-check; 0/1/many menu items (with/without submenus), with/without logo, index vs. non-index `<h1>`, mobile off-canvas menu open/close with JS on and off, keyboard-only traversal, resize past desktop breakpoint while open |
| `snippets/header-menu.liquid` (new) | Complete | theme-check; extracted from header.liquid so desktop nav and mobile off-canvas nav can't drift — 0/1/many links, with/without submenu |
| `sections/footer.liquid` | **Scaffold** — no newsletter/localization | theme-check; 0/1/many blocks, social block with no links configured |
| `sections/main-cart.liquid` | Complete no-JS baseline; drawer built separately (see below) | theme-check; empty cart |
| `sections/main-product.liquid` | Complete — no-JS baseline plus gallery/variant/sticky-ATC JS hooks | theme-check; 1 variant (no select, gallery/sticky ATC still work), 10+ variants, no image, 1 image (no thumbnails rendered), many images, sold out, unavailable/no variant, no SKU / show_sku off, with/without selling plans (selling-plan-per-variant eligibility deliberately not handled — see gaps) |
| `assets/rpl-product.js` (new) | Complete | theme-check; thumbnail gallery is an ARIA tablist/tabpanel with roving tabindex and arrow-key nav, screen-reader announcements via the existing `products.product.media.image_available` locale key; variant change never reconstructs price or translated labels in JS — it only toggles Liquid-rendered hidden blocks; sticky ATC resubmits the real form via `requestSubmit` (no duplicated add-to-cart logic); `IntersectionObserver`-unsupported and Theme Editor `shopify:section:load` re-init both handled |
| `sections/cart-drawer.liquid` (new) | Complete | theme-check; empty cart, no-image line item, subscription line item, line item properties/discounts, cart-level discounts, unit pricing, many items (scrolls), sold-out/error response, keyboard-only use, screen reader (dialog role, live status), reduced motion (reuses existing `.rpl-drawer`/`.rpl-overlay` transitions) |
| `assets/rpl-cart.js` (new) | Complete | theme-check; add-to-cart intercepted only when the drawer exists (cart_type: drawer) — falls through to native full-page POST otherwise; quantity change/remove/note update; header badge sync via the refreshed section's own item count, not per-endpoint response shape |
| `sections/main-collection.liquid` | Complete — native Search & Discovery filtering/sorting | theme-check; no filters (S&D not configured), sort-only, filter with 0/1/many values, price range, several active filters at once, filters producing zero results (reuses `products.use_fewer_filters_html`), empty collection, no image/price products |
| `sections/trending-products.liquid` (new) | Complete | theme-check + live store; reuses `snippets/product-card.liquid` as-is (badge is an overlay added in the section, not a snippet change); no collection picked, empty collection, badge on/off. Sort order comes from the picked collection's own setting — not a hand-rolled "best selling" computation |
| `sections/featured-product.liquid` (new) | Complete | theme-check + live store; deliberately reuses `main-product.liquid`'s exact data-hooks/classes (`data-product-gallery`, `data-product-json`, `data-product-variant-select`, `data-product-price`, `data-product-submit`, `.rpl-product-form`) so `rpl-product.js`/`rpl-cart.js` drive it with zero new JS — required moving the shared gallery/product-form CSS out of `main-product.liquid`'s section-scoped stylesheet into `base.css` first (same class-sharing issue fixed once already for the cart drawer). Simplified vs. the full PDP on purpose: no selling plans, no SKU, no sticky ATC. No product picked (onboarding placeholder), 1 variant, many variants, sold out |
| `sections/frequently-bought-together.liquid` (new) + `assets/rpl-fbt.js` (new) | Complete | theme-check + live store; product-page only; per-item variant selection is a plain inline `<select>`, not a modal (deliberate scope reduction — documented below); running total computed via a small `formatMoney()` — the one deliberate exception to "never reformat money in JS" in this theme, since a sum across independently-selectable items can't be pre-rendered by Liquid; single combined `/cart/add.js` call with an `items` array; reuses `RPL.refreshCartDrawer` (newly exposed from `rpl-cart.js`) instead of duplicating drawer-refresh logic |
| `sections/recently-viewed.liquid` (new) + `sections/product-card-fetch.liquid` (new) + `assets/rpl-recently-viewed.js` (new) | Complete | theme-check + live store; localStorage-tracked (handle + timestamp, capped at 12, 30-day expiry), current product excluded from its own list, a since-unpublished product's fetch just returns nothing. `product-card-fetch.liquid` is a second "always-rendered, normally invisible" section (same trick as `cart-drawer.liquid`) giving a *stable* `?section_id=product-card-fetch` endpoint — needed because the original single-section dual-purpose design would have broken if a merchant ever added "Recently viewed" directly onto a product page (caught and fixed before it shipped, not after) |
| `assets/rpl-facets.js` (new) | Complete | theme-check; every entry point (checkbox, sort select, price input, pill remove link, clear-all) funnels through one refresh() using the Section Rendering API; debounced for price inputs, immediate for checkbox/select; `history.pushState` + `popstate` handling so filtered URLs are bookmarkable and back/forward work; re-runs `RPL.initReveal` on swapped-in product cards; network-failure fallback is a real navigation |
| `sections/main-404.liquid`, `main-page.liquid`, `main-search.liquid`, `main-blog.liquid`, `main-article.liquid`, `main-list-collections.liquid` | Complete | theme-check; empty/blank states per section comments |
| `sections/main-account.liquid`, `main-login.liquid`, `main-register.liquid`, `main-addresses.liquid`, `main-order.liquid`, `main-activate-account.liquid`, `main-reset-password.liquid`, `main-password.liquid` | Complete | theme-check |
| `sections/hero.liquid` | Complete — rebuilt as a slideshow | theme-check + live store; 1 slide (plain static hero, no controls rendered), 2-5 slides, a slide with no image/video, a slide with video overriding its image (native Shopify video, own pause control), a slide with no button, autoplay on/off, `prefers-reduced-motion` (disables autoplay outright), keyboard arrow-key nav. Blocks changed from separate heading/text/buttons types to one bundled "slide" type — `templates/index.json` updated to match |
| `assets/rpl-hero.js` (new) | Complete | theme-check + live store; prev/next, dot indicators, reference-counted autoplay pause reasons (hover/focus/manual/tab-hidden) so they can't cancel each other out, video play/pause synced to slide-active state |
| `sections/feature-highlights.liquid` (new) | Complete | theme-check + live store; 0 blocks (renders nothing), no icon on a block, no heading setting, a block with no link, many blocks. Icon is an `image_picker`, not a fixed icon library — merchants aren't limited to whatever the theme ships |
| `sections/collection-list.liquid` (new) + `snippets/collection-card.liquid` (new) | Complete | theme-check + live store; 0 collections picked (renders nothing), a picked collection later deleted (skipped, not broken), no collection image, grid and carousel layout, title-overlay on/off |
| `sections/testimonials.liquid` (new) + `snippets/testimonial-card.liquid` (new) | Complete | theme-check + live store; 0 blocks, no photo, no linked product, rating 1-5, grid and carousel layout |
| `sections/trust-badges.liquid` (new) | Complete | theme-check + live store; 0 blocks, a block with no image (falls back to a placeholder, not a broken image — `image_picker` can't have a programmatic default), auto-scroll on/off, `prefers-reduced-motion` (drops the duplicate track and the animation, falls back to one static wrapping row), grayscale-until-hover on/off |
| `assets/rpl-core.js` — `initCarousels` (new) | Complete | theme-check + live store; generic `[data-carousel]` enhancement shared by collection-list and testimonials — actual swipe/scroll is native CSS scroll-snap (no JS), this only wires optional prev/next buttons |
| `snippets/icon.liquid` — `pause`/`play`/`star` icons (new) | Complete | theme-check + live store |
| `snippets/*` (13 files total) | Complete | theme-check; referenced by all sections above |
| `assets/base.css`, `rpl-core.js`, `rpl-customer.js` | Infrastructure | shared primitives (drawer, focus trap, scroll lock, reveal-on-scroll, carousel) consumed by the JS modules above |
| `config/settings_schema.json`, `settings_data.json` | Complete | theme-check; 14 groups, 35 keys, cross-checked 1:1 |
| `locales/en.default.json` | Complete | theme-check; added 4 previously-missing storefront keys (`sections.cart.remove_short`, `sections.collection_list.count`, `sections.footer.blocks.social.no_links`, `products.product.sku`) |
| `locales/en.default.schema.json` (new) | Complete | theme-check; this file did not exist before — every `t:` reference in every section schema and in `settings_schema.json` was resolving against nothing. Built from a full audit of every `t:` key actually referenced in the codebase |
| `templates/` (new — 17 files: index, 404, article, blog, cart, collection, list-collections, page, password, product, search, customers/{account,activate_account,addresses,login,order,register,reset_password}) | Complete | theme-check. **This directory did not exist at all before this pass** — no page could render in Shopify without it |

## Verification performed this pass

- `shopify theme check` run to completion after every file change.
- Every file also verified against the live dev store via `shopify theme
  dev`'s sync log. Real errors caught there and fixed, most theme-check
  didn't catch:
  - A literal `{index}` placeholder inside a `t:` filter's string argument
    (Shopify's Liquid tokenizer trips on raw braces there).
  - An invalid `role: "shadow"` key in the color_scheme_group `role` map.
  - A `templates/index.json` referencing three section types
    (`trending-products`, `image-with-text`, `newsletter-signup`) written in
    before actually building them — briefly broke the live homepage.
  - `columns_desktop` written as a quoted string (`"4"`) in
    `templates/index.json` for `trending-products`, whose schema defines it
    as a `range` (needs a plain number) rather than the `select` type
    (needs a string) used by the other sections with a same-named setting —
    an inconsistency across my own sections, not obvious without the real
    validator's exact error message.
  - `theme check` *did* catch one itself this pass: a schema `name` over
    Shopify's 25-character limit (`"Frequently bought together"`).
- `templates/product.json` wired with `frequently-bought-together` and
  `recently-viewed`; `templates/index.json` gained `trending-products`.
  `featured-product` is built but **not wired anywhere** — its `product`
  setting needs a real product reference I don't have for this store, so
  leaving it unconfigured was more honest than guessing.
- Still not interacted with in an actual browser by me — verification is
  theme-check + the real Liquid compiler's sync log + code-path reasoning,
  not a rendered/clicked page.

## Known gaps / TODO (priority order)

1. **Rest of `shopify-theme-sections-prompts.md`** — homepage batch and
   product discovery are both done now. Still open: countdown-banner,
   faq-accordion (trust/conversion — testimonials and trust-badges are
   done); image-with-text, video-section, ugc-gallery (content);
   announcement-bar (cart/checkout-adjacent — the cart drawer itself is
   already done, but without the free-shipping progress bar or upsell block
   the doc describes); newsletter-signup, mega-menu (footer/utility). Plus
   the full template-wiring pass across every page, not just home/product.
2. `collection-list`'s `collections` setting is empty, `trust-badges` has no
   blocks, and `featured-product` isn't wired into any template at all —
   all three need real store data (actual collections, actual payment/press
   logo images, an actual product to spotlight) only the merchant can
   supply. Not a code gap, a content gap.
3. Frequently-bought-together's per-item variant selection is a plain
   inline `<select>`, not the modal the original doc described — a
   deliberate scope reduction to avoid building a whole popup UI for
   marginal UX gain over an inline picker every other product form in this
   theme already uses.
4. **Footer newsletter + localization** — `locales/en.default.json` already
   has an unused top-level `newsletter` key; `footer.liquid` doesn't render a
   signup form or a country/language selector yet.
5. **Contact page** — no contact-form template/section. `locales` has unused
   `templates.contact.form.*` keys reserved for this.
6. **Gift card page** — `templates/gift_card.liquid` doesn't exist yet.
   `locales.gift_cards.issued.*` is a complete, unused key set reserved for
   it. (Not a JSON template — gift card pages use a standalone Liquid
   template with `layout: none`.)
7. **Theme blocks** (`blocks/` directory) — OS 2.0 theme-blocks feature is
   entirely unused. Not required, but worth a decision before Theme Store
   submission.
8. Performance/Lighthouse and full WCAG AA audits haven't been run.
9. Selling-plan-per-variant eligibility isn't checked by `rpl-product.js` —
   all selling plans always show regardless of the selected variant. Only
   matters for stores with variant-restricted subscription plans.
10. The cart drawer's visible error text and screen-reader announcements
    don't yet cover every edge case a real store might hit (e.g. Shopify
    Scripts/Functions rejecting a line) — only the standard `/cart/add`,
    `/cart/change`, `/cart/update` error shapes are handled.
11. Active price-range filters don't get a removable pill in
    `main-collection.liquid` (only list/boolean values do) — "Clear all"
    still removes them, but there's no one-click way to drop just the price
    bound. Also, the min price input's placeholder is hardcoded to "0" rather
    than read from a filter field, since `filter.range_min` isn't a field I
    could confirm exists on Shopify's price_range filter object from memory
    alone (`range_max` is used with confidence; unverified fields were avoided
    rather than guessed at).

Ask which of these to build next (per the project's own workflow doc) rather
than assuming an order.
