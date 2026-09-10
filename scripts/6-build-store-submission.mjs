// scripts/6-build-store-submission.mjs
//
// Produces a Theme Store submission copy of the theme in
// store-submission-build/, separate from the working repo.
//
// Historically this script's job was to blank shopify:// references before
// submission — the working repo used to carry them (§12 wired the demo
// store's own uploaded Files into templates/index.json and
// sections/header-group.json by filename) and Shopify's review install has
// none of those Files uploaded. As of the 2026-09-10 resubmission fixes
// (T1-T2), the working repo no longer carries any shopify:// reference at
// all, so the strip step below now finds nothing to strip on every ordinary
// run — it stays as a safety net rather than dead code, since a future
// section that reintroduces one would otherwise ship it straight to
// submission unnoticed.
//
// Usage: node scripts/6-build-store-submission.mjs

import { existsSync, mkdirSync, readdirSync, statSync, copyFileSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'store-submission-build');

// Exactly the folders/files Shopify's own theme structure expects — the
// dev-only tooling (scripts/, demo-store-export/, docs) never belonged in a
// submission zip in the first place.
//
// No listings/ entry: that would only be needed if the theme shipped more
// than one preset. It briefly did (2026-09-04, "Fernway Night"), but that
// preset differed from "Loam" only by colour — Shopify doesn't count a
// colour swap as real differentiation, and each preset needs its own demo
// store to list. Collapsed back to a single "Loam" preset; see T4 in
// CLAUDE-TASKS-theme-store-fixes.md.
const THEME_PATHS = ['assets', 'config', 'layout', 'locales', 'sections', 'snippets', 'templates'];

function copyDir(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    const srcPath = path.join(src, entry);
    const destPath = path.join(dest, entry);
    if (statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

function walkAndStrip(value, filePath, stripped) {
  if (typeof value === 'string') {
    return value.startsWith('shopify://') ? '' : value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => walkAndStrip(entry, filePath, stripped));
  }
  if (value && typeof value === 'object') {
    const result = {};
    for (const [key, entry] of Object.entries(value)) {
      const next = walkAndStrip(entry, filePath, stripped);
      if (typeof entry === 'string' && entry.startsWith('shopify://') && next === '') {
        stripped.push(`${filePath}: ${key} (was ${entry})`);
      }
      result[key] = next;
    }
    return result;
  }
  return value;
}

// Shopify's own settings_data.json ships a leading /* ... */ comment (see
// the file itself) that plain JSON.parse rejects, so it has to come off
// before parsing — this only strips a comment at the very start of the
// file, never anything inside a string value.
function parseShopifyJson(raw) {
  return JSON.parse(raw.replace(/^\s*\/\*[\s\S]*?\*\/\s*/, ''));
}

function processJsonFile(filePath, stripped) {
  const raw = readFileSync(filePath, 'utf8');
  let data;
  try {
    data = parseShopifyJson(raw);
  } catch {
    return; // not JSON (e.g. gift_card.liquid) — leave untouched
  }
  const next = walkAndStrip(data, path.relative(outDir, filePath), stripped);
  writeFileSync(filePath, JSON.stringify(next, null, 2) + '\n', 'utf8');
}

function forEachJsonFile(dir, callback) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      forEachJsonFile(full, callback);
    } else if (entry.endsWith('.json')) {
      callback(full);
    }
  }
}

function main() {
  if (existsSync(outDir)) {
    rmSync(outDir, { recursive: true, force: true });
  }

  for (const name of THEME_PATHS) {
    const src = path.join(root, name);
    if (existsSync(src)) {
      copyDir(src, path.join(outDir, name));
    }
  }

  const stripped = [];
  forEachJsonFile(path.join(outDir, 'templates'), (f) => processJsonFile(f, stripped));
  forEachJsonFile(path.join(outDir, 'sections'), (f) => processJsonFile(f, stripped));

  console.log(`Wrote submission build to ${path.relative(root, outDir)}/`);
  console.log(`Stripped ${stripped.length} shopify:// reference(s):`);
  for (const line of stripped) {
    console.log(`  - ${line}`);
  }
  console.log('\nNext: run "shopify theme check" and "shopify theme package" from inside store-submission-build/.');
}

main();
