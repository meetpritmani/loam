# Loam

A premium Online Store 2.0 theme for Shopify, built for brands that sell on
material honesty — footwear, apparel, homeware, anything where what a thing is
made of is part of why someone buys it.

Zero dependencies. One stylesheet, one script, no jQuery, no framework, no
external CDN. Everything a shopper downloads is in this repository.

---

## Build status

**This theme is in active development and is not yet ready to sell.**

| Phase | Scope | Status |
|---|---|---|
| 1 | Foundation — layout, tokens, CSS/JS core, settings, SEO, a11y | Complete |
| 2 | Chrome — announcement bar, header, mega menu, footer, cart drawer | Complete |
| 3 | Homepage — 15 sections | Complete |
| 4 | Templates — product, collection, search, cart, blog, customers | Complete |
| 5 | Demo store seeding | **Complete** — 48 of 48 demo photos sourced, licensed and uploaded; catalogue, collections and content seeded |
| 6 | Demo content shipped in the repo | **Complete** — theme JSON fully wired to the seeded media, both presets ship, `assets/` correctly bundles no photography |
| 7 | Hardening — Lighthouse, JSON-LD, VoiceOver, fresh-install test | **In progress** — theme check, contrast, section and locale audits automated and passing; JSON-LD validated on every template; RTL verified live (a real bidi bug found and fixed); a fresh, empty dev store confirmed installing to a finished-looking homepage in the seeded time budget; desktop Lighthouse confirmed 90+ repeatably; listing screenshots captured — 10 page states × 3 breakpoints, both theme styles. A VoiceOver pass is the one item still open |

Nothing in this file describes behaviour that does not exist today.

---

## Requirements

