/**
 * seed-log.mjs — a record of what the scripts created, and where.
 *
 * §12.8: "Log every created resource to demo-store-export/seed-log.json with
 * handle and GID, so reruns diff rather than duplicate."
 *
 * The scripts do not read this back to decide what to skip — they ask Shopify,
 * because the store is the truth and a log can be stale or deleted. What it is
 * for is the human question that comes up on the second run and every run
 * after: *what did this actually make last time, and is it still there?*
 *
 * Keyed by `type:handle` so a re-run overwrites its own entry rather than
 * appending a second one for the same resource.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PATHS, ensureDir } from './media.mjs';
import { STORE } from './shopify.mjs';

const LOG_PATH = path.join(PATHS.export, 'seed-log.json');

/** @returns {{store: string, updatedAt: string, resources: Record<string, object>}} */
function read() {
  if (!existsSync(LOG_PATH)) {
    return { store: STORE, updatedAt: '', resources: {} };
  }

  try {
    const parsed = JSON.parse(readFileSync(LOG_PATH, 'utf8'));
    // A log from a different store is worse than no log — the GIDs in it point
    // at resources that do not exist here.
    if (parsed.store && parsed.store !== STORE) {
      return { store: STORE, updatedAt: '', resources: {} };
    }
    return { store: STORE, updatedAt: parsed.updatedAt || '', resources: parsed.resources || {} };
  } catch {
    return { store: STORE, updatedAt: '', resources: {} };
  }
}

/**
 * Record one created resource.
 *
 * Written on every call rather than buffered to the end: a run that dies at
 * product six should leave a log of the five that exist, which is precisely
 * when the log is worth having.
 *
 * @param {string} type e.g. 'product', 'collection', 'page', 'article', 'menu'
 * @param {string} handle
 * @param {string} gid
 */
export function appendLog(type, handle, gid) {
  const state = read();

  state.resources[`${type}:${handle}`] = {
    type,
    handle,
    gid,
    seededAt: new Date().toISOString(),
  };
  state.updatedAt = new Date().toISOString();

  ensureDir(PATHS.export);
  writeFileSync(LOG_PATH, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

/**
 * Everything recorded, for the summary at the end of a full run.
 * @returns {object[]}
 */
export function readLog() {
  return Object.values(read().resources);
}
