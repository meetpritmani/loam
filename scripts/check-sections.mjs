#!/usr/bin/env node
/**
 * check-sections.mjs — audits every section against the §14 per-section
 * checklist, for the parts that can be checked from the source.
 *
 * `shopify theme check` already validates Liquid, schema JSON and translation
 * keys. It knows nothing about this build spec, so the rules below are the
 * ones that have actually been broken during the build:
 *
 *   presets        every merchant-insertable section needs one (§10)
 *   color_scheme   and top/bottom padding settings (§10)
 *   bare <img>     no section may render one — §6 routes all media through
 *                  image-fallback.liquid
 *   fallback:      every image_picker setting routes through image-fallback;
 *                  a missing fallback: filename is advisory, since the theme
 *                  ships no photography for that layer to find (§6)
 *   attributes     every block loop needs {{ block.shopify_attributes }} or
 *                  the block is unselectable in the editor (§14)
 *   t: labels      no hardcoded English in a schema (§4)
 *
 * Static sections — the ones theme.liquid or a section group renders, and the
 * main-* template sections — cannot carry presets, so they are exempt from
 * that rule only. Every other rule still applies to them. The further
 * exemption sets below are each named and justified; adding one is a decision,
 * not a way to quiet the script.
 *
 * Usage:  node scripts/check-sections.mjs [--json]
 * Exit 1 on any required failure.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sectionsDir = join(root, 'sections');

/* Sections a merchant never inserts from the editor's Add section list: the
   template mains, and the four that theme.liquid or a section group renders
   at a fixed position, plus the shells rendered once from theme.liquid
   (compare-bar, compare-drawer, quick-view-drawer, same reasoning as
   cart-drawer's own comment) and the pure Section Rendering API targets
   fetched into one of those shells or into a PDP region — never on any
   template's own sections list, so a presets block would offer the merchant
   a section that does nothing wherever they placed it (pickup-availability,
   predictive-search, quick-view — each says so in its own file comment). */
const NO_PRESET = new Set([
  'header',
  'footer',
  'cart-drawer',
  'cart-count',
  'compare-bar',
  'compare-drawer',
  'pickup-availability',
  'predictive-search',
  'quick-view',
  'quick-view-drawer',
]);

/* Product-context only. Each reads `product` or `recommendations`, so a
   preset would offer the merchant a section that renders nothing wherever
   they put it. They live in product.json and nowhere else. */
const NO_PRESET_CONTEXTUAL = new Set([
  'recently-viewed',
  'related-products',
  'complementary-products',
]);

/* No visual box of its own — it renders the header's cart bubble for the
   Section Rendering API and inherits the header's scheme. Same for the other
   fetched-shell sections: each inherits its opener's scheme rather than
   carrying its own (compare-drawer explicitly says so; the rest are single-
   purpose fragments with no independent surface to colour). */
const NO_SCHEME = new Set([
  'cart-count',
  'compare-bar',
  'compare-drawer',
  'pickup-availability',
  'predictive-search',
  'quick-view',
  'quick-view-drawer',
]);

/* Not `.section` boxes, so vertical section padding has nothing to set on:
   the hero sizes itself from its own height setting, the password page is a
   centred full-height layout, and the fetched-shell/Section-Rendering-only
   sections above render inside a drawer or an existing page region that
   already owns its own spacing. */
const NO_PADDING = new Set([
  'header',
  'footer',
  'cart-drawer',
  'cart-count',
  'announcement-bar',
  'hero',
  'main-password',
  'compare-bar',
  'compare-drawer',
  'pickup-availability',
  'predictive-search',
  'quick-view',
  'quick-view-drawer',
]);

const files = readdirSync(sectionsDir)
  .filter((f) => f.endsWith('.liquid'))
  .sort();

const findings = [];

function fail(file, rule, detail) {
  findings.push({ file: `sections/${file}`, rule, detail, advisory: false });
}

function note(file, rule, detail) {
  findings.push({ file: `sections/${file}`, rule, detail, advisory: true });
}

/** Strips {%- comment -%} blocks and {% schema %} so markup rules only see markup. */
function markupOf(source) {
  return source
    .replace(/{%-?\s*comment\s*-?%}[\s\S]*?{%-?\s*endcomment\s*-?%}/g, '')
    .replace(/{%-?\s*schema\s*-?%}[\s\S]*?{%-?\s*endschema\s*-?%}/g, '');
}

