/**
 * shopify.mjs — the Admin GraphQL client.
 *
 * Three things here are not optional, and all three come from §12.8.
 *
 * 1. Cost-aware throttling. Shopify's GraphQL API is a leaky bucket: 1000
 *    points on a standard plan, refilling at 50/s. Every response reports the
 *    bucket state in `extensions.cost.throttleStatus`. Reading it and waiting
 *    when the bucket runs low is the difference between a seeding run that
 *    completes and one that fires eight mutations in parallel and gets half
 *    of them rejected.
 *
 * 2. Retry on THROTTLED and 5xx, with exponential backoff.
 *
 * 3. userErrors checked on every mutation. This is the one that bites people.
 *    Shopify returns **HTTP 200 with the errors in the body** — a script that
 *    checks only `response.ok` will report a successful run having created
 *    absolutely nothing. `mutate()` below cannot be called without the
 *    userErrors path running.
 */

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { log, fail, sleep } from './log.mjs';

/* --------------------------------------------------------------------------
   Environment
   -------------------------------------------------------------------------- */

/**
 * Minimal .env reader. A dependency for this would be one more thing between
 * the operator and a working run, and the format we need is four lines of
 * KEY=value.
 * @param {string} path
 */
function loadEnvFile(path) {
  if (!existsSync(path)) return;

  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const equals = line.indexOf('=');
    if (equals === -1) continue;

    const key = line.slice(0, equals).trim();
    // Quotes are stripped so a pasted value with them still works.
    const value = line
      .slice(equals + 1)
      .trim()
      .replace(/^["']|["']$/g, '');

    // A real environment variable always wins over the file, so CI can
    // override without editing anything.
    if (!(key in process.env)) process.env[key] = value;
  }
}

// fileURLToPath, not URL.pathname: on Windows the latter returns
// "/D:/Shopify%20local%20setup/.env" — a leading slash and percent-encoded
// spaces — and existsSync then quietly reports the file missing.
loadEnvFile(fileURLToPath(new URL('../../.env', import.meta.url)));

export const STORE = process.env.SHOPIFY_STORE || '';
export const API_VERSION = process.env.SHOPIFY_API_VERSION || '2026-07';
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN || '';

/**
 * Stop before the first request if the run cannot possibly work.
 *
 * Checked up front rather than on first use: a missing token that surfaces
 * halfway through catalogue seeding leaves a store with four of eight
 * products in it.
 */
export function requireCredentials() {
  const missing = [];
  if (!STORE) missing.push('SHOPIFY_STORE');
  if (!TOKEN) missing.push('SHOPIFY_ADMIN_TOKEN');

  if (missing.length > 0) {
    fail(`Missing ${missing.join(' and ')}.`, [
      'Copy .env.example to .env and fill it in.',
      'The token comes from the demo store: Settings -> Apps and sales',
      'channels -> Develop apps -> Create an app. Scopes are listed in',
      '.env.example and in CLAUDE.md §12.1.',
    ]);
  }

  if (!/^shpat_/.test(TOKEN)) {
    fail('SHOPIFY_ADMIN_TOKEN does not look like an Admin API token.', [
      'Admin API access tokens begin with shpat_.',
      'The Storefront API token (shpsa_) and the API key are different things',
      'and will not work here.',
    ]);
  }

  if (!/^\d{4}-\d{2}$/.test(API_VERSION)) {
    fail(`SHOPIFY_API_VERSION "${API_VERSION}" is not a version string.`, [
      'Use a dated stable version such as 2026-07. Never "unstable".',
    ]);
  }
}

const endpoint = () => `https://${STORE}/admin/api/${API_VERSION}/graphql.json`;

/* --------------------------------------------------------------------------
   Throttle
   -------------------------------------------------------------------------- */

/** Wait when the bucket drops below this many points. */
const THROTTLE_FLOOR = 100;

/** Never sleep longer than this in one go, so a stall is visible. */
const MAX_THROTTLE_WAIT_MS = 20_000;

let bucket = { currentlyAvailable: 1000, restoreRate: 50, maximumAvailable: 1000 };

/**
 * @param {object|undefined} cost `extensions.cost` from a response
 */
function recordCost(cost) {
  const status = cost?.throttleStatus;
  if (!status) return;
  bucket = {
    currentlyAvailable: status.currentlyAvailable ?? bucket.currentlyAvailable,
    restoreRate: status.restoreRate || bucket.restoreRate,
    maximumAvailable: status.maximumAvailable || bucket.maximumAvailable,
  };
}

/**
 * Sleep until the bucket has refilled past the floor.
 *
 * Waiting on the *reported* balance rather than on a fixed delay between
 * calls means a run costs only as much time as the queries actually cost —
 * a cheap query never pays for an expensive one's recovery.
 */
async function waitForBucket() {
  if (bucket.currentlyAvailable >= THROTTLE_FLOOR) return;

  const deficit = THROTTLE_FLOOR - bucket.currentlyAvailable;
  const waitMs = Math.min(Math.ceil((deficit / bucket.restoreRate) * 1000) + 250, MAX_THROTTLE_WAIT_MS);

  log.info(`Rate limit: ${bucket.currentlyAvailable} points left, waiting ${waitMs}ms`);
  await sleep(waitMs);

  // Assume the refill happened. The next response corrects this either way.
  bucket.currentlyAvailable = Math.min(
    bucket.maximumAvailable,
    bucket.currentlyAvailable + (waitMs / 1000) * bucket.restoreRate
  );
}

/* --------------------------------------------------------------------------
   Request
   -------------------------------------------------------------------------- */

const MAX_ATTEMPTS = 5;

/**
 * One GraphQL request, with throttle handling and retry.
 *
 * @param {string} query
 * @param {object} [variables]
 * @param {string} [label] shown in errors, so a failure names the operation
 * @returns {Promise<object>} the `data` object
 */
export async function graphql(query, variables = {}, label = 'query') {
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    await waitForBucket();

    let response;
    try {
      response = await fetch(endpoint(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': TOKEN,
          Accept: 'application/json',
        },
        body: JSON.stringify({ query, variables }),
      });
    } catch (error) {
      // Network-level failure: no response to inspect, so retry blind.
      lastError = error;
      const backoff = 2 ** attempt * 250;
      log.warn(`${label}: network error (${error.message}), retry ${attempt}/${MAX_ATTEMPTS} in ${backoff}ms`);
      await sleep(backoff);
      continue;
    }

    // 401/403 are not worth retrying — the token or its scopes are wrong and
    // four more attempts will not change that.
    if (response.status === 401 || response.status === 403) {
      fail(`${label}: ${response.status} from Shopify. The token was rejected.`, [
        'Check SHOPIFY_ADMIN_TOKEN, and that the app has the scopes listed in',
        '.env.example. Scope changes require reinstalling the app.',
      ]);
    }

    if (response.status === 404) {
      fail(`${label}: 404 from ${endpoint()}.`, [
        `Check SHOPIFY_STORE ("${STORE}") and SHOPIFY_API_VERSION ("${API_VERSION}").`,
        'An API version past its end-of-life date does not resolve.',
      ]);
    }

    if (response.status >= 500) {
      const backoff = 2 ** attempt * 500;
      log.warn(`${label}: ${response.status} from Shopify, retry ${attempt}/${MAX_ATTEMPTS} in ${backoff}ms`);
      await sleep(backoff);
      continue;
    }

    let body;
    try {
      body = await response.json();
    } catch (error) {
      lastError = error;
      log.warn(`${label}: response was not JSON, retry ${attempt}/${MAX_ATTEMPTS}`);
      await sleep(2 ** attempt * 250);
      continue;
    }

    recordCost(body.extensions?.cost);

    // Top-level GraphQL errors. THROTTLED is retryable; the rest are bugs in
    // the query and will fail identically every time.
    if (Array.isArray(body.errors) && body.errors.length > 0) {
      const throttled = body.errors.some((e) => e?.extensions?.code === 'THROTTLED');

      if (throttled) {
        // A THROTTLED response still reports the bucket, so this waits on the
        // real number rather than on a guess.
        bucket.currentlyAvailable = 0;
        log.warn(`${label}: throttled, retry ${attempt}/${MAX_ATTEMPTS}`);
        continue;
      }

      fail(`${label}: GraphQL error`, body.errors.map((e) => `  ${e.message}`));
    }

    if (!body.data) {
      fail(`${label}: response contained no data.`, [JSON.stringify(body).slice(0, 400)]);
    }

    return body.data;
  }

  fail(`${label}: gave up after ${MAX_ATTEMPTS} attempts.`, [
    lastError ? `Last error: ${lastError.message}` : 'Last failure was a throttle or a 5xx.',
  ]);
}

