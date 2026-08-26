# Asset licences

Everything a shopper downloads from a Loam store is in this folder, and every
line of it is original work covered by the theme licence in `LICENSE.md`.

| File | Origin | Licence |
|---|---|---|
| `base.css` | Written for Loam | Theme licence |
| `global.js` | Written for Loam | Theme licence |

No third-party code. No framework, no jQuery, no utility library, no polyfill
copied from a gist. The bundle has zero dependencies, which is why this table
is two rows long.

## No photography ships in the theme

There are deliberately **no image or video files here**, and none will be
added.

Demo photography comes from two sources (§6, decided 2026-08-26): AI
generation, per the prompts in `demo-media-raw/PROMPTS.md`, and Burst,
Shopify's free stock library. Burst ships photos under two licences — CC0
carries no redistribution restriction, and the **Burst Licence** is free for
commercial use but may not be sold "as digital photo files or in any other
form", and a paid theme zip is arguably exactly that. AI-generated files are
recorded with the generating model/tool and treated the same as Burst-Licence
files unless that tool's own terms are checked and say otherwise. No source
here grants a release for a real person's likeness, so anything depicting, or
closely resembling, an identifiable real person is demo-store-only regardless.

Rather than sort the demo set into bundleable and non-bundleable halves and
hope the line was drawn correctly, no photograph is bundled at all. The theme's
image slots fall back to Shopify's own `placeholder_svg_tag`, which needs no
licence and ships with the platform. The demo photography lives on the demo
store and in `demo-store-export/media/`, with its per-file licences recorded in
`demo-store-export/LICENSES.md`.

`snippets/image-fallback.liquid` keeps its demo layer — `settings.demo_images`
plus a `fallback:` filename — but with no files here it is inert on a stock
install, and every unset slot resolves to `placeholder_svg_tag` instead. The
layer stays because it costs nothing and it activates for anyone who does drop
matching filenames into this folder. What `settings.demo_images` still does on
a stock install is the demo product *cards*: real names, prices and material
tags, so a store with no catalogue does not render an empty grid.

## Fonts

Loaded from Shopify's font library through `font_picker`, `font_face` and
`font_url`. No font file is bundled, and no external font host is contacted —
Google Fonts included. Licensing for those faces is between the merchant and
Shopify, and is covered by their Shopify plan.

## Icons

Every SVG in the theme is drawn in `snippets/icon.liquid` on a 24×24 grid,
written for Loam. No icon set — Feather, Heroicons, Font Awesome or otherwise —
is used, copied, or traced.
