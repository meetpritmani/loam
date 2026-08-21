/**
 * 2-upload-media.mjs — demo-media/ -> the demo store's Files, then media-map.json
 *
 * This script produces the most valuable artefact in the whole pipeline
 * (§12.3): a map from manifest filename to `shopify://shop_images/<filename>`.
 * That reference form is what lets the shipped theme JSON light up on the
 * buyer's store with zero editor work — Shopify resolves it against the
 * store's own Files **by filename**. Get the filenames right and everything
 * downstream follows.
 *
 * Three calls per batch (§12.3):
 *
 *   1. stagedUploadsCreate  — up to 20 targets at a time
 *   2. POST multipart       — the returned parameters go in BEFORE the file
 *                             field; S3 rejects the request otherwise
 *   3. fileCreate           — with the filename exactly as manifested
 *
 * Then poll. fileCreate answers `UPLOADED` immediately and the CDN URL is null
 * until Shopify has finished processing, so writing the map straight after
 * fileCreate produces a map full of nulls.
 *
 * Run: node scripts/2-upload-media.mjs [--replace]
 *   --replace  delete and re-upload files that already exist
 */

import { existsSync, readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { log, fail, sleep } from './lib/log.mjs';
import { MEDIA_MANIFEST, PATHS, ensureDir } from './lib/media.mjs';
import { graphql, mutate, requireCredentials, verifyShop, STORE } from './lib/shopify.mjs';

const replace = process.argv.includes('--replace');

const BATCH_SIZE = 20;
const POLL_BACKOFF_MS = [1000, 2000, 4000, 8000, 15000];
const POLL_CEILING_MS = 30_000;

/* --------------------------------------------------------------------------
   Queries
   -------------------------------------------------------------------------- */

const EXISTING_FILES = `
  query ExistingFiles($cursor: String) {
    files(first: 250, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        fileStatus
        alt
        ... on MediaImage {
          image { url width height }
        }
        ... on Video {
          originalSource { url }
        }
      }
    }
  }
`;

const STAGED_UPLOADS_CREATE = `
  mutation StagedUploads($input: [StagedUploadInput!]!) {
    stagedUploadsCreate(input: $input) {
      stagedTargets {
        url
        resourceUrl
        parameters { name value }
      }
      userErrors { field message }
    }
  }
`;

const FILE_CREATE = `
  mutation FileCreate($files: [FileCreateInput!]!) {
    fileCreate(files: $files) {
      files {
        id
        fileStatus
        alt
      }
      userErrors { field message code }
    }
  }
`;

const FILE_STATUS = `
  query FileStatus($ids: [ID!]!) {
    nodes(ids: $ids) {
      id
      ... on MediaImage {
        fileStatus
        image { url width height }
      }
      ... on Video {
        fileStatus
        originalSource { url width height }
      }
    }
  }
`;

const FILE_DELETE = `
  mutation FileDelete($ids: [ID!]!) {
    fileDelete(fileIds: $ids) {
      deletedFileIds
      userErrors { field message code }
    }
  }
`;

/* --------------------------------------------------------------------------
   Helpers
   -------------------------------------------------------------------------- */

/**
 * The filename Shopify stored a file under.
 *
 * There is no `filename` field on the File interface, so it has to come out of
 * the CDN URL — and the query string has to go, because Shopify appends
 * `?v=1234567890` to every one of them. A naive basename keeps that suffix and
 * then nothing ever matches the manifest.
 *
 * @param {object} node
 * @returns {string}
 */
function filenameOf(node) {
  const url = node?.image?.url || node?.originalSource?.url || '';
  if (!url) return '';
  try {
    return path.basename(new URL(url).pathname);
  } catch {
    return '';
  }
}

/** @param {string} file @returns {'IMAGE'|'VIDEO'} */
const contentTypeOf = (file) => (file.endsWith('.mp4') ? 'VIDEO' : 'IMAGE');

/** @param {string} file @returns {string} */
const mimeTypeOf = (file) => (file.endsWith('.mp4') ? 'video/mp4' : 'image/webp');

/**
 * Every file already in the store's Files, keyed by filename.
 * @returns {Promise<Map<string, object>>}
 */
async function fetchExistingFiles() {
  const byName = new Map();
  let cursor = null;

  // Paginated rather than a filtered query: `files(query: "filename:x")` is
  // available, but one paged sweep costs far fewer points than 47 filtered
  // lookups and gives an exact picture for the collision check below.
  for (;;) {
    const data = await graphql(EXISTING_FILES, { cursor }, 'files');
    const page = data.files;

    page.nodes.forEach((node) => {
      const name = filenameOf(node);
      if (name) byName.set(name, node);
    });

    if (!page.pageInfo.hasNextPage) break;
    cursor = page.pageInfo.endCursor;
  }

  return byName;
}

/**
 * Upload one batch through a staged target.
 * @param {{file: string, absolutePath: string, alt: string}[]} batch
 * @returns {Promise<{file: string, resourceUrl: string, alt: string}[]>}
 */
async function uploadBatch(batch) {
  const input = batch.map(({ file, absolutePath }) => ({
    filename: file,
    mimeType: mimeTypeOf(file),
    resource: contentTypeOf(file),
    httpMethod: 'POST',
    // Required for VIDEO, harmless for IMAGE, and cheap to always send.
    fileSize: String(statSync(absolutePath).size),
  }));

  const payload = await mutate(STAGED_UPLOADS_CREATE, { input }, 'stagedUploadsCreate');
  const targets = payload.stagedTargets || [];

  if (targets.length !== batch.length) {
    fail(`stagedUploadsCreate returned ${targets.length} targets for ${batch.length} files.`);
  }

  const uploaded = [];

  for (let index = 0; index < batch.length; index += 1) {
    const item = batch[index];
    const target = targets[index];

    const form = new FormData();

    // Order matters and this is the whole reason for the loop. S3 reads its
    // policy fields in order and rejects the request outright if the file
    // field arrives before them — with a 403 whose body explains nothing.
    target.parameters.forEach(({ name, value }) => form.append(name, value));

    const bytes = readFileSync(item.absolutePath);
    form.append('file', new Blob([bytes], { type: mimeTypeOf(item.file) }), item.file);

    const response = await fetch(target.url, { method: 'POST', body: form });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      fail(`${item.file}: staged upload rejected with ${response.status}.`, [
        body.slice(0, 300) || 'No response body.',
      ]);
    }

    log.created(`${item.file} staged`);
    uploaded.push({ file: item.file, resourceUrl: target.resourceUrl, alt: item.alt });
  }

  return uploaded;
}

