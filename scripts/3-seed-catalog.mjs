/**
 * 3-seed-catalog.mjs — products, variants, metafields, collections.
 *
 * Idempotent by design (§12.2). `productSet` creates or updates by handle, so
 * running this twice produces the same eight products rather than sixteen.
 * Collections and metafield definitions have no such mutation, so both are
 * looked up by handle first.
 *
 * Also writes three of the buyer's export files (§12.7) from the same data
 * that seeded the store — products.csv, collections.md and
 * metafield-definitions.md. Generating them rather than hand-maintaining them
 * is the point: a CSV written alongside a seeding script drifts within a week,
 * and the buyer's store then looks nothing like the screenshots that sold them
 * the theme.
 *
 * Run: node scripts/3-seed-catalog.mjs [--offline]
 *
 *   --offline  write the buyer's export files and touch no store at all.
 *              The export is generated entirely from demo-data.mjs, so it has
 *              never needed a store — keeping it behind the credential check
 *              made half of §12.7 look blocked when it was not.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { log, fail } from './lib/log.mjs';
import { PATHS, ensureDir } from './lib/media.mjs';
import {
  PRODUCTS,
  COLLECTIONS,
  METAFIELD_DEFINITIONS,
  productImages,
} from './lib/demo-data.mjs';
import { graphql, mutate, requireCredentials, verifyShop } from './lib/shopify.mjs';
import { appendLog } from './lib/seed-log.mjs';

/* --------------------------------------------------------------------------
   Queries
   -------------------------------------------------------------------------- */

const PRODUCT_BY_HANDLE = `
  query ProductByHandle($handle: String!) {
    productByIdentifier(identifier: { handle: $handle }) {
      id
      handle
      title
      media(first: 10) {
        nodes {
          id
          ... on MediaImage { image { url } }
        }
      }
    }
  }
`;

const PRODUCT_SET = `
  mutation ProductSet($input: ProductSetInput!) {
    productSet(synchronous: true, input: $input) {
      product {
        id
        handle
        title
        variants(first: 100) { nodes { id title sku } }
      }
      userErrors { field message code }
    }
  }
`;

/* productCreateMedia was removed in 2026-07. productUpdate takes the same
   CreateMediaInput list as a second argument and appends it to the product. */
const PRODUCT_ADD_MEDIA = `
  mutation ProductAddMedia($product: ProductUpdateInput!, $media: [CreateMediaInput!]) {
    productUpdate(product: $product, media: $media) {
      product { id media(first: 10) { nodes { id } } }
      userErrors { field message }
    }
  }
`;

const METAFIELDS_SET = `
  mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { id key namespace }
      userErrors { field message code }
    }
  }
`;

const METAFIELD_DEFINITION_CREATE = `
  mutation MetafieldDefinitionCreate($definition: MetafieldDefinitionInput!) {
    metafieldDefinitionCreate(definition: $definition) {
      createdDefinition { id name key }
      userErrors { field message code }
    }
  }
`;

const COLLECTION_BY_HANDLE = `
  query CollectionByHandle($handle: String!) {
    collectionByIdentifier(identifier: { handle: $handle }) {
      id
      handle
      title
    }
  }
`;

/* 2026-07 renamed the argument to `collection`, retyped it as
   CollectionCreateInput, and dropped `code` from its UserError. Smart-collection
   rules moved off `ruleSet` onto the conditions-source model below. */
const COLLECTION_CREATE = `
  mutation CollectionCreate($collection: CollectionCreateInput!) {
    collectionCreate(collection: $collection) {
      collection { id handle title }
      userErrors { field message }
    }
  }
`;

/* collectionAddProducts was removed in 2026-07, and neither CollectionCreateInput
   nor CollectionUpdateInput carries a `products` list. Membership is now set from
   the product side. collectionsToJoin is additive and a no-op for a product
   already in the collection, so this keeps the step idempotent. */
const PRODUCT_JOIN_COLLECTION = `
  mutation ProductJoinCollection($product: ProductUpdateInput!) {
    productUpdate(product: $product) {
      product { id }
      userErrors { field message }
    }
  }
`;

const LOCATIONS = `
  query Locations {
    locations(first: 5, includeInactive: false) {
      nodes { id name isActive }
    }
  }
`;

const PUBLICATIONS = `
  query Publications {
    publications(first: 20, catalogType: APP) {
      nodes { id name }
    }
  }
`;

const PUBLISH = `
  mutation Publish($id: ID!, $input: [PublicationInput!]!) {
    publishablePublish(id: $id, input: $input) {
      userErrors { field message }
    }
  }
`;

