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
  test("escapes <, &, and ' characters", () => {
    expect(escapeHtml("<")).toBe("&lt;");
    expect(escapeHtml("&")).toBe("&amp;");
    expect(escapeHtml("'")).toBe("&#39;");
    expect(escapeHtml("Tom & Jerry <3")).toBe("Tom &amp; Jerry &lt;3");
  });
});

describe("safeStringify", () => {
  test("stringifies objects and primitive values", () => {
    expect(safeStringify({ a: 1 })).toBe('{"a":1}');
    expect(safeStringify(42)).toBe("42");
    expect(safeStringify("foo")).toBe('"foo"');
  });

  test("returns [unserializable] for circular references", () => {
    const obj = {};
    obj.self = obj;
    expect(safeStringify(obj)).toBe("[unserializable]");
  });
});
