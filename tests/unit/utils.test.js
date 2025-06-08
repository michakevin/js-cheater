/* global describe, test, expect */
import { tryParse, escapeHtml, safeStringify } from "../../src/popup/utils.js";

describe("tryParse", () => {
  test("returns parsed object for JSON strings", () => {
    expect(tryParse('{"a":1}')).toEqual({ a: 1 });
  });

  test("returns original value if not JSON", () => {
    expect(tryParse("42")).toBe(42);
    expect(tryParse("foo")).toBe("foo");
  });

  test("returns empty string for empty input", () => {
    expect(tryParse("")).toBe("");
  });
});

describe("escapeHtml", () => {
  test("escapes special characters", () => {
    expect(escapeHtml("<>&'\"")).toBe("&lt;&gt;&amp;&#39;&quot;");
  });
});

describe("safeStringify", () => {
  test("handles objects and primitives", () => {
    expect(safeStringify({ a: 1 })).toBe('{"a":1}');
    expect(safeStringify(42)).toBe("42");
    expect(safeStringify("foo")).toBe('"foo"');
    expect(safeStringify(undefined)).toBe("undefined");
  });

  test("returns [unserializable] for circular structures", () => {
    const a = {};
    a.self = a;
    expect(safeStringify(a)).toBe("[unserializable]");
  });
});
