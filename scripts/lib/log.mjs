/**
 * log.mjs — console output for the seeding scripts.
 *
 * Seeding is a long, mostly silent process that talks to someone else's store.
 * The output has one job: when a run goes wrong at product six of eight, the
 * scrollback has to say what was created, what was skipped, and where it
 * stopped — without the operator re-reading the script to find out.
 *
 * Colour is applied only when stdout is a TTY and NO_COLOR is unset, so piping
 * to a file produces plain text.
 */

const useColour = process.stdout.isTTY && !process.env.NO_COLOR;

const ESC = String.fromCharCode(27);

/**
 * @param {string} code
 * @param {string} text
 * @returns {string}
 */
function paint(code, text) {
  // Built from a char code rather than written as a literal escape, so the
  // source stays readable in any editor and cannot be mangled by a tool that
  // normalises control characters on save.
  return useColour ? ESC + '[' + code + 'm' + text + ESC + '[0m' : text;
}

const dim = (text) => paint('2', text);
const red = (text) => paint('31', text);
const green = (text) => paint('32', text);
const yellow = (text) => paint('33', text);
const blue = (text) => paint('36', text);
const bold = (text) => paint('1', text);

let indent = 0;
const pad = () => '  '.repeat(indent);

export const log = {
  /** A numbered script starting. @param {string} title */
  banner(title) {
    console.log('');
    console.log(bold(title));
    console.log(dim('-'.repeat(title.length)));
  },

  /** A phase within a script. @param {string} message */
  step(message) {
    console.log(`${pad()}${blue('>')} ${message}`);
  },

  /** Something was created. @param {string} message */
  created(message) {
    console.log(`${pad()}${green('+')} ${message}`);
  },

  /**
   * Something already existed and was left alone. Distinct from `created` on
   * purpose: a second run should print a screen of these and nothing else,
   * which is the fastest way to confirm the scripts are idempotent.
   * @param {string} message
   */
  skipped(message) {
    console.log(`${pad()}${dim('=')} ${dim(message)}`);
  },

  /** @param {string} message */
  info(message) {
    console.log(`${pad()}${dim(message)}`);
  },

  /** @param {string} message */
  warn(message) {
    console.warn(`${pad()}${yellow('!')} ${message}`);
  },

  /** @param {string} message */
  error(message) {
    console.error(`${pad()}${red('x')} ${message}`);
  },

  /** @param {string} message */
  success(message) {
    console.log('');
    console.log(`${green('OK')} ${message}`);
  },

  /** Run `fn` with one extra level of indentation. */
  async group(title, fn) {
    this.step(title);
    indent += 1;
    try {
      return await fn();
    } finally {
      indent -= 1;
    }
  },
};

/**
 * Stop the run with a message the operator can act on.
 *
 * Seeding writes to a real store, so a half-understood failure is worse than a
 * stopped one: continuing past a missing token or an unreadable media map
 * produces a store that is partly seeded and a media map that lies.
 *
 * @param {string} message
 * @param {string[]} [hints] what to do about it
 * @returns {never}
 */
export function fail(message, hints = []) {
  console.error('');
  console.error(red(`x ${message}`));
  hints.forEach((hint) => console.error(dim(`  ${hint}`)));
  console.error('');
  process.exit(1);
}

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
