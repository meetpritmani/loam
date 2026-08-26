/**
 * media.mjs — the media manifest and the sharp pipeline.
 *
 * Filenames are a contract (§6). They are referenced by `fallback:` params in
 * Liquid, by `shopify://shop_images/<filename>` in the shipped theme JSON, and
 * by the buyer's export package. Renaming one silently breaks all three, and
 * nothing fails loudly when it happens — the image just stops appearing.
 *
 * So: do not rename, do not pluralise, do not add a hash.
 *
 * On sourcing (§6, decided 2026-08-26): demo photography may be AI-generated
 * or downloaded by hand from Burst (burst.shopify.com), per file. Prompts,
 * house style and tiering for the generated path live in
 * demo-media-raw/PROMPTS.md. Burst has no public API and §6 forbids scraping
 * it either way. This module only resizes what is already in demo-media-raw/
 * — it does not care which path a given file took to get there.
 *
 * On licensing (§6): every file declares one of three licences.
 *
 *   CC0            — Burst only. No redistribution restriction.
 *   Burst Licence  — Burst only. Free commercial use, but the photos may not
 *                    be sold "as digital photo files or in any other form".
 *   AI-GENERATED   — store-only by default. Record the generating model/tool;
 *                    only mark bundle-eligible after checking that tool's own
 *                    terms for the plan actually used.
 *
 * None of the three grants a release for a real person's likeness, so
 * anything with an identifiable (or closely resembling) face is demo-store-
 * only whatever its licence says. That covers all four avatars.
 *
 * **No photography ships inside the theme.** That is a product decision, not
 * an oversight: assets/ stays free of stock imagery, so the ZIP carries no
 * third-party licence and there is nothing for a buyer to strip out. It also
 * makes the CC0 distinction moot for the theme itself — it now matters only
 * for demo-store-export/, which does travel with the download, and which
 * 1-process-media.mjs warns about per file.
 */

import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { log } from './log.mjs';

/* --------------------------------------------------------------------------
   Manifest (§6)
   -------------------------------------------------------------------------- */

/**
 * @typedef {object} MediaEntry
 * @property {string} file      output filename — the contract
 * @property {number} [width]   target width, images only
 * @property {number} [height]  target height, images only
 * @property {'image'|'video'} kind
 * @property {string} subject   what to look for on Burst
 * @property {string} [search]  Burst search terms, when the subject describes a
 *                              relationship ("the same scene") rather than a
 *                              thing anyone could search for
 */

const product = (n) => [
  {
    file: `demo-product-${n}.webp`,
    width: 1200,
    height: 1500,
    kind: 'image',
    subject: `Studio shoe shot ${n}, neutral ground`,
    search: 'sneakers plain background',
  },
  {
    file: `demo-product-${n}-alt.webp`,
    width: 1200,
    height: 1500,
    kind: 'image',
    subject: `On-foot or lifestyle angle of shoe ${n}`,
    search: 'wearing sneakers outdoors',
  },
];

