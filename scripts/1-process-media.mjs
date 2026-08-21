/**
 * 1-process-media.mjs — demo-media-raw/ -> optimised WebP in demo-media/
 *
 * The one step in this pipeline that needs a human first. No script here
 * produces a photograph: images are downloaded by hand from Burst
 * (burst.shopify.com), which has no public API and which §6 forbids scraping.
 *
 * Drop the raw downloads into demo-media-raw/, named for their manifest entry
 * — `demo-hero.jpg`, `demo-product-1.png`, whatever extension they arrived
 * with — and this resizes, crops and encodes them.
 *
 * Also writes the licence ledger. §6 requires a licence recorded per file,
 * because Burst's two licences differ in exactly the way that matters: CC0 can
 * be bundled into a theme we sell, and a Burst-Licence photo cannot.
 *
 * Run: node scripts/1-process-media.mjs [--force]
 *   --force  re-encode files that are already up to date
 */

import { existsSync, readFileSync, writeFileSync, copyFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { log, fail } from './lib/log.mjs';
import { MEDIA_MANIFEST, PATHS, ensureDir, findRaw, processImage, copyVideo } from './lib/media.mjs';

const force = process.argv.includes('--force');

/* --------------------------------------------------------------------------
   Licence ledger
   -------------------------------------------------------------------------- */

const LEDGER_PATH = path.join(PATHS.raw, 'licenses.json');

/**
 * Read the operator's licence declarations.
 *
 * Keyed by output filename:
 *
 *   {
 *     "demo-hero.webp": { "license": "CC0", "source": "https://burst.shopify.com/photos/...", "photographer": "..." }
 *   }
 *
 * A file with no entry is treated as Burst Licence — the restrictive one.
 * Defaulting the other way would let an undeclared photo end up inside a theme
 * zip we sell, which is the one mistake in this whole pipeline with a legal
 * consequence attached.
 *
 * @returns {Record<string, {license: string, source?: string, photographer?: string}>}
 */
function readLedger() {
  if (!existsSync(LEDGER_PATH)) return {};
  try {
    return JSON.parse(readFileSync(LEDGER_PATH, 'utf8'));
  } catch (error) {
    fail(`demo-media-raw/licenses.json is not valid JSON: ${error.message}`, [
      'It maps each output filename to its Burst licence. See the template',
      'this script writes when the file is missing.',
    ]);
  }
}

/** Write a starter ledger so the operator has something to fill in. */
function writeLedgerTemplate(present) {
  const template = {};

  present.forEach((entry) => {
    template[entry.file] = {
      license: 'BURST',
      source: '',
      photographer: '',
    };
  });

  writeFileSync(
    LEDGER_PATH,
    `${JSON.stringify(template, null, 2)}\n`,
    'utf8'
  );

  log.warn('Wrote a licence template to demo-media-raw/licenses.json.');
  log.info('Set "license" to "CC0" only for photos Burst shows as CC0.');
  log.info('Anything left as "BURST" stays demo-store-only and never reaches assets/.');
}

/* --------------------------------------------------------------------------
   Run
   -------------------------------------------------------------------------- */

log.banner('1 / 5  Process media');

if (!existsSync(PATHS.raw)) {
  ensureDir(PATHS.raw);
  fail('demo-media-raw/ was empty, so it has just been created.', [
    'Images cannot be generated. Download them by hand from burst.shopify.com',
    'and drop them in, named for their manifest entry:',
    '',
    '  demo-hero.jpg, demo-product-1.jpg, demo-material-wool.jpg, ...',
    '',
    'Run this script again with the directory populated and it will list',
    'exactly what is still missing. The full manifest is in',
    'scripts/lib/media.mjs and in CLAUDE.md §6.',
  ]);
}

ensureDir(PATHS.out);
ensureDir(PATHS.exportMedia);

// Split the manifest by what is actually on disk before doing any work, so
// the report is complete rather than arriving one missing file at a time.
const present = [];
const missing = [];

MEDIA_MANIFEST.forEach((entry) => {
  const source = findRaw(entry.file, entry.kind);
  if (source) present.push({ ...entry, source });
  else missing.push(entry);
});

log.info(`${present.length} of ${MEDIA_MANIFEST.length} manifest files found in demo-media-raw/`);

const ledger = readLedger();
if (Object.keys(ledger).length === 0 && present.length > 0) {
  writeLedgerTemplate(present);
}

/* --- Process ------------------------------------------------------------- */

const results = [];

await log.group('Encoding', async () => {
  for (const entry of present) {
    const destination = path.join(PATHS.out, entry.file);

    // Skip work already done. Compares mtime rather than hashing: the raw
    // files are large and a full-manifest hash costs more than the encode it
    // would save.
    if (!force && existsSync(destination)) {
      const out = statSync(destination);
      const raw = statSync(entry.source);
      if (out.mtimeMs >= raw.mtimeMs) {
        results.push({ entry, bytes: out.size, skipped: true });
        log.skipped(`${entry.file} up to date`);
        continue;
      }
    }

    try {
      const result =
        entry.kind === 'video'
          ? await copyVideo(entry, entry.source, destination)
          : await processImage(entry, entry.source, destination);

      results.push({ entry, ...result, skipped: false });
      log.created(
        `${entry.file}  ${(result.bytes / 1024).toFixed(0)}KB` +
          (result.quality ? `  q${result.quality}` : '')
      );
    } catch (error) {
      if (error.code === 'ERR_MODULE_NOT_FOUND') {
        fail('sharp is not installed.', ['Run: npm install']);
      }
      fail(`${entry.file}: ${error.message}`, [
        'The raw file may be corrupt, or not an image at all.',
      ]);
    }
  }
});

/* --- Copy into the buyer's export ---------------------------------------- */

// The export package travels with the paid download, so this copy is the
// theme's only redistribution surface — assets/ ships no photography at all.
// Everything is copied and the licence split is reported below rather than
// enforced here: whether a Burst-Licence photo in a buyer's download counts as
// selling it "in any other form" is a judgement call, and it belongs to whoever
// is shipping the product, not to a build script.
await log.group('Copying to demo-store-export/media/', async () => {
  results.forEach(({ entry }) => {
    copyFileSync(path.join(PATHS.out, entry.file), path.join(PATHS.exportMedia, entry.file));
  });
  log.info(`${results.length} files`);
});

/* --- Licence ledger ------------------------------------------------------ */

const cc0 = [];
const burst = [];

results.forEach(({ entry }) => {
  const record = ledger[entry.file];
  const license = (record?.license || 'BURST').toUpperCase();
  (license === 'CC0' ? cc0 : burst).push({ entry, record });
});

/**
 * @param {{entry: object, record: object}[]} rows
 * @returns {string}
 */
function ledgerTable(rows) {
  if (rows.length === 0) return '_None._\n';
  const lines = [
    '| File | Subject | Source | Photographer |',
    '|---|---|---|---|',
    ...rows.map(
      ({ entry, record }) =>
        `| \`${entry.file}\` | ${entry.subject} | ${record?.source || '—'} | ${record?.photographer || '—'} |`
    ),
  ];
  return `${lines.join('\n')}\n`;
}

const licensesMd = `# Demo media licences

Every file here was downloaded by hand from [Burst](https://burst.shopify.com),
Shopify's free stock library. Nothing in this pipeline generates photographs.

Burst ships photos under two licences and the difference matters:

- **CC0** — no redistribution restriction. Safe to bundle inside a theme that
  is sold.
- **Burst Licence** — free commercial use, but the photos may not be sold "as
  digital photo files or in any other form". A paid theme zip is arguably
  exactly that, so these stay on the demo store and in this export package,
  and never inside \`assets/\`.

Neither licence grants a model release. Any photo with an identifiable face
stays demo-store-only whatever its licence says.

## CC0

${ledgerTable(cc0)}
## Burst Licence — demo store only

${ledgerTable(burst)}
---

Generated by \`scripts/1-process-media.mjs\` from
\`demo-media-raw/licenses.json\`. Do not edit by hand.
`;

writeFileSync(path.join(PATHS.out, 'LICENSES.md'), licensesMd, 'utf8');
writeFileSync(path.join(PATHS.export, 'LICENSES.md'), licensesMd, 'utf8');

/* --- Report -------------------------------------------------------------- */

if (missing.length > 0) {
  log.warn(`${missing.length} manifest files are not in demo-media-raw/ yet:`);
  missing.forEach((entry) => {
    const size = entry.kind === 'video' ? 'video' : `${entry.width}x${entry.height}`;
    log.info(`  ${entry.file.padEnd(30)} ${size.padEnd(12)} ${entry.subject}`);
  });
  log.info('');
  log.info('Search burst.shopify.com for the subject, download, and drop the');
  log.info('file into demo-media-raw/ named for its manifest entry.');
}

const undeclared = results.filter(({ entry }) => !ledger[entry.file]);
if (undeclared.length > 0) {
  log.warn(
    `${undeclared.length} files have no licence declared and are being treated ` +
      `as Burst Licence.`
  );
  log.info('Declare them in demo-media-raw/licenses.json.');
}

if (burst.length > 0) {
  log.warn(`${burst.length} Burst-Licence files were copied into demo-store-export/media/.`);
  log.info('That folder ships with the paid download. The Burst Licence allows');
  log.info('free commercial use but not selling the photos "as digital photo');
  log.info('files or in any other form", and a buyer download is arguably that.');
  log.info('');
  log.info('Options, in order of least work: source CC0 replacements for these;');
  log.info('or ship the export package without them and note the gap in its');
  log.info('README; or take the view that supplying them for the buyer to use on');
  log.info('their own store is use rather than resale. Whichever you pick, it is');
  log.info('a decision to make deliberately rather than by default.');
}

log.success(
  `${results.length} processed, ${cc0.length} CC0, ${burst.length} Burst Licence, ` +
    `${missing.length} still missing.`
);

if (missing.length > 0) {
  // Non-zero, so `seed.mjs` and CI both notice. The work that could be done
  // has been done and written out; this is a "not finished" rather than a
  // "broken".
  process.exitCode = 2;
}
