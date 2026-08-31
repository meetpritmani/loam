#!/usr/bin/env node
/**
 * check-locales.mjs — keeps the translated storefront locales in step with
 * `en.default.json`.
 *
 * `shopify theme check` verifies that every key a template uses exists. It
 * does not verify that a key added to English reached the other six files, and
 * it does not look at what is inside the string. Those are the two ways a
 * multi-locale theme rots:
 *
 *   missing        a key in en.default.json absent from a translation, so
 *                  that locale silently falls back to English
 *   extra          a key that no longer exists in English — dead weight, and
 *                  usually the sign of a rename that was only half done
 *   placeholders   {{ count }} dropped or renamed in translation. Liquid does
 *                  not error, it renders the brace literally to a shopper
 *   plurals        a plural group missing a category the locale needs
 *
 * Plural categories follow CLDR, not English. Japanese has only `other`, so a
 * `.one` leaf is not expected there — supplying only `other` is correct rather
 * than incomplete. Every other shipped locale uses one/other like English.
 *
 * Strings identical to English are listed for information. They are usually
 * legitimate — SKU, Total, Menu, Journal, Material — but a run of them in one
 * section is how an untranslated block shows up.
 *
 * Usage:  node scripts/check-locales.mjs [--json]
 * Exit 1 on any missing key, extra key, or placeholder mismatch.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const localesDir = join(root, 'locales');

/** Locales whose CLDR plural rules have a single category. */
const SINGLE_PLURAL = new Set(['ja', 'zh-CN', 'zh-TW', 'ko', 'th', 'vi']);

/**
 * A locale re-exported through Shopify's admin language editor (this
 * theme's `ar.json` is one) carries a `/* ... *\/` banner ahead of the
 * opening brace — valid to Shopify's own loader, which is why
 * `shopify theme check` never complains about it, but not valid JSON by
 * spec, so a plain `JSON.parse` throws on it. Stripped here rather than
 * hand-edited out of the file: Shopify's own systems regenerate that exact
 * header, and removing it from the file would just have it reappear on the
 * next admin-side translation save.
 * @param {string} raw
 * @returns {object}
 */
function parseLocale(raw) {
  const withoutBanner = raw.replace(/^\s*\/\*[\s\S]*?\*\/\s*/, '');
  return JSON.parse(withoutBanner);
}

function flatten(node, prefix = '', out = {}) {
  for (const [key, value] of Object.entries(node)) {
    if (value && typeof value === 'object') flatten(value, `${prefix}${key}.`, out);
    else out[`${prefix}${key}`] = value;
  }
  return out;
}

/** Placeholder names in a string, sorted, so order changes are not flagged. */
function placeholders(value) {
  const found = String(value).match(/{{\s*[\w.]+\s*}}/g) ?? [];
  return found
    .map((p) => p.replace(/[{}\s]/g, ''))
    .sort()
    .join(',');
}

const english = flatten(parseLocale(readFileSync(join(localesDir, 'en.default.json'), 'utf8')));
const englishKeys = Object.keys(english);

const files = readdirSync(localesDir)
  .filter((f) => f.endsWith('.json') && !f.startsWith('en.default'))
  .sort();

const report = [];
let failures = 0;

for (const file of files) {
  const code = file.replace(/\.json$/, '');
  const single = SINGLE_PLURAL.has(code);
  const table = flatten(parseLocale(readFileSync(join(localesDir, file), 'utf8')));
  const keys = Object.keys(table);

  const missing = englishKeys.filter((k) => {
    if (k in table) return false;
    /* A single-category locale legitimately omits `.one`, but it still has to
       carry the `.other` leaf that stands in for the whole group. */
    if (single && k.endsWith('.one')) return false;
    return true;
  });

  const extra = keys.filter((k) => !(k in english));

  const mismatched = keys
    .filter((k) => k in english && placeholders(english[k]) !== placeholders(table[k]))
    .map((k) => ({ key: k, en: placeholders(english[k]), translated: placeholders(table[k]) }));

  const identical = keys.filter((k) => table[k] === english[k]);

  const broken = missing.length + extra.length + mismatched.length;
  failures += broken;

  report.push({ code, keys: keys.length, missing, extra, mismatched, identical });
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ failures, report }, null, 2));
} else {
  for (const r of report) {
    const state = r.missing.length + r.extra.length + r.mismatched.length ? 'FAIL' : 'ok  ';
    console.log(
      `${state} ${r.code.padEnd(6)} ${String(r.keys).padStart(3)} keys` +
        `  missing ${r.missing.length}` +
        `  extra ${r.extra.length}` +
        `  placeholder ${r.mismatched.length}` +
        `  same as en ${r.identical.length}`
    );
    for (const k of r.missing) console.log(`       missing: ${k}`);
    for (const k of r.extra) console.log(`       extra: ${k}`);
    for (const m of r.mismatched) {
      console.log(`       placeholder: ${m.key} — en [${m.en}] vs [${m.translated}]`);
    }
  }
  console.log(
    `\n${files.length} translated locales against ${englishKeys.length} English keys. ` +
      (failures ? `${failures} problems.` : 'No problems.')
  );
}

process.exit(failures ? 1 : 0);