/** @type {MediaEntry[]} */
export const MEDIA_MANIFEST = [
  // Hero. The only above-the-fold media, and the LCP on the homepage.
  {
    file: 'demo-hero.webp',
    width: 2400,
    height: 1350,
    kind: 'image',
    subject: 'Person walking a coastal trail in sneakers, wide',
  },
  {
    file: 'demo-hero-mobile.webp',
    width: 1200,
    height: 1600,
    kind: 'image',
    subject: 'Portrait crop of the same scene',
    search: 'coastal trail walking shoes',
  },
  {
    file: 'demo-hero-poster.webp',
    width: 1920,
    height: 1080,
    kind: 'image',
    subject: 'Poster frame matching the hero video',
    search: 'coastal trail walking shoes',
  },
  {
    file: 'demo-hero.mp4',
    kind: 'video',
    subject: 'Same coastal scene, 8s loop, no audio, 4MB ceiling',
    search: 'coastal trail walking',
  },

  ...product(1),
  ...product(2),
  ...product(3),
  ...product(4),
  ...product(5),
  ...product(6),
  ...product(7),
  ...product(8),

  {
    file: 'demo-material-wool.webp',
    width: 1600,
    height: 2000,
    kind: 'image',
    subject: 'Merino wool macro',
  },
  {
    file: 'demo-material-tree.webp',
    width: 1600,
    height: 2000,
    kind: 'image',
    subject: 'Eucalyptus fibre macro',
    search: 'eucalyptus leaves texture',
  },
  {
    file: 'demo-material-foam.webp',
    width: 1600,
    height: 2000,
    kind: 'image',
    subject: 'Sugarcane foam sole macro',
    search: 'shoe sole close up',
  },

  {
    file: 'demo-collection-mens.webp',
    width: 1200,
    height: 1500,
    kind: 'image',
    subject: "Men's category lifestyle",
  },
  {
    file: 'demo-collection-womens.webp',
    width: 1200,
    height: 1500,
    kind: 'image',
    subject: "Women's category lifestyle",
  },
  {
    file: 'demo-collection-active.webp',
    width: 1200,
    height: 1500,
    kind: 'image',
    subject: 'Active category lifestyle',
  },
  {
    file: 'demo-collection-lounge.webp',
    width: 1200,
    height: 1500,
    kind: 'image',
    subject: 'Lounge category lifestyle',
  },

  // §6 gives the lookbook as "mixed", which is not a size a script can act
  // on. These are the concrete crops the collage's tall and wide spans need:
  // two portrait, two landscape, one square. The section reserves its own
  // aspect boxes, so these ratios decide how much of each photo survives the
  // crop rather than how the grid lays out.
  { file: 'demo-lookbook-1.webp', width: 1200, height: 1600, kind: 'image', subject: 'Editorial, portrait' },
  { file: 'demo-lookbook-2.webp', width: 1600, height: 1067, kind: 'image', subject: 'Editorial, landscape' },
  { file: 'demo-lookbook-3.webp', width: 1200, height: 1200, kind: 'image', subject: 'Editorial, square detail' },
  { file: 'demo-lookbook-4.webp', width: 1200, height: 1600, kind: 'image', subject: 'Editorial, portrait' },
  { file: 'demo-lookbook-5.webp', width: 1600, height: 1067, kind: 'image', subject: 'Editorial, landscape' },

  // Faces. Burst grants no model release, so these are the files with the
  // sharpest restriction: demo store and screenshots only.
  { file: 'demo-avatar-1.webp', width: 200, height: 200, kind: 'image', subject: 'Review portrait' },
  { file: 'demo-avatar-2.webp', width: 200, height: 200, kind: 'image', subject: 'Review portrait' },
  { file: 'demo-avatar-3.webp', width: 200, height: 200, kind: 'image', subject: 'Review portrait' },
  { file: 'demo-avatar-4.webp', width: 200, height: 200, kind: 'image', subject: 'Review portrait' },

  {
    file: 'demo-mega-feature.webp',
    width: 800,
    height: 1000,
    kind: 'image',
    subject: 'Nav feature card',
  },

  { file: 'demo-ugc-1.webp', width: 1080, height: 1080, kind: 'image', subject: 'Social grid' },
  { file: 'demo-ugc-2.webp', width: 1080, height: 1080, kind: 'image', subject: 'Social grid' },
  { file: 'demo-ugc-3.webp', width: 1080, height: 1080, kind: 'image', subject: 'Social grid' },
  { file: 'demo-ugc-4.webp', width: 1080, height: 1080, kind: 'image', subject: 'Social grid' },
  { file: 'demo-ugc-5.webp', width: 1080, height: 1080, kind: 'image', subject: 'Social grid' },
  { file: 'demo-ugc-6.webp', width: 1080, height: 1080, kind: 'image', subject: 'Social grid' },

  { file: 'demo-article-1.webp', width: 1600, height: 1000, kind: 'image', subject: 'Blog header' },
  { file: 'demo-article-2.webp', width: 1600, height: 1000, kind: 'image', subject: 'Blog header' },
  { file: 'demo-article-3.webp', width: 1600, height: 1000, kind: 'image', subject: 'Blog header' },

  {
    file: 'demo-brand-film.mp4',
    kind: 'video',
    subject: 'Workshop or craft footage, 4MB ceiling',
    search: 'workshop craft making',
  },
];

