# Release notes

## 1.1.0 — resubmission fixes

A focused release addressing a Theme Store review rejection. The root cause
was never missing features — it was that the theme shipped fabricated
commercial data live on a merchant's storefront the moment they installed
it, plus a homepage that referenced files specific to the developer's own
demo store.

**Fixed on every install**
- Removed the demo product cards that rendered invented names, prices, and
  a "New" badge on a store with no products — the single largest issue.
  Empty product sections now show a plain "no products yet" state instead.
- Stripped every `shopify://shop_images/...` reference and the hardcoded
  `best-sellers` collection default from the shipped homepage and header —
  both resolved to nothing on any store but the developer's own.
- Replaced fabricated install-state copy (B Corp / Fair Trade
  certifications, a 12,400-review / 4.8-rating figure, "Verified buyer"
  testimonials for products that don't exist) with neutral, genuinely
  editable copy.
- Collapsed to a single "Loam" preset — the second, "Fernway Night," was a
  colour swap of the same theme, which the Theme Store does not count as a
  second style.

**Removed rather than half-shipped**
- The carbon footprint feature (cart counter, PDP badge, compare column):
  presented an unverifiable sustainability figure as fact, on top of
  depending on a metafield no merchant has.
- Back-in-stock capture: implied a notification the theme cannot actually
  send.
- The `window.dataLayer` analytics layer: every event fired with no
  `Shopify.customerPrivacy.analyticsProcessingAllowed()` gate, meaning a
  merchant in a consent-regulated region who enabled it would track
  shoppers pre-consent without knowing it. Deferred to a future release,
  consent-gated — see `CLAUDE.md` §9.8 for the event taxonomy and the
  compliant design.
- Product compare now defaults off rather than being part of the reviewed
  install state (the feature itself is unchanged and can be re-enabled).

**Metafield dependencies**
- The care accordion now reads the standard `descriptors.care_guide`
  metafield instead of a custom one.
- The material tag, its composition breakdown, and its provenance note are
  now merchant-editable block settings (with dynamic-source binding
  available) rather than a hardcoded custom metafield — safer than a
  taxonomy-conditional standard metafield that may not exist for a given
  product category.
- The size guide drawer and article related-products both moved from a
  custom metafield to a plain page/product-list setting on the section.

**Also in this release**
- Added `surface_text` and `sand_text` colour settings so every background
  colour has a declared, independently adjustable foreground.
- `video-section.liquid` now builds its embed URL with Shopify's own
  `external_video_url` filter instead of a hand-built YouTube/Vimeo string.
- Removed JSON comment blocks from locale and config files (only supported
  in JSON templates).
- Terminology pass: "Enable X" labels became "Show X", a block named
  "Title" became "Product title", and the reviewer-facing paragraph in the
  Conversion settings group was replaced with a plain description.
- `.shopifyignore` now excludes internal build docs and dev tooling
  (`.github/`, `.githooks/`, `.theme-check.yml`, every root `.md` file
  except the four the theme actually ships) from `theme push` and
  `theme package`.

## 1.0.0 — initial release

Loam is a premium Online Store 2.0 theme built for brands that sell on
material honesty — footwear, apparel, homeware, anything where what a
product is made of is part of why someone buys it.

**Architecture**
- Full Online Store 2.0: JSON templates throughout, header and footer
  as section groups, app blocks on the product page, cart, cart drawer,
  and collection page.
- One stylesheet, one script. No jQuery, no framework, no external CDN
  — everything a shopper downloads ships in the theme.

**19 sections**, covering the homepage (hero, marquee, featured
collection, image with text, value props, collection list, lookbook,
impact stats, testimonials, video, UGC grid, FAQ, newsletter, rich
text, multicolumn) and full chrome (announcement bar, header with mega
menu, footer, cart drawer).

**Built-in conversion tooling** — sticky mobile Add to Cart, real
low-stock and shipping-threshold messaging (never fabricated), a
free-shipping progress bar, quick add and quick view, product
comparison, recently viewed, and an optional GA4-shaped analytics layer
that ships off by default.

**Two style presets** — Loam (light) and Fernway Night (dark) — so a
merchant gets a second colorway on day one, not just a single look.

**Accessibility and internationalization** — WCAG 2.1 AA contrast on
every default color combination, full keyboard support including the
mega menu and drawers, and seven shipped locales (English, French,
German, Spanish, Italian, Japanese, Portuguese) with verified RTL
support for Arabic and Hebrew storefronts.

**Performance** — sub-40KB JS, single-digit-KB-over-budget CSS, image
delivery tuned per component rather than one blanket srcset, and a
homepage that ships at 90+ mobile Lighthouse on the seeded demo store.

**Demo content** — a full demo store (Fernway, a natural-materials
footwear brand) ships in the repository's export package, so a fresh
install looks finished in minutes, not hours.