- A Shopify store on any plan
- [Shopify CLI](https://shopify.dev/docs/api/shopify-cli) 3.x for local development
- Node.js 20+ (CLI only — the theme itself ships no JavaScript dependencies)

---

## Install

### From the theme ZIP

1. **Online Store → Themes → Add theme → Upload ZIP file**
2. Choose `loam.zip`
3. **Customize** to open the editor, or **Publish** to make it live

### From this repository

```bash
shopify theme push --unpublished     # upload as a draft
shopify theme dev                    # local preview with hot reload
```

The theme installs and renders correctly on a store with **zero products**.
Product-driven sections fall back to demo cards — real names, prices and
material tags — so a new store never shows an empty grid. Their image slots
show Shopify's placeholder until you add your own photography; no stock
imagery ships inside the theme.

---

## Theme settings

Twelve groups under **Online Store → Themes → Customize → Theme settings**.

| Group | What it controls |
|---|---|
| **Colors** | Colour schemes. Six roles per scheme — ink, paper, surface, accent, sand, signal. Four schemes ship. |
| **Typography** | Heading and body fonts from Shopify's library, heading/body scale, letter spacing, uppercase toggle |
| **Layout** | Page width, section spacing, corner radius, border weight |
| **Animations** | Scroll reveal, image zoom on hover |
| **Product cards** | Image ratio, hover image, swatches, badges, material tag, quick add, quick view, compare |
| **Cart** | Drawer or page, order note, free-shipping bar and its threshold, running carbon footprint total |
| **Search** | Predictive search, prices in results |
| **Currency format** | Show currency codes |
| **Brand** | Logo, logo width, favicon, social share image |
| **Social media** | Profile URLs — also feeds `sameAs` in the Organization schema |
| **Conversion** | See [Conversion settings](#conversion-settings) |
| **Demo content** | Controls the demo card fallback on product sections |

### Colour schemes

Colour is defined per *scheme*, not globally. Every section picks a scheme, and
the six role tokens resolve differently inside it. This is why a dark section
and a light section can sit next to each other without either one needing
bespoke overrides.

`--c-ink-70`, `--c-ink-45` and `--c-ink-12` are derived with Liquid's
`color_mix` against each scheme's own background, so muted text stays legible
whether the scheme is light or dark. Text is never faded with `opacity`.

Which tint carries text is fixed rather than a matter of taste. `--c-ink-70` is
the only muted **text** tint — it clears AA on every scheme. `--c-ink-45` is
never text: a 45% mix measures 2.87:1 on the paper ground and cannot be made to
pass, so it is reserved for the cases WCAG exempts — disabled controls,
decorative icons, separator glyphs. `--c-ink-12` is hairlines only.

All four schemes meet WCAG 2.1 AA in both shipped theme styles. If you edit
them, re-measure: `npm run check:contrast` checks every rendered pair in every
scheme of every style and exits non-zero on a failure. The tightest pair as
shipped is the accent on the sand scheme at 4.69:1.

### Theme styles

Two presets ship, switchable from the top of the theme editor:

| Style | Ground |
|---|---|
| **Fernway** | Light. Paper `#F5F4F0`, ink `#101A16`, accent `#2E6B4F` |
| **Fernway Night** | Dark. Paper `#0E1512`, text `#EDEFEA`, accent lifted to `#8FBFA4` |

In Fernway Night the `scheme-ink` scheme is *inverted* rather than darkened
further, so the sections that break up the page in daylight still break it up
at night. Switching style replaces your colour settings — it does not merge
with them.

---

## Conversion settings

Loam treats conversion as a first-class requirement. What a theme can actually
supply is *surface*: clarity, speed, friction removal, honest signals, and
measurement. Whether that lifts your conversion rate is something you prove by
testing on your own traffic.

**[CRO-CHECKLIST.md](CRO-CHECKLIST.md)** is the setup order — which setting to
configure, in what order, what each one does, and what to test first. Start
there; this section is the reference.

| Setting | Default | Effect |
|---|---|---|
| `cro_sticky_atc` | on | Sticky Add to Cart bar on mobile, shown once the main button scrolls away |
| `cro_dynamic_checkout` | on | Express checkout buttons beneath Add to Cart |
| `cro_show_payment_icons_pdp` | on | Payment marks in the product page trust row |
| `cro_low_stock_threshold` | 10 | Low-stock message at or below this quantity. `0` disables |
| `cro_trust_returns` | "Free returns for 30 days" | Shown beside Add to Cart |
| `cro_trust_shipping` | "Carbon neutral shipping on every order" | Shown beside Add to Cart |
| `cro_back_in_stock` | on | "Email me when this is back" capture on a genuinely sold-out variant — never on an unavailable combination, which is a different state with nothing to be notified about |
| `cro_cart_upsell_products` | — | Up to three products offered in the cart and drawer |
| `cro_empty_cart_collection` | — | Drives empty-cart, 404, search and blog recovery routes |
| `cro_datalayer` | **off** | GA4-shaped events to `window.dataLayer` |

`cro_datalayer` defaults to **off** deliberately. Most stores already track
events through Google Tag Manager or an app, and running both double-counts
every event.

### What this theme will not do

These are commonly sold as conversion features. They are dark patterns, they
create legal exposure under the FTC's rules on deceptive reviews and the EU
Omnibus Directive, and they cost you repeat custom. Loam has no setting that
enables any of them, and adding one is not a supported customisation:

- Countdown timers that reset on refresh or run on a rolling window
- Fabricated live activity — "17 people are viewing this"
- Low-stock badges on products where inventory is not tracked
- Pre-ticked add-ons, insurance, or subscription upgrades
- Costs revealed only at checkout
- Entry popups that fire before the visitor has seen the page
- A `compare_at_price` that was never the real prior price
- Star ratings in structured data without real review data

Low stock is the clearest example of the principle. It reads
`variant.inventory_quantity`, and it renders **only** when you actually track
inventory for that variant and are not selling past zero. On untracked stock it
renders nothing at all — because a scarcity claim on untracked stock is not a
claim you can stand behind.

---

## Sections

### Homepage

| Section | Notes |
|---|---|
| Announcement bar | Rotating messages, optional country and language selectors |
| Header | Mega menu with feature card, sticky, mobile drawer, cart count, account entry point that adapts to new or classic customer accounts automatically |
| Hero | Image or video, separate mobile media, 9-way text position, scrim, two CTAs, stat row |
| Marquee | Seamless loop, pauses on hover, plain scroll under reduced motion |
| Featured collection | Grid or slider, quick add, view-all link |
| Image with text | Media side and ratio control, feature list with material tags |
| Value props | Two to four, icon or custom image |
| Collection list | Two, three or four up, overlay captions |
| Lookbook collage | Asymmetric grid with tall and wide spans, captions |
| Impact stats | Two to four figures, count-up on reveal |
| Testimonials | Slider or grid, star rating, avatar, source label |
| Video | Shopify-hosted or external, poster required, click to play |
| UGC grid | Image tiles linking to a product or collection |
| FAQ | Accordion, emits `FAQPage` structured data |
| Newsletter | Shopify customer form with inline success and error states |
| Rich text | Heading, text and button blocks |
| Multicolumn | Two to four columns, each ending in a link |
| Footer | Menu blocks, newsletter, social, payment icons, locale and currency, Follow on Shop where your store is eligible |
| Custom Liquid | Drop into any JSON template — a `type: "liquid"` setting in the theme's own colour-scheme and padding wrapper, so raw Liquid or an app snippet gets the same section chrome as everything else |
| Cart drawer | Free-shipping progress, inline quantity, order note |

### Product page

Built from blocks, so the info column can be reordered in the editor. The
shipped order puts title, price and the variant picker above the fold at
375px with Add to Cart directly beneath.

Available blocks: vendor, title, badges, price, material tag, carbon
footprint, variant picker, low stock, buy buttons, trust row, description,
collapsible rows, share, and `@app` for app blocks.

Behaviour worth knowing:

- **The gallery is a stacked two-column grid**, not a single stage with a
  thumbnail strip — every image is visible at once. Clicking one opens it
  in a centred lightbox with a scale-and-fade animation; click outside the
  image, the close button, or Escape all dismiss it, and focus returns to
  the thumbnail that opened it.
- **Variant switching** updates the price, availability, media, button state
  and the URL. Price is re-rendered by Shopify through the Section Rendering
  API rather than formatted in JavaScript, so currency symbol, separator and
  placement stay correct in every market you sell to.
- **Unavailable combinations are shown and marked, never hidden.** Hiding them
  makes a picker feel broken and hides the fact that you stock the option.
- **The picker works without JavaScript.** A `<noscript>` select posts a real
  variant id.
- **The sticky bar forwards to the real Add to Cart** rather than owning a
  second form, so there is one variant id and one source of truth.
- **The quantity stepper disables itself** along with Add to Cart when
  there is no purchasable variant — sold out or unavailable never leaves
  an active-looking control with nothing to submit.
- **Back-in-stock capture appears only on a genuinely sold-out variant** —
  `variant.inventory_management` set and quantity at zero — never on an
  unavailable colour/size combination that was simply never stocked.
  Controlled by `cro_back_in_stock`.
- **Pickup availability** re-fetches per variant, since store availability is
  variant-scoped and cannot be pre-rendered with the rest of the page. Shows
  nothing until at least one location has local pickup turned on.
- **Shop Pay Installments** renders through `payment_terms` inside the same
  form Add to Cart submits — it has to sit inside that exact form context to
  have anything to bind to. Shows nothing unless Shop Pay is active and
  eligible for your store's region and order value.

### Product cards

Every card can carry two extra actions beyond quick add, each its own tab
stop so neither steals a click from the other or from the card's own
title link:

- **Quick view** fetches the product into a drawer through the Section
  Rendering API — gallery, price, variant picker, Add to Cart — without
  leaving the grid. Distinct from quick add: quick add is for the
  single-variant case that needs no decision, quick view is for the case
  that does.
- **Compare** holds up to three products in a persistent tray (your own
  browser only, never sent to you) and opens a side-by-side table —
  price, material, carbon footprint, availability.

Both are switches, not always-on: `card_quick_view` and
`card_show_compare`.

### Other templates

| Template | Section | Notes |
|---|---|---|
| Collection | `main-collection-banner`, `main-collection` | Faceted filters and sort without a page reload; scroll position and filter state survive |
| Collections list | `main-list-collections` | Empty collections hidden |
| Search | `main-search` | Products rank above articles above pages. Popular products before a search; spelling help and your own popular searches after a fruitless one |
| Cart page | `main-cart` | Same components as the drawer. Shown when your cart type is Page, and at `/cart` either way |
| Blog | `main-blog` | Topic filter, signup at the foot of the list |
| Article | `main-article` | Related products from an article metafield, share, comments |
| Page | `main-page` | Ends in a next step and a contact route |
| Contact page | `contact-form`, `faq` | Form owns the first screen, response time stated above the fields, alternative routes always visible. Use `page.contact` on the page |
| About page | `main-page`, `image-with-text`, `impact-stats`, `rich-text` | Story then numbers then a shop CTA. Use `page.about` on the page |
| 404 | `main-404` | Search box, your chosen collections, and a home link |
| Password | `main-password` | Email capture is the primary action; store login sits below it |
| Customer accounts | `main-login`, `main-register`, `main-account`, `main-order`, `main-addresses`, `main-reset-password`, `main-activate-account` | All seven templates |
| Gift card | `templates/gift_card.liquid` | Balance, code, print and Apple Wallet |

Three rows load only as you approach them, so they cost nothing above the fold:

- **Related products** — from Shopify's recommendations, never a slice of the
  same collection. Hidden entirely below three results.
- **Complementary products** — Shopify's "goes well with" recommendations, a
  separate row from related rather than a toggle on it: related answers
  "shoppers who liked this also liked," complementary answers "pairs with
  this specific item." Same three-result minimum.
- **Recently viewed** — held in the shopper's own browser, never sent to you or
  joined to a customer record. Hidden when empty, and it never shows the
  product currently open.

---

## Analytics

With `cro_datalayer` on, Loam pushes GA4-shaped events to `window.dataLayer`.
It is **off** by default — most stores already fire these from Google Tag
Manager or an app, and running both double-counts every event. Turn it on only
if this is your only source.

| Event | Fires when |
|---|---|
| `view_item` | A product page loads |
| `view_item_list` | A collection grid or a featured-collection row enters the viewport, once per list |
| `select_item` | A product card is clicked through to its page |
| `add_to_cart` | The cart API confirms the add — never on the click |
| `remove_from_cart` | A line is removed, or its quantity stepped to zero |
| `view_cart` | The cart drawer opens, or the cart page loads |
| `begin_checkout` | The checkout button is clicked |
| `search` | Search results render, with the term and the result count |
| `sign_up` | A newsletter signup succeeds |

Every `items[]` entry carries `item_id` (your SKU, falling back to the variant
id), `item_name`, `item_brand`, `item_category`, `item_variant`, `price` in
major units, `quantity` and `currency`. List events add `index` and
`item_list_name`.

`window.dataLayer` is guarded before every push, so load order against your tag
manager does not matter.

No customer data is ever pushed. Not an email, not a name, not a customer id —
only catalogue fields and the shopper's own interaction with them.

---

## Metafields

Loam reads these and degrades cleanly when they are absent. None is required.

| Namespace and key | Type | Used for |
|---|---|---|
| `custom.material` | Single line text | Material tag on cards and the product page |
| `custom.care` | Rich text | Care collapsible row |
| `custom.carbon_footprint` | Decimal | Carbon badge on the product page, and the cart's running footprint total |
| `custom.size_guide` | Page reference | Size guide drawer |
| `custom.material_composition` | JSON | Segmented composition bar in the material tag, e.g. `[{"name": "Merino wool", "percent": 70}, {"name": "Sugarcane foam", "percent": 30}]`. Up to 4 entries are shown |
| `custom.material_story` | Rich text | The "Behind the seam" note in the material tag's expanded panel |

Create these under **Settings → Custom data → Products**. Set storefront
access to **read** or the theme cannot see them.

The last two are optional even where `custom.material` is set: with neither
present the material tag stays the plain, non-interactive caption it has
always been. Set one, the other, or both to promote it to an expandable
`<details>` — no theme setting turns this on or off, it is driven entirely by
whether the data exists.

---

## Images

Every image passes through a three-layer fallback: your image if you have set
one, a demo asset if the theme has one and demo content is on, and Shopify's
placeholder if neither applies. No section can render a broken or missing
image, and every media box reserves its aspect ratio so nothing shifts under a
button as the page loads.

**No photography ships inside the theme.** The download contains no stock
images, so there is nothing to strip out, no third-party licence riding along
with your store, and no unused megabytes in the ZIP. Layer two of the fallback
is inert unless you add matching files to the theme's own `assets/` yourself.

To reproduce the store shown in the screenshots, use the `demo-store-export/`
package in your download: upload its `media/` folder to **Content → Files** and
the theme's shipped layout finds those images by filename. That is layer one —
your own store's images, on your own CDN.

---

## Performance

Budgets are enforced, not aspirational:

| Budget | Limit | Current |
|---|---|---|
| CSS, gzipped | 60KB | 27.0KB |
| JavaScript, gzipped | 40KB | 31.2KB |
| Stylesheets | 1 | 1 |
| Scripts | 1 | 1 |
| External requests | 0 | 0 |

How this is held: one render-blocking stylesheet, one ES module, images always
through `image_tag` with explicit dimensions and `sizes`, `loading="lazy"`
everywhere except the hero, fonts preloaded from Shopify's library with
`font-display: swap`, and no animation library.

---

## Accessibility

- WCAG 2.1 AA contrast on every default colour combination, in both theme
  styles, measured by `npm run check:contrast` rather than asserted
- Visible focus ring on every interactive element
- Drawers are `role="dialog"` with `aria-modal`, trapped focus, Escape to
  close, and focus returned to whatever opened them
- One tab stop per product card
- Variant pickers are real radio groups, not styled divs
- A single `aria-live` region announces cart and form results
- Everything animated is disabled under `prefers-reduced-motion`, and the
  scroll observer short-circuits so no content is left hidden
- Logical CSS properties throughout, so RTL locales lay out correctly

---

## Languages

Storefront strings ship in seven languages: English, French, German, Spanish,
Italian, Japanese and European Portuguese. Editor labels — the settings a
merchant sees in the customizer — are English only.

Shopify serves whichever of these matches the shopper's chosen language and
falls back to English for anything else, so adding a language is a matter of
copying `locales/en.default.json` and translating it. `npm run check:locales`
then verifies the new file against English: every key present, no dead keys
left over, and every `{{ placeholder }}` intact. Plural categories follow CLDR
rather than English — Japanese has one, which is why `ja.json` carries only the
`other` form of each plural group and that is correct rather than incomplete.

---

## Browser support

Last two versions of Chrome, Safari, Firefox and Edge. iOS 15 and later.

---

## Development

```bash
shopify theme dev            # local server with hot reload
shopify theme check          # must be clean before any commit
shopify theme push --unpublished
shopify theme package        # build the distributable ZIP

npm run check:contrast       # WCAG audit of every scheme in every theme style
npm run check:sections       # audits every section against the per-section checklist
npm run check:locales        # translated locales against en.default.json
npm run check:secrets        # refuses a commit carrying an Admin API token
```

CI runs `shopify theme check --fail-level error` on every push, and parses the
seeding scripts.

### Demo store seeding

Not part of the theme you install — `.shopifyignore` and `.theme-check.yml` both
exclude it. It builds the developer's own demo store and generates the buyer's
`demo-store-export/` package.

```bash
npm install
npm run seed -- --offline    # buyer export only, contacts no store

cp .env.example .env         # store domain, Admin API token, API version
npm run seed                 # all five steps
node scripts/seed.mjs --from=3   # resume from a step
```

| Step | Does |
|---|---|
| 1 | `demo-media-raw/` → optimised WebP in `demo-media/`, and the licence ledger |
| 2 | Uploads to the store's Files, writes `media-map.json` |
| 3 | Products, variants, metafields, collections — and `products.csv` |
| 4 | Pages, journal, menus — and the copy-ready markdown |
| 5 | Injects `shopify://shop_images/…` references into the theme JSON |

Every step is idempotent: run twice and nothing duplicates. Step 1 needs images
in `demo-media-raw/`, which are downloaded by hand from
[Burst](https://burst.shopify.com) — run it with the directory empty and it
prints the full list with dimensions and subjects.

Enable the credential guard once per clone:

```bash
git config core.hooksPath .githooks
```

It refuses any commit containing an Admin API token. A leaked token is write
access to a store, and git history makes it permanent.

### Structure

```
assets/      base.css and global.js — the only two files a shopper downloads
config/      settings_schema.json, settings_data.json
layout/      theme.liquid, password.liquid
locales/     en.default.json (storefront), en.default.schema.json (editor),
             plus fr de es it ja pt-PT (storefront strings)
sections/    49 sections plus header-group.json and footer-group.json
snippets/    36 snippets
templates/   JSON templates
```

### Conventions

If you are modifying this theme, these are the rules it is built to. Breaking
them is what makes a theme unmaintainable:

- **One stylesheet, one script.** Never add a second. No per-section CSS, no
  `@import`, no inline `<style>` outside `theme-tokens.liquid`.
- **No hardcoded colours, fonts or spacing.** Everything is a custom property
  defined once in `snippets/theme-tokens.liquid`.
- **No hardcoded English.** Storefront strings come from
  `locales/en.default.json` via `| t`; editor labels are `t:` keys in
  `en.default.schema.json`.
- **Custom elements only** for JavaScript, one class per behaviour, each
  surviving `shopify:section:load` and `shopify:section:unload`.
- **Section padding lives on `.section`**, never also on a component class.
- **`!important` is banned**, with one exception: `.visually-hidden`.
- **Maximum selector specificity is 0,2,0.**

A note on `.page-width`: it carries `width: 100%` deliberately. Auto margins
disable stretch alignment on a grid or flex item, so without an explicit width
the element shrink-wraps to its content and falls out of line with every other
section on the page. It is not redundant.

---

## Support

Questions, bugs and customisation notes belong in the repository's issue
tracker.

---

## Credits and licence

Demo photography is AI-generated (per-file model and prompt recorded in
`demo-media-raw/PROMPTS.md`) or sourced from [Burst](https://burst.shopify.com),
Shopify's free stock library — see [Images](#images). Only a CC0-licensed
Burst photo would ever be bundled with the theme itself, and none of the
demo set qualifies: every file this build ships is AI-generated, store-only
by default. `assets/LICENSES.md` records the decision and the per-file
licence ledger lives in `demo-store-export/LICENSES.md`.

Loam is original work. No Liquid, CSS, JavaScript, class names, schema or copy
has been taken from any other commercial theme.