/* --------------------------------------------------------------------------
   Sourcing order
   -------------------------------------------------------------------------- */

/**
 * The subset that makes the homepage and the first product row look finished.
 *
 * Seventeen files rather than forty-seven. Sourcing photography is the slowest
 * part of this whole build and it is entirely manual, so it is worth being
 * able to run the pipeline end to end — and see a real seeded store — before
 * committing to the lookbook, the social grid and the blog headers.
 *
 * Products 1 to 4 with their hover pairs, because `card-product` reads
 * `media[1]` for the hover swap and a product with one image loses it
 * silently. All four collection tiles, because a collection-list row with one
 * missing tile looks broken in a way a row of placeholders does not.
 */
export const TIER_ONE = new Set([
  'demo-hero.webp',
  'demo-hero-mobile.webp',
  'demo-product-1.webp',
  'demo-product-1-alt.webp',
  'demo-product-2.webp',
  'demo-product-2-alt.webp',
  'demo-product-3.webp',
  'demo-product-3-alt.webp',
  'demo-product-4.webp',
  'demo-product-4-alt.webp',
  'demo-material-wool.webp',
  'demo-material-tree.webp',
  'demo-material-foam.webp',
  'demo-collection-mens.webp',
  'demo-collection-womens.webp',
  'demo-collection-active.webp',
  'demo-collection-lounge.webp',
]);

/**
 * A Burst search URL for a manifest entry's subject.
 *
 * Deep-links the search rather than the site root. Burst has no API to query,
 * but its search page takes a `q`, so this is the closest thing to automating
 * a step that cannot be automated.
 *
 * @param {MediaEntry} entry
 * @returns {string}
 */
export function burstSearchUrl(entry) {
  // An explicit override wins. Several subjects describe a relationship to
  // another file — "portrait crop of the same scene" — which is meaningful in
  // the manifest and useless as a search.
  if (entry.search) {
    return `https://burst.shopify.com/photos/search?q=${encodeURIComponent(entry.search)}`;
  }

  const terms = entry.subject
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !['the', 'and', 'for', 'same', 'with'].includes(word))
    .slice(0, 4)
    .join(' ');

  return `https://burst.shopify.com/photos/search?q=${encodeURIComponent(terms)}`;
}

/* --------------------------------------------------------------------------
   Paths
   -------------------------------------------------------------------------- */

// fileURLToPath rather than URL.pathname: the latter percent-encodes the
// space in this repo's own path and every join below then points nowhere.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const PATHS = {
  root,
  raw: path.join(root, 'demo-media-raw'),
  out: path.join(root, 'demo-media'),
  export: path.join(root, 'demo-store-export'),
  exportMedia: path.join(root, 'demo-store-export', 'media'),
  assets: path.join(root, 'assets'),
};

/** @param {string} dir */
export function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

/* --------------------------------------------------------------------------
   Processing
   -------------------------------------------------------------------------- */

/** §6: assert under 200KB, stepping quality down before giving up. */
const SIZE_CEILING = 200 * 1024;
const QUALITY_LADDER = [78, 70, 62];

/** Video ceiling from the manifest table. */
export const VIDEO_CEILING = 4 * 1024 * 1024;

/** Extensions accepted as a source, per output kind. */
const SOURCE_EXTENSIONS = {
  // .jfif is plain JPEG data under a different extension — Windows/Edge names
  // downloaded JPEGs that way. sharp reads it fine; it just has to be on this
  // list or findRaw() below never sees the file.
  image: ['.jpg', '.jpeg', '.jfif', '.png', '.webp', '.tif', '.tiff', '.avif'],
  video: ['.mp4', '.mov', '.m4v', '.webm'],
};

