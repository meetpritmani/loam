# PROGRESS — Loam

Execution log for the **Loam** premium Shopify theme (demo brand: Fernway).
Spec: `CLAUDE.md` — follow it exactly; this file tracks execution against its
§12 build phases.

---

## 2026-08-20 — Spec change: Replenish → Loam

`CLAUDE.md` replaced the previous build spec. The two are different products,
not revisions of one:

| | Previous ("Replenish") | Current ("Loam") |
|---|---|---|
| Product | Subscriptions / reorder theme | Natural-materials footwear theme |
| Palette | Chalk / Pine / Shelf / Verdigris | Ink / Paper / Surface / Accent / Sand / Signal |
| Stylesheet | `assets/critical.css` | `assets/base.css` |
| Tokens | `snippets/css-variables.liquid` | `snippets/theme-tokens.liquid` |
| Script | none | `assets/global.js` |

The Replenish-era work has been retired. Preserved in git history and in
`git stash` (`stash@{0}: pre-skeleton-theme-rebuild checkpoint`) if anything
needs recovering.

**Removed this pass** (superseded by the Loam spec, or skeleton-theme demo
scaffolding that has no place in a commercial theme):

- `assets/critical.css`, `assets/shoppy-x-ray.svg`, `assets/icon-account.svg`,
  `assets/icon-cart.svg`
- `snippets/css-variables.liquid`, `snippets/price.liquid`, `snippets/image.liquid`
- `sections/hello-world.liquid`, `sections/custom-section.liquid`
- `blocks/group.liquid`, `blocks/text.liquid` (the whole `blocks/` directory —
  not part of the file structure in §3)

`snippets/price.liquid` was built around selling-plan allocations and read
settings (`show_savings_badge`) that no longer exist. It is rebuilt from
scratch in phase 3 against Loam's price rules, not ported.

---

## Phase status (§12)

| # | Phase | Status |
|---|---|---|
| 1 | Foundation | **Done** — theme-check clean, live compiler clean, zero theme console errors |
| 2 | Chrome (announcement bar, header + mega menu, footer, cart drawer) | **Done** — cart verified end to end in a browser; one gap, see below |
| 3 | Homepage sections (§9, 3–17) | **Done — all 15 built and verified** |
| 4 | Templates | Not started |
| 5 | Demo store seeding (§11) | Not started |
| 6 | Demo data in the repo | Not started |
| 7 | Hardening | Not started |

---

## Phase 1 — Foundation

### Delivered

| File | Notes |
|---|---|
| `snippets/theme-tokens.liquid` | New. Font faces, `:root` tokens, one `.color-{id}` class per scheme |
| `assets/base.css` | New. Regions 1–6, the only stylesheet |
| `assets/global.js` | New. Reveal + `<sticky-header>` + `<loam-drawer>`, the only script |
| `config/settings_schema.json` | Rebuilt for Loam: 11 groups |
| `config/settings_data.json` | Rebuilt: 4 named schemes + defaults for every setting |
| `snippets/meta-tags.liquid` | Rebuilt |
| `snippets/structured-data.liquid` | Rebuilt |
| `snippets/icon.liquid` | New. 30 icons |
| `snippets/image-fallback.liquid` | New. The three-layer image path (§6) |
| `locales/en.default.json` | Rebuilt |
| `locales/en.default.schema.json` | Rebuilt |
| `layout/theme.liquid`, `layout/password.liquid` | Rebuilt on the new shell |
| `templates/gift_card.liquid` | Rebuilt (it is a `{% layout none %}` document, so it carries its own head) |
| `templates/index.json` | Emptied — the homepage is populated in phase 3/6 |

### Design system

Palette is per-scheme, not global. §2 specifies six fixed roles, §13 requires
a colour-scheme setting on every section; those are reconciled by making the
six roles the *fields of a colour scheme*, so `--c-ink` / `--c-paper` /
`--c-surface` / `--c-accent` / `--c-sand` / `--c-signal` resolve differently
inside a section that has picked a different scheme. `:root` carries the
default palette as a fallback only.

`--c-ink-70 / -45 / -12` are derived with the Liquid `color_mix` filter against
each scheme's own background, per §2. Separate `--c-ink-rgb` / `--c-paper-rgb`
triplets exist for legitimate alpha surfaces (scrims, drawer overlays) and are
never used for text.