/* --------------------------------------------------------------------------
   Shared derivations
   Used by both the API calls and the CSV, so the buyer's import and the demo
   store cannot disagree about a SKU.
   -------------------------------------------------------------------------- */

/**
 * @param {object} product
 * @param {string} colour
 * @param {string} size
 * @returns {string}
 */
function skuFor(product, colour, size) {
  const base = product.handle.toUpperCase().replace(/-/g, '');
  return `${base}-${colour.slice(0, 3).toUpperCase()}-${size.replace(/\D/g, '')}`;
}

/**
 * One variant per product is stocked low, so the low-stock message has
 * something to render against the default threshold of ten. The first colour
 * in the second size is arbitrary but stable — it must be the same on the
 * demo store and in the buyer's CSV.
 *
 * @param {object} product
 * @param {string} colour
 * @param {string} size
 * @returns {boolean}
 */
function lowStock(product, colour, size) {
  return colour === product.colours[0] && size === product.sizes[1];
}

/* --------------------------------------------------------------------------
   Media map
   -------------------------------------------------------------------------- */

const mapPath = path.join(PATHS.export, 'media-map.json');

/** @type {Record<string, {url: string, reference: string}>} */
let mediaMap = {};

if (existsSync(mapPath)) {
  mediaMap = JSON.parse(readFileSync(mapPath, 'utf8'));
} else {
  // Deliberately not fatal. Seeding the catalogue without imagery is the only
  // way to exercise the rest of the pipeline while the photographs are still
  // being sourced by hand, and product media can be attached by a later run.
  log.warn('demo-store-export/media-map.json is missing.');
  log.info('Products will be created without images. Run scripts 1 and 2, then');
  log.info('run this again — productSet updates by handle, so nothing duplicates.');
}

/* --------------------------------------------------------------------------
   Run
   -------------------------------------------------------------------------- */

const offline = process.argv.includes('--offline');

log.banner(offline ? '3 / 5  Buyer export (offline)' : '3 / 5  Seed catalog');

if (!offline) {
  requireCredentials();
  const shop = await verifyShop();
  log.info(`Store: ${shop.name} (${shop.myshopifyDomain})`);
} else {
  log.info('Offline: writing the export package only, no store is contacted.');
}

