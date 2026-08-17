# PROGRESS

Tracks what's built, what's verified, and what's still open on the Replenish
theme. Workflow rules for this file are defined in
`shopify-theme-claude-code-prompts.md` — update this after every section.

Prefix: `rpl-`. Convention: BEM class names, JSON templates + sections
everywhere (including header/footer), no jQuery, native Shopify APIs
preferred over hand-rolled equivalents.

## Status summary

`shopify theme check` — **0 errors, 0 warnings** (57 files inspected, last run
2026-08-17). The theme now loads and every route resolves; mobile navigation,
the AJAX cart drawer, product page JS, and collection filtering are all done.
Not yet fully Theme-Store-submittable end to end (see Known gaps).

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
| `assets/rpl-facets.js` (new) | Complete | theme-check; every entry point (checkbox, sort select, price input, pill remove link, clear-all) funnels through one refresh() using the Section Rendering API; debounced for price inputs, immediate for checkbox/select; `history.pushState` + `popstate` handling so filtered URLs are bookmarkable and back/forward work; re-runs `RPL.initReveal` on swapped-in product cards; network-failure fallback is a real navigation |
| `sections/main-404.liquid`, `main-page.liquid`, `main-search.liquid`, `main-blog.liquid`, `main-article.liquid`, `main-list-collections.liquid` | Complete | theme-check; empty/blank states per section comments |
| `sections/main-account.liquid`, `main-login.liquid`, `main-register.liquid`, `main-addresses.liquid`, `main-order.liquid`, `main-activate-account.liquid`, `main-reset-password.liquid`, `main-password.liquid` | Complete | theme-check |
| `sections/hero.liquid` (new) | Complete | theme-check; 0 blocks, no image, missing button links, many blocks, mobile/desktop height + position |
| `snippets/*` (9 files) | Complete | theme-check; referenced by all sections above |
| `assets/base.css`, `rpl-core.js`, `rpl-customer.js` | Infrastructure | shared primitives (drawer, focus trap, scroll lock, reveal-on-scroll) consumed by the JS modules above |
| `config/settings_schema.json`, `settings_data.json` | Complete | theme-check; 14 groups, 35 keys, cross-checked 1:1 |
| `locales/en.default.json` | Complete | theme-check; added 4 previously-missing storefront keys (`sections.cart.remove_short`, `sections.collection_list.count`, `sections.footer.blocks.social.no_links`, `products.product.sku`) |
| `locales/en.default.schema.json` (new) | Complete | theme-check; this file did not exist before — every `t:` reference in every section schema and in `settings_schema.json` was resolving against nothing. Built from a full audit of every `t:` key actually referenced in the codebase |
| `templates/` (new — 17 files: index, 404, article, blog, cart, collection, list-collections, page, password, product, search, customers/{account,activate_account,addresses,login,order,register,reset_password}) | Complete | theme-check. **This directory did not exist at all before this pass** — no page could render in Shopify without it |

## Verification performed this pass

- `shopify theme check` run to completion, all 4 real errors found and fixed
  (all missing storefront locale keys — not guessed, found by running the
  tool and reading its output).
- Cross-referenced every `t:` schema key against `locales/en.default.schema.json`
  by grepping all schema blocks and `settings_schema.json` (128 unique keys),
  not spot-checked.
- Could **not** verify in an actual browser/Theme Editor — this environment
  has no connected Shopify store (`shopify theme dev` needs a store to preview
  against). Everything above is verified via theme-check + code-path reasoning
  only, not a rendered page. Flagging per project rule: never claim a state is
  verified without saying how.

## Known gaps / TODO (priority order)

1. **Homepage content** — only one section (`hero`) exists. A real homepage
   needs more (featured collection, rich text / value props, testimonials,
   etc.). `index.json` currently uses only `hero`.
2. **Footer newsletter + localization** — `locales/en.default.json` already
   has an unused top-level `newsletter` key; `footer.liquid` doesn't render a
   signup form or a country/language selector yet.
3. **Contact page** — no contact-form template/section. `locales` has unused
   `templates.contact.form.*` keys reserved for this.
4. **Gift card page** — `templates/gift_card.liquid` doesn't exist yet.
   `locales.gift_cards.issued.*` is a complete, unused key set reserved for
   it. (Not a JSON template — gift card pages use a standalone Liquid
   template with `layout: none`.)
5. **Theme blocks** (`blocks/` directory) — OS 2.0 theme-blocks feature is
   entirely unused. Not required, but worth a decision before Theme Store
   submission.
6. Performance/Lighthouse and full WCAG AA audits haven't been run — need a
   real browser/store to do this meaningfully.
7. Selling-plan-per-variant eligibility isn't checked by `rpl-product.js` —
   all selling plans always show regardless of the selected variant. Only
   matters for stores with variant-restricted subscription plans.
8. The cart drawer's visible error text and screen-reader announcements
   don't yet cover every edge case a real store might hit (e.g. Shopify
   Scripts/Functions rejecting a line) — only the standard `/cart/add`,
   `/cart/change`, `/cart/update` error shapes are handled.
9. Active price-range filters don't get a removable pill in
   `main-collection.liquid` (only list/boolean values do) — "Clear all"
   still removes them, but there's no one-click way to drop just the price
   bound. Also, the min price input's placeholder is hardcoded to "0" rather
   than read from a filter field, since `filter.range_min` isn't a field I
   could confirm exists on Shopify's price_range filter object from memory
   alone (`range_max` is used with confidence; unverified fields were avoided
   rather than guessed at).

Ask which of these to build next (per the project's own workflow doc) rather
than assuming an order.
