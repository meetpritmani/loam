# Shopify Premium Theme — Section List & Claude Code Prompts

Built for: OS 2.0 / sections-everywhere architecture, WCAG 2.1 AA, Lighthouse mobile 90+
Target channels: Shopify Theme Store, TemplateMonster (check exclusivity rules — see note at bottom)

Every prompt assumes: Liquid + Online Store 2.0 JSON templates, section settings/blocks schema, no jQuery, vanilla JS + Web Components where interactivity is needed, CSS custom properties for theming, lazy-loaded images, `{% schema %}` with full `presets`.

---

## 1. Homepage / Hero Sections

### Hero Banner (video/image with CTA)
**Trending because:** every Theme Store top-seller (Impulse, Prestige, Motion) leads with a full-bleed hero supporting both image and video, with overlay text controls.
```
Build a Shopify OS 2.0 "hero-banner" section in Liquid. Requirements:
- Section settings: heading, subheading, button label/link, background type (image/video/color), overlay opacity slider, text alignment (left/center/right), text color, content vertical position (top/center/bottom)
- Block type "slide" (repeatable, max 5) so it can also function as a slideshow — each slide has its own image, video, heading, CTA
- Support Shopify's native video (video_url media) and external MP4 embed
- Lazy-load images with responsive srcset via image_url filters
- Mobile: stack content, reduce heading size via clamp()
- Include full {% schema %} with presets, max_blocks, and settings defaults
- WCAG: focus states on CTA, alt text setting per slide, no autoplay video without mute+pause control
```

### Multi-Column / Feature Highlights
**Trending:** benefit bars ("Free shipping", "30-day returns") right under the hero — Baymard research shows this reduces early bounce.
```
Build a Shopify OS 2.0 "feature-highlights" section: icon + heading + text repeated in a responsive grid (2/3/4 columns configurable). Blocks: icon (use an SVG picker or upload), heading, text, optional link. Settings: columns per row (mobile/desktop separate), background color, icon size, text alignment. Include schema with presets and block limit of 8.
```

### Collection List / Shop by Category
```
Build a Shopify OS 2.0 "collection-list" section using the native collection_list setting type. Support: heading, layout toggle (grid/carousel), columns (2-4), image aspect ratio setting, show/hide collection title overlay, "view all" button. Carousel mode should use a lightweight vanilla JS Web Component (no external library), swipeable on touch, with prev/next arrows hidden until hover on desktop.
```

---

## 2. Product Discovery / Merchandising

### Featured Product / Product Spotlight
```
Build a Shopify OS 2.0 "featured-product" section that pulls a single product via the product picker. Include: image gallery (thumbnails + zoom on hover), variant picker (native <select> fallback + swatch block option), quantity selector, add-to-cart with AJAX (no page reload), price with compare-at strikethrough, short description block, trust badges block (repeatable icon+text). Must work with Shopify's native product form and dispatch cart:updated event for theme-wide cart drawer sync.
```

### Best Sellers / Trending Products (dynamic)
**Trending:** social-proof-driven merchandising — "Trending now" or "Best sellers this week" sections using a collection sorted by best-selling, sometimes with a live badge.
```
Build a Shopify OS 2.0 "trending-products" section: settings for source collection, product count (4-12), columns responsive grid, sort override, and a toggle to show a "🔥 Trending" or "Best Seller" badge on the first N products. Product cards should support: quick-add button (AJAX, opens mini variant modal if product has variants), wishlist heart icon (dispatch custom event, don't hard-code an app integration), star rating placeholder (empty div with data attribute for review app injection).
```

### "Frequently Bought Together" / Bundle Section
Since you already built bundle logic for GrowthLab, this maps directly to your Shopify skillset.
```
Build a Shopify OS 2.0 "frequently-bought-together" section for a product page. Pull the current product plus up to 3 related products (via metafield list or manual product picker blocks). Show all as a horizontal row with checkboxes, running total price, and single "Add all to cart" button that adds all items via one AJAX /cart/add.js call. Handle variant selection per item with a lightweight modal if a product has multiple variants. Include schema settings for heading text and default-checked state.
```

### Recently Viewed Products
```
Build a Shopify OS 2.0 "recently-viewed" section using localStorage to track product IDs viewed by the shopper (store handle + timestamp, cap at 12, expire after 30 days). Render via Shopify's Section Rendering API (fetch product cards by handle) so it works without a page reload. Settings: heading, product count to show, hide-if-empty toggle.
```

