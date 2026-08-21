/**
 * check-secrets.mjs — refuse to commit an Admin API token.
 *
 * §12.8: "Never commit .env. Pre-commit check for `shpat_` in staged files."
 *
 * A leaked Admin token is not a tidy-up job — it is write access to a store's
 * products, files, content and themes, and it stays valid until someone
 * notices and revokes it. Git history makes it permanent.
 *
 * Run manually:   npm run check:secrets
 * Or as a hook:   git config core.hooksPath .githooks
 *
 * Scans staged content, not the working tree, so it catches exactly what is
 * about to become permanent.
 */

import { execFileSync } from 'node:child_process';
import { log } from './lib/log.mjs';

/**
 * Patterns worth stopping a commit for. Each is a credential that grants
 * access on its own, rather than an identifier that merely names something.
 */
const PATTERNS = [
  { name: 'Shopify Admin API access token', re: /shpat_[a-fA-F0-9]{32}/ },
  { name: 'Shopify Storefront API token', re: /shpss_[a-fA-F0-9]{32}/ },
  { name: 'Shopify custom app secret', re: /shpca_[a-fA-F0-9]{32}/ },
  { name: 'Shopify partner API token', re: /shppa_[a-fA-F0-9]{32}/ },
  { name: 'Generic private key block', re: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
];

/** @returns {string[]} */
function stagedFiles() {
  try {
    return execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
      encoding: 'utf8',
    })
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    // Not a git repository, or git is unavailable. Nothing to check.
    return [];
  }
}

/**
 * The staged content of a file — `:0:path` reads the index, not the working
 * tree. Reading from disk instead would miss a token that was staged and then
 * edited out locally, which is precisely the case worth catching.
 * @param {string} file
 * @returns {string}
 */
function stagedContent(file) {
  try {
    return execFileSync('git', ['show', `:0:${file}`], {
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch {
    return '';
  }
}

const files = stagedFiles();
const findings = [];

files.forEach((file) => {
  // .env is never committable regardless of content.
  if (/(^|\/)\.env$/.test(file)) {
    findings.push({ file, what: '.env must never be committed' });
    return;
  }

  const content = stagedContent(file);
  if (!content) return;

  PATTERNS.forEach(({ name, re }) => {
    if (re.test(content)) findings.push({ file, what: name });
  });
});

if (findings.length === 0) {
  log.success(`No credentials in ${files.length} staged file${files.length === 1 ? '' : 's'}.`);
  process.exit(0);
}

log.banner('Blocked');
findings.forEach(({ file, what }) => log.error(`${file}: ${what}`));
console.error('');
console.error('Unstage the file, remove the credential, and rotate it — assume');
console.error('anything that reached the index is already compromised.');
console.error('');
console.error('  git restore --staged <file>');
console.error('');
console.error('Shopify tokens are rotated from the demo store admin:');
console.error('  Settings -> Apps and sales channels -> Develop apps -> your app');
console.error('  -> API credentials -> Uninstall, then reinstall.');
console.error('');

process.exit(1);
