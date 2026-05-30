import { escapeForTemplate } from "../../scripts/escape-template.js";

/**
 * Reproduce what the build does: embed the escaped string into a template
 * literal and evaluate it, then assert it matches the original input exactly.
 */
function roundTrip(input) {
  const escaped = escapeForTemplate(input);
  return eval("`" + escaped + "`");
}

describe("escapeForTemplate", () => {
  test("round-trips plain text", () => {
    const src = "const a = 1;\nfunction f() { return a; }";
    expect(roundTrip(src)).toBe(src);
  });

  test("round-trips backslashes anywhere (e.g. regexes with \\d, \\s)", () => {
    const src = 'const re = /\\d+\\s*/g;\nconst back = "\\\\path";';
    expect(roundTrip(src)).toBe(src);
  });

  test("round-trips backticks and template placeholders", () => {
    const src = "const t = `hello ${name}`;";
    expect(roundTrip(src)).toBe(src);
  });

  test("round-trips a backslash directly before a backtick", () => {
    const src = "a\\`b";
    expect(roundTrip(src)).toBe(src);
  });
});