---

## 3. Trust & Conversion

### Testimonials / Reviews Carousel
```
Build a Shopify OS 2.0 "testimonials" section. Blocks: quote text, customer name, customer photo (optional), star rating (1-5 select), optional product tag. Layout options: grid or carousel (vanilla JS swipe, autoplay toggle with pause-on-hover). Settings: heading, background color, card style (bordered/shadow/minimal). Fully keyboard-navigable carousel with aria-live region announcing slide changes.
```

### Trust Badges / As Seen In
```
Build a Shopify OS 2.0 "trust-badges" section: repeatable image blocks (payment icons, press logos, security badges) in a horizontal auto-scrolling or static row. Settings: heading (optional, can be hidden), grayscale-until-hover toggle, row height. Auto-scroll must pause on hover/focus and respect prefers-reduced-motion.
```

### Countdown / Urgency Banner
```
Build a Shopify OS 2.0 "countdown-banner" section: settings for end date/time (with timezone handling), message text, expired-state behavior (hide section / show alternate message), background/text color, sticky-to-top toggle. Use vanilla JS setInterval, clean up on section unload (Shopify section re-render events), and gracefully degrade if JS fails (show static message, not broken markup).
```

### FAQ / Accordion
```
Build a Shopify OS 2.0 "faq-accordion" section using the native <details>/<summary> elements for accessibility and no-JS resilience, styled to look like a custom accordion with a rotating chevron icon via CSS. Blocks: question, rich-text answer. Settings: allow-multiple-open toggle, heading. Include optional FAQPage schema.org JSON-LD output for SEO.
```

---

## 4. Content & Storytelling

### Image + Text (Split Layout)
```
Build a Shopify OS 2.0 "image-with-text" section: settings for image position (left/right, swaps on a "reverse layout" toggle), image, heading, rich text body, button. Support stacking as blocks so merchants can chain multiple alternating image/text rows using one section with a "row" block type (image, heading, text, button per block), each row auto-alternating layout.
```

### Video Section (self-hosted or YouTube/Vimeo embed)
```
Build a Shopify OS 2.0 "video-section": settings for video source type (Shopify native video, YouTube URL, Vimeo URL, MP4 URL), cover image, autoplay/loop/mute toggles, aspect ratio. Use a facade pattern for YouTube/Vimeo (load thumbnail + play button, only inject iframe on click) to protect Lighthouse performance score.
```

### Instagram / UGC Gallery
```
Build a Shopify OS 2.0 "ugc-gallery" section: since Instagram's API requires app-level auth (out of scope for a theme), build this as a manual image grid with blocks (image, optional link to product, optional Instagram handle text overlay on hover). Settings: columns, gap, hover effect (zoom/fade). Include a note in the section's schema info field explaining merchants can point images to Instagram post links manually or use an app for auto-sync.
```

---

## 5. Cart, Checkout-Adjacent

### Cart Drawer (Slide-out)
```
Build a Shopify OS 2.0 cart drawer as a global snippet + section-rendered component. Requirements: AJAX add/remove/update quantity without page reload using /cart/change.js and /cart/update.js, free-shipping progress bar (settings: threshold amount, message templates for under/over threshold), upsell block area (recommended products via Shopify's product-recommendations API), empty-state message, accessible focus trap when open, close on Escape key and backdrop click.
```

### Announcement Bar
```
Build a Shopify OS 2.0 "announcement-bar" section: repeatable message blocks that rotate (settings: rotation speed, or static if only one block), optional countdown/link per message, dismissible with localStorage to not re-show same session, background/text color settings, sticky option.
```

---

## 6. Footer & Utility

### Newsletter Signup with Incentive
```
Build a Shopify OS 2.0 "newsletter-signup" section integrated with Shopify's native customer form (contact#klaviyo or list ID via app metafield hook, but default to Shopify's built-in customer/newsletter form). Settings: heading, subtext, incentive text (e.g. "Get 10% off"), background image/color, success/error message text, place as full-width section or footer block.
```

### Mega Menu (if not doing header separately)
```
Build a Shopify OS 2.0 mega-menu as a header component driven by Shopify's linklist/navigation, extended with a "menu-item-image" block type (via section blocks tied to link handles) so merchants can add featured images/promo blocks per top-level menu item. Must be keyboard-accessible (arrow key navigation, Escape to close, proper aria-expanded/aria-haspopup), and collapse to a mobile drawer menu below 990px.
```

---