/**
 * Wait for files to leave UPLOADED and reach READY.
 *
 * §12.3: a file that never reaches READY is a hard failure. Continuing past it
 * writes a media map with a null URL in it, and the theme JSON that references
 * it then renders nothing on a store that looks correctly configured.
 *
 * @param {string[]} ids
 * @returns {Promise<Map<string, object>>} id -> ready node
 */
async function waitForReady(ids) {
  const ready = new Map();
  let pending = [...ids];
  let waited = 0;
  let attempt = 0;

  while (pending.length > 0) {
    const delay = POLL_BACKOFF_MS[Math.min(attempt, POLL_BACKOFF_MS.length - 1)];
    await sleep(delay);
    waited += delay;
    attempt += 1;

    const data = await graphql(FILE_STATUS, { ids: pending }, 'fileStatus');
    const stillPending = [];

    (data.nodes || []).forEach((node) => {
      if (!node) return;

      if (node.fileStatus === 'READY') {
        ready.set(node.id, node);
        return;
      }

      if (node.fileStatus === 'FAILED') {
        fail(`A file failed processing on Shopify's side (${node.id}).`, [
          'Check Content -> Files in the admin. A corrupt source or an',
          'unsupported codec is the usual cause.',
        ]);
      }

      stillPending.push(node.id);
    });

    pending = stillPending;

    if (pending.length > 0 && waited >= POLL_CEILING_MS) {
      fail(`${pending.length} files did not reach READY within ${POLL_CEILING_MS / 1000}s.`, [
        'Stopping rather than writing a media map with null URLs in it.',
        'Check Content -> Files in the admin, then re-run this script — it',
        'skips anything already uploaded.',
      ]);
    }

    if (pending.length > 0) {
      log.info(`${pending.length} still processing (${(waited / 1000).toFixed(0)}s)`);
    }
  }

  return ready;
}

/* --------------------------------------------------------------------------
   Run
   -------------------------------------------------------------------------- */

log.banner('2 / 5  Upload media to Files');

requireCredentials();

if (!existsSync(PATHS.out) || readdirSync(PATHS.out).filter((f) => /\.(webp|mp4)$/.test(f)).length === 0) {
  fail('demo-media/ has no processed media in it.', ['Run: node scripts/1-process-media.mjs']);
}

const shop = await verifyShop();
log.info(`Store: ${shop.name} (${shop.myshopifyDomain})`);

// Only what has actually been processed. A partly populated demo-media/ is
// the normal state while media is still being sourced, and uploading what
// exists is more useful than refusing until all 47 are there.
const onDisk = MEDIA_MANIFEST.filter((entry) => existsSync(path.join(PATHS.out, entry.file)));

if (onDisk.length < MEDIA_MANIFEST.length) {
  log.warn(
    `${MEDIA_MANIFEST.length - onDisk.length} manifest files are not in demo-media/ yet. ` +
      `Uploading the ${onDisk.length} that are.`
  );
}

/* --- Collision check (§12.3) --------------------------------------------- */

