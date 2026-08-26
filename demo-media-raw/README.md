# Raw demo media goes here

This directory is gitignored. It holds the unprocessed files;
`scripts/1-process-media.mjs` resizes, crops and encodes them into
`demo-media/`.

## Where the images come from

Per §6 (decided 2026-08-26), either of two paths, per file:

- **AI-generated** — house style, negative prompt, and a per-file prompt for
  all 47 files are in [PROMPTS.md](PROMPTS.md). This is the primary path for
  this build.
- **[Burst](https://burst.shopify.com)**, Shopify's free stock library, also
  reachable in the theme editor through "Explore free images" on any image
  picker. It has **no public API** and the build spec forbids scraping it, so
  downloading from it is manual.

## What to produce

Run the script for the current list:

```
node scripts/1-process-media.mjs
```

With this directory empty it prints all 47 files with their target dimensions
and a one-line description of the subject (also usable as a Burst search). As
files arrive it prints only what is still missing.

## Naming

Name each download for its manifest entry, keeping the extension it arrived
with:

```
demo-hero.jpg          ->  demo-hero.webp        2400x1350
demo-product-1.jpg     ->  demo-product-1.webp   1200x1500
demo-material-wool.png ->  demo-material-wool.webp  1600x2000
```

`.jpg`, `.jpeg`, `.png`, `.webp`, `.tif` and `.avif` are all accepted for
images; `.mp4`, `.mov`, `.m4v` and `.webm` for video. The script matches on the
basename, so the extension does not need changing.

Do not rename, pluralise, or add a hash to the base name. Filenames are a
contract with the theme's `fallback:` params, with the `shopify://` references
in the shipped JSON, and with the buyer's export package. A renamed file breaks
all three silently — the image simply stops appearing.

## Licences

The script writes `licenses.json` here the first time it finds files. Fill it
in as you go — for a generated file:

```json
{
  "demo-hero.webp": {
    "license": "AI-GENERATED",
    "source": "Midjourney v6"
  }
}
```

or for a Burst file:

```json
{
  "demo-avatar-1.webp": {
    "license": "CC0",
    "source": "https://burst.shopify.com/photos/...",
    "photographer": "Name"
  }
}
```

The distinction is not cosmetic:

- **CC0** (Burst only) — no redistribution restriction. May be bundled inside
  `assets/`, and therefore inside the theme zip that gets sold.
- **Burst Licence** (Burst only) — free commercial use, but the photo may not
  be sold "as digital photo files or in any other form". A paid theme zip is
  arguably exactly that. Demo store and export package only.
- **AI-GENERATED** — demo store and export package only, by default. Record
  the generating model/tool in `source`. Only treat a file as bundle-eligible
  after checking that specific tool's terms for the plan actually used —
  "commercial use" in a generator's terms is not the same grant as "resale
  inside a paid product."

Anything with no entry is treated as the most restrictive category — demo-
store-only — which is the safe direction to be wrong in.

No licence here grants a release for a real person's likeness, so anything
depicting, or closely resembling, an identifiable real person stays demo-
store-only whatever its licence says. That covers all four avatars.
