#!/usr/bin/env node
/**
 * check-contrast.mjs — WCAG 2.1 contrast audit of every shipped colour scheme.
 *
 * §8 makes AA on "all default combinations" a release gate, and §9.6 calls a
 * CTA that fails contrast a CRO defect rather than only an accessibility one.
 * Both presets in config/settings_data.json ship as merchant-visible theme
 * styles, so both have to pass — a dark preset that was never measured is the
 * usual place a theme loses its Theme Store review.
 *
 * Checks, per scheme, the pairs the theme actually renders:
 *
 *   text / background         AA normal text (4.5)
 *   text / surface            cards, drawers, inputs sit on surface
 *   accent / background       link hover, focus ring, route icons
 *   accent / surface
 *   signal / background       sale price
 *   signal / surface
 *   button_label / button     the primary CTA
 *
 * Derived tints are mixed against the background in theme-tokens.liquid, so
 * they are measured at their mix ratios too. --c-ink-70 is the only muted
 * text tint and is held to 4.5. --c-ink-45 carries no text at all — it is
 * reserved for disabled controls, decorative icons, and separator glyphs,
 * every one of which WCAG 1.4.3 / 1.4.11 exempts, so it is reported as
 * advisory and cannot fail the run. If a new rule puts text on ink-45, that
 * is the bug; do not relax this script.
 *
 * Usage:  node scripts/check-contrast.mjs [--json]
 * Exit 1 on any required failure, so it can gate a release.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const AA_NORMAL = 4.5;
const AA_LARGE = 3.0;

/* --- colour maths ------------------------------------------------------- */

function parseHex(hex) {
  const value = String(hex).trim().replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value;
  if (!/^[0-9a-f]{6}$/i.test(full)) throw new Error(`Not a hex colour: ${hex}`);
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}

function relativeLuminance(rgb) {
  const [r, g, b] = rgb.map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a, b) {
  const la = relativeLuminance(parseHex(a));
  const lb = relativeLuminance(parseHex(b));
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Liquid's `color_mix` at `weight`% of `a` over `b`, in sRGB, as Shopify does it. */
function mix(a, b, weight) {
  const ca = parseHex(a);
  const cb = parseHex(b);
  const w = weight / 100;
  const out = ca.map((channel, i) => Math.round(channel * w + cb[i] * (1 - w)));
  return `#${out.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

/* --- the pairs the theme renders --------------------------------------- */

function pairsFor(scheme) {
  const s = scheme;
  return [
    { name: 'text on background', fg: s.text, bg: s.background, min: AA_NORMAL },
    { name: 'text on surface', fg: s.text, bg: s.surface, min: AA_NORMAL },
    { name: 'accent on background', fg: s.accent, bg: s.background, min: AA_NORMAL },
    { name: 'accent on surface', fg: s.accent, bg: s.surface, min: AA_NORMAL },
    { name: 'signal on background', fg: s.signal, bg: s.background, min: AA_NORMAL },
    { name: 'signal on surface', fg: s.signal, bg: s.surface, min: AA_NORMAL },
    { name: 'button label on button', fg: s.button_label, bg: s.button, min: AA_NORMAL },
    {
      name: 'ink-70 on background',
      fg: mix(s.text, s.background, 70),
      bg: s.background,
      min: AA_NORMAL,
    },
    {
      name: 'ink-45 on background (disabled + decorative only)',
      fg: mix(s.text, s.background, 45),
      bg: s.background,
      min: AA_LARGE,
      advisory: true,
    },
  ];
}

/* --- run --------------------------------------------------------------- */

// Shopify prefixes settings_data.json with a /* ... */ comment (see the file
// itself) that plain JSON.parse rejects — has to come off first.
const settingsRaw = readFileSync(join(root, 'config', 'settings_data.json'), 'utf8');
const data = JSON.parse(settingsRaw.replace(/^\s*\/\*[\s\S]*?\*\/\s*/, ''));

const styles = [['current', data.current]];
for (const [name, preset] of Object.entries(data.presets ?? {})) {
  styles.push([`preset: ${name}`, preset]);
}

const results = [];
let failures = 0;

for (const [styleName, style] of styles) {
  for (const [schemeName, scheme] of Object.entries(style.color_schemes ?? {})) {
    for (const pair of pairsFor(scheme.settings)) {
      const value = ratio(pair.fg, pair.bg);
      const pass = value >= pair.min;
      const advisory = pair.advisory === true;
      if (!pass && !advisory) failures += 1;
      results.push({
        style: styleName,
        scheme: schemeName,
        pair: pair.name,
        foreground: pair.fg,
        background: pair.bg,
        ratio: Math.round(value * 100) / 100,
        required: pair.min,
        advisory,
        pass,
      });
    }
  }
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ failures, results }, null, 2));
} else {
  let lastGroup = '';
  for (const r of results) {
    const group = `${r.style} / ${r.scheme}`;
    if (group !== lastGroup) {
      console.log(`\n${group}`);
      lastGroup = group;
    }
    const mark = r.pass ? 'PASS' : r.advisory ? 'NOTE' : 'FAIL';
    console.log(
      `  ${mark}  ${r.ratio.toFixed(2).padStart(6)}:1  (needs ${r.required})  ${r.pair}` +
        `  ${r.foreground} on ${r.background}`
    );
  }
  const required = results.filter((r) => !r.advisory);
  console.log(
    `\n${required.length - failures}/${required.length} required pairs pass.${failures ? ` ${failures} failing.` : ''}` +
      ` ${results.length - required.length} advisory pairs reported.`
  );
}

process.exit(failures ? 1 : 0);