/**
 * A mutation, with its userErrors checked.
 *
 * This is the whole reason `graphql` is not called directly for writes.
 * Shopify answers a failed mutation with HTTP 200 and the reason inside
 * `data.<root>.userErrors`. Checking only the status code produces a script
 * that reports a clean run and created nothing at all.
 *
 * @param {string} query
 * @param {object} variables
 * @param {string} root the mutation's field name, e.g. 'productSet'
 * @param {object} [options]
 * @param {string[]} [options.tolerate] error codes to treat as success
 * @returns {Promise<object>} the mutation's payload, minus userErrors
 */
export async function mutate(query, variables, root, options = {}) {
  const data = await graphql(query, variables, root);
  const payload = data?.[root];

  if (!payload) {
    fail(`${root}: mutation returned no payload.`, [
      'The mutation name and the `root` argument must match.',
    ]);
  }

  const errors = payload.userErrors || payload.mediaUserErrors || [];

  if (errors.length > 0) {
    const tolerated = options.tolerate || [];
    const real = errors.filter((error) => !tolerated.includes(error.code));

    if (real.length === 0) {
      // Every error was one the caller expects — "already exists", usually,
      // which is what makes a second run a no-op rather than a failure.
      return payload;
    }

    fail(
      `${root}: rejected by Shopify`,
      real.map((error) => {
        const field = Array.isArray(error.field) ? error.field.join('.') : error.field;
        return `  ${field ? `${field}: ` : ''}${error.message}${error.code ? ` (${error.code})` : ''}`;
      })
    );
  }

  return payload;
}

