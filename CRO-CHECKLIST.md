# Loam — conversion setup checklist

This is the configuration order for the conversion surface Loam ships, what
each setting actually does, and what to test first on your own traffic.

**What this document is not.** It is not a promise of a conversion increase.
Nobody selling you a theme can honestly make that promise, because your rate
depends on your traffic, your prices, your photography and your product — none
of which live in a theme. What a theme supplies is *surface*: clarity, speed,
friction removal, honest signals, and measurement. Whether a given change on
your store helps is something you find out by testing it. This document tells
you where the surface is and how to use it.

Everything here is a setting or a template arrangement. There is no code to
edit and nothing to install.

---

## Before you start

Two things to have ready, because four of the steps below need them:

- **Your real policies.** Returns window, shipping threshold, delivery times.
  Loam displays these as text you supply. Do not round them up.
- **A recovery collection.** One collection you are happy to send a lost
  visitor to. Best sellers is the usual choice. It drives the empty cart, the
  404 page, and several other dead-end recoveries.

And one decision: **cart drawer or cart page**. Drawer is the default and keeps
the shopper on the page they were on. Choose page if your cart carries a lot of
information — gift options, long notes, complex shipping rules.

---

## Step 1 — Set the trust text (5 minutes)

**Theme settings → Conversion**

| Setting | Set it to |
|---|---|
| `cro_trust_returns` | Your real returns window, in the fewest words that are still specific. "Free returns for 30 days" beats "hassle-free returns" |
| `cro_trust_shipping` | Your real shipping offer. If it has a threshold, say the number |

These two strings render directly beneath Add to Cart on the product page,
beneath the checkout button on the cart page, and beneath it again in the cart
drawer — the three points where a shopper hesitates. Payment marks appear with
them on the product page and the cart page; the drawer omits them, because
three rows of icons in a drawer footer cost more height than they buy.

Specific beats warm. "30-day returns, we pay the postage" answers a question.
"Great service" does not.

## Step 2 — Set the free shipping threshold (2 minutes)

**Theme settings → Cart**

| Setting | Note |
|---|---|
| `cart_show_free_shipping_bar` | On by default |
| `cart_free_shipping_threshold` | Your real threshold, in your store currency. `0` hides the bar entirely |

The bar reads the actual cart total and shows both states — the remaining
amount, and the achieved state once it is reached. Set it to `0` if you do not
offer free shipping. A bar that never completes is worse than no bar.

Set it to the threshold you actually honour. If shipping is free over £75, the
number is 75.

## Step 3 — Pick the recovery collection (2 minutes)

**Theme settings → Conversion → `cro_empty_cart_collection`**

One setting, several dead ends closed:

- Empty cart — shows this collection instead of a blank page
- 404 — offers this collection alongside search and a home link
- Fruitless search — offers a route out rather than "nothing found"
- End of a blog article with no related products

Loam's rule is that no page is a dead end, and this setting is how it keeps
that promise on the pages you cannot plan for. Leave it unset and those pages
fall back to all products, which works but is less useful than a collection you
chose.

## Step 4 — Configure the product page (10 minutes)

**Theme settings → Conversion**

| Setting | Default | Leave it there unless |
|---|---|---|
| `cro_sticky_atc` | on | Your product page is short enough that the main button never scrolls away |
| `cro_dynamic_checkout` | on | You have deliberately disabled express payments in Shopify |
| `cro_show_payment_icons_pdp` | on | Your payment mix is unusual enough to raise questions rather than settle them |

Then open the product template in the editor and check the **accordion
blocks**. Loam ships four — Materials, Care, Shipping & returns, Size & fit —
and the first is open on load. Order them by how often the question comes up
in your own support inbox, not by how important you think they are. Shipping
and returns should not be the fourth item if half your emails ask about
delivery.

If you sell clothing or footwear, set the **size guide**. It opens as a drawer,
so it never takes the shopper off the page mid-decision. Point it at a page
with a real chart via the `custom.size_guide` metafield.

## Step 5 — Set the low-stock threshold honestly (2 minutes)

**Theme settings → Conversion → `cro_low_stock_threshold`**

Default 10. `0` disables the message.

Understand the rule before you set the number: the message renders **only** for
variants where you track inventory and are not selling past zero. On untracked
inventory it renders nothing at all — no empty wrapper, no fallback text.

That is deliberate, and it is not configurable. A low-stock badge on untracked
stock is a claim you cannot stand behind, and it is the exact pattern the EU
Omnibus Directive and the FTC's rules on deceptive practices target. If you
want the message, track the inventory.

Set the number to a quantity that is genuinely low **for you**. If you
routinely hold 400 of a variant, 10 is not the interesting number.

## Step 6 — Choose your cart upsell (5 minutes)

**Theme settings → Conversion → `cro_cart_upsell_products`**

Up to three products, picked by you. Not an algorithm, not a random collection
slice. The cart page shows three, the cart drawer the first two — a drawer
column is roughly half the width.

Pick things that genuinely complete an order — socks with shoes, care kit with
wool. A £120 second pair of shoes offered against a £120 first pair reads as a
sales pitch and gets ignored. Leave it empty if nothing in your catalogue
honestly qualifies.

Nothing is ever pre-ticked. There is no setting for that.