/**
 * Find the raw file for a manifest entry, whatever extension it arrived with.
 *
 * Burst hands out .jpg mostly, but a download might be .jpeg, .jfif, .png or
 * already .webp. Matching on the basename lets the operator drop files in
 * without renaming extensions.
 *
 * The `kind` filter is not cosmetic. `demo-hero.webp` and `demo-hero.mp4` are
 * two different manifest entries with the same basename, so matching on the
 * basename alone made a single `demo-hero.png` satisfy both — and the video
 * branch then copied that PNG to `demo-hero.mp4`, producing a file with a
 * video extension, a video MIME type on upload, and a PNG inside it.
 *
 * @param {string} outputFile e.g. 'demo-hero.webp'
 * @param {'image'|'video'} kind
 * @returns {string|null} absolute path, or null when nothing matches
 */
export function findRaw(outputFile, kind) {
  if (!existsSync(PATHS.raw)) return null;

  const base = outputFile.replace(/\.(webp|mp4)$/, '').toLowerCase();
  const allowed = SOURCE_EXTENSIONS[kind] || SOURCE_EXTENSIONS.image;

  const candidates = readdirSync(PATHS.raw).filter((name) => {
    const extension = path.extname(name).toLowerCase();
    if (!allowed.includes(extension)) return false;
    return path.basename(name, path.extname(name)).toLowerCase() === base;
  });

  if (candidates.length === 0) return null;
  return path.join(PATHS.raw, candidates[0]);
}

/**
 * Resize, crop and encode one image, stepping quality down until it fits.
 *
 * `fit: 'cover'` with `position: 'attention'` (§6): sharp picks the crop
 * window around the highest-entropy region, which for a product shot is the
 * product. A centre crop on a photograph composed for something else takes the
 * shoe's heel off.
 *
 * @param {MediaEntry} entry
 * @param {string} source absolute path to the raw file
 * @param {string} destination absolute path to write
 * @returns {Promise<{bytes: number, quality: number, width: number, height: number}>}
 */
export async function processImage(entry, source, destination) {
  // Imported lazily so a run that only needs to *report* what is missing does
  // not require sharp to be installed at all.
  const { default: sharp } = await import('sharp');

  let last = null;

  for (const quality of QUALITY_LADDER) {
    const buffer = await sharp(source)
      .rotate() // honour EXIF orientation before cropping, or portraits crop sideways
      .resize({
        width: entry.width,
        height: entry.height,
        fit: 'cover',
        position: 'attention',
        withoutEnlargement: false,
      })
      .webp({ quality, effort: 6 })
      .toBuffer();

    last = { buffer, quality };
    if (buffer.length <= SIZE_CEILING) break;
  }

  const { writeFileSync } = await import('node:fs');
  writeFileSync(destination, last.buffer);

  if (last.buffer.length > SIZE_CEILING) {
    // Not fatal. A 210KB hero is worth shipping; a silent 900KB one is not,
    // and the operator is the one who can decide to re-crop the source.
    log.warn(
      `${entry.file} is ${(last.buffer.length / 1024).toFixed(0)}KB at quality ${last.quality}, ` +
        `over the 200KB ceiling. Consider a tighter source crop.`
    );
  }

  return {
    bytes: last.buffer.length,
    quality: last.quality,
    width: entry.width,
    height: entry.height,
  };
}

/**
 * Videos are copied, not transcoded.
 *
 * Transcoding would mean ffmpeg, which is a system dependency this repo does
 * not otherwise have and cannot install for the operator. The manifest states
 * the ceiling; this checks it and says so.
 *
 * @param {MediaEntry} entry
 * @param {string} source
 * @param {string} destination
 * @returns {Promise<{bytes: number}>}
 */
export async function copyVideo(entry, source, destination) {
  const { copyFileSync } = await import('node:fs');
  copyFileSync(source, destination);

  const { size } = statSync(destination);

  if (size > VIDEO_CEILING) {
    log.warn(
      `${entry.file} is ${(size / 1024 / 1024).toFixed(1)}MB, over the 4MB ceiling. ` +
        `Re-encode it before shipping — it is above the fold on the homepage.`
    );
  }

  return { bytes: size };
}
