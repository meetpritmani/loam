# Loam demo content

Everything needed to build the store shown in the theme's screenshots, on your
own store, by hand.

**Most buyers will not need this.** If you already have products, install the
theme and point its sections at your own collections — that is the normal path
and it takes ten minutes. This package is for evaluating the theme before you
have a catalogue, or for building a store from scratch.

Nothing here needs an app, an API token, or a developer. Uploading media and
importing a CSV are both native Shopify admin features.

---

## Before you start

Two things worth knowing.

**Filenames are a contract.** The theme's shipped demo layout refers to these
images by name — `demo-hero.webp`, `demo-product-1.webp` and so on. Upload them
with their names unchanged and the layout finds them on its own. Rename one and
that slot falls back to a grey placeholder, with nothing to tell you why.

**Do it in this order.** Products need media to attach to. Collections need
products to select. Menus need pages to point at. Out of order, each step half
works.

---

## 1. Upload the media

**Content → Files → Upload files.** Select everything in `media/` and upload it
in one go.

If a filename is already taken, Shopify appends `_1` and says nothing about it.
That breaks the reference. Delete the older file first, or upload into a clean
store.

Check `LICENSES.md` before reusing any of these images anywhere else. They come
from [Burst](https://burst.shopify.com) under two different licences, and one of
them does not allow redistribution.

## 2. Import the products

**Products → Import → `products.csv`.**

Eight products, 168 variants, two options each — Colour and Size. The CSV
carries prices, SKUs, inventory quantities and image filenames.

Tick **Publish new products to all sales channels** in the import dialog, or the
products import successfully and stay invisible on the storefront.

The demo catalogue is deliberately not all in the happy state: one product is on
sale, two are tagged `new`, five variants are out of stock, and one variant per
product is stocked at eight so the low-stock message has something to render
against. That is so you can see what the theme does in each case rather than
only the case that flatters it.

## 3. Create the metafield definitions

**Settings → Custom data → Products.** See `metafield-definitions.md`.

Four definitions, about three minutes. They drive the material tag on product
cards, the care accordion, the carbon footprint badge and the size guide drawer.
The theme works without them — those elements simply do not render.

One setting catches everyone: each definition must be readable by the
storefront, under **Access → Storefronts**. Without it the values save fine, show
fine in admin, and return nothing to the theme.

## 4. Create the collections

**Products → Collections.** See `collections.md`.

Six collections. Two are manual and need products selected; four are automated
on a product tag. The handles matter — the demo homepage links to them by
handle.

`best-sellers` and `new-arrivals` are what the homepage's two product rows point
at. Both must have products in them or those rows fall back to the theme's own
demo cards.

## 5. Create the pages and journal posts

**Content → Pages** and **Content → Blog posts.** See `pages-and-articles.md`.

Seven pages and three journal posts, with the copy ready to paste. Give the blog
the handle `journal`.

Stagger the publish dates across the past six weeks rather than dating all three
today. And write the excerpt for each post: the theme renders `article.excerpt`
and will not truncate your body text to fill the gap, so a post without one
shows a heading, a date and nothing else.

## 6. Create the menus

**Content → Menus.** See `menus.md`.

Four menus. The main menu is the one to be careful with: the mega menu reads two
levels below each top-level item, so **Shop** needs children that themselves
have children. With only one level under Shop the mega menu collapses to a
single column and the feature card never appears — and nothing warns you,
because a two-level menu is perfectly valid.

Hover Shop on the storefront afterwards. Four columns and an image means it
worked.

## 7. Install the theme

Upload the theme zip under **Online Store → Themes → Add theme → Upload zip
file**, then **Preview**.

The demo layout is already configured and already points at the media you
uploaded in step 1. There is no import step and nothing to switch on.

---

## What is in this folder

| File | What it is |
|---|---|
| `media/` | Optimised WebP and MP4, original filenames |
| `products.csv` | Shopify product import format, one row per variant |
| `collections.md` | The six collections — not CSV-importable, so manual steps |
| `metafield-definitions.md` | Four definitions and the values used in the demo |
| `pages-and-articles.md` | Page and journal copy, ready to paste |
| `menus.md` | Four menus, with the nesting the mega menu needs |
| `media-map.json` | Filename to CDN reference map, for reference |
| `LICENSES.md` | Per-file licence, and which ones you may reuse |

Everything except this README is generated by the seeding scripts from the same
data that built the demo store, so none of it can drift from what the
screenshots show. In the theme repository this folder is a build output
directory and only the README is tracked; in your download it arrives complete.

---

## If something looks wrong

**Grey placeholder boxes instead of images.** A filename did not match. Compare
**Content → Files** against `media/` — the usual cause is Shopify having
appended `_1` to a name that was already taken.

**A product row is empty, or shows shoes you did not import.** The section is
pointing at an empty collection, so it fell back to the theme's demo cards.
Check that `best-sellers` and `new-arrivals` have products in them.

**The mega menu is one column with no image.** The main menu is not nested deep
enough. See step 6.

**The material tag or the care accordion is missing.** The metafield definitions
are missing, or they are not readable by the storefront. See step 3.

**Products imported but the storefront shows nothing.** They were not published
to the Online Store channel. Select all, then **Actions → Make products
available**.