## Step 7 — Check the homepage answers three questions (15 minutes)

Open the homepage in the editor at the **mobile** preview width and scroll once.

By the end of that first scroll a first-time visitor should know:

1. **What you sell** — the hero heading, not the section below it
2. **Why it is different from the cheaper one** — the materials or value-props
   section
3. **Where to buy** — a primary CTA they have already passed

Then check the two structural rules:

- **Twelve sections maximum.** More costs mobile LCP, and speed is a
  conversion factor, not a separate concern. The shipped homepage uses its
  full budget — remove before you add.
- **One primary CTA per section.** If a section has two filled buttons of
  equal weight, one of them should be an underlined link. The theme gives you
  the styles; it cannot stop you using two.

Value proposition, one support line, and the primary CTA must all be visible at
375px without scrolling. Check it at that width, not at desktop.

## Step 8 — Write the FAQ in objection order (10 minutes)

Open the FAQ section and reorder the blocks by how often each question is
actually asked. Sizing, shipping and returns first, in most catalogues.

The FAQ section emits `FAQPage` structured data, so these answers can appear
directly in search results. That makes the wording worth a second pass — write
the answer a shopper needs, not the answer that sounds best.

## Step 9 — Turn on measurement, or deliberately leave it off (5 minutes)

**Theme settings → Conversion → `cro_datalayer`** — **off** by default.

Turn it on only if you are **not** already firing GA4 ecommerce events from
Google Tag Manager or an app. Running both double-counts every event, and a
double-counted `add_to_cart` is worse than no `add_to_cart` because you will
trust it.

With it on, Loam pushes GA4-shaped events to `window.dataLayer`:
`view_item_list`, `select_item`, `view_item`, `add_to_cart`,
`remove_from_cart`, `view_cart`, `begin_checkout`, `search`, `sign_up`. The
payload shape is documented in `README.md` under Analytics.

One detail worth knowing: `add_to_cart` fires when the cart API **confirms** the
add, never on the click. So the number counts adds that happened, not adds that
were attempted. If you are migrating from a theme that fired on click, expect
this number to be slightly lower and more accurate.

No customer data is ever pushed to the layer.

---

## What to test first

Do not change five things at once and then try to read the result. In rough
order of how often each one turns out to matter:

1. **The hero.** Heading, support line, and CTA label. This is the highest-
   traffic copy on the store and usually the least tested.
2. **Product page image order.** Which photo is first. Cheap to change,
   frequently significant.
3. **Trust text wording.** Step 1. Specific numbers against vaguer phrasing.
4. **The first accordion item.** Which objection you answer without a click.
5. **Cart type.** Drawer against page, if your average order has more than two
   lines.
6. **Free shipping threshold.** A real business decision, not only a display
   one — test it against margin, not only against conversion rate.

Shopify's own analytics will show conversion rate by device. Read mobile and
desktop separately: they rarely move together, and an average hides both.

---

## What Loam will not do, and will not be made to do

These are commonly sold as conversion features. They are dark patterns, they
create legal exposure for **your** store under the FTC's rules on deceptive
reviews and the EU Omnibus Directive, and they cost repeat custom. Loam has no
setting that enables any of them, and adding one is not a supported
customisation:

- Countdown timers that reset on refresh or run on a rolling window. Loam
  ships no countdown section at all. If you add one through an app, give it a
  real end datetime and let it disappear when that passes.
- Fabricated live activity — "17 people are viewing this", "3 sold in the last
  hour" — not backed by real data.
- Low-stock badges where inventory is not tracked. See step 5.
- Pre-ticked add-ons, insurance, or subscription upgrades.
- Costs revealed only at checkout.
- Entry popups that fire before the visitor has seen the page.
- A `compare_at_price` that was never the genuine prior price. Omnibus requires
  a real prior-price reference for any advertised reduction.
- Star ratings in structured data without real review data. Loam emits
  `AggregateRating` only when review metafields actually exist — fabricating it
  is a manual-action risk for your store, not ours.
- Disabled or hidden close buttons on any overlay.

If a "CRO expert" asks you to add one of these, they are asking you to take on
the liability so their report looks better.

---

## Quick reference

Every conversion setting, in one table.

| Setting | Group | Default |
|---|---|---|
| `cro_sticky_atc` | Conversion | on |
| `cro_dynamic_checkout` | Conversion | on |
| `cro_show_payment_icons_pdp` | Conversion | on |
| `cro_low_stock_threshold` | Conversion | 10 |
| `cro_trust_returns` | Conversion | "Free returns for 30 days" |
| `cro_trust_shipping` | Conversion | "Carbon neutral shipping on every order" |
| `cro_cart_upsell_products` | Conversion | — |
| `cro_empty_cart_collection` | Conversion | — |
| `cro_datalayer` | Conversion | **off** |
| `cart_type` | Cart | drawer |
| `cart_show_free_shipping_bar` | Cart | on |
| `cart_free_shipping_threshold` | Cart | 75 |
| `card_quick_add` | Product cards | on |
| `card_show_swatches` | Product cards | on |
| `card_show_sale_badge` | Product cards | on |
| `card_show_sold_out_badge` | Product cards | on |
| `predictive_search_enabled` | Search | on |
