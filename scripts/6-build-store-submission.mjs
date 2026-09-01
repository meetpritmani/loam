// scripts/6-build-store-submission.mjs
//
// Produces a Theme Store submission copy of the theme in
// store-submission-build/, separate from the working repo.
//
// Shopify's Theme Store install-experience requirement says to avoid
// shopify:// URLs in shipped config/template JSON — they're how build spec
// §12 wires the demo store's own uploaded Files into templates/index.json
// and sections/header-group.json by filename, which is exactly what the
// demo store and the TemplateMonster/Gumroad listings need. The working
// repo has to keep those refs. This script never edits the repo; it copies
// the theme folders out, blanks every shopify:// value in the copy, and
// turns settings.demo_images off there so no section attempts a Files
// lookup at all on Shopify's own review install. image-fallback.liquid
// already falls through cleanly to a placeholder when image/fallback are
// unset (§6), so blanking is sufficient — nothing else needs to change for
// the theme to render correctly with an empty catalogue and no uploads.
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

  // demo_images defaults to true in the working repo (build spec §6) so the
  // demo store and the marketplace listings show real imagery. Shopify's own
  // review install has none of those Files uploaded, so leave it on would
  // just mean every fallback attempt fails and falls through anyway — but
  // turning it off here removes the wasted attempt and keeps the submission
  // build's intent explicit: this copy renders on an empty store, honestly.
  const settingsPath = path.join(outDir, 'config', 'settings_data.json');
  if (existsSync(settingsPath)) {
    const settings = parseShopifyJson(readFileSync(settingsPath, 'utf8'));
    if (settings.current && typeof settings.current === 'object' && !Array.isArray(settings.current)) {
      settings.current.demo_images = false;
    }
    for (const preset of Object.values(settings.presets || {})) {
      preset.demo_images = false;
    }
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
  }

  console.log(`Wrote submission build to ${path.relative(root, outDir)}/`);
  console.log(`Stripped ${stripped.length} shopify:// reference(s):`);
  for (const line of stripped) {
    console.log(`  - ${line}`);
  }
  console.log('\nNext: run "shopify theme check" and "shopify theme package" from inside store-submission-build/.');
}

main();