Four schemes ship: `scheme-paper` (default), `scheme-surface`, `scheme-sand`,
`scheme-ink`. Contrast checked against WCAG 2.1 AA for the default
combinations:

| Combination | Ratio | AA normal text |
|---|---|---|
| Ink on Paper | 16.15:1 | Pass |
| Ink on Surface | 17.78:1 | Pass |
| Ink on Sand | 13.23:1 | Pass |
| Accent `#2E6B4F` on Paper | 5.73:1 | Pass |
| Accent on Surface | 6.30:1 | Pass |
| Accent on Sand | 4.69:1 | Pass (tightest combination in the theme) |
| Signal `#B23A2F` on Paper | 5.39:1 | Pass |
| Paper on Ink | 16.15:1 | Pass |

`scheme-ink` needs its own accent and signal — the Paper-scheme accent
`#2E6B4F` on `#101A16` is **2.82:1 and fails outright** — so it ships
`#8FBFA4` (8.60:1) and `#E08C82` (6.98:1). Worth knowing before anyone
"simplifies" the scheme definitions back down to a single shared accent.

Accent on Sand at 4.69:1 has only 0.19 of headroom over the 4.5 threshold.
If a merchant darkens Sand or lightens Accent it fails, which is what the
`info` text on those two settings is there to signal.

### Budgets

| Budget | Limit | Actual |
|---|---|---|
| Theme CSS | < 60KB gzipped | **6.2KB** |
| Theme JS | < 40KB gzipped | **4.0KB** |
| `shopify theme check` | 0 errors, 0 warnings | **0 / 0**, 37 files |

### Decisions worth recording

**Reveal is a module singleton, not a custom element.** §4 says "custom
elements only, one class per behaviour". The scroll-reveal engine is the one
exception: it is a document-wide service, and wrapping every revealable
heading in a custom element would allocate one element instance per revealed
node — which is the cost the "one shared IntersectionObserver" rule exists to
avoid. It re-scans on `shopify:section:load`, so editor lifecycle still works.
`<sticky-header>` and `<loam-drawer>` are proper custom elements.

**`rel=next` is not emitted.** §7 asks for `rel=prev/next` in
`meta-tags.liquid`. A layout has no access to the `paginate` object, so the
total page count is unknowable there — `prev` is always provable from
`current_page`, `next` is not, and pointing `next` at a URL that 404s is worse
for crawlers than omitting it. Shopify's `canonical_url` already resolves
paginated URLs correctly. Revisit in phase 4 if a mechanism appears.

**Scroll lock pins the body with `position: fixed`.** `overflow: hidden` alone
does not hold on iOS Safari. The lock is reference-counted so a drawer opened
from inside another drawer cannot unlock the page early, and the scroll offset
is restored on unlock.

**`image_tag` arguments are never nil.** A nil named argument renders an empty
attribute (`fetchpriority=""`) rather than being omitted, which is invalid for
enumerated attributes — so `image-fallback.liquid` resolves every default
before the call, and branches on whether intrinsic dimensions were supplied
rather than passing `width: nil`.

**Placeholder sections.** `sections/{404,article,blog,cart,collection,`
`collections,page,password,product,search}.liquid` and `header`/`footer` were
skeleton-theme leftovers that rendered a bare `<img src>` and carried their own
`{% stylesheet %}` blocks — both forbidden (§4, §5, §6). They have been reduced
to minimal, valid placeholders on the Loam shell: `.section` / `.page-width`
markup, all media through `image-fallback.liquid`, no per-section CSS. They are
marked `PLACEHOLDER` in a comment at the top and are rebuilt properly in phases
2 and 4. `header.liquid` already sits inside `<sticky-header>` and uses
`icon.liquid`, so the sticky behaviour and `--header-height` are live and
testable now.

### Live-compiler verification (dev server, port 9292)

Ran against the real Shopify compiler. **One genuine bug found, invisible to
local `theme check`** — the pattern the previous build warned about, confirmed
again on the first push:

> `snippets/structured-data.liquid` — Liquid syntax error (line 89): Variable
> `{{ shop.url | append: routes.search_url | append: '?q={search_term_string}'`
> was not properly terminated with regexp: `/\}\}/`

