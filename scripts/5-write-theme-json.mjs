/**
 * 5-write-theme-json.mjs — inject shopify:// references into the theme JSON.
 *
 * §12.6, and the mechanism §12 calls the most valuable in the whole document.
 *
 * When a JSON template stores an image setting as
 * `shopify://shop_images/<filename>`, Shopify resolves it against the store's
 * own Files **by filename**. So the buyer uploads a folder of images with
 * matching names, installs the theme, and the shipped JSON lights up with zero
 * editor work.
 *
 * Two rules, both easy to get wrong and both silent when you do:
 *
 *   1. Write the `shopify://` reference, never the CDN URL. A CDN URL is
 *      store-specific — it works perfectly on the demo store and renders
 *      nothing at all on the buyer's.
 *
 *   2. Touch media settings only. Never overwrite copy. The demo JSON's text
 *      is written Fernway copy and this script has no business near it.
 *
 * Key order and two-space indent are preserved so the diff stays reviewable.
 *
 * Run: node scripts/5-write-theme-json.mjs [--dry-run]
 */

import { existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { log, fail } from './lib/log.mjs';
import { PATHS } from './lib/media.mjs';

const dryRun = process.argv.includes('--dry-run');

/* --------------------------------------------------------------------------
   What counts as a media setting
   -------------------------------------------------------------------------- */

/**
 * A value that is a demo media filename.
 *
 * Matching on the VALUE, not on the setting id. The first version of this
 * matched ids against /image|media|video|logo|background/ and it was wrong in
 * both directions: `image_ratio: "portrait"`, `media_position: "end"` and
 * `background: "#F5F4F0"` all matched — a colour is not an image — while a
 * media setting with an unguessable id would have been missed.
 *
 * The value is unambiguous. Manifest filenames are `demo-<something>.webp` or
 * `.mp4`, and nothing else in the theme JSON looks like that. Anything
 * matching is then confirmed against the media map before it is rewritten, so
 * the worst case is a filename that is skipped and reported rather than a
 * setting that is corrupted.
 */
const MEDIA_VALUE = /^demo-[a-z0-9-]+\.(webp|mp4|jpg|jpeg|png)$/i;

/** A value already pointing at Shopify, in any form. */
const ALREADY_SHOPIFY = /^shopify:\/\//;

/**
 * Setting ids that must keep a bare filename, whatever their value looks like.
 *
 * `*_fallback` settings are the second layer of image-fallback.liquid, and
 * that layer resolves them with `fallback | asset_url | image_url` — against
 * the theme's own assets/ directory, not the store's Files. Rewriting one to
 * `shopify://shop_images/...` hands asset_url a URL it cannot resolve, so the
 * fallback silently stops working and every section that depends on it drops
 * to a placeholder SVG.
 *
 * These are exactly the settings that make a freshly installed theme look
 * finished on a store with no products, so breaking them defeats the reason
 * they exist (§6, §11).
 */
const KEEP_BARE = /(^|_)fallback$/i;

/* --------------------------------------------------------------------------
   Media map
   -------------------------------------------------------------------------- */

const mapPath = path.join(PATHS.export, 'media-map.json');

if (!existsSync(mapPath)) {
  fail('demo-store-export/media-map.json is missing.', [
    'It is written by scripts/2-upload-media.mjs, which needs the media',
    'processed by scripts/1-process-media.mjs first.',
    '',
    'Without it there are no references to inject and this script would',
    'rewrite the theme JSON to point at nothing.',
  ]);
}

/** @type {Record<string, {reference: string, url: string}>} */
const mediaMap = JSON.parse(readFileSync(mapPath, 'utf8'));

if (Object.keys(mediaMap).length === 0) {
  fail('media-map.json is empty.', ['Run scripts 1 and 2 first.']);
}

/* --------------------------------------------------------------------------
   Rewrite
   -------------------------------------------------------------------------- */

const rewrites = [];
const unmatched = new Set();

/**
 * Walk a parsed JSON tree and rewrite media settings in place.
 *
 * Mutates rather than rebuilding, which is what preserves key order —
 * JSON.stringify emits keys in insertion order, and an object rebuilt from
 * entries would reorder anything the editor had added.
 *
 * @param {any} node
 * @param {string} trail for the report
 */
function walk(node, trail) {
  if (Array.isArray(node)) {
    node.forEach((item, index) => walk(item, `${trail}[${index}]`));
    return;
  }

  if (!node || typeof node !== 'object') return;

  for (const [key, value] of Object.entries(node)) {
    const here = trail ? `${trail}.${key}` : key;

    if (value && typeof value === 'object') {
      walk(value, here);
      continue;
    }

    if (typeof value !== 'string' || value === '') continue;
    if (ALREADY_SHOPIFY.test(value)) continue;

    // A bare manifest filename, which is how the demo JSON ships before a
    // store exists to resolve it against.
    if (KEEP_BARE.test(key)) continue;

    const filename = path.basename(value);
    if (!MEDIA_VALUE.test(filename)) continue;

    const entry = mediaMap[filename];

    if (!entry) {
      // Not an error. A setting can legitimately name a file that has not been
      // sourced yet, and image-fallback.liquid degrades to a placeholder for
      // exactly this case.
      unmatched.add(`${here} -> ${value}`);
      continue;
    }

    node[key] = entry.reference;
    rewrites.push({ path: here, from: value, to: entry.reference });
  }
}

/* --------------------------------------------------------------------------
   Run
   -------------------------------------------------------------------------- */

log.banner('5 / 5  Write theme JSON');

log.info(`${Object.keys(mediaMap).length} files in the media map`);
if (dryRun) log.warn('Dry run: nothing will be written.');

// Every JSON template, plus settings_data. config/settings_schema.json is
// deliberately excluded — it holds setting *definitions*, not values, and a
// `default` in there is a filename the theme ships with rather than a
// reference to a specific store's file.
const targets = [
  ...readdirSync(path.join(PATHS.root, 'templates'))
    .filter((name) => name.endsWith('.json'))
    .map((name) => path.join('templates', name)),
  ...(existsSync(path.join(PATHS.root, 'templates', 'customers'))
    ? readdirSync(path.join(PATHS.root, 'templates', 'customers'))
        .filter((name) => name.endsWith('.json'))
        .map((name) => path.join('templates', 'customers', name))
    : []),
  path.join('config', 'settings_data.json'),
  path.join('sections', 'header-group.json'),
  path.join('sections', 'footer-group.json'),
];

let filesChanged = 0;

await log.group('Rewriting', async () => {
  for (const relative of targets) {
    const absolute = path.join(PATHS.root, relative);
    if (!existsSync(absolute)) continue;

    const original = readFileSync(absolute, 'utf8');

    // Shopify's JSON templates open with a /* ... */ banner that JSON.parse
    // will not accept. It is preserved byte for byte and put back afterwards.
    const start = original.indexOf('{');
    if (start === -1) continue;

    const preamble = original.slice(0, start);
    const body = original.slice(start);

    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch (error) {
      fail(`${relative} is not valid JSON: ${error.message}`);
    }

    const before = rewrites.length;
    walk(parsed, '');
    const changed = rewrites.length - before;

    if (changed === 0) {
      log.skipped(`${relative} — nothing to change`);
      continue;
    }

    // Two-space indent, trailing newline (§12.6).
    const next = `${preamble}${JSON.stringify(parsed, null, 2)}\n`;

    if (!dryRun) writeFileSync(absolute, next, 'utf8');

    filesChanged += 1;
    log.created(`${relative} — ${changed} reference${changed === 1 ? '' : 's'}`);
  }
});

/* --- Report --------------------------------------------------------------- */

if (rewrites.length > 0) {
  await log.group('References written', async () => {
    rewrites.forEach(({ path: where, from, to }) => log.info(`${where}: ${from} -> ${to}`));
  });
}

if (unmatched.size > 0) {
  log.warn(`${unmatched.size} media settings name a file that is not in the map:`);
  unmatched.forEach((entry) => log.info(`  ${entry}`));
  log.info('');
  log.info('These render through image-fallback.liquid as placeholders, which is');
  log.info('correct behaviour rather than a bug. Source the files, re-run');
  log.info('scripts 1 and 2, then run this again.');
}

log.success(
  `${rewrites.length} references across ${filesChanged} files` + (dryRun ? ' (dry run)' : '.')
);

if (!dryRun && rewrites.length > 0) {
  log.info('');
  log.info('Next: shopify theme push --unpublished, then open the preview and');
  log.info('confirm every section renders imagery rather than a placeholder.');
}
