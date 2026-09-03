# Release notes

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