The `SearchAction` `urlTemplate` has to contain the literal token
`{search_term_string}`. Inside a `{{ ... }}` output tag, Liquid's variable
lexer scans for the closing braces and chokes on a brace-wrapped token in a
string literal — even though the string is quoted. `theme check` passed it
cleanly; the real compiler rejected the whole file, which 500'd every page.

Fixed by building the token in the `{%- liquid -%}` block (a `{% %}` tag
terminates on `%}`, so the braces are inert there) and outputting the finished
variable. **Rule for the rest of the build: never put a `{` or `}` inside a
string literal in an output tag.**

Verified after the fix, on the rendered homepage:

| Check | Result |
|---|---|
| Homepage | HTTP 200, no upload or Liquid errors |
| JSON-LD | 1 block, parses as valid JSON, `@graph` = Organization + WebSite |
| `color_mix` tints | Correct, and correctly *inverted* per scheme — `--c-ink-70` is `#555b57` on Paper and `#b0b3af` on Ink |
| All four `.color-*` classes | Emitted; `<body>` carries `color-scheme-paper` |
| `base.css` / `global.js` | Both linked, JS as `type="module"` |
| Shell | skip link, `<sticky-header>`, `<main id="main">`, live region, seam divider, `icon.liquid` SVGs all present |
| `charset` position | Byte 65 — inside the 1024-byte requirement |
| Empty attributes | None — the `image_tag` nil-argument fix holds |

`--c-ink-70/-45/-12` fallbacks in `:root` were hand-computed guesses; they have
been corrected to the exact values `color_mix` produces.

### Full template sweep — all clean

