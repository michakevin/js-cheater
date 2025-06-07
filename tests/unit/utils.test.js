/* global describe, test, expect */
import { tryParse } from "../../src/popup/utils.js";

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
