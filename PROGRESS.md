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
| 2 | Chrome (announcement bar, header + mega menu, footer, cart drawer) | Not started |
| 3 | Homepage sections (§9, 3–17) | Not started |
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

## Open, needs you

**1. Phase 1 is verified and the checkpoint is met.** Nothing outstanding here
— `theme check` clean, every template compiles and returns 200, JSON-LD valid,
zero theme console errors. The four items previously flagged as unverified
against the real compiler are all now confirmed working: the
`asset_url | image_url | image_tag` chain, `color_mix` argument order,
`font_modify: 'weight', 'bolder'` (returns nil and emits nothing, as expected,
no error), and the `color_scheme_group` `role` map.

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
