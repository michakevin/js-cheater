/* global describe, test, expect, beforeEach */
import { loadFromStorage, saveToStorage } from "../../src/popup/storage-utils.js";

describe("storage utils", () => {
  const key = "_test_key_";

  beforeEach(() => {
    localStorage.clear();
  });

  test("loadFromStorage parses stored JSON", () => {
    localStorage.setItem(key, '{"a":1}');
    expect(loadFromStorage(key)).toEqual({ a: 1 });
  });

  test("loadFromStorage returns empty object for invalid JSON", () => {
    localStorage.setItem(key, "not-json");
    expect(loadFromStorage(key)).toEqual({});
  });

  test("saveToStorage stores stringified value", () => {
    saveToStorage(key, { b: 2 });
    expect(localStorage.getItem(key)).toBe('{"b":2}');
  });
});