for (const file of files) {
  const name = file.replace(/\.liquid$/, '');
  const source = readFileSync(join(sectionsDir, file), 'utf8');
  const markup = markupOf(source);

  /* --- schema ---------------------------------------------------------- */

  const schemaMatch = source.match(/{%-?\s*schema\s*-?%}([\s\S]*?){%-?\s*endschema\s*-?%}/);
  if (!schemaMatch) {
    fail(file, 'schema', 'no {% schema %} block');
    continue;
  }

  let schema;
  try {
    schema = JSON.parse(schemaMatch[1]);
  } catch (error) {
    fail(file, 'schema', `schema is not valid JSON: ${error.message}`);
    continue;
  }

  const settings = schema.settings ?? [];
  const ids = new Set(settings.filter((s) => s.id).map((s) => s.id));
  const insertable =
    !name.startsWith('main-') && !NO_PRESET.has(name) && !NO_PRESET_CONTEXTUAL.has(name);

  if (insertable && !(schema.presets?.length > 0)) {
    fail(file, 'presets', 'merchant-insertable section with no presets block');
  }

  if (!ids.has('color_scheme') && !NO_SCHEME.has(name)) {
    fail(file, 'color_scheme', 'no color_scheme setting');
  }

  for (const pad of ['padding_top', 'padding_bottom']) {
    if (!ids.has(pad) && !NO_PADDING.has(name)) {
      fail(file, 'padding', `no ${pad} setting`);
    }
  }

  /* Hardcoded English in a schema. `default` is copy and stays English;
     everything a merchant reads as a label must be a t: key. */
  const labelFields = ['label', 'name', 'info', 'content', 'placeholder'];
  const walk = (node, path) => {
    if (Array.isArray(node)) {
      node.forEach((child, i) => walk(child, `${path}[${i}]`));
      return;
    }
    if (node === null || typeof node !== 'object') return;
    for (const [key, value] of Object.entries(node)) {
      if (labelFields.includes(key) && typeof value === 'string') {
        /* preset names may repeat the section name key, which is also a t: */
        if (!value.startsWith('t:')) {
          fail(file, 't:labels', `${path}.${key} is hardcoded: ${JSON.stringify(value)}`);
        }
      } else {
        walk(value, `${path}.${key}`);
      }
    }
  };
  /* Preset block settings are values, not labels — skip them. */
  walk({ settings, blocks: schema.blocks ?? [], name: schema.name }, name);

  /* --- markup ---------------------------------------------------------- */

  if (/<img\b/.test(markup)) {
    fail(file, 'bare-img', 'renders a bare <img>; use image-fallback.liquid');
  }

  const imagePickers = settings
    .filter((s) => s.type === 'image_picker')
    .map((s) => s.id)
    .concat(
      (schema.blocks ?? []).flatMap((b) =>
        (b.settings ?? []).filter((s) => s.type === 'image_picker').map((s) => s.id)
      )
    );

  if (imagePickers.length > 0) {
    /* A section may render image-fallback itself, or forward the image and a
       fallback: filename to a snippet that does — card-collection and
       card-product both take that shape. */
    const routed = /render\s+'image-fallback'/.test(markup) || /\bfallback:/.test(markup);
    if (!routed) {
      fail(
        file,
        'fallback',
        `${imagePickers.length} image_picker setting(s) and no route through image-fallback`
      );
    } else if (!/\bfallback:/.test(markup)) {
      /* Two ways a section legitimately has no fallback: filename.
         Either the render is guarded on the merchant's image being present,
         so layer 1 is the only reachable layer — value-props and multicolumn
         both do this, the alternative being an icon or no media at all. Or
         the author passed an explicit `placeholder:`, declaring layer 3 as
         the intended empty state, which is what marquee's logo strip does
         because §6 manifests no demo logo file. Anything else is a slot that
         will render a bare placeholder nobody chose. */
      const guarded = /settings\.image\s*!=\s*blank/.test(markup);
      const declaresPlaceholder = /\bplaceholder:/.test(markup);
      if (!guarded && !declaresPlaceholder) {
        note(file, 'fallback', 'image-fallback reachable with no fallback: filename');
      }
    }
  }

  /* --- blocks ---------------------------------------------------------- */

  const hasBlocks = (schema.blocks ?? []).some((b) => b.type !== '@app');
  if (hasBlocks && !/block\.shopify_attributes/.test(markup)) {
    fail(file, 'shopify_attributes', 'block loop without {{ block.shopify_attributes }}');
  }

  /* @app support is a Theme Store requirement on these four (§10). */
  const APP_REQUIRED = ['main-product', 'main-cart', 'cart-drawer', 'main-collection'];
  if (APP_REQUIRED.includes(name)) {
    const declares = (schema.blocks ?? []).some((b) => b.type === '@app');
    if (!declares) fail(file, 'app-blocks', 'does not declare "@app" in blocks');
    if (!/when\s+'@app'/.test(markup)) fail(file, 'app-blocks', "no {% when '@app' %} branch");
  }
}

/* --- report ------------------------------------------------------------- */

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ sections: files.length, findings }, null, 2));
} else if (findings.length === 0) {
  console.log(`${files.length} sections checked. No findings.`);
} else {
  let last = '';
  for (const f of findings) {
    if (f.file !== last) {
      console.log(`\n${f.file}`);
      last = f.file;
    }
    console.log(`  ${f.advisory ? 'note' : 'FAIL'} [${f.rule}] ${f.detail}`);
  }
  const failures = findings.filter((f) => !f.advisory).length;
  console.log(
    `\n${files.length} sections checked. ${failures} failing, ` +
      `${findings.length - failures} advisory.`
  );
}

process.exit(findings.filter((f) => !f.advisory).length ? 1 : 0);