## 7. Wiring Sections Into Pages (JSON Templates + Sample Data)

Building the section file (`sections/hero-banner.liquid`) is only half the job. It also needs to be **added to the page's JSON template** with real-looking preset content, or it just sits unused and the homepage looks empty in review/demo. Do this for every page, not just home — reviewers and buyers judge the theme by what they see on first load.

### Home Page (`templates/index.json`)
```
Wire up the homepage in templates/index.json for this theme. Add these sections in order, each with realistic sample data (not "Lorem ipsum" — use actual product-store-style copy):
1. announcement-bar — one message: "Free shipping on orders over $50"
2. hero-banner — 1 slide: heading "New Season, New Essentials", subheading, CTA "Shop Now" linking to /collections/all, use a placeholder image URL
3. feature-highlights — 4 blocks: Free Shipping, Easy Returns, Secure Checkout, 24/7 Support, each with an icon and one line of text
4. collection-list — pull the first 4 collections from the store, layout: grid
5. trending-products — source: best-selling, count: 8
6. image-with-text — 2 alternating rows telling a brief brand story
7. testimonials — 3 sample blocks with names, star ratings, and short realistic quotes
8. newsletter-signup — heading "Join the list", incentive "Get 10% off your first order"

Output the full valid templates/index.json with "sections" and "order" keys, correct block IDs, and settings matching each section's schema exactly as defined in its .liquid file. Validate that every block referenced in "order" arrays exists in "blocks".
```

### Product Page (`templates/product.json`)
```
Wire up templates/product.json. Sections in order: main-product (gallery + variant picker + add to cart + trust-badges block populated with 3 sample badges), frequently-bought-together (populate with 2 related sample products if the store has them, otherwise leave picker empty but section present), product-tabs or faq-accordion (3 sample Q&As: shipping, returns, sizing), trending-products retitled "You May Also Like" (source: related). Use realistic settings values, not placeholders like "Section Title".
```

### Collection Page (`templates/collection.json`)
```
Wire up templates/collection.json: main-collection-banner (collection title + description), faceted filter sidebar (price, size, color, availability — enable Shopify's native filtering), product grid with sort dropdown, pagination. Add a "trust-badges" section beneath the grid. Populate any static text settings with realistic copy.
```

### Cart Page / Cart Drawer
```
Populate the cart drawer's upsell block area with 2 sample recommended products and set the free-shipping threshold setting to $50 with message templates: under-threshold "Spend $X more for free shipping" and over-threshold "You've unlocked free shipping!". Confirm cart drawer renders correctly with 0 items, 1 item, and 3+ items (empty state copy, single vs plural "item/items").
```

### Other Required Templates
```
For each of the remaining required templates (blog.json, article.json, list-collections.json, page.json, 404.json, password.json, gift_card.liquid, search.json), confirm a matching JSON template exists, wire in at minimum a header, relevant content section, and footer, and populate any section settings with realistic sample copy rather than leaving them on schema defaults. List which of the 16 required templates are missing or unwired so I can prioritize them.
```

### One combined "do it all" prompt (if you'd rather run it in one pass)
```
Go through every JSON template in /templates. For each one: 1) confirm all sections referenced in this project's /sections folder that are relevant to that page type are present and wired in a sensible order, 2) fill every section and block setting with realistic, on-brand sample content (no "Lorem ipsum", no empty schema defaults, no placeholder.png where a real-looking image URL setting is expected), 3) verify every block ID used in an "order" array actually exists in "blocks", and 4) output a short summary listing any page where a section exists in /sections but isn't used anywhere, or any template that's missing entirely.
```

---

## Notes on Theme Store fit

- **All 16 required page templates** need to exist and be functional (product, collection, cart, blog, article, page, list-collections, 404, password, gift card, etc.) — not just the homepage sections above.
- Lighthouse targets for submission: **Performance ≥ 60, Accessibility ≥ 90** (mobile + desktop) minimum to pass review — your 90+ target gives you real headroom.
- Shopify Theme Store requires **21+ supported features** (subscriptions, gift cards, faceted search/filtering, discounts shown in cart, accelerated checkout buttons, etc.) — these aren't sections but are checked in review, worth a separate checklist pass with Claude Code before submission.
- **Exclusivity**: Theme Store listings can't be sold elsewhere simultaneously — factor this into your TemplateMonster/Theme Store sequencing.

Want me to turn the "21+ required features" checklist and the 16-template list into a second reference doc so Claude Code has a full pre-submission audit prompt too?