/**
 * Confirm the credentials work, and report which store is about to be
 * written to.
 *
 * Printing the shop name before anything is created is a deliberate
 * safeguard: it is the last chance to notice that .env is still pointing at
 * the wrong store.
 *
 * @returns {Promise<{name: string, myshopifyDomain: string, plan: object}>}
 */
export async function verifyShop() {
  const data = await graphql(
    `
      query ShopInfo {
        shop {
          name
          myshopifyDomain
          currencyCode
          plan {
            displayName
            partnerDevelopment
          }
        }
      }
    `,
    {},
    'shop'
  );

  return data.shop;
}

/**
 * True when the target looks like a demo or development store.
 *
 * §12.8 gates every destructive operation on this. The check is deliberately
 * crude and deliberately conservative — a domain that does not obviously say
 * "demo" or "dev" is treated as production, because the cost of a false
 * negative is an inconvenience and the cost of a false positive is someone
 * else's catalogue.
 *
 * @param {object} [shop] the result of verifyShop(), when available
 * @returns {boolean}
 */
export function isDisposableStore(shop) {
  const domain = (shop?.myshopifyDomain || STORE).toLowerCase();
  if (/demo|dev|test|staging|sandbox/.test(domain)) return true;
  return Boolean(shop?.plan?.partnerDevelopment);
}