if (!offline) {
  /* --- Metafield definitions ------------------------------------------------ */

  // Definitions before values (§12.4). A metafield set without a definition
  // still stores, but it is invisible in admin and — the part that actually
  // breaks the theme — has no storefront access grant, so Liquid reads nil.
  await log.group('Metafield definitions', async () => {
    for (const definition of METAFIELD_DEFINITIONS) {
      const payload = await mutate(
        METAFIELD_DEFINITION_CREATE,
        {
          definition: {
            namespace: definition.namespace,
            key: definition.key,
            name: definition.name,
            description: definition.description,
            type: definition.type,
            ownerType: definition.ownerType,
            pin: true,
            access: { storefront: 'PUBLIC_READ' },
          },
        },
        'metafieldDefinitionCreate',
        // Second run: the definition is already there, which is success.
        { tolerate: ['TAKEN'] }
      );

      const created = payload.createdDefinition;
      if (created) {
        log.created(`${definition.namespace}.${definition.key}`);
        appendLog('metafieldDefinition', `${definition.namespace}.${definition.key}`, created.id);
      } else {
        log.skipped(`${definition.namespace}.${definition.key} already defined`);
      }
    }
  });

  /* --- Online Store publication -------------------------------------------- */

  const onlineStore = await log.group('Publication', async () => {
    const data = await graphql(PUBLICATIONS, {}, 'publications');
    const found = (data.publications?.nodes || []).find((node) => node.name === 'Online Store');
    if (!found) {
      log.warn('No Online Store publication found. Products will be created but');
      log.warn('may not be visible on the storefront.');
      return null;
    }
    log.info(`Online Store: ${found.id}`);
    return found;
  });

  /* --- Location ------------------------------------------------------------- */

  // Needed before any variant can carry a quantity. Without a location id there
  // is nowhere to stock, and every variant lands at zero — which would make the
  // whole catalogue read as sold out rather than the five variants that are
  // meant to.
  const location = await log.group('Location', async () => {
    const data = await graphql(LOCATIONS, {}, 'locations');
    const found = (data.locations?.nodes || [])[0];
    if (!found) {
      fail('The store has no active location.', [
        'Settings -> Locations -> add one. Inventory cannot be set without it.',
      ]);
    }
    log.info(`${found.name}`);
    return found;
  });

  /* --- Products ------------------------------------------------------------- */

  /** handle -> product gid, for the manual collections below. */
  const productIds = new Map();

  await log.group('Products', async () => {
    for (const [index, product] of PRODUCTS.entries()) {
      const existing = await graphql(PRODUCT_BY_HANDLE, { handle: product.handle }, 'productByIdentifier');
      const found = existing.productByIdentifier;

      // The full variant matrix: every colour against every size.
      const variants = [];
      for (const colour of product.colours) {
        for (const size of product.sizes) {
          const soldOut = product.soldOutVariants.some(
            (v) => v.colour === colour && v.size === size
          );

          variants.push({
            optionValues: [
              { optionName: 'Colour', name: colour },
              { optionName: 'Size', name: size },
            ],
            price: product.price,
            ...(product.compareAtPrice ? { compareAtPrice: product.compareAtPrice } : {}),
            sku: skuFor(product, colour, size),
            taxable: true,
            // Tracked, and DENY, on every variant. §9.2 rule 4 lets the theme
            // show a low-stock message only where inventory is actually tracked,
            // so an untracked demo catalogue would hide the feature the demo
            // exists to show.
            inventoryItem: { tracked: true },
            inventoryPolicy: 'DENY',
            inventoryQuantities: [
              {
                locationId: location.id,
                name: 'available',
                // Zero on the handful of variants chosen in demo-data, so the
                // picker's unavailable state is visible. Eight on one variant
                // per product, so the low-stock message has something to fire
                // on under the default threshold of ten.
                quantity: soldOut ? 0 : lowStock(product, colour, size) ? 8 : 25,
              },
            ],
          });
        }
      }

      const input = {
        handle: product.handle,
        title: product.title,
        descriptionHtml: product.description,
        vendor: 'Fernway',
        productType: product.type,
        status: 'ACTIVE',
        tags: product.tags,
        productOptions: [
          { name: 'Colour', values: product.colours.map((name) => ({ name })) },
          { name: 'Size', values: product.sizes.map((name) => ({ name })) },
        ],
        variants,
        ...(found ? { id: found.id } : {}),
      };

      const payload = await mutate(PRODUCT_SET, { input }, 'productSet');
      const saved = payload.product;
      productIds.set(product.handle, saved.id);

      if (found) log.skipped(`${product.title} updated (${saved.variants.nodes.length} variants)`);
      else log.created(`${product.title} (${saved.variants.nodes.length} variants)`);

      appendLog('product', product.handle, saved.id);

      /* Media. Attached separately from productSet, which does not take media
         for an existing product without replacing the whole set. Checked per
         file, not just "has any media" — a product seeded with only its
         studio shot (§6's alt photos commonly sourced later, in a separate
         pass) would otherwise have that first image mistaken for "fully
         done" forever, and the alt could never be attached by re-running
         this script.

         Matched by filename, not by GID. `mediaMap[file].gid` is the Files
         library's GID for the upload; attaching that same source to a
         product creates a SEPARATE MediaImage resource with its own GID, so
         comparing GIDs is always a miss — confirmed the hard way, producing
         duplicate images on all eight products the first time this ran with
         a GID check. A product's own media CDN URL still carries the
         original filename before Shopify's `_<uuid>` suffix and query
         string, which is what's actually stable to match on. */
      const existingFilenames = new Set(
        (found?.media?.nodes || [])
          .map((node) => node.image?.url?.split('/').pop()?.split('?')[0] || '')
          .map((name) => name.replace(/_[0-9a-f-]{36}\.webp$/i, '.webp'))
      );
      const images = productImages(index).filter((file) => mediaMap[file]?.url);
      const missingImages = images.filter((file) => !existingFilenames.has(file));

      if (images.length === 0) {
        log.warn(`  ${product.title}: no media in the map, skipping images`);
      } else if (missingImages.length === 0) {
        log.skipped(`  ${product.title}: all ${images.length} images already attached`);
      } else {
        await mutate(
          PRODUCT_ADD_MEDIA,
          {
            product: { id: saved.id },
            media: missingImages.map((file) => ({
              originalSource: mediaMap[file].url,
              mediaContentType: 'IMAGE',
              alt: `${product.title} — ${product.material}`,
            })),
          },
          'productUpdate'
        );
        // media[1] is what card-product's hover swap reads. A product left
        // with only one image loses that behaviour silently, so it is worth
        // saying out loud.
        const totalAfter = existingFilenames.size + missingImages.length;
        log.created(
          `  ${product.title}: +${missingImages.length} image${missingImages.length === 1 ? '' : 's'}` +
            ` (${totalAfter} total)${totalAfter < 2 ? ' — no hover image' : ''}`
        );
      }

      /* Metafields. */
      const metafields = [
        { key: 'material', type: 'single_line_text_field', value: product.material },
        { key: 'care', type: 'multi_line_text_field', value: product.care },
        { key: 'carbon_footprint', type: 'number_decimal', value: product.carbonFootprint },
      ].map((field) => ({
        ownerId: saved.id,
        namespace: 'custom',
        key: field.key,
        type: field.type,
        value: field.value,
      }));

      await mutate(METAFIELDS_SET, { metafields }, 'metafieldsSet');

      /* Publish to the Online Store, or the storefront shows nothing. */
      if (onlineStore) {
        await mutate(
          PUBLISH,
          { id: saved.id, input: [{ publicationId: onlineStore.id }] },
          'publishablePublish'
        );
      }
    }
  });

  /* --- Collections ---------------------------------------------------------- */

  await log.group('Collections', async () => {
    for (const collection of COLLECTIONS) {
      const existing = await graphql(
        COLLECTION_BY_HANDLE,
        { handle: collection.handle },
        'collectionByIdentifier'
      );

      let id = existing.collectionByIdentifier?.id;

      if (id) {
        log.skipped(`${collection.title} already exists`);
      } else {
        const image = collection.image && mediaMap[collection.image]?.url;

        const input = {
          handle: collection.handle,
          title: collection.title,
          descriptionHtml: `<p>${collection.description}</p>`,
          ...(image ? { image: { src: image, altText: collection.title } } : {}),
          // A smart collection is now a collection carrying a conditions source.
          // matchType ALL on a single condition is the same "products tagged X"
          // rule the old appliedDisjunctively: false ruleSet expressed.
          ...(collection.type === 'smart'
            ? {
                sources: [
                  {
                    source: {
                      title: collection.title,
                      inclusion: {
                        matchType: 'ALL',
                        conditions: [
                          {
                            productTag: {
                              relation: 'TAGGED_WITH',
                              values: [collection.tag],
                              matchType: 'ANY',
                            },
                          },
                        ],
                      },
                    },
                  },
                ],
              }
            : {}),
        };

        const payload = await mutate(COLLECTION_CREATE, { collection: input }, 'collectionCreate');
        id = payload.collection.id;
        log.created(`${collection.title} (${collection.type})`);
        appendLog('collection', collection.handle, id);

        if (onlineStore) {
          await mutate(PUBLISH, { id, input: [{ publicationId: onlineStore.id }] }, 'publishablePublish');
        }
      }

      // Manual collections get their members every run. collectionsToJoin is
      // additive and ignores a product already in the collection, so this is safe
      // to repeat and it repairs a collection someone emptied by hand. One call
      // per product rather than one per collection — the batch form went away
      // with collectionAddProducts.
      if (collection.type === 'manual') {
        const ids = collection.productHandles
          .map((handle) => productIds.get(handle))
          .filter(Boolean);

        for (const productId of ids) {
          await mutate(
            PRODUCT_JOIN_COLLECTION,
            { product: { id: productId, collectionsToJoin: [id] } },
            'productUpdate'
          );
        }

        if (ids.length > 0) log.info(`  ${ids.length} products`);
      }
    }
  });
}