Every template exercised against the real compiler on the dev store
(`tes-store-7r6dce1z`, which carries Shopify's standard sample catalogue):

| Route | Status | Compiler |
|---|---|---|
| `/` | 200 | clean |
| `/collections/all` | 200 | clean |
| `/collections` | 200 | clean |
| `/cart` | 200 | clean |
| `/search?q=shoe` | 200 | clean |
| `/blogs/news` | 200 | clean |
| `/this-page-does-not-exist` | 404 | clean, renders the 404 section |
| `/products/{selling-plans-ski-wax, the-collection-snowboard-liquid, the-3p-fulfilled-snowboard, gift-card}` | 200 | clean |

`/pages/about` returns 404 because the store has no such page — store content,
not a theme fault.

JSON-LD validated by parsing it, on every template that emits it:

- Product: valid, **one Offer per variant** confirmed (3 offers on the
  multi-variant product), availability resolved per variant
- BreadcrumbList: `Home > The Collection Snowboard: Liquid`
- CollectionPage: ItemList correctly capped at 12 with `numberOfItems: 13`
- No `null` values anywhere in any graph

`image_tag` output confirmed to carry `width`, `height`, 10 `srcset` entries,
and **no empty attributes** — which also validates the decision not to pass
`width`/`height` for a merchant image object: `image_tag` derives both, and
that is what reserves the space keeping CLS at zero.

### Browser runtime — zero theme console errors

Checked in headless Chrome across `/`, product, collection, cart and search.

`global.js` provably executed: the post-JS DOM shows
`<sticky-header class="sticky-header sticky-header--stuck">` and
`<html style="--header-height: 68px">`. Both are written by
`connectedCallback` / `measure()`, so the module loaded, the custom element
registered and upgraded, and its callbacks ran without throwing.

**Every console message came from Shopify's own infrastructure, none from the
theme:**

1. `origin_trials-*.js` blocked by CORS — Shopify's storefront script, blocked
   only because the dev proxy serves over `http://127.0.0.1`
2. `[HotReload] Connected` — the CLI's own hot-reload client
3. `Framing 'https://shop.app/' violates ... frame-ancestors` — the Shop Pay
   iframe injected by `content_for_header`

All three are `theme dev` proxy artifacts. Re-check on a published preview URL
during phase 7 hardening — the same reason §14 requires Lighthouse to run
there rather than against localhost.

**Operational note: do not use `sed -i` inside the theme directory while
`shopify theme dev` is running.** GNU sed writes its temp file as a sibling of
the target, and the CLI's file watcher picked it up mid-write, failing the
upload with "snippets/sedpdbrCl — Must have a .liquid file extension". Because
the temp file is then deleted, nothing can re-upload to clear the record and
the dev server serves that stale error until restarted. Use `python`/`Write`
for in-place edits instead.

---

## Phase 2 — Chrome

### Delivered

| File | Notes |
|---|---|
| `sections/announcement-bar.liquid` | New. Rotating messages, localization selectors |
| `sections/header.liquid` | Rebuilt. Mega menu, mobile drawer, search drawer, cart entry |
| `sections/footer.liquid` | Rebuilt. Menu/text/newsletter blocks, social, payment, localization |
| `sections/cart-drawer.liquid` | New. Free-shipping progress, line quantity, note |
| `sections/cart-count.liquid` | New. Render target for the Section Rendering API |
| `snippets/cart-line.liquid` | New. Shared by the drawer and, from phase 4, the cart page |
| `snippets/cart-count.liquid`, `snippets/quantity-input.liquid`, `snippets/localization-form.liquid` | New |
| `sections/header-group.json`, `sections/footer-group.json` | Rebuilt with populated demo blocks |
| `assets/global.js` | `<mega-menu>`, `<announcement-bar>`, `<quantity-input>`, `<cart-items>`, the `Cart` module |
| `assets/base.css` | Region 5 rewritten |

Budgets after phase 2: CSS **8.2KB** gzipped, JS **7.6KB** gzipped.
`shopify theme check`: 44 files, 0 offenses.

### Decisions worth recording

**Navigation is native `<details>`/`<summary>`, not divs with aria.** The mega
menu opens, is keyboard operable and is screen-reader announced before any
JavaScript runs; `<mega-menu>` only layers on hover-intent, Escape, and
close-on-focus-leave. An aria-driven implementation would be inert until the
module loads, which on a cold 4G connection is exactly when a shopper is most
likely to reach for the menu.

**The cart swap never replaces `<loam-drawer>`.** `Cart.render()` replaces the
innerHTML of `[data-cart-body]` and `[data-cart-footer]` only. Replacing the
custom element itself — the obvious implementation — would destroy the focus
trap, the scroll lock, and the stored opener reference mid-interaction,
stranding a keyboard shopper inside a drawer they cannot close. Those two
wrappers are a contract; the section file documents them as such.

**`[data-cart-footer]` renders even when the cart is empty.** If the wrapper
only existed when the cart had items, the first add-to-cart would have no
target to swap into and the totals would not appear until a full page load.

**Quantity uses a real `<input type="number">`.** The stepper buttons are
enhancement: they set the input and dispatch `change`. The control still works
with the keyboard, and the form still submits, with the module absent.

**The localization selects sit in real `{% form 'localization' %}` elements**
with a visible submit button. `global.js` adds `.js` to `<html>`, which hides
the button and submits on change instead — so changing market works before the
theme's JS has run.

### Verified in a real browser (Chrome over the DevTools Protocol)

The phase 2 checkpoint is "cart add/remove/qty works via Section Rendering API,
keyboard nav clean, drawer focus trap verified". Driven as real interactions,
not asserted from source:

| Check | Result |
|---|---|
| Drawer opens, `aria-modal`, focus moves inside panel | Pass |
| Body scroll locked, toggle `aria-expanded=true` | Pass |
| Tab at the last focusable wraps to the first (trap holds) | Pass |
| Quantity change updates the bubble via the API | Pass — 2 → 4 |
| **Drawer stayed open and the element was NOT replaced through the swap** | Pass |
| Scroll lock survived the swap; subtotal re-rendered | Pass — $99.80 |
| Remove line → empty state renders in place, bubble 0 | Pass |
| Escape closes, focus returns to the opener, scroll unlocks | Pass |
| Search drawer opens and focuses its input; Escape closes | Pass |
| Announcement: next advances, prev from 0 wraps to last, one message exposed | Pass |
| `<mega-menu>`: opening a second panel closes the first; Escape closes and returns focus; closes on focus leave | Pass |
| Reduced motion: autoplay off, manual controls kept, no `.reveal` stranded invisible | Pass |
| Theme-originated console messages | **Zero** (4 total, all Shopify infra) |

Server side, the Section Rendering API contract was exercised directly against
`/cart/add.js` and `/cart/change.js`: both return `cart-drawer` and
`cart-count`, the drawer HTML carries both swap targets, and the free-shipping
maths is right — qty 1 gives "You are $50.05 away from free shipping." at 33%,
qty 5 crosses the $75 threshold at 100%, qty 0 renders the empty state.

Two harness bugs surfaced during this and are worth remembering, because both
would have read as theme bugs:

1. `toggle` fires **asynchronously**, so checking `[open]` count in the same
   tick as setting `.open` shows both panels open. The component is correct.
2. The announcement bar autoplays, so a rotation test that assumes it starts
   at index 0 is racing the timer. Re-run with `bar.pause()` first.

---

## Full-theme audit (before phase 3)

Everything built through phase 2, re-tested end to end.

**Static, against the spec’s own §15 prohibitions:** exactly two assets
(`base.css`, `global.js`); `!important` confined to `.visually-hidden` and
`.visually-hidden--focusable` and nowhere else; no `{% include %}`; no bare
`<img src>`; no external CDN; no per-section `{% stylesheet %}`; no
`max-width` media queries; zero hardcoded English in any `{% schema %}`.
All JSON valid. `theme check`: 0 offenses.

**Live compiler:** 14 routes including pagination, sort, empty search, and
four different products — all compile clean. JSON-LD parses on every page
that emits it. No empty attributes, unrendered Liquid, missing translations,
or duplicate ids anywhere.

**Browser (Chrome over CDP):** no theme console errors or failed requests on
9 templates × 3 viewports; no horizontal overflow; no broken images; every
icon-only control labelled; every decorative SVG `aria-hidden`; every form
control named; dialogs carry `aria-modal` and a name; **21/21 elements show a
focus ring under real keyboard Tab**; section unload/reload leaves no error
and no leaked scroll lock; removing an open drawer releases the lock; RTL adds
no overflow.

**Settings permutations:** `cart_type: page` correctly drops the drawer
section entirely and turns the header cart into a link; demo images off,
seam dividers off, uppercase headings, and extremes (heading scale 130,
gutter 60px, radius 16px, page width 1800px) all render, with **no
horizontal overflow at 320 / 375 / 768 / 1440px**.

**Contrast, measured on rendered pixels** rather than computed from source:
every text style the theme renders meets WCAG AA, tightest being
`--c-ink-70` at 6.32:1. The one failure is Shopify’s own dynamic checkout
button (3.59:1 white on its blue), whose colour comes from the merchant’s
checkout branding, not from this theme.

Two audit "failures" were the harness, not the theme, and are recorded so
they are not "fixed" later: programmatic `.focus()` can never match
`:focus-visible` (use real key events), and rapid `Page.navigate` aborts
in-flight requests (the only aborted requests were Shopify analytics).

---

## Phase 3 — Homepage sections (in progress)

### Built and verified (6 of 15)

| Section | §9 | Notes |
|---|---|---|
| `hero.liquid` | 3 | image/video, mobile media, 9-way text position, scrim, 2 CTAs, stat blocks |
| `marquee.liquid` | 4 | text or logo blocks, seamless JS-duplicated track |
| `featured-collection.liquid` | 5 | grid or slider, view-all, demo fallback |
| `image-with-text.liquid` | 6 | media side toggle, ratio, feature blocks with material tags |
| `value-props.liquid` | 7 | icon picker or custom image, 2–4 up |
| `collection-list.liquid` | 8 | overlay captions, 2/3/4 up |

Supporting: `snippets/price.liquid` (rebuilt for Loam) and
`snippets/card-product.liquid` with the demo-mode path §10 requires.
`templates/index.json` populated with all six.

### Bug found by rendering, invisible to every other check

`image-fallback.liquid` layer 2 called `asset_url | image_url` on a demo file
that does not exist yet. `asset_url` returns a URL for a missing asset quite
happily, `image_url` then rejects it, and the resulting runtime Liquid error
was **printed into the page**:

> `Liquid error (snippets/image-fallback line 93): invalid url input`

`theme check` passed it. The upload compiler passed it. Only looking at the
rendered HTML caught it — and the failure mode is worse than a missing image,
because the buyer sees error text.

Layer 2 is now captured and only used if it actually produced an `<img>`;
anything else falls through to layer 3. That is what makes the three-layer
fallback safe rather than merely ordered. Since demo media does not land until
phase 6, every image slot currently resolves to `placeholder_svg_tag` — which
is correct behaviour, not a defect.

### Verified in the browser

Zero theme console errors; zero Liquid errors in the rendered body; 4 demo
product cards with real Fernway names, prices and material tags; marquee
duplicates its track (6 originals + 30 aria-hidden, non-tabbable copies) and
pauses on hover; 21 reveal elements animate in on scroll; no horizontal
overflow at 320 / 375 / 768 / 1440px; section unload/reload re-initialises
cleanly.

Hardened during testing: `<marquee-strip>` now filters clones out before
capturing its originals, so a restored-DOM re-initialisation cannot double the
track on every pass.

Budgets: CSS **9.5KB**, JS **9.2KB** gzipped. `theme check`: 52 files, 0 offenses.

### Second batch (3 more, 9 of 15 total)

| Section | §9 | Notes |
|---|---|---|
| `impact-stats.liquid` | 10 | `<count-up>` on reveal, reduced-motion aware |
| `testimonials.liquid` | 11 | star rating, avatar, source label, grid or slider |
| `faq.liquid` | 14 | accordion + FAQPage JSON-LD generated from the same blocks |

`templates/index.json` now carries 9 sections in order.

**Two more bugs, both found by running the code:**

1. `<count-up>` assigned `this.prefix`. `Element.prototype.prefix` is a
   read-only getter (the XML namespace prefix), so in a module's strict mode
   the assignment threw and took the whole element down — every stat was
   dead, with a `TypeError` in the console. Renamed to `valuePrefix` /
   `valueSuffix`. **Custom elements inherit the entire `Element` surface;
   check before claiming a property name on `this`.**
2. The `suffix` setting had a schema default of `"M"`, which any block
   omitting a suffix silently inherited — the 12,400 reviews stat rendered as
   "12400M". Defaults belong in the preset, not on the setting, whenever the
   value is not a sensible universal.

Verified in the browser: values animate from near-zero, carry `aria-hidden`
while counting so a screen reader is never read intermediate numbers, and land
on the authored string exactly (`2.1M`, `95%`, `100%`, `12400`). FAQPage
JSON-LD parses with 5 questions and HTML correctly stripped from the answers.
Accordion opens and closes; every star rating has a spoken equivalent and the
glyphs are `aria-hidden`. No horizontal overflow at 320 / 375 / 768 / 1440px.

### Mega menu — now fully verified against real Liquid

With a three-level menu on the dev store, the previously unexercised branch
renders: 2 columns from `link.links`, 4 third-level `mega__link` items, the
feature card matched to "Shop" by title, and the mobile drawer mirroring the
same depth (3 sublists, 2 of them deep). Click-to-open, Escape-closes-and-
restores-focus, and close-on-focus-leave all pass on real markup.

Still only verified against injected markup: "opening a second panel closes
the first", because the store's menu has one dropdown. The behaviour is
implemented and tested; it just has not been seen with two real dropdowns.

### Third batch — phase 3 complete (15 of 15)

| Section | §9 | Notes |
|---|---|---|
| `lookbook-collage.liquid` | 9 | asymmetric spans, captions, one shoppable hotspot per shot |
| `video-section.liquid` | 12 | click-to-play, poster required, nothing loads on arrival |
| `ugc-grid.liquid` | 13 | square tiles, optional product link |
| `newsletter.liquid` | 15 | Shopify `customer` form, announced success/error |
| `rich-text.liquid` | 16 | heading/caption/text/button blocks, width + alignment |
| `multicolumn.liquid` | 17 | generic 2–4 column row |

**Homepage preset ships 12 sections**, the §5 ceiling: hero, marquee,
featured-collection, image-with-text, collection-list, lookbook-collage,
impact-stats, value-props, video-section, testimonials, faq, newsletter.
`ugc-grid`, `rich-text` and `multicolumn` ship with presets so a merchant can
add them from the editor, but are kept off the default homepage — more than
twelve and mobile LCP suffers, which is the whole point of that rule.

### Decisions worth recording

**The video never loads until asked.** `<video-player>` mounts the media
element on the first click. For an external URL that means no YouTube or
Vimeo iframe — and none of its cookies — exists on the page unless the
visitor opts in. Focus moves to the mounted player, so a keyboard user who
pressed the button is not left with focus on a control that no longer exists.

**No Instagram API in `ugc-grid`.** A live feed needs an app, a token that
expires, and a third-party script. Merchant-supplied images are the only
version still working two years after release, when a platform has changed
its terms again.

**Lookbook hotspots are real links,** not tooltips, so they are keyboard
reachable and announced. The label reveals on `:hover` *and* `:focus-visible`.

**`rich-text` separates heading level from heading size,** because the tag
drives the document outline for screen readers and the class drives the
visual scale — conflating them forces a merchant to choose between the two.

### Found by the completion check

The homepage had **no `<h1>`**. Heading levels ran `2,2,3,3…`: the hero
heading was an `h2`, and the logo’s conditional `h1` was dropped when the
header was rewritten in phase 2. The hero now takes a `heading_tag` setting
defaulting to `h1`, with the tag and the display size kept separate. Levels
now read `1,2,3,3…` with exactly one `h1`.

Note the test that caught it had computed the `h1` count but never asserted
it — the assertion is now in the harness.

### Verified in the browser (12-section homepage)

Zero theme console errors; zero Liquid errors; all 12 sections render;
lookbook spans measurably differ (677px wide vs 326px normal on a 4-column
grid); video mounts on click with native controls and focus moves to it;
newsletter is a real Shopify form with a space-reserved `role="status"`
region; no horizontal overflow at 320 / 375 / 768 / 1440px; every icon-only
button labelled; 43 decorative icons all `aria-hidden`; exactly one `h1` and
no skipped heading levels.

Budgets: CSS **10.8KB**, JS **11.0KB** gzipped. `theme check`: 61 files, 0 offenses.

**Caveat on the image checks:** "every image has an alt attribute" currently
reports 0 images, because with no demo media in `assets/` every slot resolves
to `placeholder_svg_tag`. That assertion is vacuous until phase 6 and must be
re-run once the media lands.

---

## Open, needs you

**1. Phase 1 is verified and the checkpoint is met.** Nothing outstanding here
— `theme check` clean, every template compiles and returns 200, JSON-LD valid,
zero theme console errors. The four items previously flagged as unverified
against the real compiler are all now confirmed working: the
`asset_url | image_url | image_tag` chain, `color_mix` argument order,
`font_modify: 'weight', 'bolder'` (returns nil and emits nothing, as expected,
no error), and the `color_scheme_group` `role` map.

**2. The mega menu's Liquid rendering is not yet exercised.** The dev store's
`main-menu` is flat — Home / Catalog / Contact — so no link has children and
the `<details class="mega">` branch never runs. The `<mega-menu>` component
itself is verified (against injected markup), and a flat menu correctly
degrades to plain links, but the two-level column rendering and the feature
card have only been read, not seen.

This is the exact thing §11.5 warns about: "the mega menu renders `link.links`
two levels deep — Shop must have children *with children*, or the mega
collapses to one column. Verify nesting depth after creating." Phase 5 seeds
these menus properly. To close it sooner, create a menu in admin with, say,
Shop → Men's / Women's, and give Men's its own children.

**2. No `templates/customers/*`.** skeleton-theme does not ship them and they
were removed with the Replenish work. They are a Theme Store requirement and
are built in phase 4 (§9).

**3. No demo media yet.** `assets/demo-*.webp` does not exist, so
`image-fallback.liquid` currently resolves to layer 3 (`placeholder_svg_tag`)
everywhere. That is correct behaviour, not a bug — layer 2 lights up in phase
6 once the Burst-sourced CC0 files are processed and copied in (§6). Nothing
before phase 6 should depend on those files existing.

---

## Verification method

Every phase is checked two ways, per the previous build's lesson:

1. `shopify theme check` locally — necessary, not sufficient
2. The live dev-server sync log, which is Shopify's real compiler

Phase 1 has passed (1) and is awaiting (2).
