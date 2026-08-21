# Raw demo media goes here

This directory is gitignored. It holds the unprocessed downloads;
`scripts/1-process-media.mjs` resizes, crops and encodes them into
`demo-media/`.

## Where the images come from

[Burst](https://burst.shopify.com), Shopify's free stock library. Also reachable
in the theme editor through "Explore free images" on any image picker.

Burst has **no public API** and the build spec forbids scraping it, so
downloading is manual. Nothing in this pipeline generates photographs.

## What to download

Run the script for the current list:

```
node scripts/1-process-media.mjs
```

With this directory empty it prints all 47 files with their target dimensions
and a one-line description of the subject to search Burst for. As files arrive
it prints only what is still missing.

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
in as you download:

```json
{
  "demo-hero.webp": {
    "license": "CC0",
    "source": "https://burst.shopify.com/photos/...",
    "photographer": "Name"
  }
}
```

Burst shows the licence on each photo's page. The distinction is not cosmetic:

- **CC0** — no redistribution restriction. May be bundled inside `assets/`, and
  therefore inside the theme zip that gets sold.
- **Burst Licence** — free commercial use, but the photo may not be sold "as
  digital photo files or in any other form". A paid theme zip is arguably
  exactly that. Demo store and export package only.

Anything with no entry is treated as Burst Licence, which is the safe direction
to be wrong in.

Neither licence grants a model release, so a photo with an identifiable face
stays demo-store-only whatever its licence says. That covers all four avatars.