/* --------------------------------------------------------------------------
   Buyer export (§12.7)
   -------------------------------------------------------------------------- */

ensureDir(PATHS.export);

/** @param {string} value */
const csvCell = (value) => {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

await log.group('Writing buyer export', async () => {
  /* products.csv — Shopify's product import format.

     One row per variant. The first row of a product carries the shared
     fields; subsequent rows leave them blank, which is exactly how Shopify's
     own export looks and what its importer expects. */
  const headers = [
    'Handle', 'Title', 'Body (HTML)', 'Vendor', 'Type', 'Tags', 'Published',
    'Option1 Name', 'Option1 Value', 'Option2 Name', 'Option2 Value',
    'Variant SKU', 'Variant Inventory Tracker', 'Variant Inventory Qty',
    'Variant Inventory Policy', 'Variant Fulfillment Service', 'Variant Price',
    'Variant Compare At Price', 'Variant Requires Shipping', 'Variant Taxable',
    'Image Src', 'Image Position', 'Image Alt Text', 'Status',
  ];

  const rows = [headers];

  PRODUCTS.forEach((product, index) => {
    const images = productImages(index);
    let first = true;
    let imageIndex = 0;

    product.colours.forEach((colour) => {
      product.sizes.forEach((size) => {
        const soldOut = product.soldOutVariants.some((v) => v.colour === colour && v.size === size);
        const sku = skuFor(product, colour, size);
        const quantity = soldOut ? 0 : lowStock(product, colour, size) ? 8 : 25;

        // Images ride on the first rows of the product, one per row, which is
        // how Shopify's importer associates them.
        const image = imageIndex < images.length ? images[imageIndex] : '';
        if (image) imageIndex += 1;

        rows.push([
          product.handle,
          first ? product.title : '',
          first ? product.description : '',
          first ? 'Fernway' : '',
          first ? product.type : '',
          first ? product.tags.join(', ') : '',
          first ? 'TRUE' : '',
          'Colour', colour,
          'Size', size,
          sku, 'shopify', String(quantity), 'deny', 'manual',
          product.price,
          product.compareAtPrice || '',
          'TRUE', 'TRUE',
          image, image ? String(imageIndex) : '',
          image ? `${product.title} — ${product.material}` : '',
          first ? 'active' : '',
        ]);

        first = false;
      });
    });
  });

  const csv = rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
  writeFileSync(path.join(PATHS.export, 'products.csv'), `${csv}\r\n`, 'utf8');
  log.created(`products.csv (${rows.length - 1} variant rows)`);

  /* collections.md — collections are not CSV-importable, so these are the
     manual steps, written out in the order the admin asks for them. */
  const collectionsMd = `# Collections

Shopify's product CSV import does not create collections, so these are made by
hand. It takes about five minutes.

**Products -> Collections -> Create collection** for each row below. Import
\`products.csv\` first — the manual collections need products to select.

${COLLECTIONS.map((collection) => {
  const lines = [
    `## ${collection.title}`,
    '',
    `- **Handle** \`${collection.handle}\` — set this under *Search engine listing -> Edit*. The theme's demo JSON links to it by handle, so a different handle means a broken link.`,
    `- **Description** ${collection.description}`,
    `- **Type** ${collection.type === 'smart' ? `Automated — *Product tag* is equal to \`${collection.tag}\`` : 'Manual'}`,
  ];

  if (collection.image) {
    lines.push(`- **Image** \`${collection.image}\` from the media folder`);
  }

  if (collection.type === 'manual') {
    lines.push(`- **Products** ${collection.productHandles.map((h) => `\`${h}\``).join(', ')}`);
  }

  return lines.join('\n');
}).join('\n\n')}

---

## Why these six

\`best-sellers\` and \`new-arrivals\` are what the homepage's two
featured-collection sections point at. Both must be non-empty or those
sections fall back to the theme's demo cards instead of your real products.

Generated by \`scripts/3-seed-catalog.mjs\`. Do not edit by hand.
`;

  writeFileSync(path.join(PATHS.export, 'collections.md'), collectionsMd, 'utf8');
  log.created('collections.md');

  /* metafield-definitions.md */
  const metafieldsMd = `# Metafield definitions

The theme reads four product metafields and degrades cleanly when they are
absent — no broken layout, the relevant element simply does not render. Adding
them switches on the material tag, the care accordion, the carbon badge and the
size guide drawer.

**Settings -> Custom data -> Products -> Add definition** for each row.

| Namespace and key | Name | Type | Drives |
|---|---|---|---|
${METAFIELD_DEFINITIONS.map(
  (definition) =>
    `| \`${definition.namespace}.${definition.key}\` | ${definition.name} | ${definition.type} | ${definition.description} |`
).join('\n')}

## The setting that catches everyone

Under **Access -> Storefronts**, each definition must be readable by the
storefront. A definition without it stores values perfectly, shows them in
admin, and returns nil to Liquid — so the theme renders nothing and the store
looks broken in a way that gives no clue where to look.

Tick **Pin** as well. It puts the fields at the top of the product editor
rather than behind *Show all*.

## Values used in the demo

| Product | \`custom.material\` | \`custom.carbon_footprint\` |
|---|---|---|
${PRODUCTS.map((p) => `| ${p.title} | ${p.material} | ${p.carbonFootprint} |`).join('\n')}

\`custom.care\` is a sentence or two of washing instructions per product;
\`custom.size_guide\` points at the Size guide page.

Generated by \`scripts/3-seed-catalog.mjs\`. Do not edit by hand.
`;

  writeFileSync(path.join(PATHS.export, 'metafield-definitions.md'), metafieldsMd, 'utf8');
  log.created('metafield-definitions.md');
});

log.success(
  offline
    ? `Export written for ${PRODUCTS.length} products and ${COLLECTIONS.length} collections. No store contacted.`
    : `${PRODUCTS.length} products, ${COLLECTIONS.length} collections.`
);
