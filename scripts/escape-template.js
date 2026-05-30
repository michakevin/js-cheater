/**
 * Escape a string for safe embedding inside a JS template literal.
 *
 * Order matters: backslashes must be doubled FIRST, otherwise the backslashes
 * added when escaping backticks and `${` would themselves get doubled. This
 * covers backslashes anywhere in the input (e.g. regexes with \d, \s), not just
 * in a single pre-processed file.
 *
 * @param {string} str
 * @returns {string}
 */
export function escapeForTemplate(str) {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\$\{/g, "\\${");
}
