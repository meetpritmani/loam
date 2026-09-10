/**
 * seed.mjs — run 1 through 5.
 *
 * Each step is a separate process. That is deliberate: a step that dies takes
 * its own process down and leaves the ones before it intact, and `--from=N`
 * resumes without re-running work that already succeeded. Importing them into
 * one process would make a failure in step 4 look like a failure of the whole
 * run.
 *
 * Run: node scripts/seed.mjs [--from=N] [--offline] [--dry-run] [--reset]
 *
 *   --from=N   start at step N (1-5)
 *   --offline  do everything that does not need a store: process whatever
 *              media is on disk and write the buyer's export package. Steps 2
 *              and 5 are skipped, since both genuinely require one.
 *   --dry-run  pass through to every step. Steps 2-4 read the store for real
 *              (so "would create" vs. "would update" is accurate) but send
 *              no mutation — every write logs what it would have sent
 *              instead. Step 5 writes nothing to the theme JSON either.
 *              Nothing in this pipeline is destructive without --reset, but
 *              --dry-run is still the way to see what a real run would do
 *              before it does it — see REMAINING-WORK.md R1.
 *   --reset    delete the seeded resources first. Refuses to run against a
 *              store whose domain does not look disposable (§12.8).
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { log, fail } from './lib/log.mjs';
import { readLog } from './lib/seed-log.mjs';
import { STORE, isDisposableStore, verifyShop, requireCredentials } from './lib/shopify.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * `offlineCapable` is not the same as `needsStore`.
 *
 * Steps 3 and 4 need a store to seed one, but the export files they write come
 * entirely from demo-data.mjs — so they have an --offline mode that produces
 * the buyer's package and contacts nothing. Step 5 needs media-map.json, which
 * only exists once step 2 has run, so it has no offline equivalent.
 */
const STEPS = [
  { number: 1, file: '1-process-media.mjs', name: 'Process media', offlineCapable: true },
  { number: 2, file: '2-upload-media.mjs', name: 'Upload media', offlineCapable: false },
  { number: 3, file: '3-seed-catalog.mjs', name: 'Seed catalog', offlineCapable: true },
  { number: 4, file: '4-seed-content.mjs', name: 'Seed content', offlineCapable: true },
  { number: 5, file: '5-write-theme-json.mjs', name: 'Write theme JSON', offlineCapable: false },
];

/* --------------------------------------------------------------------------
   Arguments
   -------------------------------------------------------------------------- */

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const reset = args.includes('--reset');
const offline = args.includes('--offline');

const fromArg = args.find((arg) => arg.startsWith('--from='));
const from = fromArg ? Number(fromArg.split('=')[1]) : 1;

if (!Number.isInteger(from) || from < 1 || from > STEPS.length) {
  fail(`--from must be between 1 and ${STEPS.length}.`);
}

/* --------------------------------------------------------------------------
   Reset guard (§12.8)
   -------------------------------------------------------------------------- */

if (reset) {
  requireCredentials();

  const shop = await verifyShop();

  // The guard is on the store, not on a confirmation prompt. A prompt is
  // answered by whoever is already convinced they are on the right store;
  // the domain is a fact.
  if (!isDisposableStore(shop)) {
    fail(`Refusing to reset ${shop.myshopifyDomain}.`, [
      '--reset only runs against a store whose domain contains demo, dev,',
      'test, staging or sandbox, or a partner development store.',
      '',
      `This one is "${shop.myshopifyDomain}" on the ${shop.plan?.displayName} plan.`,
      'If that really is the demo store, rename it or delete the resources by',
      'hand — this guard is not worth weakening.',
    ]);
  }

  const seeded = readLog();
  log.banner('Reset');
  log.warn(`${shop.name} (${shop.myshopifyDomain})`);
  log.info(`${seeded.length} resources recorded in seed-log.json.`);
  log.info('');
  log.error('Reset is not implemented yet.');
  log.info('Deleting products, collections, pages, articles and menus is a');
  log.info('handful more mutations, but it is the one part of this pipeline');
  log.info('that cannot be tested without a store to destroy. It stays');
  log.info('unimplemented rather than shipped untested — see PROGRESS.md.');
  log.info('');
  log.info('The scripts are idempotent, so a re-run does not need a reset.');
  process.exit(1);
}

/* --------------------------------------------------------------------------
   Run
   -------------------------------------------------------------------------- */

/**
 * @param {{file: string, name: string, number: number}} step
 * @returns {Promise<number>} exit code
 */
function runStep(step) {
  const flags = [];
  if (dryRun) flags.push('--dry-run');
  if (offline) flags.push('--offline');

  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(here, step.file), ...flags], {
      stdio: 'inherit',
    });
    child.on('close', (code) => resolve(code ?? 1));
  });
}

log.banner(offline ? 'Building the buyer export (offline)' : `Seeding ${STORE || '(no store configured)'}`);
log.info(`Steps ${from} to ${STEPS.length}${dryRun ? ', dry run' : ''}`);

if (offline) {
  log.info('Offline: no store is contacted. Steps 2 and 5 are skipped.');
}

const results = [];

for (const step of STEPS) {
  if (step.number < from) {
    results.push({ step, code: null });
    continue;
  }

  if (offline && !step.offlineCapable) {
    results.push({ step, code: null, reason: 'needs a store' });
    continue;
  }

  const code = await runStep(step);
  results.push({ step, code });

  // Exit code 2 means "did what it could, something is still missing" — the
  // normal state while media is being sourced by hand. Anything else is a
  // real failure and continuing would build on top of it.
  if (code !== 0 && code !== 2) {
    log.error(`Step ${step.number} (${step.name}) failed with exit code ${code}.`);
    log.info(`Fix it, then resume with: node scripts/seed.mjs --from=${step.number}`);
    process.exit(code);
  }
}

/* --- Summary -------------------------------------------------------------- */

log.banner('Summary');

results.forEach(({ step, code, reason }) => {
  if (code === null) log.skipped(`${step.number}. ${step.name} — skipped, ${reason || `--from=${from}`}`);
  else if (code === 0) log.created(`${step.number}. ${step.name}`);
  else log.warn(`${step.number}. ${step.name} — incomplete, see above`);
});

const seeded = readLog();
if (seeded.length > 0) {
  const byType = seeded.reduce((counts, item) => {
    counts[item.type] = (counts[item.type] || 0) + 1;
    return counts;
  }, {});
  log.info('');
  log.info(
    `seed-log.json: ${Object.entries(byType)
      .map(([type, count]) => `${count} ${type}`)
      .join(', ')}`
  );
}

const incomplete = results.some(({ code }) => code === 2);

if (incomplete) {
  log.warn('Finished, with work outstanding. See the warnings above.');
  process.exitCode = 2;
} else if (offline) {
  log.success('Buyer export written. Nothing was sent to a store.');
  log.info('Remaining, both of which need a store: uploading the media (step 2)');
  log.info('and injecting shopify:// references into the theme JSON (step 5).');
} else {
  log.success('Seeding complete.');
  log.info('Next: shopify theme push --unpublished, then open the preview.');
}