// Shopify appends `_1` to a filename that is already taken. A silently
// renamed file breaks every shopify:// reference pointing at it, and nothing
// reports the rename — the image just stops appearing. So: look first.
const existing = await log.group('Checking existing Files', async () => {
  const found = await fetchExistingFiles();
  log.info(`${found.size} files already in the store`);
  return found;
});

const collisions = onDisk.filter((entry) => existing.has(entry.file));
const toUpload = [];

if (collisions.length > 0) {
  if (replace) {
    await log.group(`Replacing ${collisions.length} existing files`, async () => {
      const ids = collisions.map((entry) => existing.get(entry.file).id);
      await mutate(FILE_DELETE, { ids }, 'fileDelete');
      collisions.forEach((entry) => {
        existing.delete(entry.file);
        log.created(`${entry.file} deleted, will re-upload`);
      });
    });
  } else {
    collisions.forEach((entry) => log.skipped(`${entry.file} already uploaded`));
  }
}

onDisk.forEach((entry) => {
  if (existing.has(entry.file)) return;
  toUpload.push({
    file: entry.file,
    absolutePath: path.join(PATHS.out, entry.file),
    alt: entry.subject,
  });
});

/* --- Upload -------------------------------------------------------------- */

const created = [];

if (toUpload.length === 0) {
  log.info('Nothing new to upload.');
} else {
  for (let start = 0; start < toUpload.length; start += BATCH_SIZE) {
    const batch = toUpload.slice(start, start + BATCH_SIZE);
    const batchNumber = Math.floor(start / BATCH_SIZE) + 1;
    const batchCount = Math.ceil(toUpload.length / BATCH_SIZE);

    await log.group(`Batch ${batchNumber} of ${batchCount} (${batch.length} files)`, async () => {
      const staged = await uploadBatch(batch);

      const payload = await mutate(
        FILE_CREATE,
        {
          files: staged.map(({ file, resourceUrl, alt }) => ({
            originalSource: resourceUrl,
            contentType: contentTypeOf(file),
            filename: file,
            alt,
          })),
        },
        'fileCreate'
      );

      const ids = (payload.files || []).map((file) => file.id);
      log.info(`fileCreate accepted ${ids.length}, waiting for READY`);

      const ready = await waitForReady(ids);

      // Matched back by order. fileCreate preserves the order it was given,
      // and the filename is not queryable on the returned node.
      staged.forEach(({ file }, index) => {
        const node = ready.get(ids[index]);
        if (node) created.push({ file, node });
      });

      log.created(`${ready.size} ready`);
    });
  }
}

/* --- Media map (§12.3) --------------------------------------------------- */

const mapPath = path.join(PATHS.export, 'media-map.json');
ensureDir(PATHS.export);

// Merge rather than overwrite, so a partial run adds to the map instead of
// discarding what earlier runs established.
let mediaMap = {};
if (existsSync(mapPath)) {
  try {
    mediaMap = JSON.parse(readFileSync(mapPath, 'utf8'));
  } catch {
    log.warn('media-map.json was unreadable and is being rebuilt from scratch.');
  }
}

const ledgerPath = path.join(PATHS.raw, 'licenses.json');
const ledger = existsSync(ledgerPath) ? JSON.parse(readFileSync(ledgerPath, 'utf8')) : {};

/** @param {string} file @param {object} node */
function record(file, node) {
  const media = node.image || node.originalSource || {};
  mediaMap[file] = {
    gid: node.id,
    url: media.url || null,
    // The reference the theme JSON stores. NOT the CDN url — that is
    // store-specific and breaks the moment the buyer installs (§12.6).
    reference: `shopify://shop_images/${file}`,
    width: media.width || null,
    height: media.height || null,
    license: (ledger[file]?.license || 'BURST').toUpperCase(),
  };
}

created.forEach(({ file, node }) => record(file, node));

// Existing files that were skipped still belong in the map — otherwise a
// second run produces a map covering only what that run happened to upload.
for (const entry of onDisk) {
  if (mediaMap[entry.file]) continue;
  const node = existing.get(entry.file);
  if (node) record(entry.file, node);
}

// Stable key order so the diff stays reviewable (§12.6).
const ordered = {};
MEDIA_MANIFEST.forEach((entry) => {
  if (mediaMap[entry.file]) ordered[entry.file] = mediaMap[entry.file];
});

writeFileSync(mapPath, `${JSON.stringify(ordered, null, 2)}\n`, 'utf8');

const mapped = Object.keys(ordered).length;
log.success(
  `${created.length} uploaded, ${mapped} of ${MEDIA_MANIFEST.length} in media-map.json.`
);

if (mapped < MEDIA_MANIFEST.length) {
  log.warn(`${MEDIA_MANIFEST.length - mapped} manifest files are still unmapped.`);
  process.exitCode = 2;
}
